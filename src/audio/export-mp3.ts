import { FFmpeg } from "@ffmpeg/ffmpeg";
import {
	type GenomicMusicSequence,
} from "./types";
import { renderSampledSequence } from "./sampled-voices";

export type Mp3ExportStage = "rendering" | "loading-encoder" | "encoding";

export type Mp3ExportProgress = {
	stage: Mp3ExportStage;
	progress: number;
};

type ExportOptions = {
	bitRateKbps?: number;
	sampleRate?: number;
	channels?: 1 | 2;
	signal?: AbortSignal;
	onProgress?: (progress: Mp3ExportProgress) => void;
};

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<void> | null = null;

function resolvePublicAssetPath(assetPath: string) {
	const base = import.meta.env.BASE_URL || "/";
	const normalizedBase = base.endsWith("/") ? base : `${base}/`;
	const normalizedPath = assetPath.replace(/^\//u, "");

	return `${normalizedBase}${normalizedPath}`;
}

function stringifyUnknownError(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return JSON.stringify(error);
}

function throwIfAborted(signal?: AbortSignal) {
	if (signal?.aborted) {
		throw signal.reason instanceof Error
			? signal.reason
			: new DOMException("MP3 export was cancelled.", "AbortError");
	}
}

async function withAbortAndTimeout<T>(
	run: (signal: AbortSignal) => Promise<T>,
	externalSignal: AbortSignal | undefined,
	timeoutMs: number,
	timeoutMessage: string,
) {
	throwIfAborted(externalSignal);

	const controller = new AbortController();
	const forwardAbort = () => {
		controller.abort(
			externalSignal?.reason ??
				new DOMException("MP3 export was cancelled.", "AbortError"),
		);
	};
	const timeoutId = window.setTimeout(() => {
		controller.abort(new DOMException(timeoutMessage, "TimeoutError"));
	}, timeoutMs);

	externalSignal?.addEventListener("abort", forwardAbort, { once: true });

	try {
		return await run(controller.signal);
	} finally {
		window.clearTimeout(timeoutId);
		externalSignal?.removeEventListener("abort", forwardAbort);
	}
}

async function withPromiseTimeout<T>(
	promise: Promise<T>,
	signal: AbortSignal | undefined,
	timeoutMs: number,
	timeoutMessage: string,
) {
	return withAbortAndTimeout(
		(stageSignal) =>
			new Promise<T>((resolve, reject) => {
				const abort = () => reject(stageSignal.reason);

				stageSignal.addEventListener("abort", abort, { once: true });
				promise.then(resolve, reject).finally(() => {
					stageSignal.removeEventListener("abort", abort);
				});
			}),
		signal,
		timeoutMs,
		timeoutMessage,
	);
}

function resetFfmpeg(expectedInstance?: FFmpeg) {
	if (expectedInstance && ffmpegInstance !== expectedInstance) {
		return;
	}

	ffmpegInstance?.terminate();
	ffmpegInstance = null;
	ffmpegLoadPromise = null;
}

export function terminateMp3Encoder() {
	resetFfmpeg();
}

function writeAscii(view: DataView, offset: number, value: string) {
	for (let index = 0; index < value.length; index += 1) {
		view.setUint8(offset + index, value.charCodeAt(index));
	}
}

function createWavPcm16(
	channels: Float32Array[],
	sampleRate: number,
): Uint8Array {
	const channelCount = channels.length;
	const sampleCount = channels[0]?.length ?? 0;
	const bytesPerSample = 2;
	const blockAlign = channelCount * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const pcmByteLength = sampleCount * blockAlign;
	const buffer = new ArrayBuffer(44 + pcmByteLength);
	const view = new DataView(buffer);

	writeAscii(view, 0, "RIFF");
	view.setUint32(4, 36 + pcmByteLength, true);
	writeAscii(view, 8, "WAVE");
	writeAscii(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channelCount, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bytesPerSample * 8, true);
	writeAscii(view, 36, "data");
	view.setUint32(40, pcmByteLength, true);

	let offset = 44;

	for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
		for (
			let channelIndex = 0;
			channelIndex < channelCount;
			channelIndex += 1
		) {
			const sample = clamp(channels[channelIndex][sampleIndex] ?? 0, -1, 1);
			const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

			view.setInt16(offset, pcm, true);
			offset += bytesPerSample;
		}
	}

	return new Uint8Array(buffer);
}

