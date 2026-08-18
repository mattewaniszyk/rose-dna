import {
	CANONICAL_BASES,
	GROUP_ENDING_MODES,
	TIME_SIGNATURES,
	VOICE_PRESET_IDS,
	type VoicePresetId,
} from "@/audio/types";
import { FASTQ_FIXTURES } from "@/audio/fixtures";
import { BACKGROUND_OPTIONS } from "@/components/background-mode";
import { OVERLAY_EFFECT_OPTIONS } from "@/components/overlay-effect";
import { ROSE_ANGLE_PRESET_OPTIONS } from "@/components/rose-angle";
import { ROSE_MATERIAL_OPTIONS } from "@/components/rose-material";
import {
	parseSharedSettings,
	type ParsedSharedSettings,
	type SharedAppSettings,
} from "@/shared-settings";
import {
	BOTTOM_VISUALIZATION_MODES,
	VISUAL_LAYOUT_PRESETS,
} from "@/visualization/types";

export const RANDOM_MAX_READS_PER_FILE = [8, 12, 16, 24, 32, 48, 64] as const;
export const RANDOM_READ_STRIDES = [8, 16, 32, 64, 128, 256, 512] as const;
export const RANDOM_MAX_BASES_PER_READ = [12, 16, 24, 32, 48, 64, 96] as const;
export const RANDOM_TEMPOS = [60, 72, 84, 96, 108, 120, 132, 144, 156] as const;
export const RANDOM_RUNTIMES = [30, 45, 60, 75, 90] as const;
export const RANDOM_ACCENT_STRENGTHS = [25, 40, 55, 70, 85, 100] as const;
export const RANDOM_GROUP_ENDING_LENGTHS = [0, 1, 2] as const;
export const RANDOM_VOICE_VOLUMES = [-24, -22, -20, -18, -16, -14, -12, -10, -8] as const;
export const RANDOM_VOICE_OCTAVES = [-2, -1, 0, 1, 2] as const;

const VISUAL_LAYER_COMBINATIONS = [
	{ stepwiseBackgroundEnabled: true, bottomVisualizationEnabled: false },
	{ stepwiseBackgroundEnabled: false, bottomVisualizationEnabled: true },
	{ stepwiseBackgroundEnabled: true, bottomVisualizationEnabled: true },
] as const;

function randomIndex(length: number, random: () => number) {
	if (length === 0) {
		throw new Error("Cannot choose from an empty randomization pool.");
	}

	const value = random();
	const normalized = Number.isFinite(value)
		? Math.max(0, Math.min(0.9999999999999999, value))
		: 0;
	return Math.floor(normalized * length);
}

function pick<T>(values: readonly T[], random: () => number): T {
	return values[randomIndex(values.length, random)];
}

function pickDistinctVoicePresets(random: () => number) {
	const available: VoicePresetId[] = [...VOICE_PRESET_IDS];
	return CANONICAL_BASES.map(() => {
		const [preset] = available.splice(randomIndex(available.length, random), 1);
		return preset;
	});
}

export function createRandomizedExperienceSettings(
	current: SharedAppSettings,
	random: () => number = Math.random,
): SharedAppSettings {
	const visualLayers = pick(VISUAL_LAYER_COMBINATIONS, random);
	const voicePresets = pickDistinctVoicePresets(random);
	const voiceSettings = Object.fromEntries(
		CANONICAL_BASES.map((base, index) => [
			base,
			{
				preset: voicePresets[index],
				volumeDb: pick(RANDOM_VOICE_VOLUMES, random),
				octaveShift: pick(RANDOM_VOICE_OCTAVES, random),
			},
		]),
	) as SharedAppSettings["audio"]["mappingOptions"]["voiceSettings"];

	return {
		backgroundMode: pick(BACKGROUND_OPTIONS, random).value,
		roseAnglePreset: pick(ROSE_ANGLE_PRESET_OPTIONS, random).value,
		roseMaterialPreset: pick(ROSE_MATERIAL_OPTIONS, random).value,
		overlayEffect: pick(OVERLAY_EFFECT_OPTIONS, random).value,
		...visualLayers,
		bottomVisualizationMode: pick(BOTTOM_VISUALIZATION_MODES, random),
		visualLayoutPreset: pick(VISUAL_LAYOUT_PRESETS, random),
		audio: {
			selectedFixtureId: pick(FASTQ_FIXTURES, random).id,
			parseOptions: {
				maxReadsPerFile: pick(RANDOM_MAX_READS_PER_FILE, random),
				readStride: pick(RANDOM_READ_STRIDES, random),
			},
			mappingOptions: {
				maxBasesPerRead: pick(RANDOM_MAX_BASES_PER_READ, random),
				tempoBpm: pick(RANDOM_TEMPOS, random),
				timeSignature: pick(TIME_SIGNATURES, random),
				groupEndingMode: pick(GROUP_ENDING_MODES, random),
				groupEndingLengthSteps: pick(
					RANDOM_GROUP_ENDING_LENGTHS,
					random,
				),
				accentStrengthPercent: pick(RANDOM_ACCENT_STRENGTHS, random),
				targetRuntimeSeconds: pick(RANDOM_RUNTIMES, random),
				voiceSettings,
			},
			isLoopEnabled: true,
			videoAspectRatio: current.audio.videoAspectRatio,
			videoQuality: current.audio.videoQuality,
		},
	};
}

export function resolveInitialExperienceSettings(
	search: string,
	random: () => number = Math.random,
): ParsedSharedSettings {
	const parsed = parseSharedSettings(search);

	if (parsed.shouldAutoLoad) {
		return parsed;
	}

	return {
		settings: createRandomizedExperienceSettings(parsed.settings, random),
		shouldAutoLoad: true,
	};
}
