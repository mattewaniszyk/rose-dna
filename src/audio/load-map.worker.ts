import { loadFastqFixtureData } from "./fastq";
import { mapDatasetToSequence } from "./mapping";
import type {
	FastqFixture,
	FastqParseOptions,
	MappingOptions,
} from "./types";

type LoadMapRequest = {
	fixture: FastqFixture;
	mappingOptions: MappingOptions;
	parseOptions: FastqParseOptions;
};

self.addEventListener("message", async (event: MessageEvent<LoadMapRequest>) => {
	try {
		const dataset = await loadFastqFixtureData(
			event.data.fixture,
			event.data.parseOptions,
		);
		const sequence = mapDatasetToSequence(
			dataset,
			event.data.mappingOptions,
		);

		self.postMessage({ ok: true, result: { dataset, sequence } });
	} catch (error) {
		self.postMessage({
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		});
	}
});
