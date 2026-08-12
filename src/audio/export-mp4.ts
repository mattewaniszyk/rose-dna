import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
	clamp,
	getMediaEncoder,
	renderSequenceAudio,
	resetMediaEncoder,
	stringifyUnknownError,
	throwIfAborted,
	type MediaExportProgress,
} from "./export-media";
import type { GenomicMusicSequence } from "./types";
import {
	DEFAULT_VIDEO_ASPECT_RATIO,
	DEFAULT_VIDEO_QUALITY_PRESET,
	VIDEO_ASPECT_RATIO_CONFIGS,
	VIDEO_QUALITY_CONFIGS,
	type VideoAspectRatio,
	type VideoCaptureRequest,
	type VideoCaptureSession,
	type VideoQualityPreset,
} from "./video-export-options";

const VIDEO_FRAME_RATE = 30;
const PROGRESS_UPDATE_INTERVAL_FRAMES = 6;
const VIDEO_MIME_TYPES = [
	"video/webm;codecs=vp9",
	"video/webm;codecs=vp8",
] as const;

export type Mp4ExportProgress = MediaExportProgress;

type Mp4ExportOptions = {
	aspectRatio?: VideoAspectRatio;
	quality?: VideoQualityPreset;
	signal?: AbortSignal;
	onProgress?: (progress: Mp4ExportProgress) => void;
	prepareScene: (
		request: VideoCaptureRequest,
		signal?: AbortSignal,
	) => Promise<VideoCaptureSession>;
};

type RecordCanvasOptions = {
	durationSeconds: number;
	energyEnvelope: Float32Array;
	recordingBitRate?: number;
	signal?: AbortSignal;
	onProgress?: (progress: number) => void;
};

type ManualCanvasCaptureTrack = MediaStreamTrack & {
	requestFrame?: () => void;
};

export function getSupportedVideoMimeType() {
	if (
		typeof MediaRecorder === "undefined" ||
		typeof MediaRecorder.isTypeSupported !== "function"
	) {
		return null;
	}

	return (
		VIDEO_MIME_TYPES.find((mimeType) =>
			MediaRecorder.isTypeSupported(mimeType),
		) ?? null
	);
}

export function isMp4ExportSupported() {
	return (
		typeof HTMLCanvasElement !== "undefined" &&
		typeof HTMLCanvasElement.prototype.captureStream === "function" &&
		getSupportedVideoMimeType() !== null
	);
}

export function createAudioEnergyEnvelope(
	audioBuffer: AudioBuffer,
	frameRate = VIDEO_FRAME_RATE,
) {
	const frameCount = Math.max(1, Math.ceil(audioBuffer.duration * frameRate));
	const envelope = new Float32Array(frameCount);
	const samplesPerFrame = Math.max(1, Math.floor(audioBuffer.sampleRate / frameRate));
	const channels = Array.from(
		{ length: audioBuffer.numberOfChannels },
		(_, index) => audioBuffer.getChannelData(index),
	);
	let smoothed = 0;

	for (let frame = 0; frame < frameCount; frame += 1) {
		const start = frame * samplesPerFrame;
		const end = Math.min(audioBuffer.length, start + samplesPerFrame);
		let sumSquares = 0;
		let sampleCount = 0;

		for (const channel of channels) {
			for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
				const sample = channel[sampleIndex] ?? 0;
				sumSquares += sample * sample;
				sampleCount += 1;
			}
		}

		const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
		const target = clamp(rms * 4, 0, 1);
		const smoothing = target > smoothed ? 0.45 : 0.16;

		smoothed += (target - smoothed) * smoothing;
		envelope[frame] = smoothed;
	}

	return envelope;
}

function getEnvelopeEnergy(
	envelope: Float32Array,
	elapsedSeconds: number,
) {
	const index = Math.min(
		envelope.length - 1,
		Math.max(0, Math.floor(elapsedSeconds * VIDEO_FRAME_RATE)),
	);

	return envelope[index] ?? 0;
}

