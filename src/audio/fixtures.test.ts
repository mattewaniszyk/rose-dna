/// <reference types="node" />

import { readFileSync } from "node:fs";
import { gunzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseFastqText } from "./fastq";
import { FASTQ_FIXTURES } from "./fixtures";

const textDecoder = new TextDecoder();

function parseFixtureFile(url: string, direction: "r1" | "r2") {
	const compressed = readFileSync(`public${url}`);
	return parseFastqText(
		textDecoder.decode(gunzipSync(compressed)),
		direction,
		{
			maxReadsPerFile: 2_000,
			readStride: 1,
		},
	);
}

describe("ERR14041549 fixture", () => {
	it("contains 2,000 matching read pairs", () => {
		const fixture = FASTQ_FIXTURES.find(
			(candidate) => candidate.id === "err14041549-rosa-gallica",
		);
		expect(fixture).toBeDefined();

		const r1 = parseFixtureFile(fixture!.r1Url, "r1");
		const r2 = parseFixtureFile(fixture!.r2Url, "r2");
		expect(r1.selectedReads).toBe(2_000);
		expect(r2.selectedReads).toBe(2_000);
		expect(
			r1.reads.map((read) => read.header.split(/\s+/, 1)[0]),
		).toEqual(r2.reads.map((read) => read.header.split(/\s+/, 1)[0]));
	});
});
