# *Rose DNA*: Public-Facing Methodology

## A living data portrait

*Rose DNA* transforms selected DNA sequencing reads into sound and movement. The work begins with public paired-end FASTQ examples: files that store short nucleotide sequences alongside quality values. Within the selected reads, each A, C, G, or T becomes a possible musical event.

The four letters are assigned different positions in a minor-mode pattern and performed by separate instrumental voices. The two paired read streams occupy different pitch ranges, a letter's position affects its octave, and its quality value helps shape loudness. The artist determines the instruments, tempo, meter, phrasing, and duration. When more bases are available than the composition can hold, the system makes a repeatable selection across both read streams and all represented letters.

The resulting sound gives motion to a three-dimensional rose. As the music changes, its energy subtly alters the flower's rotation, lift, and wobble. The image does not reveal a rose hidden in the data. Instead, the flower provides a metaphorical body through which an abstract sequence can be experienced as rhythm, texture, and movement.

The artist also chooses the rose's material, viewing angle, lighting, background, and image effects. These decisions establish the visual character of each portrait but are not derived from the sequencing files. The finished work can remain interactive or be exported as MIDI, MP3, or synchronized video.

*Rose DNA* is therefore both data-constrained and artist-authored. The source material determines which nucleotide, position, read stream, and quality value enter each event; the translation system determines how those values can be heard and seen. The work does not claim that DNA naturally contains music, nor does it reconstruct a genome or provide biological analysis. It asks how acts of selection and mediation shape the ways data can be sensed.

The current inputs are ANN0830, ANN0831, and ANN0832 from the public [Rieseberg Lab `fastq-examples` repository](https://github.com/rieseberglab/fastq-examples), plus a 2,000-pair subset of [ERR14041549](https://www.ebi.ac.uk/ena/browser/view/ERR14041549), a public paired-end *Rosa gallica* whole-genome sequencing run in study PRJEB82787.

> **Before publication:** Add verified biological provenance, study and licensing information, access date, and any applicable ethics context for the ANN fixtures; confirm any additional attribution requirements for ERR14041549. Creator and license details for the sourced rose model and Unicorn Studio backgrounds also require completion.

Software and sampled-audio acknowledgements appear in [Third-Party Notices](../../THIRD_PARTY_NOTICES.md).

## Related documents

- [Artist-statement reference](./artist-statement-reference.md)
- [Technical methods](./technical-methods.md)
