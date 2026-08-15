# *Rose DNA*: Technical Methods

## Input and selection

*Rose DNA* uses three paired FASTQ examples—ANN0830, ANN0831, and ANN0832—from the public [Rieseberg Lab `fastq-examples` repository](https://github.com/rieseberglab/fastq-examples). It also includes 2,000 read pairs from [ERR14041549](https://www.ebi.ac.uk/ena/browser/view/ERR14041549), a public paired-end *Rosa gallica* whole-genome sequencing run in study PRJEB82787. The supplied 3.7 GB FASTQ interleaves consecutive R1 and R2 records; the included fixture separates those records and stores them as two gzip-compressed files. The parser accepts standard four-line records with an `@` header and equal-length sequence and quality strings.

By default, the program retains 16 reads from each R1 and R2 file, beginning with the first valid record and advancing by a stride of 64. The paired selections are interleaved, and the first 24 positions of each retained read are examined. A, C, G, and T become note candidates; ambiguous bases are skipped. No alignment, assembly, variant calling, or biological inference is performed.

## Musical mapping

The mapping is deterministic. If the candidates exceed the available rhythmic positions, they are sampled evenly while maintaining proportional representation across nucleotide and read-stream groups.

The four bases use intervals from a natural-minor collection:

| Base | Interval | Default voice |
| --- | ---: | --- |
| A | 0 semitones | New Age Pad |
| C | 3 semitones | Crystal Synth |
| G | 7 semitones | Square Lead |
| T | 10 semitones | Synth Bass |

R1 uses MIDI note 50 as its root and R2 uses MIDI note 57. Positions 0–6 use the base register, 7–13 add one octave, and 14–20 add two; this pattern repeats every 21 positions. Each base can also be shifted by -2 to +2 octaves.

Quality characters are interpreted as Phred+33 and converted into note velocity. Events occupy a sixteenth-note grid. Current defaults are 88 BPM, 4/4 meter, 100% accent strength, a one-step sustain at group endings, and a 60-second runtime. Available meters, instruments, phrase endings, duration, balance, and octave shifts are artist-controlled.

## Sound, image, and output

Playback and offline audio rendering use FluidR3 General MIDI samples. MIDI export creates four base-specific tracks and stores the selected tempo, meter, instruments, and events. MP3 export renders stereo audio at 44.1 kHz and 160 kbps. MP4 export records the scene at 30 frames per second and combines H.264 video with AAC audio.

During playback, smoothed audio energy increases the rose's rotational speed, floating motion, and wobble. MP4 export derives a comparable energy envelope from the rendered audio. The rose model, materials, viewing angle, lighting, backgrounds, and post-processing are presentation choices rather than FASTQ-derived properties.

## Limits and provenance

The same data and settings produce the same note-event sequence, but browser timing, sample loading, WebGL rendering, and codecs can affect media output. The method is selective, assumes Phred+33, and is an artistic sonification—not genome reconstruction, diagnosis, or neutral scientific visualization.

> **Before publication:** Complete the specimen, collection context, data creator, license, access date, and applicable ethics information for the ANN fixtures, and confirm any additional attribution requirements for ERR14041549. Creator and license metadata for the sourced rose model and Unicorn Studio backgrounds also remain incomplete.

See [Third-Party Notices](../../THIRD_PARTY_NOTICES.md) for software and sample licensing.

## Related documents

- [Artist-statement reference](./artist-statement-reference.md)
- [Public-facing methodology](./public-facing-methodology.md)
