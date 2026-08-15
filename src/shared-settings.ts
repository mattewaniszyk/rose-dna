import {
	CANONICAL_BASES,
	DEFAULT_MAPPING_OPTIONS,
	DEFAULT_PARSE_OPTIONS,
	DEFAULT_VOICE_SETTINGS,
	GROUP_ENDING_MODES,
	TIME_SIGNATURES,
	VOICE_PRESET_IDS,
	type CanonicalBase,
	type FastqParseOptions,
	type MappingOptions,
	type VoiceSettingsByBase,
} from "@/audio/types";
import { FASTQ_FIXTURES } from "@/audio/fixtures";
import {
	DEFAULT_VIDEO_ASPECT_RATIO,
	DEFAULT_VIDEO_QUALITY_PRESET,
	VIDEO_ASPECT_RATIOS,
	VIDEO_QUALITY_PRESETS,
	type VideoAspectRatio,
	type VideoQualityPreset,
} from "@/audio/video-export-options";
import {
	BACKGROUND_OPTIONS,
	type BackgroundMode,
} from "@/components/background-mode";
import {
	OVERLAY_EFFECT_OPTIONS,
	type OverlayEffect,
} from "@/components/overlay-effect";
import {
	ROSE_ANGLE_PRESET_OPTIONS,
	type RoseAnglePreset,
} from "@/components/rose-angle";
import {
	ROSE_MATERIAL_OPTIONS,
	type RoseMaterialPreset,
} from "@/components/rose-material";
import {
	BOTTOM_VISUALIZATION_MODES,
	DEFAULT_VISUAL_LAYER_SETTINGS,
	VISUAL_LAYOUT_PRESETS,
	type BottomVisualizationMode,
	type VisualLayoutPreset,
} from "@/visualization/types";

const SHARED_SETTINGS_VERSION = "1";
const SHARED_SETTINGS_VERSION_PARAM = "settings";

const VOICE_PARAM_NAMES: Record<
	CanonicalBase,
	{ octave: string; preset: string; volume: string }
> = {
	A: { preset: "aVoice", volume: "aVol", octave: "aOct" },
	C: { preset: "cVoice", volume: "cVol", octave: "cOct" },
	G: { preset: "gVoice", volume: "gVol", octave: "gOct" },
	T: { preset: "tVoice", volume: "tVol", octave: "tOct" },
};

const SHARED_PARAM_NAMES = [
	SHARED_SETTINGS_VERSION_PARAM,
	"bg",
	"angle",
	"material",
	"effect",
	"stepwise",
	"viz",
	"vizMode",
	"layout",
	"fixture",
	"reads",
	"stride",
	"bases",
	"tempo",
	"meter",
	"ending",
	"endingSteps",
	"accent",
	"runtime",
	"loop",
	"aspect",
	"quality",
	...CANONICAL_BASES.flatMap((base) => Object.values(VOICE_PARAM_NAMES[base])),
] as const;

export type GenomicAudioSettings = {
	selectedFixtureId: string;
	parseOptions: FastqParseOptions;
	mappingOptions: MappingOptions;
	isLoopEnabled: boolean;
	videoAspectRatio: VideoAspectRatio;
	videoQuality: VideoQualityPreset;
};

export type SharedAppSettings = {
	backgroundMode: BackgroundMode;
	roseAnglePreset: RoseAnglePreset;
	roseMaterialPreset: RoseMaterialPreset;
	overlayEffect: OverlayEffect;
	stepwiseBackgroundEnabled: boolean;
	bottomVisualizationEnabled: boolean;
	bottomVisualizationMode: BottomVisualizationMode;
	visualLayoutPreset: VisualLayoutPreset;
	audio: GenomicAudioSettings;
};

export type ParsedSharedSettings = {
	settings: SharedAppSettings;
	shouldAutoLoad: boolean;
};

function cloneVoiceSettings(
	voiceSettings: VoiceSettingsByBase,
): VoiceSettingsByBase {
	return {
		A: { ...voiceSettings.A },
		C: { ...voiceSettings.C },
		G: { ...voiceSettings.G },
		T: { ...voiceSettings.T },
	};
}

export function createDefaultSharedAppSettings(): SharedAppSettings {
	return {
		backgroundMode: "black",
		roseAnglePreset: "default",
		roseMaterialPreset: "default",
		overlayEffect: "none",
		...DEFAULT_VISUAL_LAYER_SETTINGS,
		audio: {
			selectedFixtureId: FASTQ_FIXTURES[0]?.id ?? "",
			parseOptions: { ...DEFAULT_PARSE_OPTIONS },
			mappingOptions: {
				...DEFAULT_MAPPING_OPTIONS,
				voiceSettings: cloneVoiceSettings(DEFAULT_VOICE_SETTINGS),
			},
			isLoopEnabled: true,
			videoAspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
			videoQuality: DEFAULT_VIDEO_QUALITY_PRESET,
		},
	};
}

