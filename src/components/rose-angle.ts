export type RoseAnglePreset =
	| "default"
	| "lean-left"
	| "lean-right"
	| "lean-left-back"
	| "lean-left-forward"
	| "lean-right-back"
	| "lean-right-forward";

export const ROSE_ANGLE_PRESET_OPTIONS: Array<{
	value: RoseAnglePreset;
	label: string;
	description: string;
}> = [
	{
		value: "default",
		label: "Default",
		description: "Keep the original centered pose.",
	},
	{
		value: "lean-left",
		label: "Lean Left",
		description: "Tilt the bloom toward the left.",
	},
	{
		value: "lean-right",
		label: "Lean Right",
		description: "Tilt the bloom toward the right.",
	},
	{
		value: "lean-left-back",
		label: "Lean Left and Back",
		description: "Lean left while pitching away.",
	},
	{
		value: "lean-left-forward",
		label: "Lean Left and Forward",
		description: "Lean left while pitching forward.",
	},
	{
		value: "lean-right-back",
		label: "Lean Right and Back",
		description: "Lean right while pitching away.",
	},
	{
		value: "lean-right-forward",
		label: "Lean Right and Forward",
		description: "Lean right while pitching forward.",
	},
];

export const ROSE_ANGLE_PRESET_LABELS: Record<RoseAnglePreset, string> = {
	default: "Default",
	"lean-left": "Lean Left",
	"lean-right": "Lean Right",
	"lean-left-back": "Lean Left and Back",
	"lean-left-forward": "Lean Left and Forward",
	"lean-right-back": "Lean Right and Back",
	"lean-right-forward": "Lean Right and Forward",
};

export const ROSE_ANGLE_PRESET_ROTATIONS: Record<
	RoseAnglePreset,
	[number, number, number]
> = {
	default: [-0.08, 0.08, 0.015],
	"lean-left": [-0.08, 0.08, 0.16],
	"lean-right": [-0.08, 0.08, -0.16],
	"lean-left-back": [-0.36, 0.08, 0.16],
	"lean-left-forward": [0.28, 0.08, 0.16],
	"lean-right-back": [-0.36, 0.08, -0.16],
	"lean-right-forward": [0.28, 0.08, -0.16],
};