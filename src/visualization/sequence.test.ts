import { describe, expect, it } from "vitest";
import type { GenomicMusicSequence, GenomicNoteEvent } from "@/audio/types";
import { DEFAULT_VOICE_SETTINGS } from "@/audio/types";
import { DEFAULT_VISUAL_LAYER_SETTINGS } from "./types";
import {
	complementBase,
	getFocusedEventIndex,
	isEventActive,
	secondsPerMeasure,
} from "./sequence";

const events: GenomicNoteEvent[] = [0, 1, 2].map((time, index) => ({
	time,
	duration: 0.4,
	midi: 60 + index,
	velocity: 0.7,
	base: (["A", "C", "G"] as const)[index],
	voice: (["A", "C", "G"] as const)[index],
	qualityScore: 30,
	direction: "r1",
	sourceReadIndex: 0,
	sourceBaseIndex: index,
}));

function makeSequence(
	tempoBpm: number,
	timeSignature: GenomicMusicSequence["timeSignature"],
): GenomicMusicSequence {
	return {
		events,
		runtimeSeconds: 4,
		noteCount: events.length,
		readCount: 1,
		tempoBpm,
		timeSignature,
		voiceSettings: DEFAULT_VOICE_SETTINGS,
	};
}

describe("sequence visualization timing", () => {
	it("defaults both layers off while retaining Spiral as the bottom mode", () => {
		expect(DEFAULT_VISUAL_LAYER_SETTINGS).toEqual({
			stepwiseBackgroundEnabled: false,
			bottomVisualizationEnabled: false,
			bottomVisualizationMode: "spiral",
			visualLayoutPreset: "balanced",
		});
	});

	it("maps every canonical base to its DNA complement", () => {
		expect(["A", "C", "G", "T"].map((base) => complementBase(base as "A"))).toEqual([
			"T",
			"G",
			"C",
			"A",
		]);
	});

	it("uses musical measures as Strudel cycles", () => {
		expect(secondsPerMeasure(makeSequence(120, "4/4"))).toBe(2);
		expect(secondsPerMeasure(makeSequence(120, "6/8"))).toBe(1.5);
	});

	it("finds the last triggered event and its active note window", () => {
		expect(getFocusedEventIndex([], 0)).toBe(-1);
		expect(getFocusedEventIndex(events, -1)).toBe(0);
		expect(getFocusedEventIndex(events, 1.8)).toBe(1);
		expect(getFocusedEventIndex(events, 99)).toBe(2);
		expect(isEventActive(events[1], 1.2)).toBe(true);
		expect(isEventActive(events[1], 1.4)).toBe(false);
	});
});
