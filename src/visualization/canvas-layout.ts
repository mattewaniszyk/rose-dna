import type { VisualLayoutPreset } from "./types";

export type CanvasPixelSize = {
	height: number;
	width: number;
};

export type NormalizedVisualRect = {
	height: number;
	width: number;
	x: number;
	y: number;
};

export function getSquareContainedRect(
	rect: NormalizedVisualRect,
	viewportWidth: number,
	viewportHeight: number,
): NormalizedVisualRect {
	const pixelWidth = rect.width * viewportWidth;
	const pixelHeight = rect.height * viewportHeight;
	const side = Math.min(pixelWidth, pixelHeight);
	const width = side / Math.max(1, viewportWidth);
	const height = side / Math.max(1, viewportHeight);

	return {
		x: rect.x + (rect.width - width) / 2,
		y: rect.y + (rect.height - height) / 2,
		width,
		height,
	};
}

export type VisualCompositionLayout = {
	codeCompact: boolean;
	complement: NormalizedVisualRect;
	metadata: { x: number; y: number };
	overlaps: boolean;
	resolvedPreset: VisualLayoutPreset;
	sounded: NormalizedVisualRect;
	visualization: NormalizedVisualRect;
	visualizationVertical: boolean;
};

export function getCanvasPixelSize(
	cssWidth: number,
	cssHeight: number,
	pixelRatio: number,
): CanvasPixelSize {
	return {
		width: Math.max(1, Math.round(cssWidth * pixelRatio)),
		height: Math.max(1, Math.round(cssHeight * pixelRatio)),
	};
}

export function getAspectPreservingCoverSize(
	viewportWidth: number,
	viewportHeight: number,
	contentWidth: number,
	contentHeight: number,
): CanvasPixelSize {
	const viewportAspect = viewportWidth / Math.max(viewportHeight, 0.000_001);
	const contentAspect = contentWidth / Math.max(contentHeight, 0.000_001);

	if (contentAspect >= viewportAspect) {
		return {
			width: viewportHeight * contentAspect,
			height: viewportHeight,
		};
	}

	return {
		width: viewportWidth,
		height: viewportWidth / contentAspect,
	};
}

const COMPOSITION_LAYOUTS: Record<
	VisualLayoutPreset,
	Omit<VisualCompositionLayout, "resolvedPreset">
> = {
	balanced: {
		codeCompact: true,
		complement: { x: 0.025, y: 0.345, width: 0.95, height: 0.3 },
		metadata: { x: 0.025, y: 0.645 },
		overlaps: false,
		sounded: { x: 0.025, y: 0.025, width: 0.95, height: 0.3 },
		visualization: { x: 0, y: 2 / 3, width: 1, height: 1 / 3 },
		visualizationVertical: false,
	},
	sandwich: {
		codeCompact: true,
		complement: { x: 0.025, y: 0.7, width: 0.95, height: 0.27 },
		metadata: { x: 0.025, y: 0.965 },
		overlaps: false,
		sounded: { x: 0.025, y: 0.025, width: 0.95, height: 0.27 },
		visualization: { x: 0, y: 1 / 3, width: 1, height: 1 / 3 },
		visualizationVertical: false,
	},
	"split-columns": {
		codeCompact: true,
		complement: { x: 0.515, y: 0.025, width: 0.46, height: 0.62 },
		metadata: { x: 0.025, y: 0.645 },
		overlaps: false,
		sounded: { x: 0.025, y: 0.025, width: 0.46, height: 0.62 },
		visualization: { x: 0, y: 2 / 3, width: 1, height: 1 / 3 },
		visualizationVertical: false,
	},
	"vertical-triptych": {
		codeCompact: true,
		complement: { x: 0.68, y: 0.035, width: 0.295, height: 0.93 },
		metadata: { x: 0.025, y: 0.965 },
		overlaps: false,
		sounded: { x: 0.025, y: 0.035, width: 0.295, height: 0.93 },
		visualization: { x: 0.345, y: 0, width: 0.31, height: 1 },
		visualizationVertical: true,
	},
	"visual-left": {
		codeCompact: true,
		complement: { x: 0.37, y: 0.515, width: 0.605, height: 0.45 },
		metadata: { x: 0.37, y: 0.965 },
		overlaps: false,
		sounded: { x: 0.37, y: 0.035, width: 0.605, height: 0.45 },
		visualization: { x: 0, y: 0, width: 0.34, height: 1 },
		visualizationVertical: true,
	},
	"visual-right": {
		codeCompact: true,
		complement: { x: 0.025, y: 0.515, width: 0.605, height: 0.45 },
		metadata: { x: 0.025, y: 0.965 },
		overlaps: false,
		sounded: { x: 0.025, y: 0.035, width: 0.605, height: 0.45 },
		visualization: { x: 0.66, y: 0, width: 0.34, height: 1 },
		visualizationVertical: true,
	},
	layered: {
		codeCompact: false,
		complement: { x: 0.025, y: 0.575, width: 0.95, height: 0.38 },
		metadata: { x: 0.025, y: 0.965 },
		overlaps: true,
		sounded: { x: 0.025, y: 0.035, width: 0.95, height: 0.38 },
		visualization: { x: 0, y: 2 / 3, width: 1, height: 1 / 3 },
		visualizationVertical: false,
	},
	"visual-focus": {
		codeCompact: true,
		complement: { x: 0.025, y: 0.225, width: 0.95, height: 0.19 },
		metadata: { x: 0.025, y: 0.405 },
		overlaps: false,
		sounded: { x: 0.025, y: 0.02, width: 0.95, height: 0.19 },
		visualization: { x: 0, y: 0.42, width: 1, height: 0.58 },
		visualizationVertical: false,
	},
};

export function getVisualCompositionLayout(
	preset: VisualLayoutPreset,
	viewportAspect: number,
): VisualCompositionLayout {
	const resolvedPreset =
		viewportAspect < 0.9
			? preset === "vertical-triptych" ||
				preset === "visual-left" ||
				preset === "visual-right"
				? "sandwich"
				: preset === "split-columns"
					? "balanced"
					: preset
			: preset;

	return {
		...COMPOSITION_LAYOUTS[resolvedPreset],
		resolvedPreset,
	};
}
