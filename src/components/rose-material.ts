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
	| "chrome";

// Presets rendered by a custom ShaderMaterial instead of the PBR tweak pipeline.
export type RoseShaderPreset = "chrome";

export type RosePbrPreset = Exclude<RoseMaterialPreset, RoseShaderPreset>;

const ROSE_SHADER_PRESETS: Record<RoseShaderPreset, true> = {
	chrome: true,
};

export function isRoseShaderPreset(
	preset: RoseMaterialPreset,
): preset is RoseShaderPreset {
	return Object.hasOwn(ROSE_SHADER_PRESETS, preset);
}

// The glTF material carrying the petal surface textures.
export const PETAL_MATERIAL_NAME = "m_petal";

// Mirror finishes lit by the dedicated studio environment rather than the
// standard scene lights.
const ROSE_BARE_METAL_PRESETS: Partial<Record<RoseMaterialPreset, true>> = {
	"bare-metal": true,
	"black-metal": true,
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
};