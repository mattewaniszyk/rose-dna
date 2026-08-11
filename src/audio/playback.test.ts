import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTonePart } from "./playback";
import {
	DEFAULT_VOICE_SETTINGS,
	type GenomicMusicSequence,
} from "./types";
import type { GenomicVoiceBank } from "./voices";

vi.mock("tone", () => ({
	Frequency: (midi: number) => ({ toFrequency: () => midi * 10 }),
	now: () => 12,
}));

function makeSequence(): GenomicMusicSequence {
	return {
		events: [
			{
				time: 0,
				duration: 0.2,
				midi: 60,
				velocity: 0.8,
				base: "A",
				voice: "A",
				qualityScore: 32,
				direction: "r1",
			},
			{
				time: 1,
				duration: 0.2,
				midi: 67,
				velocity: 0.6,
				base: "G",
				voice: "G",
				qualityScore: 24,
				direction: "r2",
			},
		],
		runtimeSeconds: 2,
		noteCount: 2,
		readCount: 2,
		tempoBpm: 88,
		timeSignature: "4/4",
		voiceSettings: DEFAULT_VOICE_SETTINGS,
	};
}

function makeVoiceBank(triggerAttackRelease = vi.fn()) {
	const releaseAll = vi.fn();
	const cancelScheduledValues = vi.fn();
	const voices = Object.fromEntries(
		["A", "C", "G", "T"].map((base) => [
			base,
			{
				triggerAttackRelease,
				releaseAll,
				volume: { value: -8, cancelScheduledValues },
			},
		]),
	) as unknown as GenomicVoiceBank;

	return { voices, releaseAll, triggerAttackRelease };
}

describe("buildTonePart", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("window", globalThis);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("triggers notes without relying on Tone.Transport", () => {
		const { voices, triggerAttackRelease } = makeVoiceBank();
		const onTrigger = vi.fn();
		const onEnded = vi.fn();
		const playback = buildTonePart(
			makeSequence(),
			voices,
			onTrigger,
			onEnded,
		);

		playback.play();
		vi.advanceTimersByTime(1);

		expect(onTrigger).toHaveBeenCalledTimes(1);
		expect(triggerAttackRelease).toHaveBeenLastCalledWith(600, 0.2, 12, 0.8);

		vi.advanceTimersByTime(999);
		expect(onTrigger).toHaveBeenCalledTimes(2);

		vi.advanceTimersByTime(1000);
		expect(onEnded).toHaveBeenCalledOnce();
		expect(playback.getPosition()).toBe(0);
	});

	it("pauses and resumes from the current position", () => {
		const { voices, releaseAll, triggerAttackRelease } = makeVoiceBank();
		const playback = buildTonePart(makeSequence(), voices);

		playback.play();
		vi.advanceTimersByTime(500);
		playback.pause();
		expect(releaseAll).toHaveBeenCalledTimes(4);
		expect(Object.values(voices).every((voice) => voice.volume.value === -Infinity)).toBe(true);
		vi.advanceTimersByTime(1000);
		expect(triggerAttackRelease).toHaveBeenCalledTimes(1);

		playback.play();
		expect(Object.values(voices).every((voice) => voice.volume.value === -8)).toBe(true);
		vi.advanceTimersByTime(500);
		expect(triggerAttackRelease).toHaveBeenCalledTimes(2);
	});

	it("immediately silences active voices when stopped", () => {
		const { voices, releaseAll } = makeVoiceBank();
		const playback = buildTonePart(makeSequence(), voices);

		playback.play();
		vi.advanceTimersByTime(250);
		playback.stop();

		expect(releaseAll).toHaveBeenCalledTimes(4);
		expect(Object.values(voices).every((voice) => voice.volume.value === -Infinity)).toBe(true);
		vi.advanceTimersByTime(2000);
		expect(playback.getPosition()).toBe(0);
	});

	it("can be disposed repeatedly without touching released voice resources", () => {
		const { voices, releaseAll } = makeVoiceBank();
		const playback = buildTonePart(makeSequence(), voices);

		playback.play();
		playback.dispose();
		expect(releaseAll).toHaveBeenCalledTimes(4);

		playback.dispose();
		playback.stop();
		playback.play();
		expect(releaseAll).toHaveBeenCalledTimes(4);
	});
});
