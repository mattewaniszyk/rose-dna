import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VOICE_SETTINGS, type GenomicMusicSequence } from "./types";

const mockState = vi.hoisted(() => ({
	commands: [] as string[][],
	timeouts: [] as number[],
	deletedFiles: [] as string[],
	invalidOutputCount: 0,
	recorders: [] as Array<{ state: string; stop: () => void }>,
	recorderOptions: [] as Array<{ videoBitsPerSecond?: number }>,
	captureFrameRates: [] as number[],
	trackStop: vi.fn(),
	trackRequestFrame: vi.fn(),
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
	FFmpeg: class MockFfmpeg {
		private listeners = new Map<string, Set<(event: never) => void>>();

		async load() {
			return true;
		}

		on(name: string, callback: (event: never) => void) {
			const callbacks = this.listeners.get(name) ?? new Set();
			callbacks.add(callback);
			this.listeners.set(name, callbacks);
		}

		off(name: string, callback: (event: never) => void) {
			this.listeners.get(name)?.delete(callback);
		}

		async writeFile() {
			return true;
		}

		async exec(command: string[], timeout: number) {
			mockState.commands.push(command);
			mockState.timeouts.push(timeout);

			for (const callback of this.listeners.get("progress") ?? []) {
				callback({ progress: 1 } as never);
			}

			return 0;
		}

		async readFile() {
			if (mockState.invalidOutputCount > 0) {
				mockState.invalidOutputCount -= 1;
				return new Uint8Array(8);
			}

			const bytes = new Uint8Array(512);
			bytes.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);
			return bytes;
		}

		async deleteFile(fileName: string) {
			mockState.deletedFiles.push(fileName);
			return true;
		}

		terminate() {}
	},
}));

vi.mock("./sampled-voices", () => ({
	renderSampledSequence: vi.fn(async () => {
		const samples = new Float32Array(4_410);
		samples.fill(0.1);

		return {
			duration: 0.1,
			length: samples.length,
			numberOfChannels: 2,
			sampleRate: 44_100,
			getChannelData: () => samples,
		};
	}),
}));

class MockMediaRecorder {
	static isTypeSupported(mimeType: string) {
		return mimeType === "video/webm;codecs=vp9";
	}

	state = "inactive";
	private listeners = new Map<string, Set<(event: { data: Blob }) => void>>();

	constructor(
		_stream: unknown,
		options: { videoBitsPerSecond?: number },
	) {
		mockState.recorders.push(this);
		mockState.recorderOptions.push(options);
	}

	addEventListener(
		name: string,
		callback: (event: { data: Blob }) => void,
	) {
		const callbacks = this.listeners.get(name) ?? new Set();
		callbacks.add(callback);
		this.listeners.set(name, callbacks);
	}

	start() {
		this.state = "recording";

		for (const callback of this.listeners.get("start") ?? []) {
			callback({ data: new Blob() });
		}
	}

	stop() {
		if (this.state === "inactive") {
			return;
		}

		this.state = "inactive";

		for (const callback of this.listeners.get("dataavailable") ?? []) {
			callback({ data: new Blob([new Uint8Array([1, 2, 3])]) });
		}

		for (const callback of this.listeners.get("stop") ?? []) {
			callback({ data: new Blob() });
		}
	}
}

class MockCanvas {
	width = 1280;
	height = 720;

	captureStream(frameRate: number) {
		mockState.captureFrameRates.push(frameRate);
		const track = {
			stop: mockState.trackStop,
			requestFrame: mockState.trackRequestFrame,
		};

		return {
			getTracks: () => [track],
			getVideoTracks: () => [track],
		};
	}
}

const sequence: GenomicMusicSequence = {
	events: [
		{
			time: 0,
			duration: 0.01,
			midi: 60,
			velocity: 0.7,
			base: "A",
			voice: "A",
			qualityScore: 30,
			direction: "r1",
			sourceReadIndex: 0,
			sourceBaseIndex: 0,
		},
	],
	runtimeSeconds: 0.03,
	noteCount: 1,
	readCount: 1,
	tempoBpm: 88,
	timeSignature: "4/4",
	voiceSettings: DEFAULT_VOICE_SETTINGS,
};

import {
	createAudioEnergyEnvelope,
	exportSequenceToMp4,
	getSupportedVideoMimeType,
	isMp4ExportSupported,
	recordCanvas,
} from "./export-mp4";
import { resetMediaEncoder } from "./export-media";
import {
	getCapturePixelRatio,
	type VideoCaptureSession,
} from "./video-export-options";

