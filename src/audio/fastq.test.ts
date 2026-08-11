import { describe, expect, it } from "vitest";
import { parseFastqText } from "./fastq";

function record(id: string, sequence: string, quality = "IIII") {
	return `@${id}\n${sequence}\n+\n${quality}`;
}

describe("parseFastqText", () => {
	it("validates records and applies the read stride", () => {
		const text = [
			record("one", "ACGT"),
			record("bad-length", "ACGT", "III"),
			record("two", "TGCA"),
			record("three", "GGGG"),
		].join("\n");
		const parsed = parseFastqText(text, "r1", {
			maxReadsPerFile: 4,
			readStride: 2,
		});

		expect(parsed.scannedReads).toBe(3);
		expect(parsed.selectedReads).toBe(2);
		expect(parsed.reads.map((read) => read.header)).toEqual([
			"@one",
			"@three",
		]);
		expect(parsed.reads.every((read) => read.direction === "r1")).toBe(true);
	});
});
