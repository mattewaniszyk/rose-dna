import { describe, expect, it } from "vitest";
import { mapDatasetToSequence } from "./mapping";
import {
	DEFAULT_VOICE_SETTINGS,
	type FastqDataset,
	type FastqRead,
	type MappingOptions,
} from "./types";

function makeReads(direction: "r1" | "r2", count: number): FastqRead[] {
	return Array.from({ length: count }, (_, index) => ({
		header: `@${direction}-${index}`,
		sequence: "ACGTACGTACGTACGTACGTNN",
		quality: "!5I]!5I]!5I]!5I]!5I]II",
		direction,
	}));
}

function makeDataset(): FastqDataset {
	const r1 = makeReads("r1", 20);
	const r2 = makeReads("r2", 20);

	return {
		fixture: {
			id: "test",
			label: "Test",
			description: "Test fixture",
			r1Url: "/r1.fastq",
			r2Url: "/r2.fastq",
		},
		r1: { reads: r1, scannedReads: r1.length, selectedReads: r1.length },
		r2: { reads: r2, scannedReads: r2.length, selectedReads: r2.length },
		parseDurationMs: 1,
	};
}

const options: MappingOptions = {
	accentStrengthPercent: 100,
	groupEndingLengthSteps: 1,
	groupEndingMode: "sustain",
	tempoBpm: 48,
	maxBasesPerRead: 22,
	targetRuntimeSeconds: 30,
	timeSignature: "4/4",
	voiceSettings: DEFAULT_VOICE_SETTINGS,
};

describe("mapDatasetToSequence", () => {
	it("samples deterministically across all bases and read directions", () => {
		const dataset = makeDataset();
		const first = mapDatasetToSequence(dataset, options);
		const second = mapDatasetToSequence(dataset, options);

		expect(first).toEqual(second);
		expect(first.runtimeSeconds).toBe(30);
		expect(first.noteCount).toBeLessThan(800);
		expect(new Set(first.events.map((event) => event.voice))).toEqual(
			new Set(["A", "C", "G", "T"]),
		);
		expect(new Set(first.events.map((event) => event.direction))).toEqual(
			new Set(["r1", "r2"]),
		);
		expect(first.events.every((event) => "ACGT".includes(event.base))).toBe(
			true,
		);
		expect(first.events.at(-1)?.time).toBeLessThan(30);
	});

	it("clamps runtime to the supported 30–180 second range", () => {
		const dataset = makeDataset();
		const short = mapDatasetToSequence(dataset, {
			...options,
			targetRuntimeSeconds: 5,
		});
		const long = mapDatasetToSequence(dataset, {
			...options,
			targetRuntimeSeconds: 500,
		});

		expect(short.runtimeSeconds).toBe(30);
		expect(long.runtimeSeconds).toBe(180);
	});

	it("applies per-base octave shifts without changing other voices", () => {
		const dataset = makeDataset();
		const baseline = mapDatasetToSequence(dataset, options);
		const shifted = mapDatasetToSequence(dataset, {
			...options,
			voiceSettings: {
				...DEFAULT_VOICE_SETTINGS,
				A: {
					...DEFAULT_VOICE_SETTINGS.A,
					octaveShift: 1,
				},
			},
		});

		for (let index = 0; index < baseline.events.length; index += 1) {
			const before = baseline.events[index];
			const after = shifted.events[index];

			expect(after.base).toBe(before.base);
			expect(after.midi - before.midi).toBe(before.base === "A" ? 12 : 0);
		}

		expect(shifted.voiceSettings.A.octaveShift).toBe(1);
	});

	it("applies deterministic meter accents to quality-driven velocity", () => {
		const dataset = makeDataset();

		for (const read of [...dataset.r1.reads, ...dataset.r2.reads]) {
			read.quality = "5".repeat(read.sequence.length);
		}

		const common = mapDatasetToSequence(dataset, {
			...options,
			timeSignature: "4/4",
		});
		const compound = mapDatasetToSequence(dataset, {
			...options,
			timeSignature: "6/8",
		});

		expect(common.timeSignature).toBe("4/4");
		expect(compound.timeSignature).toBe("6/8");
		expect(common.events[0]?.velocity).toBeGreaterThan(
			common.events[1]?.velocity ?? 1,
		);

		const stepSeconds = 60 / options.tempoBpm / 4;
		const eventAtStep = (
			sequence: ReturnType<typeof mapDatasetToSequence>,
			step: number,
		) =>
			sequence.events.find(
				(event) => Math.abs(event.time - step * stepSeconds) < 0.000_001,
			);

		expect(eventAtStep(compound, 6)?.velocity).toBeGreaterThan(
			eventAtStep(common, 6)?.velocity ?? 1,
		);
		expect(eventAtStep(compound, 5)).toBeUndefined();
		expect(eventAtStep(common, 5)).toBeDefined();
	});

	it("scales accents and supports breath or sustain group endings", () => {
		const dataset = makeDataset();

		for (const read of [...dataset.r1.reads, ...dataset.r2.reads]) {
			read.quality = "5".repeat(read.sequence.length);
		}

		const continuous = mapDatasetToSequence(dataset, {
			...options,
			accentStrengthPercent: 0,
			groupEndingLengthSteps: 0,
			groupEndingMode: "breath",
		});
		const breath = mapDatasetToSequence(dataset, {
			...options,
			accentStrengthPercent: 100,
			groupEndingLengthSteps: 2,
			groupEndingMode: "breath",
		});
		const sustain = mapDatasetToSequence(dataset, {
			...options,
			accentStrengthPercent: 100,
			groupEndingLengthSteps: 2,
			groupEndingMode: "sustain",
		});
		const stepSeconds = 60 / options.tempoBpm / 4;
		const hasEventAtStep = (
			sequence: ReturnType<typeof mapDatasetToSequence>,
			step: number,
		) =>
			sequence.events.some(
				(event) => Math.abs(event.time - step * stepSeconds) < 0.000_001,
			);
		const eventAtStep = (
			sequence: ReturnType<typeof mapDatasetToSequence>,
			step: number,
		) =>
			sequence.events.find(
				(event) => Math.abs(event.time - step * stepSeconds) < 0.000_001,
			);

		expect(continuous.events[0]?.velocity).toBeCloseTo(
			continuous.events[1]?.velocity ?? 0,
		);
		expect(sustain.events[0]?.velocity).toBeGreaterThan(
			sustain.events[1]?.velocity ?? 1,
		);
		expect(hasEventAtStep(continuous, 2)).toBe(true);
		expect(hasEventAtStep(breath, 2)).toBe(false);
		expect(hasEventAtStep(sustain, 2)).toBe(false);
		expect(eventAtStep(sustain, 1)?.duration).toBeGreaterThan(
			eventAtStep(breath, 1)?.duration ?? Number.POSITIVE_INFINITY,
		);
	});
});