export async function recordCanvas(
	session: Pick<VideoCaptureSession, "canvas" | "renderFrame">,
	options: RecordCanvasOptions,
) {
	const mimeType = getSupportedVideoMimeType();
	const { canvas } = session;

	if (!mimeType || typeof canvas.captureStream !== "function") {
		throw new Error(
			"MP4 export requires a current desktop version of Chrome or Edge.",
		);
	}

	if (document.hidden) {
		throw new Error("Keep this tab visible while recording the video.");
	}

	throwIfAborted(options.signal, "MP4 export was cancelled.");

	return await new Promise<Blob>((resolve, reject) => {
		// A zero frame-rate stream only captures when requestFrame is called. This
		// decouples video time from wall time when rendering takes longer than 1/30s.
		const stream = canvas.captureStream(0);
		const videoTrack = stream.getVideoTracks()[0] as
			| ManualCanvasCaptureTrack
			| undefined;
		const chunks: Blob[] = [];
		let recorder: MediaRecorder;

		if (!videoTrack || typeof videoTrack.requestFrame !== "function") {
			for (const track of stream.getTracks()) {
				track.stop();
			}

			reject(
				new Error(
					"MP4 export requires manual canvas capture in desktop Chrome or Edge.",
				),
			);
			return;
		}

		try {
			recorder = new MediaRecorder(stream, {
				mimeType,
				videoBitsPerSecond:
					options.recordingBitRate ??
					VIDEO_QUALITY_CONFIGS[DEFAULT_VIDEO_QUALITY_PRESET].recordingBitRate,
			});
		} catch (error) {
			for (const track of stream.getTracks()) {
				track.stop();
			}

			reject(error);
			return;
		}
		let frameTimer = 0;
		let finishFrameWait: (() => void) | null = null;
		let settled = false;
		let terminalError: Error | null = null;

		const cleanup = () => {
			window.clearTimeout(frameTimer);
			finishFrameWait?.();
			finishFrameWait = null;
			options.signal?.removeEventListener("abort", onAbort);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			for (const track of stream.getTracks()) {
				track.stop();
			}
		};

		const settleWithError = (error: Error) => {
			if (settled) {
				return;
			}

			terminalError = error;

			if (recorder.state === "inactive") {
				settled = true;
				cleanup();
				reject(error);
			} else {
				recorder.stop();
			}
		};

		const onAbort = () => {
			settleWithError(
				options.signal?.reason instanceof Error
					? options.signal.reason
					: new DOMException("MP4 export was cancelled.", "AbortError"),
			);
		};

		const onVisibilityChange = () => {
			if (document.hidden) {
				settleWithError(
					new Error("Video export stopped because the tab was hidden."),
				);
			}
		};

		const waitUntil = (deadline: number) => {
			return new Promise<void>((resolveWait) => {
				const finish = () => {
					if (finishFrameWait !== finish) {
						return;
					}

					finishFrameWait = null;
					resolveWait();
				};

				finishFrameWait = finish;
				frameTimer = window.setTimeout(
					finish,
					Math.max(0, deadline - performance.now()),
				);
			});
		};

		const captureFrames = async () => {
			const frameCount = Math.max(
				1,
				Math.ceil(options.durationSeconds * VIDEO_FRAME_RATE),
			);
			const frameDurationMs = 1_000 / VIDEO_FRAME_RATE;
			const startedAt = performance.now();

			try {
				for (let frame = 0; frame < frameCount; frame += 1) {
					if (frame > 0) {
						await waitUntil(startedAt + frame * frameDurationMs);
					}

					if (settled) {
						return;
					}

					throwIfAborted(options.signal, "MP4 export was cancelled.");

					const elapsedSeconds = frame / VIDEO_FRAME_RATE;
					session.renderFrame(
						elapsedSeconds,
						getEnvelopeEnergy(options.energyEnvelope, elapsedSeconds),
					);
					videoTrack.requestFrame?.();

					const completedFrames = frame + 1;
					if (
						completedFrames < frameCount &&
						completedFrames % PROGRESS_UPDATE_INTERVAL_FRAMES === 0
					) {
						options.onProgress?.(completedFrames / frameCount);
					}
				}

				// Hold the final requested frame for one frame interval so the native
				// recorder has a task boundary in which to enqueue it before stop().
				await waitUntil(startedAt + frameCount * frameDurationMs);

				if (settled) {
					return;
				}

				if (recorder.state !== "inactive") {
					recorder.stop();
				}
			} catch (error) {
				settleWithError(
					error instanceof Error
						? error
						: new Error("The browser could not capture the scene frames."),
				);
			}
		};

		recorder.addEventListener("dataavailable", (event) => {
			if (event.data.size > 0) {
				chunks.push(event.data);
			}
		});
		recorder.addEventListener("error", () => {
			settleWithError(new Error("The browser could not record the scene."));
		});
		recorder.addEventListener("start", () => {
			void captureFrames();
		});
		recorder.addEventListener("stop", () => {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();

			if (terminalError) {
				reject(terminalError);
				return;
			}

			if (chunks.length === 0) {
				reject(new Error("The browser returned an empty video recording."));
				return;
			}

			options.onProgress?.(1);
			resolve(new Blob(chunks, { type: mimeType }));
		});

		options.signal?.addEventListener("abort", onAbort, { once: true });
		document.addEventListener("visibilitychange", onVisibilityChange);
		options.onProgress?.(0);

		try {
			recorder.start(1_000);
		} catch (error) {
			settleWithError(
				error instanceof Error
					? error
					: new Error("The browser could not start recording the scene."),
			);
		}
	});
}

