import type { LiquidMetalParams } from "./rose-liquid-metal";

type MaterialScalarControl =
	| {
		mode: "cap";
		value: number;
	  }
	| {
		mode: "set";
		value: number;
	  };

type MaterialRoughnessControl =
	| {
		mode: "clamp";
		min: number;
		max: number;
	  }
	| {
		mode: "set";
		value: number;
	  };

type MaterialColorBlend = {
	target: [number, number, number];
	mix: number;
};

export type RoseMaterialPreset =
	| "default"
	| "velvet"
	| "glossy"
	| "frozen"
	| "metal"
	| "bare-metal"
	| "black-metal"
	| "chrome"
	| "liquid-rose"
	| "rose-mirror"
	| "etched-rose";

// Presets rendered by a custom ShaderMaterial instead of the PBR tweak pipeline.
export type RoseShaderPreset = "chrome" | "liquid-rose";

export type RosePbrPreset = Exclude<RoseMaterialPreset, RoseShaderPreset>;

const ROSE_SHADER_PRESETS: Record<RoseShaderPreset, true> = {
	chrome: true,
	"liquid-rose": true,
};

export function isRoseShaderPreset(
	preset: RoseMaterialPreset,
): preset is RoseShaderPreset {
	return Object.hasOwn(ROSE_SHADER_PRESETS, preset);
}

// Liquid-metal tunings per rose part. `base` covers the whole bloom; a part
// with no override shares the base material rather than allocating its own.
export type RoseShaderConfig = {
	base: Partial<LiquidMetalParams>;
	petal?: Partial<LiquidMetalParams>;
	stem?: Partial<LiquidMetalParams>;
};

export const ROSE_SHADER_CONFIGS: Record<RoseShaderPreset, RoseShaderConfig> = {
	chrome: {
		base: {},
	},
	// Dark backs keep the bands blowing out to white at the crest, so the tint
	// only lands in the mid-tones and still reads as metal rather than paint.
	"liquid-rose": {
		base: {},
		petal: {
			colorBack: "#180207",
			colorTint: "#e8323f",
			tintOpacity: 0.88,
		},
		stem: {
			colorBack: "#04120a",
			colorTint: "#2f9c55",
			tintOpacity: 0.86,
		},
	},
};

// The glTF material carrying the petal surface textures.
export const PETAL_MATERIAL_NAME = "m_petal";

export type RosePart = "petal" | "stem" | "other";

// Every part's color comes from its base color texture rather than a glTF
// baseColorFactor, so all four materials report white and the only thing that
// separates the bloom from the greenery is the material name.
export const ROSE_PART_BY_MATERIAL_NAME: Record<string, RosePart> = {
	[PETAL_MATERIAL_NAME]: "petal",
	m_stem: "stem",
	m_leafs: "stem",
	m_thorns: "stem",
};

// Mirror finishes lit by the dedicated studio environment rather than the
// standard scene lights.
const ROSE_BARE_METAL_PRESETS: Partial<Record<RoseMaterialPreset, true>> = {
	"bare-metal": true,
	"black-metal": true,
	"rose-mirror": true,
	"etched-rose": true,
};

export function isBareMetalPreset(preset: RoseMaterialPreset) {
	return Object.hasOwn(ROSE_BARE_METAL_PRESETS, preset);
}

export type RoseMaterialConfig = {
	metalness: MaterialScalarControl;
	roughness: MaterialRoughnessControl;
	petalEmissiveScalar: number;
	petalEmissiveIntensity: number;
	stemEmissive: [number, number, number];
	stemEmissiveIntensity: number;
	forceColor?: [number, number, number];
	stripBaseColorMap?: boolean;
	stripEmissiveMap?: boolean;
	// The GLB ships petals, stem, leafs and thorns as four materials, each with
	// its own normal/metallic-roughness/occlusion textures. Those maps modulate
	// the scalars set here, so parts still shade differently even when every
	// other property is forced to one value. A preset settles that either by
	// dropping the maps outright or by lending one part's maps to the rest.
	stripSurfaceMaps?: boolean;
	// glTF material name whose surface maps every other part borrows.
	surfaceMapSource?: string;
	disableVertexColors?: boolean;
	petalColor?: MaterialColorBlend;
	stemColor?: MaterialColorBlend;
	envMapIntensity?: number;
	clearcoat?: number;
	clearcoatRoughness?: number;
};

export const ROSE_MATERIAL_OPTIONS: Array<{
	value: RoseMaterialPreset;
	label: string;
	description: string;
}> = [
	{
		value: "default",
		label: "Default",
		description: "Keep the current rose shading and glow.",
	},
	{
		value: "velvet",
		label: "Velvet",
		description: "Soften the highlights for a deeper petal finish.",
	},
	{
		value: "glossy",
		label: "Glossy",
		description: "Sharpen highlights for a polished bloom.",
	},
	{
		value: "frozen",
		label: "Frozen",
		description: "Keep the current icy metallic finish and soft reflections.",
	},
	{
		value: "metal",
		label: "Metal",
		description: "Keep the current polished metallic rose finish.",
	},
	{
		value: "bare-metal",
		label: "Bare Metal",
		description: "Keep the current polished bare-metal chrome finish.",
	},
	{
		value: "black-metal",
		label: "Black Metal",
		description: "Untextured mirror chrome with no surface detail.",
	},
	{
		value: "chrome",
		label: "Chrome",
		description: "Animated liquid-metal chrome that flows over the bloom.",
	},
	{
		value: "liquid-rose",
		label: "Liquid Rose",
		description:
			"Flowing liquid chrome tinted red at the bloom and green down the stem.",
	},
	{
		value: "rose-mirror",
		label: "Rose Mirror",
		description: "Untextured mirror finish in deep red and green.",
	},
	{
		value: "etched-rose",
		label: "Etched Rose",
		description: "Mirror finish that keeps the petal and leaf surface detail.",
	},
];

