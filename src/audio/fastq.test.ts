import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFastqFixtureData, parseFastqText } from "./fastq";

const textEncoder = new TextEncoder();

function responseWithText(text: string) {
	return {
		arrayBuffer: async () => textEncoder.encode(text).buffer,
		ok: true,
		status: 200,
	} as Response;
}

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

describe("loadFastqFixtureData", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("accepts FASTQ text when a server transparently decompresses a .gz URL", async () => {
		const r1Text = record("pair-1", "ACGT");
		const r2Text = record("pair-1", "TGCA");
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) =>
				responseWithText(url.includes("R1") ? r1Text : r2Text),
			),
		);

		const dataset = await loadFastqFixtureData(
			{
				id: "transparent-gzip",
				label: "Transparent gzip",
				description: "Test fixture",
				r1Url: "/R1.fastq.gz",
				r2Url: "/R2.fastq.gz",
			},
			{ maxReadsPerFile: 1, readStride: 1 },
		);

		expect(dataset.r1.reads[0]?.sequence).toBe("ACGT");
		expect(dataset.r2.reads[0]?.sequence).toBe("TGCA");
	});

	it("reports a clear error when an asset URL returns HTML", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => responseWithText("<!doctype html><title>Not found</title>")),
		);

		await expect(
			loadFastqFixtureData(
				{
					id: "missing",
					label: "Missing",
					description: "Test fixture",
					r1Url: "/missing-R1.fastq.gz",
					r2Url: "/missing-R2.fastq.gz",
				},
				{ maxReadsPerFile: 1, readStride: 1 },
			),
		).rejects.toThrow("did not contain gzip data or FASTQ text");
	});
});
