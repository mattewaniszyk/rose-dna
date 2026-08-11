import { gunzipSync } from "fflate";
import type {
	FastqDataset,
	FastqFixture,
	FastqParseOptions,
	FastqRead,
	FastqReadSet,
	ReadDirection,
} from "./types";

const textDecoder = new TextDecoder();

function clampCount(value: number, fallback: number) {
	if (!Number.isFinite(value)) {
		return fallback;
	}

	return Math.max(1, Math.floor(value));
}

async function fetchTextPayload(url: string) {
	const response = await fetch(url, { cache: "force-cache" });

	if (!response.ok) {
		throw new Error(`Failed to fetch FASTQ asset: ${response.status}`);
	}

	const payload = new Uint8Array(await response.arrayBuffer());
	const decompressed = url.endsWith(".gz") ? gunzipSync(payload) : payload;

	return textDecoder.decode(decompressed);
}

export function parseFastqText(
	text: string,
	direction: ReadDirection,
	options: FastqParseOptions,
): FastqReadSet {
	const maxReads = clampCount(options.maxReadsPerFile, 1);
	const readStride = clampCount(options.readStride, 1);
	const lines = text.split(/\r?\n/);
	const reads: FastqRead[] = [];
	let scannedReads = 0;

	for (let cursor = 0; cursor + 3 < lines.length; cursor += 4) {
		const header = lines[cursor]?.trim();
		const sequence = lines[cursor + 1]?.trim().toUpperCase();
		const quality = lines[cursor + 3]?.trim();

		if (!header || !sequence || !quality || !header.startsWith("@")) {
			continue;
		}

		if (sequence.length !== quality.length || sequence.length === 0) {
			continue;
		}

		scannedReads += 1;

		if ((scannedReads - 1) % readStride !== 0) {
			continue;
		}

		reads.push({
			header,
			sequence,
			quality,
			direction,
		});

		if (reads.length >= maxReads) {
			break;
		}
	}

	return {
		reads,
		scannedReads,
		selectedReads: reads.length,
	};
}

export async function loadFastqFixtureData(
	fixture: FastqFixture,
	options: FastqParseOptions,
): Promise<FastqDataset> {
	const parseStart = performance.now();
	const [r1Text, r2Text] = await Promise.all([
		fetchTextPayload(fixture.r1Url),
		fetchTextPayload(fixture.r2Url),
	]);

	const r1 = parseFastqText(r1Text, "r1", options);
	const r2 = parseFastqText(r2Text, "r2", options);

	return {
		fixture,
		r1,
		r2,
		parseDurationMs: performance.now() - parseStart,
	};
}
