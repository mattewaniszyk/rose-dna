import * as Tone from "tone";
import type { GenomicMusicSequence } from "./types";
import {
	createElectronicVoice,
	type GenomicVoiceBank,
} from "./voices";

export { createElectronicVoice };

export type ScheduledGenomicPlayback = {
	dispose: () => void;
	getPosition: () => number;
	pause: () => void;
	play: () => void;
	setLoop: (enabled: boolean) => void;
	stop: () => void;
};

export function buildTonePart(
	sequence: GenomicMusicSequence,
	voices: GenomicVoiceBank,
	onTrigger?: () => void,
	onEnded?: () => void,
): ScheduledGenomicPlayback {
	let timerIds: number[] = [];
	let endTimerId: number | null = null;
	let positionSeconds = 0;
	let startedAtMs = 0;
	let isRunning = false;
	let isLoopEnabled = false;
	let isDisposed = false;
	const initialVoiceVolumes = new Map(
		Object.values(voices).map((voice) => [voice, voice.volume.value]),
	);

	const silenceVoices = () => {
		const now = Tone.now();

		for (const voice of Object.values(voices)) {
			voice.releaseAll(now);
			voice.volume.cancelScheduledValues(now);
			voice.volume.value = Number.NEGATIVE_INFINITY;
		}
	};

	const restoreVoiceVolumes = () => {
		const now = Tone.now();

		for (const voice of Object.values(voices)) {
			voice.volume.cancelScheduledValues(now);
			voice.volume.value = initialVoiceVolumes.get(voice) ?? 0;
		}
	};

	const clearTimers = () => {
		for (const timerId of timerIds) {
			window.clearTimeout(timerId);
		}

		timerIds = [];

		if (endTimerId !== null) {
			window.clearTimeout(endTimerId);
			endTimerId = null;
		}
	};

	const getPosition = () => {
		if (!isRunning) {
			return positionSeconds;
		}

		return Math.min(
			sequence.runtimeSeconds,
			positionSeconds + (performance.now() - startedAtMs) / 1000,
		);
	};

	const play = () => {
		if (isRunning || isDisposed) {
			return;
		}

		clearTimers();
		restoreVoiceVolumes();
		isRunning = true;
		startedAtMs = performance.now();

		for (const event of sequence.events) {
			if (event.time < positionSeconds) {
				continue;
			}

			const delayMs = Math.max(0, (event.time - positionSeconds) * 1000);
			const timerId = window.setTimeout(() => {
				onTrigger?.();
				voices[event.voice].triggerAttackRelease(
					Tone.Frequency(event.midi, "midi").toFrequency(),
					event.duration,
					Tone.now(),
					event.velocity,
				);
			}, delayMs);

			timerIds.push(timerId);
		}

		const remainingMs = Math.max(
			0,
			(sequence.runtimeSeconds - positionSeconds) * 1000,
		);
		endTimerId = window.setTimeout(() => {
			clearTimers();
			silenceVoices();
			isRunning = false;
			positionSeconds = 0;

			if (isLoopEnabled) {
				play();
			} else {
				onEnded?.();
			}
		}, remainingMs);
	};

	const pause = () => {
		if (!isRunning || isDisposed) {
			return;
		}

		positionSeconds = getPosition();
		isRunning = false;
		clearTimers();
		silenceVoices();
	};

	const stop = () => {
		if (isDisposed) {
			return;
		}

		isRunning = false;
		positionSeconds = 0;
		clearTimers();
		silenceVoices();
	};

	const dispose = () => {
		if (isDisposed) {
			return;
		}

		stop();
		isDisposed = true;
	};

	return {
		dispose,
		getPosition,
		pause,
		play,
		setLoop: (enabled) => {
			isLoopEnabled = enabled;
		},
		stop,
	};
}
