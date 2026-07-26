export type OverlayEffect =
	| "none"
	| "dither"
	| "ascii"
	| "halftone"
	| "pixelate"
	| "posterize"
	| "edge"
	| "bloom"
	| "chromatic"
	| "grain";

export type ActiveOverlayEffect = Exclude<OverlayEffect, "none">;

export function isActiveOverlayEffect(
	effect: OverlayEffect,
): effect is ActiveOverlayEffect {
	return effect !== "none";
}

export const OVERLAY_EFFECT_OPTIONS: Array<{
	value: OverlayEffect;
	label: string;
	description: string;
}> = [
	{
		value: "none",
		label: "None",
		description: "Render the scene without post-processing.",
	},
	{
		value: "dither",
		label: "Dither",
		description: "Quantize the frame into an ordered Bayer pattern, in color.",
	},
	{
		value: "ascii",
		label: "ASCII",
		description: "Rebuild the frame out of terminal glyphs.",
	},
	{
		value: "halftone",
		label: "Halftone",
		description: "Print-style rotated dot screens across the frame.",
	},
	{
		value: "pixelate",
		label: "Pixelate",
		description: "Snap the frame down to chunky low-resolution pixels.",
	},
	{
		value: "posterize",
		label: "Posterize",
		description: "Flatten color into hard poster-print bands.",
	},
	{
		value: "edge",
		label: "Edge",
		description: "Trace luminance edges into a white wireframe.",
	},
	{
		value: "bloom",
		label: "Bloom",
		description: "Bleed a soft glow out of the brightest highlights.",
	},
	{
		value: "chromatic",
		label: "Chromatic",
		description: "Split color channels toward the edges of the frame.",
	},
	{
		value: "grain",
		label: "Grain",
		description: "Overlay animated film grain across the frame.",
	},
];

export const OVERLAY_EFFECT_LABELS: Record<OverlayEffect, string> = {
	none: "None",
	dither: "Dither",
	ascii: "ASCII",
	halftone: "Halftone",
	pixelate: "Pixelate",
	posterize: "Posterize",
	edge: "Edge",
	bloom: "Bloom",
	chromatic: "Chromatic",
	grain: "Grain",
};
