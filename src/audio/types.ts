export type ReadDirection = "r1" | "r2";
export type CanonicalBase = "A" | "C" | "G" | "T";
export const CANONICAL_BASES: CanonicalBase[] = ["A", "C", "G", "T"];
export const VOICE_PRESET_IDS = [
	"new-age-pad",
	"warm-pad",
	"polysynth-pad",
	"choir-pad",
	"bowed-pad",
	"metallic-pad",
	"halo-pad",
	"sweep-pad",
	"crystal-synth",
	"glass-bell",
	"celesta",
	"music-box",
	"vibraphone",
	"kalimba",
	"electric-piano",
	"drawbar-organ",
	"marimba",
	"plucked-strings",
	"nylon-guitar",
	"orchestral-harp",
	"string-ensemble",
	"square-lead",
	"saw-lead",
	"synth-bass",
] as const;
export type VoicePresetId = (typeof VOICE_PRESET_IDS)[number];
export const VOICE_PRESET_FAMILIES = [
	"Pads",
	"Keys & Bells",
	"Organs",
	"Strings",
	"Leads",
	"Bass",
] as const;
export type VoicePresetFamily = (typeof VOICE_PRESET_FAMILIES)[number];
export type VoiceSettings = {
	preset: VoicePresetId;
	volumeDb: number;
	octaveShift: number;
};
export type VoiceSettingsByBase = Record<CanonicalBase, VoiceSettings>;

export const VOICE_PRESET_DEFINITIONS: Record<
	VoicePresetId,
	{ family: VoicePresetFamily; label: string; program: number }
> = {
	"new-age-pad": { family: "Pads", label: "New Age Pad", program: 88 },
	"warm-pad": { family: "Pads", label: "Warm Pad", program: 89 },
	"polysynth-pad": { family: "Pads", label: "Polysynth Pad", program: 90 },
	"choir-pad": { family: "Pads", label: "Choir Pad", program: 91 },
	"bowed-pad": { family: "Pads", label: "Bowed Pad", program: 92 },
	"metallic-pad": { family: "Pads", label: "Metallic Pad", program: 93 },
	"halo-pad": { family: "Pads", label: "Halo Pad", program: 94 },
	"sweep-pad": { family: "Pads", label: "Sweep Pad", program: 95 },
	"crystal-synth": {
		family: "Keys & Bells",
		label: "Crystal Synth",
		program: 98,
	},
	"glass-bell": {
		family: "Keys & Bells",
		label: "Glockenspiel",
		program: 9,
	},
	celesta: { family: "Keys & Bells", label: "Celesta", program: 8 },
	"music-box": { family: "Keys & Bells", label: "Music Box", program: 10 },
	vibraphone: { family: "Keys & Bells", label: "Vibraphone", program: 11 },
	kalimba: { family: "Keys & Bells", label: "Kalimba", program: 108 },
	"electric-piano": {
		family: "Keys & Bells",
		label: "Electric Piano",
		program: 4,
	},
	marimba: { family: "Keys & Bells", label: "Marimba", program: 12 },
	"drawbar-organ": { family: "Organs", label: "Drawbar Organ", program: 16 },
	"plucked-strings": {
		family: "Strings",
		label: "Plucked Strings",
		program: 45,
	},
	"nylon-guitar": { family: "Strings", label: "Nylon Guitar", program: 24 },
	"orchestral-harp": {
		family: "Strings",
		label: "Orchestral Harp",
		program: 46,
	},
	"string-ensemble": {
		family: "Strings",
		label: "String Ensemble",
		program: 48,
	},
	"square-lead": { family: "Leads", label: "Square Lead", program: 80 },
	"saw-lead": { family: "Leads", label: "Saw Lead", program: 81 },
	"synth-bass": { family: "Bass", label: "Synth Bass", program: 38 },
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettingsByBase = {
	A: { preset: "new-age-pad", volumeDb: -14, octaveShift: 0 },
	C: { preset: "crystal-synth", volumeDb: -17, octaveShift: 0 },
	G: { preset: "square-lead", volumeDb: -18, octaveShift: 0 },
	T: { preset: "synth-bass", volumeDb: -15, octaveShift: 0 },
};
export const TIME_SIGNATURES = ["3/4", "4/4", "5/4", "6/8", "7/8"] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];
export const GROUP_ENDING_MODES = ["sustain", "breath"] as const;
export type GroupEndingMode = (typeof GROUP_ENDING_MODES)[number];

export const TIME_SIGNATURE_VALUES: Record<
	TimeSignature,
	[number, number]
> = {
	"3/4": [3, 4],
	"4/4": [4, 4],
	"5/4": [5, 4],
	"6/8": [6, 8],
	"7/8": [7, 8],
};

export type FastqFixture = {
	id: string;
	label: string;
	description: string;
	r1Url: string;
	r2Url: string;
};

export type FastqRead = {
	header: string;
	sequence: string;
	quality: string;
	direction: ReadDirection;
};

export type FastqParseOptions = {
	maxReadsPerFile: number;
	readStride: number;
};

export const DEFAULT_PARSE_OPTIONS: FastqParseOptions = {
	maxReadsPerFile: 16,
	readStride: 64,
};

export type FastqReadSet = {
	reads: FastqRead[];
	scannedReads: number;
	selectedReads: number;
};

export type FastqDataset = {
	fixture: FastqFixture;
	r1: FastqReadSet;
	r2: FastqReadSet;
	parseDurationMs: number;
};

export type MappingOptions = {
	accentStrengthPercent: number;
	groupEndingLengthSteps: number;
	groupEndingMode: GroupEndingMode;
	tempoBpm: number;
	maxBasesPerRead: number;
	targetRuntimeSeconds: number;
	timeSignature: TimeSignature;
	voiceSettings: VoiceSettingsByBase;
};

export const DEFAULT_MAPPING_OPTIONS: MappingOptions = {
	accentStrengthPercent: 100,
	groupEndingLengthSteps: 1,
	groupEndingMode: "sustain",
	tempoBpm: 88,
	maxBasesPerRead: 24,
	targetRuntimeSeconds: 60,
	timeSignature: "4/4",
	voiceSettings: DEFAULT_VOICE_SETTINGS,
};

export type GenomicNoteEvent = {
	time: number;
	duration: number;
	midi: number;
	velocity: number;
	base: CanonicalBase;
	voice: CanonicalBase;
	qualityScore: number;
	direction: ReadDirection;
};

export type GenomicMusicSequence = {
	events: GenomicNoteEvent[];
	runtimeSeconds: number;
	noteCount: number;
	readCount: number;
	tempoBpm: number;
	timeSignature: TimeSignature;
	voiceSettings: VoiceSettingsByBase;
};
