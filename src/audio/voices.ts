import * as Tone from "tone";
import {
	CANONICAL_BASES,
	DEFAULT_VOICE_SETTINGS,
	type VoicePresetId,
	type VoiceSettingsByBase,
} from "./types";
import type { GenomicVoice, GenomicVoiceBank } from "./voice-types";

export type { GenomicVoice, GenomicVoiceBank } from "./voice-types";

function envelope(
	attack: number,
	decay: number,
	sustain: number,
	release: number,
) {
	return { attack, decay, sustain, release };
}

function filterEnvelope(
	attack: number,
	decay: number,
	sustain: number,
	release: number,
	baseFrequency: number,
	octaves: number,
) {
	return { attack, decay, sustain, release, baseFrequency, octaves };
}

const BASIC_PATCHES = {
	"new-age-pad": {
		oscillator: {
			type: "custom" as const,
			partials: [1, 0.12, 0.34, 0.04, 0.16, 0.02],
		},
		envelope: envelope(0.28, 0.7, 0.56, 1.8),
	},
	"warm-pad": {
		oscillator: {
			type: "custom" as const,
			partials: [1, 0.28, 0.12, 0.08, 0.035],
		},
		envelope: envelope(0.48, 0.65, 0.72, 2.4),
	},
	"drawbar-organ": {
		oscillator: {
			type: "custom" as const,
			partials: [1, 0.78, 0.52, 0.31, 0.2, 0.12, 0.08, 0.045],
		},
		envelope: envelope(0.018, 0.08, 0.94, 0.24),
	},
};

const FM_PATCHES = {
	"crystal-synth": {
		harmonicity: 3.01,
		modulationIndex: 8,
		oscillator: { type: "sine" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.004, 0.9, 0.12, 1.25),
		modulationEnvelope: envelope(0.002, 0.55, 0.04, 0.7),
	},
	"glass-bell": {
		harmonicity: 1.4,
		modulationIndex: 10,
		oscillator: { type: "sine" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.002, 1.45, 0.015, 1.8),
		modulationEnvelope: envelope(0.001, 0.82, 0, 0.9),
	},
	celesta: {
		harmonicity: 2.01,
		modulationIndex: 5.5,
		oscillator: { type: "sine" as const },
		modulation: { type: "triangle" as const },
		envelope: envelope(0.003, 0.95, 0.06, 1.1),
		modulationEnvelope: envelope(0.001, 0.32, 0, 0.45),
	},
	"music-box": {
		harmonicity: 3.99,
		modulationIndex: 12,
		oscillator: { type: "sine" as const },
		modulation: { type: "square" as const },
		envelope: envelope(0.001, 0.72, 0.01, 1.05),
		modulationEnvelope: envelope(0.001, 0.22, 0, 0.35),
	},
	vibraphone: {
		harmonicity: 1,
		modulationIndex: 3.2,
		oscillator: { type: "sine" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.006, 1.3, 0.3, 1.7),
		modulationEnvelope: envelope(0.004, 0.9, 0.18, 1.1),
	},
	kalimba: {
		harmonicity: 5,
		modulationIndex: 6.5,
		oscillator: { type: "sine" as const },
		modulation: { type: "triangle" as const },
		envelope: envelope(0.001, 0.33, 0.018, 0.42),
		modulationEnvelope: envelope(0.001, 0.12, 0, 0.18),
	},
	"electric-piano": {
		harmonicity: 3.01,
		modulationIndex: 4.8,
		oscillator: { type: "sine" as const },
		modulation: { type: "triangle" as const },
		envelope: envelope(0.006, 0.85, 0.22, 1),
		modulationEnvelope: envelope(0.002, 0.36, 0.08, 0.5),
	},
	marimba: {
		harmonicity: 3.99,
		modulationIndex: 2.8,
		oscillator: { type: "sine" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.002, 0.48, 0.015, 0.38),
		modulationEnvelope: envelope(0.001, 0.16, 0, 0.12),
	},
	"plucked-strings": {
		harmonicity: 1.5,
		modulationIndex: 2.2,
		oscillator: { type: "triangle" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.002, 0.3, 0.08, 0.52),
		modulationEnvelope: envelope(0.001, 0.1, 0, 0.16),
	},
	"nylon-guitar": {
		harmonicity: 1.01,
		modulationIndex: 1.5,
		oscillator: { type: "triangle" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.003, 0.62, 0.14, 0.72),
		modulationEnvelope: envelope(0.001, 0.16, 0.02, 0.24),
	},
	"orchestral-harp": {
		harmonicity: 2,
		modulationIndex: 1.8,
		oscillator: { type: "triangle" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.002, 1, 0.07, 1.4),
		modulationEnvelope: envelope(0.001, 0.22, 0, 0.3),
	},
	"metallic-pad": {
		harmonicity: 1.414,
		modulationIndex: 6.8,
		oscillator: { type: "sine" as const },
		modulation: { type: "square" as const },
		envelope: envelope(0.12, 0.9, 0.38, 2),
		modulationEnvelope: envelope(0.08, 0.8, 0.3, 1.8),
	},
};

const AM_PATCHES = {
	"choir-pad": {
		harmonicity: 1.5,
		oscillator: { type: "sine" as const },
		modulation: { type: "sine" as const },
		envelope: envelope(0.42, 0.8, 0.68, 2.3),
		modulationEnvelope: envelope(0.55, 0.65, 0.52, 2.4),
	},
};

