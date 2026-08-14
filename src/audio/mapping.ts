import type {
	CanonicalBase,
	FastqDataset,
	FastqRead,
	GenomicMusicSequence,
	GenomicNoteEvent,
	GroupEndingMode,
	MappingOptions,
	TimeSignature,
	VoiceSettingsByBase,
} from "./types";
import {
	CANONICAL_BASES,
	DEFAULT_VOICE_SETTINGS,
	VOICE_PRESET_IDS,
} from "./types";

const SCALE_SEMITONES = [0, 2, 3, 5, 7, 8, 10] as const;

const BASE_TO_SCALE_INDEX: Record<CanonicalBase, number> = {
	A: 0,
	C: 2,
	G: 4,
	T: 6,
};

const CANONICAL_BASE_SET = new Set<CanonicalBase>(CANONICAL_BASES);
const RELEASE_TAIL_SECONDS = 3.2;
const METER_ACCENTS: Record<
	TimeSignature,
	{ stepsPerMeasure: number; beatSteps: number[] }
> = {
	"3/4": {
		stepsPerMeasure: 12,
		beatSteps: [0, 4, 8],
	},
	"4/4": {
		stepsPerMeasure: 16,
		beatSteps: [0, 4, 8, 12],
	},
	"5/4": {
		stepsPerMeasure: 20,
		beatSteps: [0, 4, 8, 12, 16],
	},
	"6/8": {
		stepsPerMeasure: 12,
		beatSteps: [0, 6],
	},
	"7/8": {
		stepsPerMeasure: 14,
		beatSteps: [0, 4, 8],
	},
};

type NoteCandidate = {
	base: CanonicalBase;
	baseIndex: number;
	direction: FastqRead["direction"];
	qualityScore: number;
	sourceReadIndex: number;
	sourceOrder: number;
};

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, amount: number) {
	return start + (end - start) * amount;
}

function getMeterGroupEndings(
	meter: (typeof METER_ACCENTS)[TimeSignature],
	lengthSteps: number,
) {
	const reservedSteps = new Set<number>();
	const holdDurations = new Map<number, number>();
	const groupBoundaries = [
		...meter.beatSteps.slice(1),
		meter.stepsPerMeasure,
	];

	for (const boundary of groupBoundaries) {
		for (let offset = 1; offset <= lengthSteps; offset += 1) {
			reservedSteps.add(boundary - offset);
		}

		if (lengthSteps > 0) {
			holdDurations.set(boundary - lengthSteps - 1, lengthSteps + 1);
		}
	}

	return { holdDurations, reservedSteps };
}

function interleaveReads(readsA: FastqRead[], readsB: FastqRead[]) {
	const merged: Array<{ read: FastqRead; sourceReadIndex: number }> = [];
	const length = Math.max(readsA.length, readsB.length);

	for (let index = 0; index < length; index += 1) {
		if (readsA[index]) {
			merged.push({ read: readsA[index], sourceReadIndex: index });
		}

		if (readsB[index]) {
			merged.push({ read: readsB[index], sourceReadIndex: index });
		}
	}

	return merged;
}

function qualityToVelocity(qualityScore: number) {
	const normalized = clamp(qualityScore / 40, 0, 1);
	return clamp(0.22 + normalized * 0.74, 0.22, 0.96);
}

function baseToMidi(
	base: CanonicalBase,
	directionRoot: number,
	baseIndex: number,
) {
	const degree = BASE_TO_SCALE_INDEX[base];
	const scaleSemitone = SCALE_SEMITONES[degree % SCALE_SEMITONES.length];
	const octaveOffset = Math.floor((baseIndex % 21) / 7) * 12;

	return clamp(directionRoot + scaleSemitone + octaveOffset, 36, 96);
}

function isCanonicalBase(base: string): base is CanonicalBase {
	return CANONICAL_BASE_SET.has(base as CanonicalBase);
}

