export type BackgroundMode = "space" | "space2" | "black";

export const BACKGROUND_MODE_PROJECT_IDS: Partial<Record<BackgroundMode, string>> =
	{
		space: "AV1EujVOBWkxiMYHvQme",
		space2: "ge0nVgnyqhFv2yHXxQmU",
	};

export const BACKGROUND_OPTIONS: Array<{
	value: BackgroundMode;
	label: string;
	description: string;
}> = [
	{
		value: "black",
		label: "Black",
		description: "Use a plain black backdrop.",
	},
	{
		value: "space",
		label: "Space",
		description: "Show the Unicorn Studio space scene.",
	},
	{
		value: "space2",
		label: "Space 2",
		description: "Show the second Unicorn Studio space scene.",
	},
];

export const BACKGROUND_MODE_LABELS: Record<BackgroundMode, string> = {
	space: "Space",
	space2: "Space 2",
	black: "Black",
};