function looksLikeMp4(output: Uint8Array) {
	return (
		output.length >= 12 &&
		output[4] === 0x66 &&
		output[5] === 0x74 &&
		output[6] === 0x79 &&
		output[7] === 0x70
	);
}

export async function exportSequenceToMp4(
	sequence: GenomicMusicSequence,
	options: Mp4ExportOptions,
) {
	if (!isMp4ExportSupported()) {
		throw new Error(
			"MP4 export requires a current desktop version of Chrome or Edge.",
		);
	}

	let ffmpeg: FFmpeg | null = null;
	let captureSession: VideoCaptureSession | null = null;
	const aspectRatio = options.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO;
	const output = VIDEO_ASPECT_RATIO_CONFIGS[aspectRatio];
	const quality =
		VIDEO_QUALITY_CONFIGS[
			options.quality ?? DEFAULT_VIDEO_QUALITY_PRESET
		];

	try {
		options.onProgress?.({ stage: "rendering-audio", progress: 0 });
		const { audioBuffer, wavData } = await renderSequenceAudio(sequence, {
			channels: 2,
			sampleRate: 44_100,
			signal: options.signal,
		});
		const energyEnvelope = createAudioEnergyEnvelope(audioBuffer);
		options.onProgress?.({ stage: "rendering-audio", progress: 1 });

		options.onProgress?.({ stage: "preparing-scene", progress: 0 });
		captureSession = await options.prepareScene(
			{
				width: output.width,
				height: output.height,
				maxPixelRatio: quality.maxPixelRatio,
			},
			options.signal,
		);
		throwIfAborted(options.signal, "MP4 export was cancelled.");
		options.onProgress?.({ stage: "preparing-scene", progress: 1 });

		options.onProgress?.({ stage: "recording-video", progress: 0 });
		const recording = await recordCanvas(captureSession, {
			durationSeconds: sequence.runtimeSeconds,
			energyEnvelope,
			recordingBitRate: quality.recordingBitRate,
			signal: options.signal,
			onProgress: (progress) =>
				options.onProgress?.({ stage: "recording-video", progress }),
		});

		captureSession.release();
		captureSession = null;
		throwIfAborted(options.signal, "MP4 export was cancelled.");

		options.onProgress?.({ stage: "loading-encoder", progress: 0 });
		ffmpeg = await getMediaEncoder(options.signal);
		options.onProgress?.({ stage: "loading-encoder", progress: 1 });

		const id = crypto.randomUUID();
		const videoName = `video-${id}.webm`;
		const audioName = `audio-${id}.wav`;
		const mp4Name = `output-${id}.mp4`;
		const ffmpegLogs: string[] = [];
		const onLog = ({ message }: { message: string }) => {
			ffmpegLogs.push(message);

			if (ffmpegLogs.length > 16) {
				ffmpegLogs.shift();
			}
		};
		const onEncoderProgress = ({ progress }: { progress: number }) => {
			options.onProgress?.({
				stage: "encoding-mp4",
				progress: clamp(progress, 0, 1),
			});
		};

		ffmpeg.on("log", onLog);
		ffmpeg.on("progress", onEncoderProgress);

		try {
			await ffmpeg.writeFile(
				videoName,
				new Uint8Array(await recording.arrayBuffer()),
				{ signal: options.signal },
			);
			await ffmpeg.writeFile(audioName, wavData, { signal: options.signal });
			options.onProgress?.({ stage: "encoding-mp4", progress: 0 });

			const duration = sequence.runtimeSeconds.toFixed(3);
			const videoFilter = [
				`setpts=N/(${VIDEO_FRAME_RATE}*TB)`,
				`scale=${output.width}:${output.height}:force_original_aspect_ratio=increase`,
				`crop=${output.width}:${output.height}`,
				"setsar=1",
				`setdar=${aspectRatio.replace(":", "/")}`,
				`fps=${VIDEO_FRAME_RATE}`,
			].join(",");
			const resultCode = await ffmpeg.exec(
				[
					"-i",
					videoName,
					"-i",
					audioName,
					"-map",
					"0:v:0",
					"-map",
					"1:a:0",
					"-vf",
					videoFilter,
					"-c:v",
					"libx264",
					"-preset",
					quality.x264Preset,
					"-crf",
					String(quality.crf),
					"-pix_fmt",
					"yuv420p",
					"-aspect",
					aspectRatio,
					"-c:a",
					"aac",
					"-b:a",
					"192k",
					"-t",
					duration,
					"-shortest",
					mp4Name,
				],
				-1,
				{ signal: options.signal },
			);

			if (resultCode !== 0) {
				throw new Error(
					`ffmpeg failed to encode MP4 output (code ${resultCode}).`,
				);
			}

			const encodedOutput = await ffmpeg.readFile(mp4Name, "binary", {
				signal: options.signal,
			});

			if (typeof encodedOutput === "string") {
				throw new Error("Unexpected ffmpeg output payload.");
			}

			const mp4Bytes = Uint8Array.from(encodedOutput);

			if (!looksLikeMp4(mp4Bytes)) {
				throw new Error("The encoder returned an invalid or empty MP4 file.");
			}

			options.onProgress?.({ stage: "encoding-mp4", progress: 1 });
			return new Blob([mp4Bytes], { type: "video/mp4" });
		} catch (error) {
			const baseMessage = stringifyUnknownError(error);
			const logTail = ffmpegLogs.length
				? ` ffmpeg log tail: ${ffmpegLogs.join(" | ")}`
				: "";

			throw new Error(`${baseMessage}${logTail}`.trim());
		} finally {
			ffmpeg.off("log", onLog);
			ffmpeg.off("progress", onEncoderProgress);
			await Promise.allSettled([
				ffmpeg.deleteFile(videoName),
				ffmpeg.deleteFile(audioName),
				ffmpeg.deleteFile(mp4Name),
			]);
		}
	} catch (error) {
		if (ffmpeg) {
			resetMediaEncoder(ffmpeg);
		}

		throw error;
	} finally {
		captureSession?.release();
	}
}
