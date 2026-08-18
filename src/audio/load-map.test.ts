import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAndMapFastqFixture } from "./load-map";
import { DEFAULT_MAPPING_OPTIONS, type FastqFixture } from "./types";

const fixture: FastqFixture = {
	id: "pending",
	label: "Pending fixture",
	description: "A fixture whose requests do not complete on their own.",
	r1Url: "/pending-R1.fastq.gz",
	r2Url: "/pending-R2.fastq.gz",
};

function abortablePendingFetch() {
	return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
		return new Promise<Response>((_resolve, reject) => {
			const signal = init?.signal;
			const handleAbort = () => {
				reject(
					signal?.reason instanceof Error
						? signal.reason
						: new DOMException("Cancelled", "AbortError"),
				);
			};

			if (signal?.aborted) {
				handleAbort();
				return;
			}

			signal?.addEventListener("abort", handleAbort, { once: true });
		});
	});
}

describe("loadAndMapFastqFixture cancellation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects and aborts pending FASTQ requests after the timeout", async () => {
		const fetchMock = abortablePendingFetch();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loadAndMapFastqFixture(
				fixture,
				{ maxReadsPerFile: 8, readStride: 8 },
				DEFAULT_MAPPING_OPTIONS,
				{ timeoutMs: 5 },
			),
		).rejects.toThrow("FASTQ loading timed out");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(
			fetchMock.mock.calls.every(([, init]) => init?.signal?.aborted),
		).toBe(true);
	});

	it("rejects promptly when a newer request cancels the load", async () => {
		vi.stubGlobal("fetch", abortablePendingFetch());
		const abortController = new AbortController();
		const loadPromise = loadAndMapFastqFixture(
			fixture,
			{ maxReadsPerFile: 8, readStride: 8 },
			DEFAULT_MAPPING_OPTIONS,
			{ signal: abortController.signal, timeoutMs: 1_000 },
		);

		abortController.abort(
			new DOMException("FASTQ loading was superseded.", "AbortError"),
		);

		await expect(loadPromise).rejects.toMatchObject({ name: "AbortError" });
	});
});
