export const BOTTOM_VISUALIZATION_MODES = [
	"timeline",
	"spiral",
	"pitch-wheel",
	"scope",
	"spectrum",
] as const;

export type BottomVisualizationMode =
	(typeof BOTTOM_VISUALIZATION_MODES)[number];

export const VISUAL_LAYOUT_PRESETS = [
	"balanced",
	"sandwich",
	"split-columns",
	"vertical-triptych",
	"visual-left",
	"visual-right",
	"layered",
	"visual-focus",
] as const;

export type VisualLayoutPreset = (typeof VISUAL_LAYOUT_PRESETS)[number];

export const VISUAL_LAYOUT_LABELS: Record<VisualLayoutPreset, string> = {
	balanced: "Balanced Bands",
	sandwich: "Sandwich",
	"split-columns": "Split Columns",
	"vertical-triptych": "Vertical Triptych",
	"visual-left": "Visual Left Column",
	"visual-right": "Visual Right Column",
	layered: "Layered",
	"visual-focus": "Visual Focus",
};

export const VISUAL_LAYOUT_DESCRIPTIONS: Record<VisualLayoutPreset, string> = {
	balanced: "Two code bands above a lower-third visualization.",
	sandwich: "The visualization sits between sounded and complement code.",
	"split-columns": "Code splits left and right above a wide visualization.",
	"vertical-triptych": "Code, visualization, and complement form three columns.",
	"visual-left": "A tall visualization sits left of two stacked code regions.",
	"visual-right": "Two stacked code regions sit left of a tall visualization.",
	layered: "Full-background code intentionally overlaps the visualization.",
	"visual-focus": "Compact code bands leave more room for the visualization.",
};

export type VisualLayerSettings = {
	stepwiseBackgroundEnabled: boolean;
	bottomVisualizationEnabled: boolean;
	bottomVisualizationMode: BottomVisualizationMode;
	visualLayoutPreset: VisualLayoutPreset;
};

export const DEFAULT_VISUAL_LAYER_SETTINGS: VisualLayerSettings = {
	stepwiseBackgroundEnabled: false,
	bottomVisualizationEnabled: false,
	bottomVisualizationMode: "spiral",
	visualLayoutPreset: "balanced",
};

export const BOTTOM_VISUALIZATION_LABELS: Record<
	BottomVisualizationMode,
	string
> = {
	timeline: "Timeline",
	spiral: "Spiral",
	"pitch-wheel": "Pitch Wheel",
	scope: "Scope",
	spectrum: "Spectrum",
};

export type VisualizationAudioFrame = {
	waveform: Float32Array;
	spectrum: Float32Array;
};
