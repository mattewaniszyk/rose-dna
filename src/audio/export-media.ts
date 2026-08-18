import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { GenomicMusicSequence } from "./types";
import { renderSampledSequence } from "./sampled-voices";

export type MediaExportKind = "mp3" | "mp4";

export type MediaExportStage =
	| "rendering-audio"
	| "preparing-scene"
	| "recording-video"
	| "loading-encoder"
	| "encoding-mp3"
	| "encoding-mp4";

export type MediaExportProgress = {
	stage: MediaExportStage;
	progress: number;
};

export type RenderedSequenceAudio = {
	audioBuffer: AudioBuffer;
	wavData: Uint8Array;
};

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<void> | null = null;

export function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

export function stringifyUnknownError(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return JSON.stringify(error);
}

export function throwIfAborted(
	signal?: AbortSignal,
	fallbackMessage = "Export was cancelled.",
) {
	if (signal?.aborted) {
		throw signal.reason instanceof Error
			? signal.reason
			: new DOMException(fallbackMessage, "AbortError");
	}
}

export async function withAbortAndTimeout<T>(
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
				new DOMException("Export was cancelled.", "AbortError"),
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

export async function withPromiseTimeout<T>(
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

function resolvePublicAssetPath(assetPath: string) {
	const base = import.meta.env.BASE_URL || "/";
	const normalizedBase = base.endsWith("/") ? base : `${base}/`;
	const normalizedPath = assetPath.replace(/^\//u, "");

	return `${normalizedBase}${normalizedPath}`;
}

export function resetMediaEncoder(expectedInstance?: FFmpeg) {
	if (expectedInstance && ffmpegInstance !== expectedInstance) {
		return;
	}

	ffmpegInstance?.terminate();
	ffmpegInstance = null;
	ffmpegLoadPromise = null;
}

export async function getMediaEncoder(signal?: AbortSignal) {
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
			"Timed out while loading the media encoder runtime.",
		);
	}

	try {
		await ffmpegLoadPromise;
		return instance;
	} catch (error) {
		resetMediaEncoder(instance);
		throw error;
	}
}

function writeAscii(view: DataView, offset: number, value: string) {
	for (let index = 0; index < value.length; index += 1) {
		view.setUint8(offset + index, value.charCodeAt(index));
	}
}

export function createWavPcm16(
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

export function createWavFromAudioBuffer(
	audioBuffer: AudioBuffer,
	channels: 1 | 2 = 2,
) {
	return createWavPcm16(
		channels === 2
			? [audioBuffer.getChannelData(0), audioBuffer.getChannelData(1)]
			: [audioBuffer.getChannelData(0)],
		audioBuffer.sampleRate,
	);
}

export async function renderSequenceAudioBuffer(
	sequence: GenomicMusicSequence,
	options: {
		channels?: 1 | 2;
		sampleRate?: number;
		signal?: AbortSignal;
	},
): Promise<AudioBuffer> {
	const channels = options.channels ?? 2;
	const sampleRate = options.sampleRate ?? 44_100;
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

	throwIfAborted(options.signal);
	return rendered;
}

export async function renderSequenceAudio(
	sequence: GenomicMusicSequence,
	options: {
		channels?: 1 | 2;
		sampleRate?: number;
		signal?: AbortSignal;
	},
): Promise<RenderedSequenceAudio> {
	const channels = options.channels ?? 2;
	const audioBuffer = await renderSequenceAudioBuffer(sequence, options);

	return {
		audioBuffer,
		wavData: createWavFromAudioBuffer(audioBuffer, channels),
	};
}
