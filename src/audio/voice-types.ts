import type * as Tone from "tone";
import type { CanonicalBase } from "./types";

export type GenomicVoice = {
	readonly volume: {
		value: number;
		cancelScheduledValues: (time: Tone.Unit.Time) => unknown;
	};
	connect: (destination: Tone.InputNode) => unknown;
	dispose: () => unknown;
	releaseAll: (time?: Tone.Unit.Time) => unknown;
	toDestination: () => unknown;
	triggerAttackRelease: (
		notes: Tone.Unit.Frequency | Tone.Unit.Frequency[],
		duration: Tone.Unit.Time,
		time?: Tone.Unit.Time,
		velocity?: Tone.Unit.NormalRange,
	) => unknown;
};

export type GenomicVoiceBank = Record<CanonicalBase, GenomicVoice>;