async function getFfmpeg(signal?: AbortSignal) {
	if (!ffmpegInstance) {
		ffmpegInstance = new FFmpeg();
	}

	const instance = ffmpegInstance;

	if (!ffmpegLoadPromise) {
		ffmpegLoadPromise = withAbortAndTimeout(
			async (stageSignal) => {
				await instance.load(
					{
						coreURL: resolvePublicAssetPath("ffmpeg/ffmpeg-core.js"),
						wasmURL: resolvePublicAssetPath("ffmpeg/ffmpeg-core.wasm"),
					},
					{ signal: stageSignal },
				);
			},
			signal,
			90_000,
			"Timed out while loading the MP3 encoder runtime.",
		);
	}

	try {
		await ffmpegLoadPromise;
		return instance;
	} catch (error) {
		resetFfmpeg(instance);
		throw error;
	}
}

function looksLikeMp3(output: Uint8Array) {
	if (output.length < 256) {
		return false;
	}

	if (
		output[0] === 0x49 &&
		output[1] === 0x44 &&
		output[2] === 0x33
	) {
		return true;
	}

	const searchLength = Math.min(output.length - 1, 4096);

	for (let index = 0; index < searchLength; index += 1) {
		if (output[index] === 0xff && (output[index + 1] & 0xe0) === 0xe0) {
			return true;
		}
	}

	return false;
}

export async function exportSequenceToMp3(
	sequence: GenomicMusicSequence,
	options: ExportOptions = {},
) {
	const channels = options.channels ?? 2;
	const sampleRate = options.sampleRate ?? 44_100;
	const bitRateKbps = options.bitRateKbps ?? 160;
	const onProgress = options.onProgress;
	let ffmpeg: FFmpeg | null = null;

	try {
		onProgress?.({ stage: "rendering", progress: 0 });
		const renderPromise = renderSampledSequence(sequence, {
			channels,
			sampleRate,
		});
		const renderTimeoutMs = Math.min(
			300_000,
			Math.max(120_000, sequence.runtimeSeconds * 1_000 + 60_000),
		);
		const rendered = await withPromiseTimeout(
			renderPromise,
			options.signal,
			renderTimeoutMs,
			"Timed out while rendering the genomic audio.",
		);
		onProgress?.({ stage: "rendering", progress: 1 });
		throwIfAborted(options.signal);

		const wavData = createWavPcm16(
			channels === 2
				? [rendered.getChannelData(0), rendered.getChannelData(1)]
				: [rendered.getChannelData(0)],
			sampleRate,
		);

		onProgress?.({ stage: "loading-encoder", progress: 0 });
		ffmpeg = await getFfmpeg(options.signal);
		onProgress?.({ stage: "loading-encoder", progress: 1 });

		const wavName = `input-${crypto.randomUUID()}.wav`;
		const mp3Name = `output-${crypto.randomUUID()}.mp3`;
		const ffmpegLogs: string[] = [];
		const onLog = ({ message }: { message: string }) => {
			ffmpegLogs.push(message);

			if (ffmpegLogs.length > 16) {
				ffmpegLogs.shift();
			}
		};
		const onEncoderProgress = ({ progress }: { progress: number }) => {
			onProgress?.({
				stage: "encoding",
				progress: clamp(progress, 0, 1),
			});
		};

		ffmpeg.on("log", onLog);
		ffmpeg.on("progress", onEncoderProgress);

		try {
			await ffmpeg.writeFile(wavName, wavData, { signal: options.signal });
			onProgress?.({ stage: "encoding", progress: 0 });
			const encodeTimeoutMs = Math.min(
				300_000,
				Math.max(90_000, sequence.runtimeSeconds * 1_500),
			);
			const resultCode = await ffmpeg.exec(
				[
					"-i",
					wavName,
					"-vn",
					"-c:a",
					"libmp3lame",
					"-b:a",
					`${bitRateKbps}k`,
					mp3Name,
				],
				encodeTimeoutMs,
				{ signal: options.signal },
			);

			if (resultCode !== 0) {
				throw new Error(
					`ffmpeg failed to encode MP3 output (code ${resultCode}).`,
				);
			}

			const output = await ffmpeg.readFile(mp3Name, "binary", {
				signal: options.signal,
			});

			if (typeof output === "string") {
				throw new Error("Unexpected ffmpeg output payload.");
			}

			const mp3Bytes = Uint8Array.from(output);

			if (!looksLikeMp3(mp3Bytes)) {
				throw new Error("The encoder returned an invalid or empty MP3 file.");
			}

			onProgress?.({ stage: "encoding", progress: 1 });
			return new Blob([mp3Bytes], { type: "audio/mpeg" });
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
				ffmpeg.deleteFile(wavName),
				ffmpeg.deleteFile(mp3Name),
			]);
		}
	} catch (error) {
		if (ffmpeg) {
			resetFfmpeg(ffmpeg);
		}

		throw error;
	}
}
