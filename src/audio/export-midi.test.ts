import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { sequenceToMidiBytes } from "./export-midi";
import {
	CANONICAL_BASES,
	DEFAULT_VOICE_SETTINGS,
	VOICE_PRESET_DEFINITIONS,
	VOICE_PRESET_FAMILIES,
	VOICE_PRESET_IDS,
	type GenomicMusicSequence,
} from "./types";

const sequence: GenomicMusicSequence = {
	events: CANONICAL_BASES.map((base, index) => ({
		time: index * 0.5,
		duration: 0.25,
		midi: 48 + index * 4,
		velocity: 0.4 + index * 0.1,
		base,
		voice: base,
		qualityScore: 20 + index,
		direction: index % 2 ? "r2" : "r1",
	})),
	runtimeSeconds: 60,
	noteCount: 4,
	readCount: 2,
	tempoBpm: 96,
	timeSignature: "7/8",
	voiceSettings: {
		...DEFAULT_VOICE_SETTINGS,
		A: { preset: "halo-pad", volumeDb: -6, octaveShift: 1 },
	},
};

describe("sequenceToMidiBytes", () => {
	it("defines 24 categorized presets with valid General MIDI programs", () => {
		expect(VOICE_PRESET_IDS).toHaveLength(24);

		for (const preset of VOICE_PRESET_IDS) {
			const definition = VOICE_PRESET_DEFINITIONS[preset];

			expect(VOICE_PRESET_FAMILIES).toContain(definition.family);
			expect(definition.program).toBeGreaterThanOrEqual(0);
			expect(definition.program).toBeLessThanOrEqual(127);
		}
	});

	it("writes four named instrument tracks from the normalized sequence", () => {
		const midi = new Midi(sequenceToMidiBytes(sequence));

		expect(midi.header.tempos[0]?.bpm).toBeCloseTo(96);
		expect(midi.header.timeSignatures[0]?.timeSignature).toEqual([7, 8]);
		expect(midi.tracks).toHaveLength(4);

		for (let index = 0; index < CANONICAL_BASES.length; index += 1) {
			const base = CANONICAL_BASES[index];
			const track = midi.tracks[index];
			const settings = sequence.voiceSettings[base];
			const definition = VOICE_PRESET_DEFINITIONS[settings.preset];

			expect(track.name).toBe(`${base} · ${definition.label}`);
			expect(track.instrument.number).toBe(definition.program);
			expect(track.controlChanges[7]?.[0]?.value).toBeCloseTo(
				10 ** (settings.volumeDb / 20),
				1,
			);
			expect(track.notes).toHaveLength(1);
			expect(
				midi.header.ticksToSeconds(track.endOfTrackTicks ?? 0),
			).toBeCloseTo(60, 1);
			expect(track.notes[0]?.midi).toBe(sequence.events[index].midi);
			expect(track.notes[0]?.velocity).toBeCloseTo(
				sequence.events[index].velocity,
				1,
			);
		}
	});
});