function createCaptureSession(
	overrides: Partial<VideoCaptureSession> = {},
): VideoCaptureSession {
	return {
		canvas: new MockCanvas() as unknown as HTMLCanvasElement,
		renderFrame: vi.fn(),
		release: vi.fn(),
		...overrides,
	};
}

describe("MP4 export", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("window", globalThis);
		vi.stubGlobal("MediaRecorder", MockMediaRecorder);
		vi.stubGlobal("HTMLCanvasElement", MockCanvas);
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
			setTimeout(() => callback(performance.now()), 1),
		);
		vi.stubGlobal("cancelAnimationFrame", (timer: number) => clearTimeout(timer));
		vi.stubGlobal("document", {
			hidden: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		});
		mockState.commands.length = 0;
		mockState.timeouts.length = 0;
		mockState.deletedFiles.length = 0;
		mockState.invalidOutputCount = 0;
		mockState.recorders.length = 0;
		mockState.recorderOptions.length = 0;
		mockState.captureFrameRates.length = 0;
		mockState.trackStop.mockClear();
		mockState.trackRequestFrame.mockClear();
		resetMediaEncoder();
	});

	afterEach(() => {
		resetMediaEncoder();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("detects the preferred recording codec and browser support", () => {
		expect(getSupportedVideoMimeType()).toBe("video/webm;codecs=vp9");
		expect(isMp4ExportSupported()).toBe(true);
	});

	it("builds a smoothed energy envelope and keeps silence at zero", () => {
		const silent = new Float32Array(100);
		const loud = new Float32Array(100);
		loud.fill(0.25);
		const makeBuffer = (samples: Float32Array) =>
			({
				duration: 1,
				length: samples.length,
				numberOfChannels: 1,
				sampleRate: 100,
				getChannelData: () => samples,
			}) as unknown as AudioBuffer;

		expect(Array.from(createAudioEnergyEnvelope(makeBuffer(silent), 10))).toEqual(
			new Array(10).fill(0),
		);
		expect(createAudioEnergyEnvelope(makeBuffer(loud), 10)[0]).toBeGreaterThan(0);
	});

	it("raises capture density for narrow high-quality crops", () => {
		expect(
			getCapturePixelRatio(
				{ width: 1080, height: 1920, maxPixelRatio: 2 },
				1440,
				900,
			),
		).toBeCloseTo(2);
		expect(
			getCapturePixelRatio(
				{ width: 1080, height: 1920, maxPixelRatio: 1 },
				1440,
				900,
			),
		).toBe(1);
	});

	it("renders and requests every deterministic frame before stopping", async () => {
		const renderFrame = vi.fn();
		const promise = recordCanvas(createCaptureSession({ renderFrame }), {
			durationSeconds: 0.11,
			energyEnvelope: new Float32Array([0.1, 0.2, 0.3, 0.4]),
		});

		await vi.advanceTimersByTimeAsync(134);

		await expect(promise).resolves.toBeInstanceOf(Blob);
		expect(mockState.captureFrameRates).toEqual([0]);
		expect(mockState.trackRequestFrame).toHaveBeenCalledTimes(4);
		expect(renderFrame.mock.calls).toEqual([
			[0, expect.closeTo(0.1)],
			[1 / 30, expect.closeTo(0.2)],
			[2 / 30, expect.closeTo(0.3)],
			[3 / 30, expect.closeTo(0.4)],
		]);
		expect(mockState.trackStop).toHaveBeenCalledOnce();
	});

	it("keeps frame timestamps deterministic when rendering falls behind", async () => {
		let wallTime = 0;
		const nowSpy = vi
			.spyOn(performance, "now")
			.mockImplementation(() => wallTime);
		const renderFrame = vi.fn((_elapsedSeconds: number, _energy: number) => {
			wallTime += 75;
		});
		const promise = recordCanvas(createCaptureSession({ renderFrame }), {
			durationSeconds: 0.1,
			energyEnvelope: new Float32Array([0.2, 0.4, 0.6]),
		});

		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBeInstanceOf(Blob);

		expect(renderFrame.mock.calls.map(([timestamp]) => timestamp)).toEqual([
			0,
			1 / 30,
			2 / 30,
		]);
		expect(mockState.trackRequestFrame).toHaveBeenCalledTimes(3);
		expect(wallTime).toBeGreaterThan(100);
		nowSpy.mockRestore();
	});

	it("stops the recorder and capture track when cancelled", async () => {
		const controller = new AbortController();
		const promise = recordCanvas(createCaptureSession(), {
			durationSeconds: 1,
			energyEnvelope: new Float32Array([0.5]),
			signal: controller.signal,
		});
		const expectation = expect(promise).rejects.toThrow("cancelled");

		controller.abort(new DOMException("cancelled", "AbortError"));
		await expectation;

		expect(mockState.recorders[0]?.state).toBe("inactive");
		expect(mockState.trackStop).toHaveBeenCalledOnce();
	});

	it("creates a validated 1080p H.264/AAC MP4 and cleans temporary files", async () => {
		const stages: string[] = [];
		const releaseScene = vi.fn();
		const promise = exportSequenceToMp4(sequence, {
			prepareScene: vi.fn(async () =>
				createCaptureSession({ release: releaseScene }),
			),
			onProgress: ({ stage }) => stages.push(stage),
		});

		await vi.advanceTimersByTimeAsync(40);
		const blob = await promise;

		expect(blob.type).toBe("video/mp4");
		expect(stages).toContain("rendering-audio");
		expect(stages).toContain("recording-video");
		expect(stages).toContain("encoding-mp4");
		expect(releaseScene).toHaveBeenCalledOnce();
		expect(mockState.trackStop).toHaveBeenCalledOnce();
		expect(mockState.deletedFiles).toHaveLength(3);

		const command = mockState.commands[0] ?? [];
		expect(command).toContain("libx264");
		expect(command).toContain("aac");
		expect(command).toContain("yuv420p");
		expect(command[command.indexOf("-preset") + 1]).toBe("superfast");
		expect(command[command.indexOf("-crf") + 1]).toBe("12");
		expect(mockState.recorderOptions[0]?.videoBitsPerSecond).toBe(32_000_000);
		expect(command).not.toContain("+faststart");
		expect(mockState.timeouts[0]).toBe(-1);
		expect(command.join(" ")).toContain(
			"scale=1920:1080:force_original_aspect_ratio=increase",
		);
		expect(command.join(" ")).toContain("crop=1920:1080");
		expect(command.join(" ")).toContain("setdar=16/9");
		expect(command.join(" ")).toContain("setpts=N/(30*TB)");
		expect(command[command.indexOf("-aspect") + 1]).toBe("16:9");
	});

	it("uses the selected portrait dimensions and display aspect", async () => {
		const prepareScene = vi.fn(async () => createCaptureSession());
		const promise = exportSequenceToMp4(sequence, {
			aspectRatio: "9:16",
			quality: "near-lossless",
			prepareScene,
		});

		await vi.advanceTimersByTimeAsync(40);
		await promise;

		const command = mockState.commands[0] ?? [];
		expect(command.join(" ")).toContain(
			"scale=1080:1920:force_original_aspect_ratio=increase",
		);
		expect(command.join(" ")).toContain("crop=1080:1920");
		expect(command.join(" ")).toContain("setdar=9/16");
		expect(command[command.indexOf("-aspect") + 1]).toBe("9:16");
		expect(command[command.indexOf("-preset") + 1]).toBe("ultrafast");
		expect(command[command.indexOf("-crf") + 1]).toBe("1");
		expect(mockState.recorderOptions[0]?.videoBitsPerSecond).toBe(80_000_000);
		expect(prepareScene).toHaveBeenCalledWith(
			expect.objectContaining({
				width: 1080,
				height: 1920,
				maxPixelRatio: 2,
				sequence,
				audioBuffer: expect.anything(),
			}),
			undefined,
		);
	});

	it("rejects unsupported capture and honors pre-recording cancellation", async () => {
		vi.stubGlobal("MediaRecorder", undefined);
		expect(isMp4ExportSupported()).toBe(false);

		await expect(
			recordCanvas(createCaptureSession(), {
				durationSeconds: 1,
				energyEnvelope: new Float32Array([0]),
			}),
		).rejects.toThrow("Chrome or Edge");

		vi.stubGlobal("MediaRecorder", MockMediaRecorder);
		const controller = new AbortController();
		controller.abort(new DOMException("cancelled", "AbortError"));

		await expect(
			recordCanvas(createCaptureSession(), {
				durationSeconds: 1,
				energyEnvelope: new Float32Array([0]),
				signal: controller.signal,
			}),
		).rejects.toThrow("cancelled");
	});

	it("rejects invalid MP4 output and allows a clean retry", async () => {
		mockState.invalidOutputCount = 1;
		const options = {
			prepareScene: vi.fn(async () => createCaptureSession()),
		};

		const first = exportSequenceToMp4(sequence, options);
		const firstExpectation = expect(first).rejects.toThrow(
			"invalid or empty MP4",
		);
		await vi.advanceTimersByTimeAsync(40);
		await firstExpectation;

		const second = exportSequenceToMp4(sequence, options);
		await vi.advanceTimersByTimeAsync(40);
		await expect(second).resolves.toBeInstanceOf(Blob);
	});
});
