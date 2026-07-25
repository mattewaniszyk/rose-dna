export type RoseAnglePreset =
	| "default"
	| "back"
	| "forward"
	| "aggressive-forward"
	| "aggressive-forward-2"
	| "top-down"
	| "lean-left"
	| "lean-right"
	| "lean-left-back"
	| "lean-left-forward"
	| "lean-left-aggressive-forward"
	| "lean-left-aggressive-forward-2"
	| "lean-right-back"
	| "lean-right-forward"
	| "lean-right-aggressive-forward"
	| "lean-right-aggressive-forward-2";

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
		value: "back",
		label: "Back",
		description: "Pitch the bloom away without leaning sideways.",
	},
	{
		value: "forward",
		label: "Forward",
		description: "Pitch the bloom forward without leaning sideways.",
	},
	{
		value: "aggressive-forward",
		label: "Aggressive Forward",
		description: "Push the bloom into a stronger forward pitch.",
	},
	{
		value: "aggressive-forward-2",
		label: "Aggressive Forward 2",
		description: "Push the bloom into an even more extreme forward pitch.",
	},
	{
		value: "top-down",
		label: "Top Down",
		description: "View the bloom from directly above.",
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
		value: "lean-left-aggressive-forward",
		label: "Lean Left and Aggressive Forward",
		description: "Lean left with a stronger forward pitch.",
	},
	{
		value: "lean-left-aggressive-forward-2",
		label: "Lean Left and Aggressive Forward 2",
		description: "Lean left with an even more extreme forward pitch.",
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
	{
		value: "lean-right-aggressive-forward",
		label: "Lean Right and Aggressive Forward",
		description: "Lean right with a stronger forward pitch.",
	},
	{
		value: "lean-right-aggressive-forward-2",
		label: "Lean Right and Aggressive Forward 2",
		description: "Lean right with an even more extreme forward pitch.",
	},
];

export const ROSE_ANGLE_PRESET_LABELS: Record<RoseAnglePreset, string> = {
	default: "Default",
	back: "Back",
	forward: "Forward",
	"aggressive-forward": "Aggressive Forward",
	"aggressive-forward-2": "Aggressive Forward 2",
	"top-down": "Top Down",
	"lean-left": "Lean Left",
	"lean-right": "Lean Right",
	"lean-left-back": "Lean Left and Back",
	"lean-left-forward": "Lean Left and Forward",
	"lean-left-aggressive-forward": "Lean Left and Aggressive Forward",
	"lean-left-aggressive-forward-2": "Lean Left and Aggressive Forward 2",
	"lean-right-back": "Lean Right and Back",
	"lean-right-forward": "Lean Right and Forward",
	"lean-right-aggressive-forward": "Lean Right and Aggressive Forward",
	"lean-right-aggressive-forward-2": "Lean Right and Aggressive Forward 2",
};

export const ROSE_ANGLE_PRESET_ROTATIONS: Record<
	RoseAnglePreset,
	[number, number, number]
> = {
	default: [-0.08, 0.08, 0.015],
	back: [-0.36, 0.08, 0.015],
	forward: [0.28, 0.08, 0.015],
	"aggressive-forward": [0.52, 0.08, 0.015],
	"aggressive-forward-2": [0.76, 0.08, 0.015],
	"top-down": [1.3, 0.08, 0.015],
	"lean-left": [-0.08, 0.08, 0.16],
	"lean-right": [-0.08, 0.08, -0.16],
	"lean-left-back": [-0.36, 0.08, 0.16],
	"lean-left-forward": [0.28, 0.08, 0.16],
	"lean-left-aggressive-forward": [0.52, 0.08, 0.16],
	"lean-left-aggressive-forward-2": [0.76, 0.08, 0.16],
	"lean-right-back": [-0.36, 0.08, -0.16],
	"lean-right-forward": [0.28, 0.08, -0.16],
	"lean-right-aggressive-forward": [0.52, 0.08, -0.16],
	"lean-right-aggressive-forward-2": [0.76, 0.08, -0.16],
};