function readEnum<T extends string>(
	params: URLSearchParams,
	name: string,
	values: readonly T[],
	fallback: T,
) {
	const value = params.get(name);
	return value !== null && values.includes(value as T)
		? (value as T)
		: fallback;
}

function readInteger(
	params: URLSearchParams,
	name: string,
	min: number,
	max: number,
	fallback: number,
) {
	const rawValue = params.get(name);
	if (rawValue === null || !/^-?\d+$/.test(rawValue)) {
		return fallback;
	}

	const value = Number(rawValue);
	return Number.isSafeInteger(value) && value >= min && value <= max
		? value
		: fallback;
}

function readBoolean(
	params: URLSearchParams,
	name: string,
	fallback: boolean,
) {
	const value = params.get(name);
	if (value === "1") {
		return true;
	}

	if (value === "0") {
		return false;
	}

	return fallback;
}

export function parseSharedSettings(search: string): ParsedSharedSettings {
	const defaults = createDefaultSharedAppSettings();
	const params = new URLSearchParams(search);
	if (params.get(SHARED_SETTINGS_VERSION_PARAM) !== SHARED_SETTINGS_VERSION) {
		return { settings: defaults, shouldAutoLoad: false };
	}

	const voiceSettings = cloneVoiceSettings(
		defaults.audio.mappingOptions.voiceSettings,
	);
	for (const base of CANONICAL_BASES) {
		const names = VOICE_PARAM_NAMES[base];
		voiceSettings[base] = {
			preset: readEnum(
				params,
				names.preset,
				VOICE_PRESET_IDS,
				voiceSettings[base].preset,
			),
			volumeDb: readInteger(
				params,
				names.volume,
				-30,
				0,
				voiceSettings[base].volumeDb,
			),
			octaveShift: readInteger(
				params,
				names.octave,
				-2,
				2,
				voiceSettings[base].octaveShift,
			),
		};
	}

	const fixtureIds = FASTQ_FIXTURES.map((fixture) => fixture.id);
	const settings: SharedAppSettings = {
		backgroundMode: readEnum(
			params,
			"bg",
			BACKGROUND_OPTIONS.map((option) => option.value),
			defaults.backgroundMode,
		),
		roseAnglePreset: readEnum(
			params,
			"angle",
			ROSE_ANGLE_PRESET_OPTIONS.map((option) => option.value),
			defaults.roseAnglePreset,
		),
		roseMaterialPreset: readEnum(
			params,
			"material",
			ROSE_MATERIAL_OPTIONS.map((option) => option.value),
			defaults.roseMaterialPreset,
		),
		overlayEffect: readEnum(
			params,
			"effect",
			OVERLAY_EFFECT_OPTIONS.map((option) => option.value),
			defaults.overlayEffect,
		),
		stepwiseBackgroundEnabled: readBoolean(
			params,
			"stepwise",
			defaults.stepwiseBackgroundEnabled,
		),
		bottomVisualizationEnabled: readBoolean(
			params,
			"viz",
			defaults.bottomVisualizationEnabled,
		),
		bottomVisualizationMode: readEnum(
			params,
			"vizMode",
			BOTTOM_VISUALIZATION_MODES,
			defaults.bottomVisualizationMode,
		),
		visualLayoutPreset: readEnum(
			params,
			"layout",
			VISUAL_LAYOUT_PRESETS,
			defaults.visualLayoutPreset,
		),
		audio: {
			selectedFixtureId: readEnum(
				params,
				"fixture",
				fixtureIds,
				defaults.audio.selectedFixtureId,
			),
			parseOptions: {
				maxReadsPerFile: readInteger(
					params,
					"reads",
					4,
					2000,
					defaults.audio.parseOptions.maxReadsPerFile,
				),
				readStride: readInteger(
					params,
					"stride",
					1,
					5000,
					defaults.audio.parseOptions.readStride,
				),
			},
			mappingOptions: {
				maxBasesPerRead: readInteger(
					params,
					"bases",
					8,
					250,
					defaults.audio.mappingOptions.maxBasesPerRead,
				),
				tempoBpm: readInteger(
					params,
					"tempo",
					48,
					180,
					defaults.audio.mappingOptions.tempoBpm,
				),
				timeSignature: readEnum(
					params,
					"meter",
					TIME_SIGNATURES,
					defaults.audio.mappingOptions.timeSignature,
				),
				groupEndingMode: readEnum(
					params,
					"ending",
					GROUP_ENDING_MODES,
					defaults.audio.mappingOptions.groupEndingMode,
				),
				groupEndingLengthSteps: readInteger(
					params,
					"endingSteps",
					0,
					2,
					defaults.audio.mappingOptions.groupEndingLengthSteps,
				),
				accentStrengthPercent: readInteger(
					params,
					"accent",
					0,
					100,
					defaults.audio.mappingOptions.accentStrengthPercent,
				),
				targetRuntimeSeconds: readInteger(
					params,
					"runtime",
					30,
					180,
					defaults.audio.mappingOptions.targetRuntimeSeconds,
				),
				voiceSettings,
			},
			isLoopEnabled: readBoolean(
				params,
				"loop",
				defaults.audio.isLoopEnabled,
			),
			videoAspectRatio: readEnum(
				params,
				"aspect",
				VIDEO_ASPECT_RATIOS,
				defaults.audio.videoAspectRatio,
			),
			videoQuality: readEnum(
				params,
				"quality",
				VIDEO_QUALITY_PRESETS,
				defaults.audio.videoQuality,
			),
		},
	};

	return { settings, shouldAutoLoad: true };
}

