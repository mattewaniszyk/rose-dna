import type { VisualizationAudioFrame } from "./types";

const FFT_SIZE = 512;
const SPECTRUM_BINS = 128;

function reverseBits(value: number, bitCount: number) {
	let reversed = 0;

	for (let bit = 0; bit < bitCount; bit += 1) {
		reversed = (reversed << 1) | ((value >> bit) & 1);
	}

	return reversed;
}

export function fftMagnitudes(samples: Float32Array) {
	const size = samples.length;
	const bitCount = Math.log2(size);

	if (!Number.isInteger(bitCount)) {
		throw new Error("FFT input length must be a power of two.");
	}

	const real = new Float64Array(size);
	const imaginary = new Float64Array(size);

	for (let index = 0; index < size; index += 1) {
		const window =
			size > 1
				? 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1))
				: 1;
		real[reverseBits(index, bitCount)] = samples[index] * window;
	}

	for (let length = 2; length <= size; length *= 2) {
		const half = length / 2;
		const angleStep = (-2 * Math.PI) / length;

		for (let start = 0; start < size; start += length) {
			for (let offset = 0; offset < half; offset += 1) {
				const angle = angleStep * offset;
				const cosine = Math.cos(angle);
				const sine = Math.sin(angle);
				const evenIndex = start + offset;
				const oddIndex = evenIndex + half;
				const oddReal =
				real[oddIndex] * cosine - imaginary[oddIndex] * sine;
				const oddImaginary =
					real[oddIndex] * sine + imaginary[oddIndex] * cosine;
				const evenReal = real[evenIndex];
				const evenImaginary = imaginary[evenIndex];

				real[evenIndex] = evenReal + oddReal;
				imaginary[evenIndex] = evenImaginary + oddImaginary;
				real[oddIndex] = evenReal - oddReal;
				imaginary[oddIndex] = evenImaginary - oddImaginary;
			}
		}
	}

	const magnitudes = new Float32Array(size / 2);

	for (let index = 0; index < magnitudes.length; index += 1) {
		const magnitude =
			Math.hypot(real[index], imaginary[index]) / Math.max(1, size / 2);
		magnitudes[index] = 20 * Math.log10(Math.max(1e-6, magnitude));
	}

	return magnitudes;
}

export function audioBufferFrameAt(
	buffer: AudioBuffer,
	timeSeconds: number,
): VisualizationAudioFrame {
	const samples = new Float32Array(FFT_SIZE);
	const center = Math.floor(timeSeconds * buffer.sampleRate);
	const start = center - Math.floor(FFT_SIZE / 2);

	for (let offset = 0; offset < FFT_SIZE; offset += 1) {
		const sampleIndex = start + offset;

		if (sampleIndex < 0 || sampleIndex >= buffer.length) {
			continue;
		}

		let mixed = 0;

		for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
			mixed += buffer.getChannelData(channel)[sampleIndex] ?? 0;
		}

		samples[offset] = mixed / Math.max(1, buffer.numberOfChannels);
	}

	return {
		waveform: samples,
		spectrum: fftMagnitudes(samples).slice(0, SPECTRUM_BINS),
	};
}
