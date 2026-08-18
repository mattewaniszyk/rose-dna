import type {
	FastqDataset,
	FastqFixture,
	FastqParseOptions,
	GenomicMusicSequence,
	MappingOptions,
} from "./types";
import { mapDatasetToSequence } from "./mapping";

export type LoadMapResult = {
	dataset: FastqDataset;
	sequence: GenomicMusicSequence;
};

export type LoadMapOptions = {
	signal?: AbortSignal;
	timeoutMs?: number;
};

export const DEFAULT_LOAD_MAP_TIMEOUT_MS = 30_000;

type LoadMapWorkerResponse =
	| { ok: true; result: LoadMapResult }
	| { error: string; ok: false };

function yieldToBrowser() {
	return new Promise<void>((resolve) => {
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(() => resolve());
			return;
		}

		setTimeout(resolve, 0);
	});
}

async function loadAndMapOnMainThread(
	fixture: FastqFixture,
	parseOptions: FastqParseOptions,
	mappingOptions: MappingOptions,
	signal: AbortSignal,
) {
	await yieldToBrowser();
	const { loadFastqFixtureData } = await import("./fastq");
	const dataset = await loadFastqFixtureData(fixture, parseOptions, signal);

	return {
		dataset,
		sequence: mapDatasetToSequence(dataset, mappingOptions),
	};
}

function loadAndMapInWorker(
	fixture: FastqFixture,
	parseOptions: FastqParseOptions,
	mappingOptions: MappingOptions,
	signal: AbortSignal,
) {
	return new Promise<LoadMapResult>((resolve, reject) => {
		const worker = new Worker(new URL("./load-map.worker.ts", import.meta.url), {
			type: "module",
		});
		let settled = false;
		const cleanup = () => {
			signal.removeEventListener("abort", handleAbort);
			worker.terminate();
		};
		const fail = (error: Error) => {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();
			reject(error);
		};
		const handleAbort = () => {
			fail(
				signal.reason instanceof Error
					? signal.reason
					: new DOMException("FASTQ loading was cancelled.", "AbortError"),
			);
		};

		worker.addEventListener(
			"message",
			(event: MessageEvent<LoadMapWorkerResponse>) => {
				if (settled) {
					return;
				}

				settled = true;
				cleanup();
				if (event.data.ok) {
					resolve(event.data.result);
				} else {
					reject(new Error(event.data.error));
				}
			},
		);
		worker.addEventListener("error", (event) => {
			fail(new Error(event.message || "The FASTQ mapping worker failed."));
		});
		signal.addEventListener("abort", handleAbort, { once: true });

		if (signal.aborted) {
			handleAbort();
			return;
		}

		worker.postMessage({ fixture, mappingOptions, parseOptions });
	});
}

export function loadAndMapFastqFixture(
	fixture: FastqFixture,
	parseOptions: FastqParseOptions,
	mappingOptions: MappingOptions,
	options: LoadMapOptions = {},
): Promise<LoadMapResult> {
	const abortController = new AbortController();
	const timeoutMs = options.timeoutMs ?? DEFAULT_LOAD_MAP_TIMEOUT_MS;
	const handleExternalAbort = () => {
		abortController.abort(options.signal?.reason);
	};
	const timeout = setTimeout(() => {
		abortController.abort(
			new Error(
				`FASTQ loading timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
			),
		);
	}, timeoutMs);

	options.signal?.addEventListener("abort", handleExternalAbort, { once: true });
	if (options.signal?.aborted) {
		handleExternalAbort();
	}

	const loadPromise =
		typeof Worker === "undefined"
			? loadAndMapOnMainThread(
					fixture,
					parseOptions,
					mappingOptions,
					abortController.signal,
				)
			: loadAndMapInWorker(
					fixture,
					parseOptions,
					mappingOptions,
					abortController.signal,
				);

	return loadPromise.finally(() => {
		clearTimeout(timeout);
		options.signal?.removeEventListener("abort", handleExternalAbort);
	});
}
