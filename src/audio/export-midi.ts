import { Midi } from "@tonejs/midi";
import {
	CANONICAL_BASES,
	DEFAULT_VOICE_SETTINGS,
	TIME_SIGNATURE_VALUES,
	VOICE_PRESET_DEFINITIONS,
	type GenomicMusicSequence,
} from "./types";

function decibelsToMidiGain(volumeDb: number) {
	return Math.max(0, Math.min(1, 10 ** (volumeDb / 20)));
}

export function sequenceToMidiBytes(sequence: GenomicMusicSequence) {
	const midi = new Midi();
	midi.name = "Rose DNA Genomic Audio";
	midi.header.setTempo(sequence.tempoBpm);
	midi.header.timeSignatures = [
		{
			ticks: 0,
			timeSignature: TIME_SIGNATURE_VALUES[sequence.timeSignature],
		},
	];
	midi.header.keySignatures = [{ ticks: 0, key: "C", scale: "minor" }];
	midi.header.update();

	for (let index = 0; index < CANONICAL_BASES.length; index += 1) {
		const base = CANONICAL_BASES[index];
		const voiceSettings =
			sequence.voiceSettings?.[base] ?? DEFAULT_VOICE_SETTINGS[base];
		const definition = VOICE_PRESET_DEFINITIONS[voiceSettings.preset];
		const track = midi.addTrack();

		track.name = `${base} · ${definition.label}`;
		track.channel = index;
		track.instrument.number = definition.program;
		track.addCC({
			number: 7,
			value: decibelsToMidiGain(voiceSettings.volumeDb),
			time: 0,
		});
		track.addCC({
			number: 123,
			value: 0,
			time: sequence.runtimeSeconds,
		});

		for (const event of sequence.events) {
			if (event.voice !== base) {
				continue;
			}

			track.addNote({
				midi: event.midi,
				time: event.time,
				duration: event.duration,
				velocity: event.velocity,
			});
		}
	}

	return midi.toArray();
}

export function exportSequenceToMidi(sequence: GenomicMusicSequence) {
	return new Blob([Uint8Array.from(sequenceToMidiBytes(sequence))], {
		type: "audio/midi",
	});
}
