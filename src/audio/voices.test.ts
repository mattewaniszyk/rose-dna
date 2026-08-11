import { describe, expect, it, vi } from "vitest";

vi.mock("tone", () => {
	class Synth {}
	class FMSynth {}
	class AMSynth {}
	class MonoSynth {}
	class PolySynth {
		readonly voice: { name: string };
		readonly options: Record<string, unknown>;

		constructor(
			voice: { name: string },
			options: Record<string, unknown>,
		) {
			this.voice = voice;
			this.options = options;
		}
	}

	return { AMSynth, FMSynth, MonoSynth, PolySynth, Synth };
});

import { VOICE_PRESET_IDS } from "./types";
import {
	createElectronicVoice,
	getVoiceSynthesisEngine,
} from "./voices";

describe("genomic voice presets", () => {
	it("provides a configured patch for every selectable preset", () => {
		for (const preset of VOICE_PRESET_IDS) {
			const voice = createElectronicVoice(preset, -12) as unknown as {
				options: Record<string, unknown>;
			};

			expect(voice.options.volume).toBe(-12);
			expect(Object.keys(voice.options).length).toBeGreaterThan(1);
		}
	});

	it("uses instrument-appropriate synthesis engines", () => {
		expect(getVoiceSynthesisEngine("marimba")).toBe("FM");
		expect(getVoiceSynthesisEngine("electric-piano")).toBe("FM");
		expect(getVoiceSynthesisEngine("drawbar-organ")).toBe("harmonic");
		expect(getVoiceSynthesisEngine("choir-pad")).toBe("AM");
		expect(getVoiceSynthesisEngine("metallic-pad")).toBe("FM");
		expect(getVoiceSynthesisEngine("synth-bass")).toBe("filtered");
		expect(getVoiceSynthesisEngine("sweep-pad")).toBe("filtered");
		expect(getVoiceSynthesisEngine("warm-pad")).toBe("harmonic");
	});
});
