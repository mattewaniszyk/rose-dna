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
) {
	await yieldToBrowser();
	const { loadFastqFixtureData } = await import("./fastq");
	const dataset = await loadFastqFixtureData(fixture, parseOptions);

	return {
		dataset,
		sequence: mapDatasetToSequence(dataset, mappingOptions),
	};
}

export function loadAndMapFastqFixture(
	fixture: FastqFixture,
	parseOptions: FastqParseOptions,
	mappingOptions: MappingOptions,
): Promise<LoadMapResult> {
	if (typeof Worker === "undefined") {
		return loadAndMapOnMainThread(fixture, parseOptions, mappingOptions);
	}

	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL("./load-map.worker.ts", import.meta.url), {
			type: "module",
		});
		let settled = false;
		const cleanup = () => {
			worker.terminate();
		};
		const fail = (message: string) => {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();
			reject(new Error(message));
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
			fail(event.message || "The FASTQ mapping worker failed.");
		});
		worker.postMessage({ fixture, mappingOptions, parseOptions });
	});
}
