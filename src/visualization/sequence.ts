import type {
	CanonicalBase,
	GenomicMusicSequence,
	GenomicNoteEvent,
} from "@/audio/types";
import { TIME_SIGNATURE_VALUES } from "@/audio/types";

export const BASE_COMPLEMENTS: Record<CanonicalBase, CanonicalBase> = {
	A: "T",
	C: "G",
	G: "C",
	T: "A",
};

export const BASE_COLORS: Record<CanonicalBase, string> = {
	A: "#f4adc8",
	C: "#7dd3fc",
	G: "#86efac",
	T: "#fcd34d",
};

export function complementBase(base: CanonicalBase) {
	return BASE_COMPLEMENTS[base];
}

export function secondsPerMeasure(sequence: GenomicMusicSequence) {
	const [beats, denominator] = TIME_SIGNATURE_VALUES[sequence.timeSignature];
	const quarterNotes = beats * (4 / denominator);

	return quarterNotes * (60 / sequence.tempoBpm);
}

export function getFocusedEventIndex(
	events: GenomicNoteEvent[],
	timeSeconds: number,
) {
	if (!events.length) {
		return -1;
	}

	const time = Math.max(0, timeSeconds);
	let low = 0;
	let high = events.length - 1;
	let result = 0;

	while (low <= high) {
		const middle = Math.floor((low + high) / 2);

		if (events[middle].time <= time) {
			result = middle;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}

	return result;
}

export function isEventActive(event: GenomicNoteEvent, timeSeconds: number) {
	return (
		timeSeconds >= event.time &&
		timeSeconds < event.time + event.duration
	);
}