export const ROSE_MATERIAL_LABELS: Record<RoseMaterialPreset, string> = {
	default: "Default",
	velvet: "Velvet",
	glossy: "Glossy",
	frozen: "Frozen",
	metal: "Metal",
	"bare-metal": "Bare Metal",
	"black-metal": "Black Metal",
	chrome: "Chrome",
	"liquid-rose": "Liquid Rose",
	"rose-mirror": "Rose Mirror",
	"etched-rose": "Etched Rose",
};

export const ROSE_MATERIAL_CONFIGS: Record<
	RosePbrPreset,
	RoseMaterialConfig
> = {
	default: {
		metalness: { mode: "cap", value: 0.08 },
		roughness: { mode: "clamp", min: 0.22, max: 0.82 },
		petalEmissiveScalar: 0.16,
		petalEmissiveIntensity: 0.12,
		stemEmissive: [0.02, 0.05, 0.03],
		stemEmissiveIntensity: 0.05,
	},
	velvet: {
		metalness: { mode: "cap", value: 0.04 },
		roughness: { mode: "clamp", min: 0.58, max: 0.94 },
		petalEmissiveScalar: 0.12,
		petalEmissiveIntensity: 0.08,
		stemEmissive: [0.02, 0.04, 0.025],
		stemEmissiveIntensity: 0.035,
		clearcoat: 0,
		clearcoatRoughness: 1,
	},
	glossy: {
		metalness: { mode: "set", value: 0.16 },
		roughness: { mode: "set", value: 0.16 },
		petalEmissiveScalar: 0.1,
		petalEmissiveIntensity: 0.08,
		stemEmissive: [0.018, 0.04, 0.024],
		stemEmissiveIntensity: 0.03,
		clearcoat: 0.7,
		clearcoatRoughness: 0.14,
	},
	frozen: {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.06 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		petalColor: {
			target: [0.84, 0.87, 0.93],
			mix: 0.94,
		},
		stemColor: {
			target: [0.63, 0.68, 0.76],
			mix: 0.82,
		},
		envMapIntensity: 2.6,
		clearcoat: 1,
		clearcoatRoughness: 0.04,
	},
	metal: {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.018 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		petalColor: {
			target: [0.95, 0.95, 0.965],
			mix: 0.995,
		},
		stemColor: {
			target: [0.84, 0.85, 0.87],
			mix: 0.965,
		},
		envMapIntensity: 4.2,
		clearcoat: 0,
		clearcoatRoughness: 0.02,
	},
	"bare-metal": {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.012 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		forceColor: [0.82, 0.83, 0.86],
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		surfaceMapSource: PETAL_MATERIAL_NAME,
		disableVertexColors: true,
		envMapIntensity: 8.6,
		clearcoat: 1,
		clearcoatRoughness: 0.02,
	},
	// Same finish as bare-metal, minus every source texture, so the whole bloom
	// resolves to one uniform mirror driven by geometry normals alone.
	"black-metal": {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.012 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		forceColor: [0.82, 0.83, 0.86],
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		stripSurfaceMaps: true,
		disableVertexColors: true,
		envMapIntensity: 8.6,
		clearcoat: 1,
		clearcoatRoughness: 0.02,
	},
	// Black-metal's mirror, tinted per part instead of forced to one silver.
	// forceColor is deliberately unset: it short-circuits the petal/stem branch.
	"rose-mirror": {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.012 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		stripSurfaceMaps: true,
		disableVertexColors: true,
		petalColor: {
			target: [0.72, 0.09, 0.14],
			mix: 1,
		},
		stemColor: {
			target: [0.11, 0.4, 0.17],
			mix: 1,
		},
		// A tinted metal absorbs more of the studio environment than black-metal's
		// neutral silver, so the intensity runs higher to land at the same
		// brightness. The clearcoat adds the untinted white specular on top that
		// keeps this reading as metal rather than candy paint.
		envMapIntensity: 10.5,
		clearcoat: 1,
		clearcoatRoughness: 0.02,
	},
	// Mirror finish laid over the GLB's own textures: each part keeps its base
	// color and surface maps, so the baked petal veins and leaf detail survive as
	// modulation on the reflection.
	"etched-rose": {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.02 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		// Light blend only — the base color map already carries the red and green.
		petalColor: {
			target: [0.68, 0.1, 0.16],
			mix: 0.45,
		},
		stemColor: {
			target: [0.13, 0.38, 0.18],
			mix: 0.4,
		},
		envMapIntensity: 6.4,
		clearcoat: 1,
		clearcoatRoughness: 0.04,
	},
};