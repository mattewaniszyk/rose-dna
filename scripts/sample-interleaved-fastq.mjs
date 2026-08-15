import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { finished } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

const [inputPath, pairCountText, r1OutputPath, r2OutputPath] =
	process.argv.slice(2);
const pairCount = Number.parseInt(pairCountText, 10);

if (
	!inputPath ||
	!r1OutputPath ||
	!r2OutputPath ||
	!Number.isSafeInteger(pairCount) ||
	pairCount < 1
) {
	console.error(
		"Usage: node scripts/sample-interleaved-fastq.mjs INPUT.fastq[.gz] PAIRS OUTPUT_R1.fastq.gz OUTPUT_R2.fastq.gz",
	);
	process.exitCode = 1;
} else {
	await sampleInterleavedFastq();
}

async function writeRecord(output, lines) {
	if (!output.write(`${lines.join("\n")}\n`)) {
		await once(output, "drain");
	}
}

function readId(header) {
	return header.split(/\s+/, 1)[0];
}

async function sampleInterleavedFastq() {
	const fileInput = createReadStream(inputPath);
	const input = inputPath.endsWith(".gz")
		? fileInput.pipe(createGunzip())
		: fileInput;
	const r1Gzip = createGzip({ level: 9 });
	const r2Gzip = createGzip({ level: 9 });
	const r1File = createWriteStream(r1OutputPath);
	const r2File = createWriteStream(r2OutputPath);
	r1Gzip.pipe(r1File);
	r2Gzip.pipe(r2File);

	const reader = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
	let record = [];
	let recordIndex = 0;
	let completedPairs = 0;
	let pendingR1Id = null;

	try {
		for await (const line of reader) {
			record.push(line);

			if (record.length !== 4) {
				continue;
			}

			const [header, sequence, separator, quality] = record;
			if (
				!header.startsWith("@") ||
				!separator.startsWith("+") ||
				sequence.length === 0 ||
				sequence.length !== quality.length
			) {
				throw new Error(`Invalid FASTQ record ${recordIndex + 1}.`);
			}

			if (recordIndex % 2 === 0) {
				pendingR1Id = readId(header);
				await writeRecord(r1Gzip, record);
			} else {
				if (readId(header) !== pendingR1Id) {
					throw new Error(
						`Interleaved pair ${completedPairs + 1} has mismatched read identifiers.`,
					);
				}

				await writeRecord(r2Gzip, record);
				completedPairs += 1;
			}

			recordIndex += 1;
			record = [];

			if (completedPairs === pairCount) {
				break;
			}
		}

		if (completedPairs !== pairCount) {
			throw new Error(
				`Input ended after ${completedPairs} complete pairs; ${pairCount} were requested.`,
			);
		}
	} finally {
		reader.close();
		fileInput.destroy();
		r1Gzip.end();
		r2Gzip.end();
	}

	await Promise.all([finished(r1File), finished(r2File)]);
	console.log(`Wrote ${completedPairs} read pairs.`);
}
