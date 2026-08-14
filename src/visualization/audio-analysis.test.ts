import { describe, expect, it } from "vitest";
import { audioBufferFrameAt, fftMagnitudes } from "./audio-analysis";

describe("visualization audio analysis", () => {
	it("keeps a silent waveform and spectrum at the noise floor", () => {
		const magnitudes = fftMagnitudes(new Float32Array(512));

		expect(Math.max(...magnitudes)).toBe(-120);
	});

	it("finds the expected peak for a bin-centered sine wave", () => {
		const samples = Float32Array.from(
			{ length: 512 },
			(_, index) => Math.sin((2 * Math.PI * 8 * index) / 512),
		);
		const magnitudes = fftMagnitudes(samples);
		let peak = 0;

		for (let index = 1; index < magnitudes.length; index += 1) {
			if (magnitudes[index] > magnitudes[peak]) {
				peak = index;
			}
		}

		expect(peak).toBe(8);
	});

	it("extracts a deterministic rendered-audio window for export frames", () => {
		const samples = Float32Array.from(
			{ length: 2_048 },
			(_, index) => Math.sin((2 * Math.PI * 16 * index) / 512),
		);
		const buffer = {
			sampleRate: 512,
			length: samples.length,
			numberOfChannels: 1,
			getChannelData: () => samples,
		} as unknown as AudioBuffer;
		const frame = audioBufferFrameAt(buffer, 1);

		expect(frame.waveform).toHaveLength(512);
		expect(frame.spectrum).toHaveLength(128);
		expect(frame.waveform[256]).toBeCloseTo(samples[512]);
	});
});
