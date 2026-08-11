import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_VOICE_SETTINGS,
	type GenomicMusicSequence,
} from "./types";
import { renderSampledSequence } from "./sampled-voices";

const mockState = vi.hoisted(() => ({
	instances: [] as Array<{ terminated: boolean }>,
	failLoadCount: 0,
	invalidOutputCount: 0,
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
	FFmpeg: class MockFfmpeg {
		loaded = false;
		terminated = false;
		private listeners = new Map<string, Set<(event: never) => void>>();

		constructor() {
			mockState.instances.push(this);
		}

		async load() {
			if (mockState.failLoadCount > 0) {
				mockState.failLoadCount -= 1;
				throw new Error("load failed");
			}

			this.loaded = true;
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

		async exec() {
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
			bytes.set([0x49, 0x44, 0x33]);
			return bytes;
		}

		async deleteFile() {
			return true;
		}

		terminate() {
			this.terminated = true;
		}
	},
}));

vi.mock("./sampled-voices", () => ({
	renderSampledSequence: vi.fn(async () => ({
		getChannelData: () => new Float32Array(128),
	})),
}));

import { exportSequenceToMp3, terminateMp3Encoder } from "./export-mp3";

const sequence: GenomicMusicSequence = {
	events: [
		{
			time: 0,
			duration: 0.25,
			midi: 60,
			velocity: 0.7,
			base: "A",
			voice: "A",
			qualityScore: 30,
			direction: "r1",
		},
	],
	runtimeSeconds: 30,
	noteCount: 1,
	readCount: 1,
	tempoBpm: 88,
	timeSignature: "4/4",
	voiceSettings: DEFAULT_VOICE_SETTINGS,
};

describe("exportSequenceToMp3", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		terminateMp3Encoder();
		mockState.instances.length = 0;
		mockState.failLoadCount = 0;
		mockState.invalidOutputCount = 0;
		vi.stubGlobal("window", globalThis);
	});

	it("creates a validated MP3 blob and reports each stage", async () => {
		const stages: string[] = [];
		const blob = await exportSequenceToMp3(sequence, {
			onProgress: ({ stage }) => stages.push(stage),
		});

		expect(blob.type).toBe("audio/mpeg");
		expect(blob.size).toBe(512);
		expect(renderSampledSequence).toHaveBeenCalledWith(sequence, {
			channels: 2,
			sampleRate: 44_100,
		});
		expect(stages).toContain("rendering");
		expect(stages).toContain("loading-encoder");
		expect(stages).toContain("encoding");
	});

	it("resets a failed encoder so a retry can succeed", async () => {
		mockState.failLoadCount = 1;

		await expect(exportSequenceToMp3(sequence)).rejects.toThrow("load failed");
		expect(mockState.instances[0]?.terminated).toBe(true);

		await expect(exportSequenceToMp3(sequence)).resolves.toBeInstanceOf(Blob);
		expect(mockState.instances).toHaveLength(2);
	});

	it("rejects empty output, resets the worker, and permits retry", async () => {
		mockState.invalidOutputCount = 1;

		await expect(exportSequenceToMp3(sequence)).rejects.toThrow(
			"invalid or empty MP3",
		);
		expect(mockState.instances[0]?.terminated).toBe(true);
		await expect(exportSequenceToMp3(sequence)).resolves.toBeInstanceOf(Blob);
	});

	it("honors cancellation before encoder work begins", async () => {
		const controller = new AbortController();
		controller.abort(new DOMException("cancelled", "AbortError"));

		await expect(
			exportSequenceToMp3(sequence, { signal: controller.signal }),
		).rejects.toThrow("cancelled");
		expect(mockState.instances).toHaveLength(0);
	});
});
