import { describe, expect, it } from "vitest";
import {
	sanitizeAnimationDelta,
	sanitizeAudioEnergy,
} from "./rose-animation";

describe("rose animation safeguards", () => {
	it("rejects clock discontinuities and caps long frames", () => {
		expect(sanitizeAnimationDelta(-12)).toBe(0);
		expect(sanitizeAnimationDelta(Number.NaN)).toBe(0);
		expect(sanitizeAnimationDelta(Number.POSITIVE_INFINITY)).toBe(0);
		expect(sanitizeAnimationDelta(1)).toBe(0.1);
		expect(sanitizeAnimationDelta(1 / 30)).toBeCloseTo(1 / 30);
	});

	it("keeps animation energy finite and normalized", () => {
		expect(sanitizeAudioEnergy(Number.NaN)).toBe(0);
		expect(sanitizeAudioEnergy(Number.POSITIVE_INFINITY)).toBe(0);
		expect(sanitizeAudioEnergy(-0.5)).toBe(0);
		expect(sanitizeAudioEnergy(0.4)).toBe(0.4);
		expect(sanitizeAudioEnergy(2)).toBe(1);
	});
});
