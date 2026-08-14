import type { GenomicMusicSequence } from "./types";

export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5"] as const;

export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

export const DEFAULT_VIDEO_ASPECT_RATIO: VideoAspectRatio = "16:9";

export const VIDEO_ASPECT_RATIO_CONFIGS: Record<
	VideoAspectRatio,
	{
		label: string;
		width: number;
		height: number;
	}
> = {
	"16:9": { label: "Widescreen · 1920×1080", width: 1920, height: 1080 },
	"9:16": { label: "Portrait · 1080×1920", width: 1080, height: 1920 },
	"1:1": { label: "Square · 1080×1080", width: 1080, height: 1080 },
	"4:5": { label: "Portrait · 1080×1350", width: 1080, height: 1350 },
};

export const VIDEO_QUALITY_PRESETS = [
	"standard",
	"high",
	"near-lossless",
] as const;

export type VideoQualityPreset = (typeof VIDEO_QUALITY_PRESETS)[number];

export const DEFAULT_VIDEO_QUALITY_PRESET: VideoQualityPreset = "high";

export type VideoCaptureRequest = {
	width: number;
	height: number;
	maxPixelRatio: number;
	sequence: GenomicMusicSequence;
	audioBuffer: AudioBuffer;
};

export type VideoCaptureSession = {
	canvas: HTMLCanvasElement;
	renderFrame: (elapsedSeconds: number, audioEnergy: number) => void;
	release: () => void;
};

export function getCapturePixelRatio(
	request: Pick<VideoCaptureRequest, "width" | "height" | "maxPixelRatio">,
	sourceWidth: number,
	sourceHeight: number,
) {
	const safeSourceWidth = Math.max(1, sourceWidth);
	const safeSourceHeight = Math.max(1, sourceHeight);
	const sourceAspect = safeSourceWidth / safeSourceHeight;
	const targetAspect = request.width / request.height;
	const cropWidth =
		sourceAspect > targetAspect
			? safeSourceHeight * targetAspect
			: safeSourceWidth;
	const cropHeight =
		sourceAspect > targetAspect
			? safeSourceHeight
			: safeSourceWidth / targetAspect;
	const requiredPixelRatio = Math.max(
		request.width / cropWidth,
		request.height / cropHeight,
	);

	return Math.min(
		request.maxPixelRatio,
		Math.max(1, requiredPixelRatio),
	);
}

export const VIDEO_QUALITY_CONFIGS: Record<
	VideoQualityPreset,
	{
		label: string;
		description: string;
		recordingBitRate: number;
		crf: number;
		x264Preset: "ultrafast" | "superfast";
		maxPixelRatio: number;
	}
> = {
	standard: {
		label: "Standard",
		description: "Smaller file · good for previews",
		recordingBitRate: 12_000_000,
		crf: 20,
		x264Preset: "ultrafast",
		maxPixelRatio: 1,
	},
	high: {
		label: "High",
		description: "Sharper detail · recommended",
		recordingBitRate: 32_000_000,
		crf: 12,
		x264Preset: "superfast",
		maxPixelRatio: 2,
	},
	"near-lossless": {
		label: "Near-lossless",
		description: "Maximum quality · very large file",
		recordingBitRate: 80_000_000,
		crf: 1,
		x264Preset: "ultrafast",
		maxPixelRatio: 2,
	},
};
