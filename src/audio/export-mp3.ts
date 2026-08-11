import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
	clamp,
	getMediaEncoder,
	renderSequenceAudio,
	resetMediaEncoder,
	stringifyUnknownError,
	type MediaExportProgress,
} from "./export-media";
import type { GenomicMusicSequence } from "./types";

export type Mp3ExportProgress = MediaExportProgress;

type ExportOptions = {
	bitRateKbps?: number;
	sampleRate?: number;
	channels?: 1 | 2;
	signal?: AbortSignal;
	onProgress?: (progress: Mp3ExportProgress) => void;
};

export function terminateMp3Encoder() {
	resetMediaEncoder();
}

function looksLikeMp3(output: Uint8Array) {
	if (output.length < 256) {
		return false;
	}

	if (output[0] === 0x49 && output[1] === 0x44 && output[2] === 0x33) {
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
		onProgress?.({ stage: "rendering-audio", progress: 0 });
		const { wavData } = await renderSequenceAudio(sequence, {
			channels,
			sampleRate,
			signal: options.signal,
		});
		onProgress?.({ stage: "rendering-audio", progress: 1 });

		onProgress?.({ stage: "loading-encoder", progress: 0 });
		ffmpeg = await getMediaEncoder(options.signal);
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
				stage: "encoding-mp3",
				progress: clamp(progress, 0, 1),
			});
		};

		ffmpeg.on("log", onLog);
		ffmpeg.on("progress", onEncoderProgress);

		try {
			await ffmpeg.writeFile(wavName, wavData, { signal: options.signal });
			onProgress?.({ stage: "encoding-mp3", progress: 0 });
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

			onProgress?.({ stage: "encoding-mp3", progress: 1 });
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
			resetMediaEncoder(ffmpeg);
		}

		throw error;
	}
}
