// @vitest-environment happy-dom

import { StrictMode } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FASTQ_FIXTURES } from "@/audio/fixtures";
import type { LoadMapResult } from "@/audio/load-map";
import {
	DEFAULT_MAPPING_OPTIONS,
	DEFAULT_VOICE_SETTINGS,
} from "@/audio/types";
import { parseSharedSettings } from "@/shared-settings";
import { useGenomicAudio } from "./useGenomicAudio";

const loadAndMapFastqFixtureMock = vi.hoisted(() => vi.fn());

vi.mock("@/audio/load-map", () => ({
	loadAndMapFastqFixture: loadAndMapFastqFixtureMock,
}));

vi.mock("@/audio/export-mp4", () => ({
	isMp4ExportSupported: () => false,
}));

const fixture = FASTQ_FIXTURES[0];
if (!fixture) {
	throw new Error("The genomic audio tests require a FASTQ fixture.");
}

const loadedFixture: LoadMapResult = {
	dataset: {
		fixture,
		r1: { reads: [], scannedReads: 0, selectedReads: 0 },
		r2: { reads: [], scannedReads: 0, selectedReads: 0 },
		parseDurationMs: 1,
	},
	sequence: {
		events: [],
		runtimeSeconds: 0,
		noteCount: 0,
		readCount: 0,
		tempoBpm: DEFAULT_MAPPING_OPTIONS.tempoBpm,
		timeSignature: DEFAULT_MAPPING_OPTIONS.timeSignature,
		voiceSettings: DEFAULT_VOICE_SETTINGS,
	},
};

function AudioStatus({ search }: { search: string }) {
	const initialSettings = parseSharedSettings(search);
	const audio = useGenomicAudio(undefined, {
		autoLoadInitialFixture: initialSettings.shouldAutoLoad,
		initialSettings: initialSettings.settings.audio,
	});

	return <output data-testid="build-status">{audio.buildStatus}</output>;
}

describe("useGenomicAudio initial loading", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("loads a shared URL once after the Strict Mode effect replay", async () => {
		loadAndMapFastqFixtureMock.mockResolvedValue(loadedFixture);

		const view = render(
			<StrictMode>
				<AudioStatus search="?settings=1" />
			</StrictMode>,
		);

		await waitFor(() => {
			expect(view.getByTestId("build-status").textContent).toBe("ready");
		});

		expect(loadAndMapFastqFixtureMock).toHaveBeenCalledTimes(1);
		const loadOptions = loadAndMapFastqFixtureMock.mock.calls[0]?.[3];
		expect(loadOptions?.signal.aborted).toBe(false);
	});

	it("keeps an ordinary URL idle until loading is requested", async () => {
		const view = render(
			<StrictMode>
				<AudioStatus search="" />
			</StrictMode>,
		);

		await new Promise((resolve) => window.setTimeout(resolve, 10));

		expect(view.getByTestId("build-status").textContent).toBe("idle");
		expect(loadAndMapFastqFixtureMock).not.toHaveBeenCalled();
	});
});
