import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VOICE_SETTINGS, type GenomicMusicSequence } from "./types";

const mockState = vi.hoisted(() => ({
	commands: [] as string[][],
	timeouts: [] as number[],
	encoderLoads: 0,
	writtenFiles: [] as string[],
	deletedFiles: [] as string[],
	invalidOutputCount: 0,
	recorders: [] as Array<{ state: string; stop: () => void }>,
	recorderOptions: [] as Array<{ videoBitsPerSecond?: number }>,
	recorderStreams: [] as MockMediaStream[],
	captureFrameRates: [] as number[],
	trackStop: vi.fn(),
	trackRequestFrame: vi.fn(),
	audioTrackStop: vi.fn(),
	audioSourceStart: vi.fn(),
	audioSourceStop: vi.fn(),
	audioSourceConnect: vi.fn(),
	audioSourceDisconnect: vi.fn(),
	supportedMimeTypes: new Set<string>(),
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
	FFmpeg: class MockFfmpeg {
		private listeners = new Map<string, Set<(event: never) => void>>();

		async load() {
			mockState.encoderLoads += 1;
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

		async writeFile(fileName: string) {
			mockState.writtenFiles.push(fileName);
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
		return mockState.supportedMimeTypes.has(mimeType);
	}

	state = "inactive";
	private listeners = new Map<string, Set<(event: { data: Blob }) => void>>();

	constructor(
		stream: MockMediaStream,
		options: { mimeType?: string; videoBitsPerSecond?: number },
	) {
		mockState.recorders.push(this);
		mockState.recorderOptions.push(options);
		mockState.recorderStreams.push(stream);
		this.mimeType = options.mimeType ?? "";
	}

	private mimeType: string;

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
			const shouldReturnInvalidMp4 =
				this.mimeType.startsWith("video/mp4") &&
				mockState.invalidOutputCount > 0;
			if (shouldReturnInvalidMp4) {
				mockState.invalidOutputCount -= 1;
			}
			const bytes =
				this.mimeType.startsWith("video/mp4") && !shouldReturnInvalidMp4
					? (() => {
							const mp4 = new Uint8Array(512);
							mp4.set([
								0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
								0x6d,
							]);
							return mp4;
						})()
					: new Uint8Array([1, 2, 3]);
			callback({ data: new Blob([bytes]) });
		}

		for (const callback of this.listeners.get("stop") ?? []) {
			callback({ data: new Blob() });
		}
	}

	emitError() {
		for (const callback of this.listeners.get("error") ?? []) {
			callback({ data: new Blob() });
		}
	}
}

class MockMediaStream {
	private tracks: Array<{ stop: () => void; requestFrame?: () => void }>;

	constructor(videoTrack?: { stop: () => void; requestFrame?: () => void }) {
		this.tracks = videoTrack ? [videoTrack] : [];
	}

	addTrack(track: { stop: () => void }) {
		this.tracks.push(track);
	}

	getTracks() {
		return this.tracks;
	}

	getVideoTracks() {
		return this.tracks.filter((track) => "requestFrame" in track);
	}

	getAudioTracks() {
		return this.tracks.filter((track) => !("requestFrame" in track));
	}
}

function createMockAudioContext() {
	return {
		createBufferSource: vi.fn(() => ({
			buffer: null,
			connect: mockState.audioSourceConnect,
			disconnect: mockState.audioSourceDisconnect,
			start: mockState.audioSourceStart,
			stop: mockState.audioSourceStop,
		})),
		createMediaStreamDestination: vi.fn(() => ({
			stream: {
				getAudioTracks: () => [{ stop: mockState.audioTrackStop }],
			},
		})),
	} as unknown as AudioContext;
}

function createMockAudioBuffer(): AudioBuffer {
	const samples = new Float32Array(4_410);

	return {
		duration: 0.1,
		length: samples.length,
		numberOfChannels: 2,
		sampleRate: 44_100,
		getChannelData: () => samples,
	} as unknown as AudioBuffer;
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

		return new MockMediaStream(track) as unknown as MediaStream;
	}
}

class MockAutomaticCanvas {
	width = 1280;
	height = 720;

	captureStream(frameRate: number) {
		mockState.captureFrameRates.push(frameRate);
		const track = {
			stop: mockState.trackStop,
		};

		const stream = new MockMediaStream();
		stream.addTrack(track);
		return {
			addTrack: stream.addTrack.bind(stream),
			getTracks: stream.getTracks.bind(stream),
			getVideoTracks: () => [track],
			getAudioTracks: stream.getAudioTracks.bind(stream),
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
	getContainedVideoCaptureViewport,
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
		mockState.encoderLoads = 0;
		mockState.writtenFiles.length = 0;
		mockState.deletedFiles.length = 0;
		mockState.invalidOutputCount = 0;
		mockState.recorders.length = 0;
		mockState.recorderOptions.length = 0;
		mockState.recorderStreams.length = 0;
		mockState.captureFrameRates.length = 0;
		mockState.trackStop.mockClear();
		mockState.trackRequestFrame.mockClear();
		mockState.audioTrackStop.mockClear();
		mockState.audioSourceStart.mockClear();
		mockState.audioSourceStop.mockClear();
		mockState.audioSourceConnect.mockClear();
		mockState.audioSourceDisconnect.mockClear();
		mockState.supportedMimeTypes.clear();
		mockState.supportedMimeTypes.add("video/webm;codecs=vp9");
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

		mockState.supportedMimeTypes.add("video/mp4");
		expect(getSupportedVideoMimeType()).toBe("video/mp4");
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

	it("fits the capture scene to the requested aspect without cropping its edges", () => {
		expect(
			getContainedVideoCaptureViewport(1920, 1080, 1600, 1200),
		).toEqual({
			width: 1600,
			height: 900,
		});
		expect(
			getContainedVideoCaptureViewport(1080, 1920, 1600, 1200),
		).toEqual({
			width: 675,
			height: 1200,
		});
	});

	it("seeds frame zero before creating the manual capture stream", async () => {
		const callOrder: string[] = [];
		const renderFrame = vi.fn(() => callOrder.push("render"));
		const canvas = new MockCanvas();
		const captureStream = canvas.captureStream.bind(canvas);
		canvas.captureStream = (frameRate: number) => {
			callOrder.push("capture-stream");
			return captureStream(frameRate);
		};
		const promise = recordCanvas(
			createCaptureSession({
				canvas: canvas as unknown as HTMLCanvasElement,
				renderFrame,
			}),
			{
				durationSeconds: 0.03,
				energyEnvelope: new Float32Array([0.25]),
			},
		);

		expect(callOrder.slice(0, 2)).toEqual(["render", "capture-stream"]);
		expect(renderFrame).toHaveBeenCalledWith(0, expect.closeTo(0.25));
		await vi.advanceTimersByTimeAsync(34);
		await expect(promise).resolves.toBeInstanceOf(Blob);
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

	it("falls back to real-time canvas capture when requestFrame is unavailable", async () => {
		const renderFrame = vi.fn();
		const canvas = new MockAutomaticCanvas();
		const promise = recordCanvas(
			createCaptureSession({
				canvas: canvas as unknown as HTMLCanvasElement,
				renderFrame,
			}),
			{
				durationSeconds: 0.1,
				energyEnvelope: new Float32Array([0.2, 0.4, 0.6]),
			},
		);

		await vi.advanceTimersByTimeAsync(101);
		await expect(promise).resolves.toBeInstanceOf(Blob);
		expect(mockState.captureFrameRates).toEqual([0, 30]);
		expect(mockState.trackRequestFrame).not.toHaveBeenCalled();
		expect(renderFrame).toHaveBeenCalledTimes(3);
		expect(mockState.trackStop).toHaveBeenCalledTimes(2);
	});

	it("retains all 1,800 frames for a one-minute export", async () => {
		const renderFrame = vi.fn();
		const promise = recordCanvas(createCaptureSession({ renderFrame }), {
			durationSeconds: 60,
			energyEnvelope: new Float32Array([0]),
		});

		await vi.advanceTimersByTimeAsync(60_100);
		await expect(promise).resolves.toBeInstanceOf(Blob);
		expect(renderFrame).toHaveBeenCalledTimes(1_800);
		expect(mockState.trackRequestFrame).toHaveBeenCalledTimes(1_800);
		expect(renderFrame).toHaveBeenNthCalledWith(1_800, 1_799 / 30, 0);
	});

	it("keeps deterministic frames separated when rendering falls behind", async () => {
		const renderFrame = vi.fn();
		const promise = recordCanvas(createCaptureSession({ renderFrame }), {
			durationSeconds: 0.1,
			energyEnvelope: new Float32Array([0.2, 0.4, 0.6]),
		});

		expect(renderFrame).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(32);
		expect(renderFrame).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(2);
		expect(renderFrame).toHaveBeenCalledTimes(2);

		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBeInstanceOf(Blob);

		expect(renderFrame.mock.calls.map(([timestamp]) => timestamp)).toEqual([
			0,
			1 / 30,
			2 / 30,
		]);
		expect(mockState.trackRequestFrame).toHaveBeenCalledTimes(3);
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

	it("stops native MP4 audio nodes and tracks when cancelled", async () => {
		mockState.supportedMimeTypes.clear();
		mockState.supportedMimeTypes.add("video/mp4");
		const controller = new AbortController();
		const promise = recordCanvas(createCaptureSession(), {
			durationSeconds: 1,
			energyEnvelope: new Float32Array([0.5]),
			audioBuffer: createMockAudioBuffer(),
			audioContext: createMockAudioContext(),
			signal: controller.signal,
		});
		const expectation = expect(promise).rejects.toThrow("cancelled");

		controller.abort(new DOMException("cancelled", "AbortError"));
		await expectation;

		expect(mockState.audioSourceStart).toHaveBeenCalledOnce();
		expect(mockState.audioSourceStop).toHaveBeenCalledOnce();
		expect(mockState.audioSourceDisconnect).toHaveBeenCalledOnce();
		expect(mockState.audioTrackStop).toHaveBeenCalledOnce();
	});

	it("cleans native MP4 audio when the recorder errors", async () => {
		mockState.supportedMimeTypes.clear();
		mockState.supportedMimeTypes.add("video/mp4");
		const promise = recordCanvas(createCaptureSession(), {
			durationSeconds: 1,
			energyEnvelope: new Float32Array([0.5]),
			audioBuffer: createMockAudioBuffer(),
			audioContext: createMockAudioContext(),
		});
		const expectation = expect(promise).rejects.toThrow(
			"could not record the scene",
		);

		(mockState.recorders[0] as MockMediaRecorder).emitError();
		await expectation;

		expect(mockState.audioSourceStop).toHaveBeenCalledOnce();
		expect(mockState.audioSourceDisconnect).toHaveBeenCalledOnce();
		expect(mockState.audioTrackStop).toHaveBeenCalledOnce();
	});

	it("cleans native MP4 audio when the document becomes hidden", async () => {
		mockState.supportedMimeTypes.clear();
		mockState.supportedMimeTypes.add("video/mp4");
		const promise = recordCanvas(createCaptureSession(), {
			durationSeconds: 1,
			energyEnvelope: new Float32Array([0.5]),
			audioBuffer: createMockAudioBuffer(),
			audioContext: createMockAudioContext(),
		});
		const expectation = expect(promise).rejects.toThrow("tab was hidden");
		const visibilityListener = vi
			.mocked(document.addEventListener)
			.mock.calls.find(([name]) => name === "visibilitychange")?.[1] as
			| EventListener
			| undefined;

		Object.defineProperty(document, "hidden", {
			configurable: true,
			value: true,
		});
		visibilityListener?.(new Event("visibilitychange"));
		await expectation;

		expect(mockState.audioSourceStop).toHaveBeenCalledOnce();
		expect(mockState.audioSourceDisconnect).toHaveBeenCalledOnce();
		expect(mockState.audioTrackStop).toHaveBeenCalledOnce();
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
		expect(command.join(" ")).toContain(
			"tpad=stop_mode=clone:stop_duration=0.030",
		);
		expect(command[command.indexOf("-aspect") + 1]).toBe("16:9");
		expect(command[command.indexOf("-t") + 1]).toBe("0.030");
		expect(command).toContain("-shortest");
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

	it("returns native Safari MP4 with Web Audio without loading FFmpeg", async () => {
		mockState.supportedMimeTypes.clear();
		mockState.supportedMimeTypes.add("video/mp4");
		expect(getSupportedVideoMimeType()).toBe("video/mp4");
		const stages: string[] = [];
		const arrayBufferSizes: number[] = [];
		const originalArrayBuffer = Blob.prototype.arrayBuffer;
		const arrayBufferSpy = vi
			.spyOn(Blob.prototype, "arrayBuffer")
			.mockImplementation(function (this: Blob) {
				arrayBufferSizes.push(this.size);
				return originalArrayBuffer.call(this);
			});

		const promise = exportSequenceToMp4(sequence, {
			audioContext: createMockAudioContext(),
			quality: "near-lossless",
			prepareScene: vi.fn(async () => createCaptureSession()),
			onProgress: ({ stage }) => stages.push(stage),
		});

		await vi.advanceTimersByTimeAsync(40);
		const blob = await promise;
		arrayBufferSpy.mockRestore();

		expect(blob.type).toBe("video/mp4");
		expect(blob.size).toBe(512);
		expect(arrayBufferSizes).toEqual([12]);
		expect(mockState.recorderStreams[0]?.getTracks()).toHaveLength(2);
		expect(mockState.audioSourceConnect).toHaveBeenCalledOnce();
		expect(mockState.audioSourceStart).toHaveBeenCalledOnce();
		expect(mockState.audioSourceStop).toHaveBeenCalledOnce();
		expect(mockState.audioSourceDisconnect).toHaveBeenCalledOnce();
		expect(mockState.audioTrackStop).toHaveBeenCalledOnce();
		expect(mockState.recorderOptions[0]?.videoBitsPerSecond).toBe(80_000_000);
		expect(mockState.encoderLoads).toBe(0);
		expect(mockState.writtenFiles).toEqual([]);
		expect(mockState.commands).toEqual([]);
		expect(mockState.deletedFiles).toEqual([]);
		expect(stages).not.toContain("loading-encoder");
		expect(stages).not.toContain("encoding-mp4");
	});

	it("rejects unsupported capture and honors pre-recording cancellation", async () => {
		vi.stubGlobal("MediaRecorder", undefined);
		expect(isMp4ExportSupported()).toBe(false);

		await expect(
			recordCanvas(createCaptureSession(), {
				durationSeconds: 1,
				energyEnvelope: new Float32Array([0]),
			}),
		).rejects.toThrow("cannot capture");

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

	it("rejects invalid native MP4 output and allows a clean retry", async () => {
		mockState.supportedMimeTypes.clear();
		mockState.supportedMimeTypes.add("video/mp4");
		mockState.invalidOutputCount = 1;
		const options = {
			audioContext: createMockAudioContext(),
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
		expect(mockState.encoderLoads).toBe(0);
		expect(mockState.commands).toEqual([]);
	});

	it("rejects invalid FFmpeg MP4 output and allows a clean retry", async () => {
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
