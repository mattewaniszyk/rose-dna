import { getSoundfontNames } from "smplr";
import { describe, expect, it } from "vitest";
import { SOUNDFONT_INSTRUMENT_BY_PRESET } from "./sampled-voices";
import {
	VOICE_PRESET_DEFINITIONS,
	VOICE_PRESET_IDS,
} from "./types";

describe("sampled genomic voices", () => {
	it("maps every selectable preset to an available FluidR3 instrument", () => {
		const available = new Set(getSoundfontNames());
		const mapped = VOICE_PRESET_IDS.map(
			(preset) => SOUNDFONT_INSTRUMENT_BY_PRESET[preset],
		);

		expect(mapped).toHaveLength(VOICE_PRESET_IDS.length);
		expect(new Set(mapped).size).toBe(mapped.length);
		expect(mapped.every((instrument) => available.has(instrument))).toBe(true);
	});

	it("uses matching labels for formerly approximate acoustic presets", () => {
		expect(VOICE_PRESET_DEFINITIONS["glass-bell"].label).toBe(
			"Glockenspiel",
		);
		expect(SOUNDFONT_INSTRUMENT_BY_PRESET["glass-bell"]).toBe(
			"glockenspiel",
		);
		expect(SOUNDFONT_INSTRUMENT_BY_PRESET.marimba).toBe("marimba");
		expect(SOUNDFONT_INSTRUMENT_BY_PRESET["nylon-guitar"]).toBe(
			"acoustic_guitar_nylon",
		);
	});
});
