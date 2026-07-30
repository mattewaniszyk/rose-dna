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
	| "molten-rose"
	| "liquid-gold"
	| "rose-mirror"
	| "etched-rose"
	| "gold"
	| "pearl"
	| "crystal"
	| "bioluminescent"
	| "obsidian"
	| "porcelain"
	| "oxidized-copper";

// Presets rendered by a custom ShaderMaterial instead of the PBR tweak pipeline.
export type RoseShaderPreset =
	| "chrome"
	| "liquid-rose"
	| "molten-rose"
	| "liquid-gold";

export type RosePbrPreset = Exclude<RoseMaterialPreset, RoseShaderPreset>;

const ROSE_SHADER_PRESETS: Record<RoseShaderPreset, true> = {
	chrome: true,
	"liquid-rose": true,
	"molten-rose": true,
	"liquid-gold": true,
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
	// Contrast + viscosity: near-black voids, hotter saturated crests, and
	// thick slow bands so it reads as heavy molten metal, not busy chrome.
	"molten-rose": {
		base: {},
		petal: {
			colorBack: "#030001",
			colorHighlight: "#ff3a20",
			colorTint: "#a01028",
			tintOpacity: 0.68,
			formAmount: 0.58,
			speed: 0.08,
			softness: 0.52,
			repetition: 2,
			distortion: 0.34,
			noiseScale: 1.6,
		},
		stem: {
			colorBack: "#000503",
			colorHighlight: "#20ff70",
			colorTint: "#0e7038",
			tintOpacity: 0.68,
			formAmount: 0.58,
			speed: 0.08,
			softness: 0.52,
			repetition: 2,
			distortion: 0.34,
			noiseScale: 1.6,
		},
	},
	// Warm precious-metal flow: gold petals, darker brass stem. Molten-style
	// viscosity (soft/slow/thick bands) so it reads as liquid gold, not chrome.
	"liquid-gold": {
		base: {},
		petal: {
			colorBack: "#4a3014",
			colorHighlight: "#fff4d0",
			colorTint: "#e0b85a",
			tintOpacity: 0.62,
			formAmount: 0.42,
			speed: 0.07,
			softness: 0.58,
			repetition: 1.7,
			distortion: 0.24,
			noiseScale: 1.25,
			contour: 0.42,
			shiftRed: 0.012,
			shiftBlue: 0.008,
		},
		stem: {
			colorBack: "#2e1e0a",
			colorHighlight: "#f8e6b0",
			colorTint: "#b08a38",
			tintOpacity: 0.58,
			formAmount: 0.42,
			speed: 0.07,
			softness: 0.58,
			repetition: 1.7,
			distortion: 0.24,
			noiseScale: 1.25,
			contour: 0.42,
			shiftRed: 0.012,
			shiftBlue: 0.008,
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

// Mirror / studio-env finishes. Environment is shared; lighting may still be
// full strength for glass / pearl so form stays readable on transparent canvases.
const ROSE_BARE_METAL_PRESETS: Partial<Record<RoseMaterialPreset, true>> = {
	"bare-metal": true,
	"black-metal": true,
	"rose-mirror": true,
	"etched-rose": true,
	gold: true,
	pearl: true,
	crystal: true,
	obsidian: true,
	"oxidized-copper": true,
};

// Dim the scene lights so the studio PMREM dominates (true mirrors / metals).
const ROSE_DIM_STUDIO_LIT_PRESETS: Partial<Record<RoseMaterialPreset, true>> = {
	"bare-metal": true,
	"black-metal": true,
	"rose-mirror": true,
	"etched-rose": true,
	gold: true,
	obsidian: true,
	"oxidized-copper": true,
};

export function isBareMetalPreset(preset: RoseMaterialPreset) {
	return Object.hasOwn(ROSE_BARE_METAL_PRESETS, preset);
}

export function isDimStudioLitPreset(preset: RoseMaterialPreset) {
	return Object.hasOwn(ROSE_DIM_STUDIO_LIT_PRESETS, preset);
}

// Crystal / glass presets get softer lights so clearcoat specular reads as glass.
const ROSE_GLASS_PRESETS: Partial<Record<RoseMaterialPreset, true>> = {
	crystal: true,
};

export function isGlassPreset(preset: RoseMaterialPreset) {
	return Object.hasOwn(ROSE_GLASS_PRESETS, preset);
}

/** @deprecated Use isGlassPreset */
export function isTransmissionPreset(preset: RoseMaterialPreset) {
	return isGlassPreset(preset);
}

export type RoseMaterialConfig = {
	metalness: MaterialScalarControl;
	roughness: MaterialRoughnessControl;
	petalEmissiveScalar: number;
	petalEmissiveIntensity: number;
	stemEmissive: [number, number, number];
	stemEmissiveIntensity: number;
	// When set, overrides the petal emissive color derived from albedo.
	petalEmissive?: [number, number, number];
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
	// MeshPhysicalMaterial extensions — cloning upgrades Standard → Physical.
	iridescence?: number;
	iridescenceIOR?: number;
	iridescenceThicknessRange?: [number, number];
	transmission?: number;
	thickness?: number;
	ior?: number;
	attenuationColor?: [number, number, number];
	attenuationDistance?: number;
	// Alpha glass: the canvas is transparent, so opacity reveals the Unicorn /
	// CSS backdrop behind the WebGL layer — more reliable than transmission here.
	opacity?: number;
	transparent?: boolean;
	depthWrite?: boolean;
	specularIntensity?: number;
	specularColor?: [number, number, number];
	// Additive view-dependent spectrum on glass rims (does not need env light).
	rainbowFresnel?: number;
	// Modulate emissive by base-map luminance (keeps glow hue, lights veins).
	biolumeVeinMask?: boolean;
};

export function needsPhysicalMaterial(config: RoseMaterialConfig) {
	return (
		config.clearcoat !== undefined ||
		config.iridescence !== undefined ||
		config.transmission !== undefined ||
		config.thickness !== undefined ||
		config.ior !== undefined ||
		config.attenuationColor !== undefined ||
		config.attenuationDistance !== undefined
	);
}

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
		value: "porcelain",
		label: "Porcelain",
		description: "Pale bone-china bloom with a soft ceramic sheen.",
	},
	{
		value: "pearl",
		label: "Pearl",
		description: "Soft white petals with view-dependent iridescent shift.",
	},
	{
		value: "crystal",
		label: "Crystal",
		description: "See-through glass with prismatic rainbow rims.",
	},
	{
		value: "bioluminescent",
		label: "Bioluminescent",
		description: "Dark petals with vein-lit cyan DNA glow.",
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
		value: "gold",
		label: "Gold",
		description: "Polished warm gold petals with a darker brass stem.",
	},
	{
		value: "oxidized-copper",
		label: "Oxidized Copper",
		description: "Aged copper bloom with teal-green patina on the stem.",
	},
	{
		value: "obsidian",
		label: "Obsidian",
		description: "Near-black glass with sharp specular highlights.",
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
		value: "molten-rose",
		label: "Molten Rose",
		description:
			"Heavy molten metal — thick slow bands with near-black voids and hot saturated crests.",
	},
	{
		value: "liquid-gold",
		label: "Liquid Gold",
		description: "Animated liquid metal in warm gold and brass.",
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
	porcelain: "Porcelain",
	pearl: "Pearl",
	crystal: "Crystal",
	bioluminescent: "Bioluminescent",
	frozen: "Frozen",
	metal: "Metal",
	"bare-metal": "Bare Metal",
	"black-metal": "Black Metal",
	gold: "Gold",
	"oxidized-copper": "Oxidized Copper",
	obsidian: "Obsidian",
	chrome: "Chrome",
	"liquid-rose": "Liquid Rose",
	"molten-rose": "Molten Rose",
	"liquid-gold": "Liquid Gold",
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
	// Soft white ceramic: low metalness, pale pink-tinted petals, gentle clearcoat.
	porcelain: {
		metalness: { mode: "set", value: 0.02 },
		roughness: { mode: "set", value: 0.42 },
		petalEmissiveScalar: 0.04,
		petalEmissiveIntensity: 0.04,
		stemEmissive: [0.02, 0.03, 0.02],
		stemEmissiveIntensity: 0.02,
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		disableVertexColors: true,
		petalColor: {
			target: [0.96, 0.9, 0.88],
			mix: 1,
		},
		stemColor: {
			target: [0.78, 0.82, 0.74],
			mix: 1,
		},
		clearcoat: 0.45,
		clearcoatRoughness: 0.28,
		envMapIntensity: 0.55,
	},
	// Soft white with thin-film iridescence — luxury organic between velvet and mirror.
	pearl: {
		metalness: { mode: "set", value: 0.12 },
		roughness: { mode: "set", value: 0.28 },
		petalEmissiveScalar: 0.06,
		petalEmissiveIntensity: 0.05,
		stemEmissive: [0.02, 0.03, 0.028],
		stemEmissiveIntensity: 0.03,
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		disableVertexColors: true,
		petalColor: {
			target: [0.94, 0.93, 0.96],
			mix: 1,
		},
		stemColor: {
			target: [0.72, 0.78, 0.74],
			mix: 1,
		},
		clearcoat: 0.85,
		clearcoatRoughness: 0.12,
		envMapIntensity: 1.4,
		iridescence: 1,
		iridescenceIOR: 1.35,
		iridescenceThicknessRange: [120, 420],
	},
	// Alpha glass with a strong fresnel spectrum so crystal rainbows read even on
	// black backdrops (built-in iridescence alone is too quiet without bright env).
	crystal: {
		metalness: { mode: "set", value: 0 },
		roughness: { mode: "set", value: 0.03 },
		petalEmissiveScalar: 0.03,
		petalEmissiveIntensity: 0.05,
		stemEmissive: [0.02, 0.05, 0.04],
		stemEmissiveIntensity: 0.03,
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		stripSurfaceMaps: true,
		disableVertexColors: true,
		petalColor: {
			target: [0.94, 0.9, 0.96],
			mix: 1,
		},
		stemColor: {
			target: [0.8, 0.93, 0.9],
			mix: 1,
		},
		envMapIntensity: 4.5,
		clearcoat: 1,
		clearcoatRoughness: 0,
		ior: 1.55,
		opacity: 0.52,
		transparent: true,
		depthWrite: false,
		iridescence: 0.85,
		iridescenceIOR: 1.65,
		iridescenceThicknessRange: [100, 700],
		specularIntensity: 1,
		specularColor: [0.88, 0.95, 1],
		rainbowFresnel: 0.9,
	},
	// Dark body; glow lives mostly on fresnel rims (+ light vein boost) so petal
	// folds stay visible instead of blooming into a white fill.
	bioluminescent: {
		metalness: { mode: "cap", value: 0.04 },
		roughness: { mode: "clamp", min: 0.5, max: 0.92 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0.7,
		petalEmissive: [0.2, 0.85, 1],
		stemEmissive: [0.1, 0.7, 0.35],
		stemEmissiveIntensity: 0.55,
		petalColor: {
			target: [0.02, 0.05, 0.08],
			mix: 0.78,
		},
		stemColor: {
			target: [0.015, 0.05, 0.03],
			mix: 0.75,
		},
		biolumeVeinMask: true,
		envMapIntensity: 0.25,
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
	// Warm precious-metal opposite of silver chrome.
	gold: {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.14 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		stripSurfaceMaps: true,
		disableVertexColors: true,
		petalColor: {
			target: [1, 0.72, 0.22],
			mix: 1,
		},
		stemColor: {
			target: [0.55, 0.38, 0.14],
			mix: 1,
		},
		envMapIntensity: 9.2,
		clearcoat: 1,
		clearcoatRoughness: 0.06,
	},
	// Aged copper petals with teal patina on stem and leaves.
	"oxidized-copper": {
		metalness: { mode: "set", value: 0.92 },
		roughness: { mode: "set", value: 0.38 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		stripSurfaceMaps: true,
		disableVertexColors: true,
		petalColor: {
			target: [0.72, 0.32, 0.16],
			mix: 1,
		},
		stemColor: {
			target: [0.18, 0.48, 0.42],
			mix: 1,
		},
		envMapIntensity: 3.2,
		clearcoat: 0.2,
		clearcoatRoughness: 0.45,
	},
	// Near-black glass — darker than black-metal without reading as chrome.
	obsidian: {
		metalness: { mode: "set", value: 0.15 },
		roughness: { mode: "set", value: 0.05 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		stripSurfaceMaps: true,
		disableVertexColors: true,
		petalColor: {
			target: [0.05, 0.03, 0.06],
			mix: 1,
		},
		stemColor: {
			target: [0.035, 0.04, 0.035],
			mix: 1,
		},
		envMapIntensity: 5.5,
		clearcoat: 1,
		clearcoatRoughness: 0.02,
		ior: 1.55,
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
