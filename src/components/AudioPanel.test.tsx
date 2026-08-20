// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FASTQ_FIXTURES } from "@/audio/fixtures";
import {
	DEFAULT_MAPPING_OPTIONS,
	DEFAULT_PARSE_OPTIONS,
} from "@/audio/types";
import {
	DEFAULT_VIDEO_ASPECT_RATIO,
	DEFAULT_VIDEO_QUALITY_PRESET,
} from "@/audio/video-export-options";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { GenomicAudioController } from "@/hooks/useGenomicAudio";
import { AudioPanel } from "./AudioPanel";

const fixture = FASTQ_FIXTURES[0];
if (!fixture) {
	throw new Error("The audio panel tests require a FASTQ fixture.");
}

function createAudio(
	overrides: Partial<GenomicAudioController> = {},
): GenomicAudioController {
	return {
		fixtures: FASTQ_FIXTURES,
		activeFixture: fixture,
		selectedFixtureId: fixture.id,
		setSelectedFixtureId: vi.fn(),
		parseOptions: { ...DEFAULT_PARSE_OPTIONS },
		mappingOptions: {
			...DEFAULT_MAPPING_OPTIONS,
			voiceSettings: {
				A: { ...DEFAULT_MAPPING_OPTIONS.voiceSettings.A },
				C: { ...DEFAULT_MAPPING_OPTIONS.voiceSettings.C },
				G: { ...DEFAULT_MAPPING_OPTIONS.voiceSettings.G },
				T: { ...DEFAULT_MAPPING_OPTIONS.voiceSettings.T },
			},
		},
		setReadStride: vi.fn(),
		setMaxReadsPerFile: vi.fn(),
		setTempoBpm: vi.fn(),
		setAccentStrengthPercent: vi.fn(),
		setGroupEndingLengthSteps: vi.fn(),
		setGroupEndingMode: vi.fn(),
		setTimeSignature: vi.fn(),
		setMaxBasesPerRead: vi.fn(),
		setTargetRuntimeSeconds: vi.fn(),
		setVoicePreset: vi.fn(),
		setVoiceVolumeDb: vi.fn(),
		setVoiceOctaveShift: vi.fn(),
		previewVoice: vi.fn(),
		stopVoicePreview: vi.fn(),
		previewingBase: null,
		isPreparingVoices: false,
		isRandomizing: false,
		buildStatus: "idle",
		buildError: null,
		dataset: null,
		sequence: null,
		loadSelectedFixture: vi.fn(),
		loadSettingsAndPlayLooping: vi.fn(),
		isLoopEnabled: true,
		setIsLoopEnabled: vi.fn(),
		isPlaying: false,
		play: vi.fn(),
		pause: vi.fn(),
		stop: vi.fn(),
		playbackSeconds: 0,
		playbackEventIndex: null,
		getPlaybackPosition: vi.fn(),
		getVisualizationAudioFrame: vi.fn(),
		audioEnergy: 0,
		playbackTriggerCount: 0,
		audioContextState: "not-started",
		exportStatus: "idle",
		exportKind: null,
		exportStage: null,
		exportProgress: 0,
		exportError: null,
		exportMp3: vi.fn(),
		exportMp4: vi.fn(),
		exportMidi: vi.fn(),
		isVideoExportSupported: true,
		videoAspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
		setVideoAspectRatio: vi.fn(),
		videoQuality: DEFAULT_VIDEO_QUALITY_PRESET,
		setVideoQuality: vi.fn(),
		cancelExport: vi.fn(),
		...overrides,
	};
}

describe("AudioPanel", () => {
	afterEach(cleanup);

	it("does not autofocus the fixture pair select when the panel opens", () => {
		const view = render(
			<TooltipProvider>
				<AudioPanel audio={createAudio()} />
			</TooltipProvider>,
		);
		const trigger = view.getByRole("button", { name: /Audio/ });

		fireEvent.click(trigger);

		const fixtureSelect = view.getByLabelText("Fixture Pair");
		const panel = view.getByRole("dialog");

		expect(document.activeElement).not.toBe(fixtureSelect);
		expect(document.activeElement).toBe(panel);
	});
});
