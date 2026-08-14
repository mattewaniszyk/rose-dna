import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_SETTINGS, type GenomicMusicSequence } from "@/audio/types";
import {
	createStepwiseVisualizationModel,
	createVisualizationModel,
} from "./renderers";

const sequence: GenomicMusicSequence = {
	events: [
		{
			time: 1,
			duration: 0.5,
			midi: 60,
			velocity: 0.75,
			base: "A",
			voice: "A",
			qualityScore: 30,
			direction: "r1",
			sourceReadIndex: 2,
			sourceBaseIndex: 4,
		},
	],
	runtimeSeconds: 4,
	noteCount: 1,
	readCount: 1,
	tempoBpm: 120,
	timeSignature: "4/4",
	voiceSettings: DEFAULT_VOICE_SETTINGS,
};

describe("Strudel visualization model", () => {
	it("converts sequence seconds to measure cycles and installs Spiral painters", () => {
		const model = createVisualizationModel(sequence);

		expect(model.secondsPerCycle).toBe(2);
		expect(Number(model.haps[0].whole.begin)).toBe(0.5);
		expect(Number(model.haps[0].whole.end)).toBe(0.75);
		expect(model.haps[0].value).toMatchObject({
			note: 60,
			label: "A·T",
		});
		expect(model.spiralPainters.length).toBeGreaterThan(0);
	});

	it("builds paired stepcat patterns paced in musical measures", () => {
		const model = createStepwiseVisualizationModel(sequence);
		const sounded = model.soundedPattern.queryArc(0, 2);
		const complement = model.complementPattern.queryArc(0, 2);

		expect(model.secondsPerCycle).toBe(2);
		expect(sounded[0]?.value).toMatchObject({
			base: "A",
			label: "A",
			lane: "sounded",
		});
		expect(complement[0]?.value).toMatchObject({
			base: "T",
			label: "T",
			lane: "complement",
		});
		expect(Number(sounded[0]?.whole.begin)).toBe(0.5);
		expect(Number(sounded[0]?.whole.end)).toBe(2);
	});
});
