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
	| "mirror"
	| "chrome";

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
		value: "mirror",
		label: "Mirror",
		description: "Keep the current mirror-silver rose finish.",
	},
	{
		value: "chrome",
		label: "Chrome",
		description: "Animated liquid-metal chrome with flowing silver bands.",
	},
];

export const ROSE_MATERIAL_LABELS: Record<RoseMaterialPreset, string> = {
	default: "Default",
	velvet: "Velvet",
	glossy: "Glossy",
	frozen: "Frozen",
	metal: "Metal",
	mirror: "Mirror",
	chrome: "Chrome",
};

export const ROSE_MATERIAL_CONFIGS: Record<
	RoseMaterialPreset,
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
	mirror: {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.0006 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		forceColor: [0.78, 0.79, 0.82],
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		disableVertexColors: true,
		envMapIntensity: 11.5,
		clearcoat: 1,
		clearcoatRoughness: 0,
	},
	chrome: {
		metalness: { mode: "set", value: 1 },
		roughness: { mode: "set", value: 0.012 },
		petalEmissiveScalar: 0,
		petalEmissiveIntensity: 0,
		stemEmissive: [0, 0, 0],
		stemEmissiveIntensity: 0,
		forceColor: [0.82, 0.83, 0.86],
		stripBaseColorMap: true,
		stripEmissiveMap: true,
		disableVertexColors: true,
		envMapIntensity: 8.6,
		clearcoat: 1,
		clearcoatRoughness: 0.02,
	},
};