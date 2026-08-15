import type { FastqFixture } from "./types";

function localDataUrl(fileName: string) {
	return `${import.meta.env.BASE_URL}data/${fileName}`;
}

export const FASTQ_FIXTURES: FastqFixture[] = [
	{
		id: "ann0830-index10",
		label: "ANN0830 Index 10",
		description: "Paired-end subset from HI.4038.002, index_10.",
		r1Url:
			"https://raw.githubusercontent.com/rieseberglab/fastq-examples/master/data/HI.4038.002.index_10.ANN0830_R1.fastq.gz",
		r2Url:
			"https://raw.githubusercontent.com/rieseberglab/fastq-examples/master/data/HI.4038.002.index_10.ANN0830_R2.fastq.gz",
	},
	{
		id: "ann0831-index7",
		label: "ANN0831 Index 7",
		description: "Paired-end subset from HI.4019.002, index_7.",
		r1Url:
			"https://raw.githubusercontent.com/rieseberglab/fastq-examples/master/data/HI.4019.002.index_7.ANN0831_R1.fastq.gz",
		r2Url:
			"https://raw.githubusercontent.com/rieseberglab/fastq-examples/master/data/HI.4019.002.index_7.ANN0831_R2.fastq.gz",
	},
	{
		id: "ann0832-index8",
		label: "ANN0832 Index 8",
		description: "Paired-end subset from HI.4019.002, index_8.",
		r1Url:
			"https://raw.githubusercontent.com/rieseberglab/fastq-examples/master/data/HI.4019.002.index_8.ANN0832_R1.fastq.gz",
		r2Url:
			"https://raw.githubusercontent.com/rieseberglab/fastq-examples/master/data/HI.4019.002.index_8.ANN0832_R2.fastq.gz",
	},
	{
		id: "err14041549-rosa-gallica",
		label: "ERR14041549 (Rosa gallica)",
		description:
			"2,000-pair sample from the public Rosa gallica whole-genome run ERR14041549.",
		r1Url: localDataUrl("ERR14041549_R1.sample.fastq.gz"),
		r2Url: localDataUrl("ERR14041549_R2.sample.fastq.gz"),
	},
];
