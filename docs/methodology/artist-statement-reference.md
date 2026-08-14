# *Rose DNA*: Artist-Statement Reference

## Overview

*Rose DNA* is an interactive audiovisual artwork that transforms selected DNA sequencing reads into sound and movement. Public paired-end FASTQ example files supply nucleotide letters and sequencing-quality values. These elements are translated into a musical sequence whose changing energy animates a three-dimensional rose.

The work is conceived as a **living data portrait**. The rose gives abstract sequencing records a body, duration, and atmosphere, but it is metaphorical: the software does not discover a rose within the data or reconstruct the source organism.

## Method

The current inputs are three public paired-end FASTQ examples—ANN0830, ANN0831, and ANN0832—from the [Rieseberg Lab `fastq-examples` repository](https://github.com/rieseberglab/fastq-examples). The program samples selected reads rather than processing the files exhaustively.

Each canonical base—A, C, G, or T—becomes a note in its own configurable instrumental voice. The two paired read streams occupy different pitch ranges, base position affects octave, and an assumed Phred+33 quality score contributes to loudness. Tempo, meter, accents, phrase endings, duration, and instrumentation are artist-defined parts of the translation.

Audio energy subtly changes the rose's rotation, floating motion, and wobble. The artist separately chooses its material, viewing angle, background, lighting, and image effects. These visual decisions are not extracted from the FASTQ files; they stage how the data portrait is encountered. The work can remain interactive or be exported as MIDI, MP3, or synchronized MP4.

## Interpretive position

*Rose DNA* makes mediation visible. Data constrains which bases, positions, read streams, and quality values enter the sequence, while artistic rules determine how those values sound and appear. Useful terms include *data portrait*, *sonification*, *audiovisual translation*, *mediation*, and *embodiment*.

The work should not be described as a genome reconstruction, biological analysis, diagnostic instrument, gene-expression model, or neutral scientific visualization.

> **Before publication:** Add the verified organism/species, specimen or tissue, study accession, collection context, data creator, license, access date, and any relevant consent or ethics information. Until verified, describe the inputs only as public paired-end FASTQ examples using their ANN identifiers.

Creator and license details for the sourced rose model and Unicorn Studio backgrounds also require completion. Software and audio-sample acknowledgements appear in [Third-Party Notices](../../THIRD_PARTY_NOTICES.md).

## Related documents

- [Technical methods](./technical-methods.md)
- [Public-facing methodology](./public-facing-methodology.md)
