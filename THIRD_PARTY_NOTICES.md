# Third-Party Notices

## FASTQ example data

The application loads paired FASTQ examples from the Rieseberg Lab
`fastq-examples` repository. It also distributes a 2,000-pair, gzip-compressed
subset of the public *Rosa gallica* whole-genome sequencing run ERR14041549
(study PRJEB82787), derived from the interleaved FASTQ supplied for this
project. Data provenance and any applicable reuse terms remain those of the
source records.

- https://github.com/rieseberglab/fastq-examples
- https://www.ebi.ac.uk/ena/browser/view/ERR14041549

## Strudel

The Stepwise and lower-third sequence visualizations integrate the pinned
`@strudel/core` and `@strudel/draw` packages at version 1.2.6. Strudel and these
packages are licensed under AGPL-3.0-or-later. Tone and the FluidR3-derived
sample set remain the authoritative audio engine; Strudel is used for pattern
and drawing primitives.

- https://github.com/tidalcycles/strudel
- https://strudel.cc/technical-manual/project-start/
- https://www.gnu.org/licenses/agpl-3.0.html

## ffmpeg.wasm core

This application distributes `@ffmpeg/core` to perform MP3 encoding in the
browser. The package is licensed under GPL-2.0-or-later and includes FFmpeg,
LAME, and other optional codec libraries. Source and license information:

- https://github.com/ffmpegwasm/ffmpeg.wasm
- https://github.com/FFmpeg-wasm/core
- https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

## smplr

This application uses `smplr` to load and render sampled instruments in the
browser. `smplr` is copyright its contributors and licensed under the MIT
License.

- https://github.com/danigb/smplr

## FluidR3_GM SoundFont samples

Sampled playback and MP3 rendering use pre-rendered samples derived from the
FluidR3_GM SoundFont by Frank Wen and contributors. The samples are loaded from
the MIDI.js Soundfonts distribution and are licensed under Creative Commons
Attribution 3.0 Unported (CC BY 3.0). The application does not alter the source
sample files; it selects, pitch-shifts, envelopes, and mixes them according to
the genomic sequence.

- https://github.com/gleitz/midi-js-soundfonts
- https://creativecommons.org/licenses/by/3.0/

All other third-party packages remain subject to their respective licenses.
