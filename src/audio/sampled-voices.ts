import {
	CacheStorage,
	HttpStorage,
	renderOffline,
	Scheduler,
	Soundfont,
	type Storage,
} from "smplr";
import * as Tone from "tone";
import {
	CANONICAL_BASES,
	DEFAULT_VOICE_SETTINGS,
	type CanonicalBase,
	type GenomicMusicSequence,
	type VoicePresetId,
	type VoiceSettingsByBase,
} from "./types";
import type { GenomicVoice, GenomicVoiceBank } from "./voice-types";

export const SOUNDFONT_INSTRUMENT_BY_PRESET: Record<VoicePresetId, string> = {
	"new-age-pad": "pad_1_new_age",
	"warm-pad": "pad_2_warm",
	"polysynth-pad": "pad_3_polysynth",
	"choir-pad": "pad_4_choir",
	"bowed-pad": "pad_5_bowed",
	"metallic-pad": "pad_6_metallic",
	"halo-pad": "pad_7_halo",
	"sweep-pad": "pad_8_sweep",
	"crystal-synth": "fx_3_crystal",
	"glass-bell": "glockenspiel",
	celesta: "celesta",
	"music-box": "music_box",
	vibraphone: "vibraphone",
	kalimba: "kalimba",
	"electric-piano": "electric_piano_1",
	"drawbar-organ": "drawbar_organ",
	marimba: "marimba",
	"plucked-strings": "pizzicato_strings",
	"nylon-guitar": "acoustic_guitar_nylon",
	"orchestral-harp": "orchestral_harp",
	"string-ensemble": "string_ensemble_1",
	"square-lead": "lead_1_square",
	"saw-lead": "lead_2_sawtooth",
	"synth-bass": "synth_bass_1",
};

const SOUNDFONT_KIT = "FluidR3_GM";
let soundfontStorage: Storage | null = null;

function getSoundfontStorage() {
	if (!soundfontStorage) {
		soundfontStorage =
			typeof caches === "undefined"
				? HttpStorage
				: CacheStorage("rose-dna-fluidr3-soundfonts");
	}

	return soundfontStorage;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function decibelsToGain(decibels: number) {
	return 10 ** (decibels / 20);
}

class SampledGenomicVoice implements GenomicVoice {
	readonly volume: Tone.Volume["volume"];
	readonly ready: Promise<void>;

	private readonly instrument: ReturnType<typeof Soundfont>;
	private readonly output: Tone.Volume;
	private isDisposed = false;

	constructor(preset: VoicePresetId, volumeDb: number) {
		this.output = new Tone.Volume(volumeDb);
		this.volume = this.output.volume;

		const context = Tone.getContext().rawContext as BaseAudioContext;
		const destination = this.output.input.input;

		this.instrument = Soundfont(context, {
			destination,
			instrument: SOUNDFONT_INSTRUMENT_BY_PRESET[preset],
			kit: SOUNDFONT_KIT,
			storage: getSoundfontStorage(),
			volume: 127,
		});
		this.ready = this.instrument.ready;
	}

	connect(destination: Tone.InputNode) {
		this.output.connect(destination);
		return this;
	}

	toDestination() {
		this.output.toDestination();
		return this;
	}

	triggerAttackRelease(
		notes: Tone.Unit.Frequency | Tone.Unit.Frequency[],
		duration: Tone.Unit.Time,
		time?: Tone.Unit.Time,
		velocity = 1,
	) {
		if (this.isDisposed) {
			return this;
		}

		const noteList = Array.isArray(notes) ? notes : [notes];
		const startTime =
			time === undefined
				? Tone.getContext().currentTime
				: Tone.Time(time).toSeconds();
		const durationSeconds = Tone.Time(duration).toSeconds();
		const midiVelocity = Math.round(clamp(velocity, 0, 1) * 127);

		for (const note of noteList) {
			this.instrument.start({
				note: Math.round(Tone.Frequency(note).toMidi()),
				velocity: midiVelocity,
				time: startTime,
				duration: durationSeconds,
			});
		}

		return this;
	}

	releaseAll(time?: Tone.Unit.Time) {
		if (this.isDisposed) {
			return this;
		}

		this.instrument.stop(
			time === undefined ? undefined : { time: Tone.Time(time).toSeconds() },
		);
		return this;
	}

	dispose() {
		if (this.isDisposed) {
			return this;
		}

		this.isDisposed = true;
		this.instrument.dispose();
		this.output.dispose();
		return this;
	}
}

export async function createSampledElectronicVoice(
	preset: VoicePresetId,
	volumeDb: number,
): Promise<GenomicVoice> {
	const voice = new SampledGenomicVoice(preset, volumeDb);

	try {
		await voice.ready;
		return voice;
	} catch (error) {
		voice.dispose();
		throw error;
	}
}

export async function createSampledGenomicVoiceBank(
	voiceSettings: VoiceSettingsByBase = DEFAULT_VOICE_SETTINGS,
): Promise<GenomicVoiceBank> {
	const results = await Promise.allSettled(
		CANONICAL_BASES.map(async (base) => [
			base,
			await createSampledElectronicVoice(
				voiceSettings[base].preset,
				voiceSettings[base].volumeDb,
			),
		] as const),
	);
	const rejected = results.find(
		(result): result is PromiseRejectedResult => result.status === "rejected",
	);

	if (rejected) {
		for (const result of results) {
			if (result.status === "fulfilled") {
				result.value[1].dispose();
			}
		}

		throw rejected.reason;
	}

	const fulfilled = results.filter(
		(
			result,
		): result is PromiseFulfilledResult<
			readonly [CanonicalBase, GenomicVoice]
		> => result.status === "fulfilled",
	);

	return Object.fromEntries(
		fulfilled.map((result) => result.value),
	) as GenomicVoiceBank;
}

export async function renderSampledSequence(
	sequence: GenomicMusicSequence,
	options: { channels: number; sampleRate: number },
) {
	const result = await renderOffline(
		async (context) => {
			const scheduler = Scheduler(context, {
				lookaheadMs: (sequence.runtimeSeconds + 1) * 1000,
			});
			const instruments = Object.fromEntries(
				CANONICAL_BASES.map((base) => {
					const settings =
						sequence.voiceSettings?.[base] ?? DEFAULT_VOICE_SETTINGS[base];

					return [
						base,
						Soundfont(context, {
							destination: context.destination,
							instrument:
								SOUNDFONT_INSTRUMENT_BY_PRESET[settings.preset],
							kit: SOUNDFONT_KIT,
							scheduler,
							storage: getSoundfontStorage(),
							volume: 127,
							volumeToGain: () => decibelsToGain(settings.volumeDb),
						}),
					];
				}),
		) as Record<string, ReturnType<typeof Soundfont>>;

			await Promise.all(
				Object.values(instruments).map((instrument) => instrument.ready),
			);

			for (const event of sequence.events) {
				instruments[event.voice].start({
					note: event.midi,
					velocity: Math.round(clamp(event.velocity, 0, 1) * 127),
					time: event.time,
					duration: event.duration,
				});
			}
		},
		{
			channels: options.channels,
			duration: sequence.runtimeSeconds,
			sampleRate: options.sampleRate,
		},
	);

	return result.audioBuffer;
}
