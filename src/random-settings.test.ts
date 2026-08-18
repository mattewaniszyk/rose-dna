import { describe, expect, it } from "vitest";
import {
	CANONICAL_BASES,
	GROUP_ENDING_MODES,
	TIME_SIGNATURES,
	VOICE_PRESET_IDS,
} from "@/audio/types";
import { FASTQ_FIXTURES } from "@/audio/fixtures";
import { BACKGROUND_OPTIONS } from "@/components/background-mode";
import { OVERLAY_EFFECT_OPTIONS } from "@/components/overlay-effect";
import { ROSE_ANGLE_PRESET_OPTIONS } from "@/components/rose-angle";
import { ROSE_MATERIAL_OPTIONS } from "@/components/rose-material";
import {
	createRandomizedExperienceSettings,
	RANDOM_ACCENT_STRENGTHS,
	RANDOM_GROUP_ENDING_LENGTHS,
	RANDOM_MAX_BASES_PER_READ,
	RANDOM_MAX_READS_PER_FILE,
	RANDOM_READ_STRIDES,
	RANDOM_RUNTIMES,
	RANDOM_TEMPOS,
	RANDOM_VOICE_OCTAVES,
	RANDOM_VOICE_VOLUMES,
} from "@/random-settings";
import { createDefaultSharedAppSettings } from "@/shared-settings";
import {
	BOTTOM_VISUALIZATION_MODES,
	VISUAL_LAYOUT_PRESETS,
} from "@/visualization/types";

function cyclingRandom(values: number[]) {
	let index = 0;
	return () => values[index++ % values.length];
}

describe("random experience settings", () => {
	it("uses only supported curated values", () => {
		const current = createDefaultSharedAppSettings();
		const settings = createRandomizedExperienceSettings(
			current,
			cyclingRandom([0, 0.17, 0.43, 0.68, 0.91]),
		);

		expect(BACKGROUND_OPTIONS.map(({ value }) => value)).toContain(settings.backgroundMode);
		expect(ROSE_ANGLE_PRESET_OPTIONS.map(({ value }) => value)).toContain(settings.roseAnglePreset);
		expect(ROSE_MATERIAL_OPTIONS.map(({ value }) => value)).toContain(settings.roseMaterialPreset);
		expect(OVERLAY_EFFECT_OPTIONS.map(({ value }) => value)).toContain(settings.overlayEffect);
		expect(BOTTOM_VISUALIZATION_MODES).toContain(settings.bottomVisualizationMode);
		expect(VISUAL_LAYOUT_PRESETS).toContain(settings.visualLayoutPreset);
		expect(FASTQ_FIXTURES.map(({ id }) => id)).toContain(settings.audio.selectedFixtureId);
		expect(RANDOM_MAX_READS_PER_FILE).toContain(settings.audio.parseOptions.maxReadsPerFile);
		expect(RANDOM_READ_STRIDES).toContain(settings.audio.parseOptions.readStride);
		expect(RANDOM_MAX_BASES_PER_READ).toContain(settings.audio.mappingOptions.maxBasesPerRead);
		expect(RANDOM_TEMPOS).toContain(settings.audio.mappingOptions.tempoBpm);
		expect(TIME_SIGNATURES).toContain(settings.audio.mappingOptions.timeSignature);
		expect(GROUP_ENDING_MODES).toContain(settings.audio.mappingOptions.groupEndingMode);
		expect(RANDOM_GROUP_ENDING_LENGTHS).toContain(settings.audio.mappingOptions.groupEndingLengthSteps);
		expect(RANDOM_ACCENT_STRENGTHS).toContain(settings.audio.mappingOptions.accentStrengthPercent);
		expect(RANDOM_RUNTIMES).toContain(settings.audio.mappingOptions.targetRuntimeSeconds);
	});

	it("always enables a visual layer and looping while preserving export settings", () => {
		const current = createDefaultSharedAppSettings();
		current.audio.videoAspectRatio = "9:16";
		current.audio.videoQuality = "near-lossless";

		for (const randomValue of [0, 0.49, 0.999999]) {
			const settings = createRandomizedExperienceSettings(
				current,
				() => randomValue,
			);

			expect(
				settings.stepwiseBackgroundEnabled ||
					settings.bottomVisualizationEnabled,
			).toBe(true);
			expect(settings.audio.isLoopEnabled).toBe(true);
			expect(settings.audio.videoAspectRatio).toBe("9:16");
			expect(settings.audio.videoQuality).toBe("near-lossless");
		}
	});

	it("assigns valid distinct voice presets with curated tuning", () => {
		const settings = createRandomizedExperienceSettings(
			createDefaultSharedAppSettings(),
			() => 0,
		);
		const voices = CANONICAL_BASES.map(
			(base) => settings.audio.mappingOptions.voiceSettings[base],
		);

		expect(new Set(voices.map(({ preset }) => preset))).toHaveLength(
			CANONICAL_BASES.length,
		);
		for (const voice of voices) {
			expect(VOICE_PRESET_IDS).toContain(voice.preset);
			expect(RANDOM_VOICE_VOLUMES).toContain(voice.volumeDb);
			expect(RANDOM_VOICE_OCTAVES).toContain(voice.octaveShift);
		}
	});
});