function normalizeVoiceSettings(
	settings: MappingOptions["voiceSettings"] | undefined,
): VoiceSettingsByBase {
	return Object.fromEntries(
		CANONICAL_BASES.map((base) => {
			const fallback = DEFAULT_VOICE_SETTINGS[base];
			const supplied = settings?.[base];
			const preset = VOICE_PRESET_IDS.includes(
				supplied?.preset as (typeof VOICE_PRESET_IDS)[number],
			)
				? supplied?.preset ?? fallback.preset
				: fallback.preset;

			return [
				base,
				{
					preset,
					volumeDb: clamp(supplied?.volumeDb ?? fallback.volumeDb, -30, 0),
					octaveShift: Math.round(
						clamp(supplied?.octaveShift ?? fallback.octaveShift, -2, 2),
					),
				},
			];
		}),
	) as VoiceSettingsByBase;
}

function sampleEvenly<T>(items: T[], count: number) {
	if (count >= items.length) {
		return items;
	}

	if (count <= 0) {
		return [];
	}

	if (count === 1) {
		return [items[Math.floor((items.length - 1) / 2)]];
	}

	return Array.from({ length: count }, (_, index) => {
		const itemIndex = Math.round(
			(index * (items.length - 1)) / (count - 1),
		);

		return items[itemIndex];
	});
}

function sampleCandidates(candidates: NoteCandidate[], count: number) {
	if (count >= candidates.length) {
		return candidates;
	}

	const groups = new Map<string, NoteCandidate[]>();

	for (const candidate of candidates) {
		const key = `${candidate.direction}-${candidate.base}`;
		const group = groups.get(key) ?? [];
		group.push(candidate);
		groups.set(key, group);
	}

	const populatedGroups = [...groups.values()];
	const allocations: number[] = populatedGroups.map((group) =>
		count >= populatedGroups.length && group.length > 0 ? 1 : 0,
	);
	let allocated = allocations.reduce((total, value) => total + value, 0);

	while (allocated < count) {
		let bestIndex = -1;
		let bestDeficit = Number.NEGATIVE_INFINITY;

		for (let index = 0; index < populatedGroups.length; index += 1) {
			const group = populatedGroups[index];

			if (allocations[index] >= group.length) {
				continue;
			}

			const desired = (group.length / candidates.length) * count;
			const deficit = desired - allocations[index];

			if (deficit > bestDeficit) {
				bestDeficit = deficit;
				bestIndex = index;
			}
		}

		if (bestIndex < 0) {
			break;
		}

		allocations[bestIndex] += 1;
		allocated += 1;
	}

	return populatedGroups
		.flatMap((group, index) => sampleEvenly(group, allocations[index]))
		.sort(
			(left, right) =>
				left.sourceOrder - right.sourceOrder ||
				left.baseIndex - right.baseIndex,
		);
}