const FILTERED_PATCHES = {
	"polysynth-pad": {
		oscillator: { type: "fatsawtooth" as const, count: 2, spread: 16 },
		filter: { Q: 1.4, type: "lowpass" as const, rolloff: -24 as const },
		envelope: envelope(0.18, 0.58, 0.62, 1.9),
		filterEnvelope: filterEnvelope(0.2, 0.9, 0.36, 1.8, 260, 3.4),
	},
	"bowed-pad": {
		oscillator: { type: "fatsawtooth" as const, count: 3, spread: 12 },
		filter: { Q: 1.1, type: "lowpass" as const, rolloff: -24 as const },
		envelope: envelope(0.72, 0.4, 0.78, 2.8),
		filterEnvelope: filterEnvelope(0.55, 1, 0.58, 2.5, 220, 2.7),
	},
	"halo-pad": {
		oscillator: { type: "fattriangle" as const, count: 3, spread: 18 },
		filter: { Q: 0.8, type: "lowpass" as const, rolloff: -12 as const },
		envelope: envelope(0.85, 0.7, 0.68, 3.2),
		filterEnvelope: filterEnvelope(1.1, 0.9, 0.52, 3, 380, 2.2),
	},
	"sweep-pad": {
		oscillator: { type: "fatsawtooth" as const, count: 2, spread: 22 },
		filter: { Q: 3.2, type: "lowpass" as const, rolloff: -24 as const },
		envelope: envelope(1.05, 0.75, 0.52, 2.7),
		filterEnvelope: filterEnvelope(1.35, 1.2, 0.42, 2.5, 140, 5.2),
	},
	"string-ensemble": {
		oscillator: { type: "fatsawtooth" as const, count: 3, spread: 20 },
		filter: { Q: 1.2, type: "lowpass" as const, rolloff: -12 as const },
		envelope: envelope(0.38, 0.52, 0.7, 2.25),
		filterEnvelope: filterEnvelope(0.3, 0.75, 0.5, 2.1, 310, 3.1),
	},
	"square-lead": {
		oscillator: { type: "square" as const },
		filter: { Q: 2.5, type: "lowpass" as const, rolloff: -24 as const },
		envelope: envelope(0.015, 0.22, 0.35, 0.7),
		filterEnvelope: filterEnvelope(0.008, 0.32, 0.36, 0.55, 420, 4.5),
	},
	"saw-lead": {
		oscillator: { type: "sawtooth" as const },
		filter: { Q: 2.2, type: "lowpass" as const, rolloff: -24 as const },
		envelope: envelope(0.018, 0.18, 0.48, 0.62),
		filterEnvelope: filterEnvelope(0.01, 0.28, 0.42, 0.5, 360, 5),
	},
	"synth-bass": {
		oscillator: { type: "square2" as const },
		filter: { Q: 4.5, type: "lowpass" as const, rolloff: -24 as const },
		envelope: envelope(0.018, 0.32, 0.52, 0.72),
		filterEnvelope: filterEnvelope(0.008, 0.28, 0.22, 0.5, 72, 4.2),
	},
};

export type VoiceSynthesisEngine = "AM" | "FM" | "filtered" | "harmonic";

export function getVoiceSynthesisEngine(
	preset: VoicePresetId,
): VoiceSynthesisEngine {
	if (preset in FM_PATCHES) {
		return "FM";
	}

	if (preset in AM_PATCHES) {
		return "AM";
	}

	if (preset in FILTERED_PATCHES) {
		return "filtered";
	}

	return "harmonic";
}

export function createElectronicVoice(
	preset: VoicePresetId,
	volumeDb: number,
): GenomicVoice {
	if (preset in FM_PATCHES) {
		const settings = FM_PATCHES[preset as keyof typeof FM_PATCHES];

		return new Tone.PolySynth(Tone.FMSynth, {
			...settings,
			volume: volumeDb,
		});
	}

	if (preset in AM_PATCHES) {
		const settings = AM_PATCHES[preset as keyof typeof AM_PATCHES];

		return new Tone.PolySynth(Tone.AMSynth, {
			...settings,
			volume: volumeDb,
		});
	}

	if (preset in FILTERED_PATCHES) {
		const settings =
			FILTERED_PATCHES[preset as keyof typeof FILTERED_PATCHES];

		return new Tone.PolySynth(Tone.MonoSynth, {
			...settings,
			volume: volumeDb,
		});
	}

	const settings = BASIC_PATCHES[preset as keyof typeof BASIC_PATCHES];

	return new Tone.PolySynth(Tone.Synth, {
		...settings,
		volume: volumeDb,
	});
}

export function createGenomicVoiceBank(
	voiceSettings: VoiceSettingsByBase = DEFAULT_VOICE_SETTINGS,
): GenomicVoiceBank {
	return Object.fromEntries(
		CANONICAL_BASES.map((base) => [
			base,
			createElectronicVoice(
				voiceSettings[base].preset,
				voiceSettings[base].volumeDb,
			),
		]),
	) as GenomicVoiceBank;
}

export function disposeGenomicVoiceBank(bank: GenomicVoiceBank | null) {
	if (!bank) {
		return;
	}

	for (const voice of Object.values(bank)) {
		voice.dispose();
	}
}