function setIfChanged(
	params: URLSearchParams,
	name: string,
	value: string | number | boolean,
	defaultValue: string | number | boolean,
) {
	if (value === defaultValue) {
		return;
	}

	params.set(name, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
}

export function buildSharedSettingsUrl(
	currentUrl: string | URL,
	settings: SharedAppSettings,
) {
	const url = new URL(currentUrl.toString());
	const defaults = createDefaultSharedAppSettings();
	for (const name of SHARED_PARAM_NAMES) {
		url.searchParams.delete(name);
	}

	url.searchParams.set(SHARED_SETTINGS_VERSION_PARAM, SHARED_SETTINGS_VERSION);
	setIfChanged(url.searchParams, "bg", settings.backgroundMode, defaults.backgroundMode);
	setIfChanged(url.searchParams, "angle", settings.roseAnglePreset, defaults.roseAnglePreset);
	setIfChanged(url.searchParams, "material", settings.roseMaterialPreset, defaults.roseMaterialPreset);
	setIfChanged(url.searchParams, "effect", settings.overlayEffect, defaults.overlayEffect);
	setIfChanged(url.searchParams, "stepwise", settings.stepwiseBackgroundEnabled, defaults.stepwiseBackgroundEnabled);
	setIfChanged(url.searchParams, "viz", settings.bottomVisualizationEnabled, defaults.bottomVisualizationEnabled);
	setIfChanged(url.searchParams, "vizMode", settings.bottomVisualizationMode, defaults.bottomVisualizationMode);
	setIfChanged(url.searchParams, "layout", settings.visualLayoutPreset, defaults.visualLayoutPreset);
	setIfChanged(url.searchParams, "fixture", settings.audio.selectedFixtureId, defaults.audio.selectedFixtureId);
	setIfChanged(url.searchParams, "reads", settings.audio.parseOptions.maxReadsPerFile, defaults.audio.parseOptions.maxReadsPerFile);
	setIfChanged(url.searchParams, "stride", settings.audio.parseOptions.readStride, defaults.audio.parseOptions.readStride);
	setIfChanged(url.searchParams, "bases", settings.audio.mappingOptions.maxBasesPerRead, defaults.audio.mappingOptions.maxBasesPerRead);
	setIfChanged(url.searchParams, "tempo", settings.audio.mappingOptions.tempoBpm, defaults.audio.mappingOptions.tempoBpm);
	setIfChanged(url.searchParams, "meter", settings.audio.mappingOptions.timeSignature, defaults.audio.mappingOptions.timeSignature);
	setIfChanged(url.searchParams, "ending", settings.audio.mappingOptions.groupEndingMode, defaults.audio.mappingOptions.groupEndingMode);
	setIfChanged(url.searchParams, "endingSteps", settings.audio.mappingOptions.groupEndingLengthSteps, defaults.audio.mappingOptions.groupEndingLengthSteps);
	setIfChanged(url.searchParams, "accent", settings.audio.mappingOptions.accentStrengthPercent, defaults.audio.mappingOptions.accentStrengthPercent);
	setIfChanged(url.searchParams, "runtime", settings.audio.mappingOptions.targetRuntimeSeconds, defaults.audio.mappingOptions.targetRuntimeSeconds);
	setIfChanged(url.searchParams, "loop", settings.audio.isLoopEnabled, defaults.audio.isLoopEnabled);
	setIfChanged(url.searchParams, "aspect", settings.audio.videoAspectRatio, defaults.audio.videoAspectRatio);
	setIfChanged(url.searchParams, "quality", settings.audio.videoQuality, defaults.audio.videoQuality);

	for (const base of CANONICAL_BASES) {
		const names = VOICE_PARAM_NAMES[base];
		const voice = settings.audio.mappingOptions.voiceSettings[base];
		const defaultVoice = defaults.audio.mappingOptions.voiceSettings[base];
		setIfChanged(url.searchParams, names.preset, voice.preset, defaultVoice.preset);
		setIfChanged(url.searchParams, names.volume, voice.volumeDb, defaultVoice.volumeDb);
		setIfChanged(url.searchParams, names.octave, voice.octaveShift, defaultVoice.octaveShift);
	}

	return url;
}