export function mapDatasetToSequence(
	dataset: FastqDataset,
	options: MappingOptions,
): GenomicMusicSequence {
	const tempo = clamp(options.tempoBpm, 48, 180);
	const voiceSettings = normalizeVoiceSettings(options.voiceSettings);
	const timeSignature = options.timeSignature ?? "4/4";
	const meter = METER_ACCENTS[timeSignature];
	const accentAmount =
		clamp(options.accentStrengthPercent ?? 100, 0, 100) / 100;
	const groupEndingLengthSteps = Math.round(
		clamp(options.groupEndingLengthSteps ?? 1, 0, 2),
	);
	const groupEndingMode: GroupEndingMode =
		options.groupEndingMode ?? "sustain";
	const groupEndings = getMeterGroupEndings(
		meter,
		groupEndingLengthSteps,
	);
	const maxBasesPerRead = Math.max(8, Math.floor(options.maxBasesPerRead));
	const targetRuntimeSeconds = clamp(
		options.targetRuntimeSeconds,
		30,
		180,
	);
	const secondsPerBeat = 60 / tempo;
	const stepSeconds = secondsPerBeat / 4;
	const noteDuration = stepSeconds * 0.92;
	const maxAccentedNoteDuration = Math.max(
		noteDuration * 1.35,
		groupEndingMode === "sustain"
			? (groupEndingLengthSteps + 1) * stepSeconds
			: 0,
	);
	const mergedReads = interleaveReads(dataset.r1.reads, dataset.r2.reads);
	const candidates: NoteCandidate[] = [];

	for (let readIndex = 0; readIndex < mergedReads.length; readIndex += 1) {
		const { read, sourceReadIndex } = mergedReads[readIndex];
		const upperSequence = read.sequence.toUpperCase();
		const baseLimit = Math.min(upperSequence.length, maxBasesPerRead);

		for (let index = 0; index < baseLimit; index += 1) {
			const base = upperSequence[index] ?? "";

			if (!isCanonicalBase(base)) {
				continue;
			}

			const qualityScore =
				(read.quality.charCodeAt(index) || 33) - 33;

			candidates.push({
				base,
				baseIndex: index,
				qualityScore,
				direction: read.direction,
				sourceReadIndex,
				sourceOrder: readIndex,
			});
		}
	}

	const playableSeconds = Math.max(
		0,
		targetRuntimeSeconds -
			RELEASE_TAIL_SECONDS -
			maxAccentedNoteDuration,
	);
	const slotCount = Math.max(1, Math.floor(playableSeconds / stepSeconds) + 1);
	const activeStepIndices = Array.from(
		{ length: slotCount },
		(_, index) => index,
	).filter(
		(index) =>
			!groupEndings.reservedSteps.has(index % meter.stepsPerMeasure),
	);
	const sampledCandidates = sampleCandidates(
		candidates,
		activeStepIndices.length,
	);
	const eventStepIndices = sampleEvenly(
		activeStepIndices,
		sampledCandidates.length,
	);
	const events: GenomicNoteEvent[] = sampledCandidates.map(
		(candidate, index) => {
			const midiRoot = candidate.direction === "r1" ? 50 : 57;
			const stepIndex = eventStepIndices[index] ?? 0;
			const measureStep = stepIndex % meter.stepsPerMeasure;
			const qualityVelocity = qualityToVelocity(candidate.qualityScore);
			const accentedVelocity =
				measureStep === 0
					? clamp(0.55 + qualityVelocity * 0.45, 0.55, 0.99)
					: meter.beatSteps.includes(measureStep)
						? clamp(0.25 + qualityVelocity * 0.65, 0.3, 0.94)
						: clamp(qualityVelocity * 0.48, 0.1, 0.72);
			const accentedDurationMultiplier =
				measureStep === 0
					? 1.35
					: meter.beatSteps.includes(measureStep)
						? 0.95
						: 0.58;
			const velocity = lerp(
				qualityVelocity,
				accentedVelocity,
				accentAmount,
			);
			const durationMultiplier = lerp(
				1,
				accentedDurationMultiplier,
				accentAmount,
			);
			const sustainStepCount =
				groupEndingMode === "sustain"
					? groupEndings.holdDurations.get(measureStep)
					: undefined;
			const duration = sustainStepCount
				? Math.max(
						noteDuration * durationMultiplier,
						sustainStepCount * stepSeconds,
					)
				: noteDuration * durationMultiplier;

			return {
				time: stepIndex * stepSeconds,
				duration,
				midi: clamp(
					baseToMidi(
						candidate.base,
						midiRoot,
						candidate.baseIndex,
					) + voiceSettings[candidate.base].octaveShift * 12,
					24,
					108,
				),
				velocity,
				base: candidate.base,
				voice: candidate.base,
				qualityScore: candidate.qualityScore,
				direction: candidate.direction,
				sourceReadIndex: candidate.sourceReadIndex,
				sourceBaseIndex: candidate.baseIndex,
			};
		},
	);

	return {
		events,
		runtimeSeconds: events.length ? targetRuntimeSeconds : 0,
		noteCount: events.length,
		readCount: mergedReads.length,
		tempoBpm: tempo,
		timeSignature,
		voiceSettings,
	};
}
