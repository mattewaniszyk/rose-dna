import { describe, expect, it } from "vitest";
import {
	buildSharedSettingsUrl,
	createDefaultSharedAppSettings,
	parseSharedSettings,
	type SharedAppSettings,
} from "./shared-settings";

function createCustomizedSettings(): SharedAppSettings {
	const settings = createDefaultSharedAppSettings();
	return {
		...settings,
		backgroundMode: "space2",
		roseAnglePreset: "lean-right-aggressive-forward-2",
		roseMaterialPreset: "liquid-gold",
		overlayEffect: "halftone",
		stepwiseBackgroundEnabled: true,
		bottomVisualizationEnabled: true,
		bottomVisualizationMode: "spectrum",
		visualLayoutPreset: "vertical-triptych",
		audio: {
			selectedFixtureId: "err14041549-rosa-gallica",
			parseOptions: { maxReadsPerFile: 1200, readStride: 777 },
			mappingOptions: {
				accentStrengthPercent: 43,
				groupEndingLengthSteps: 2,
				groupEndingMode: "breath",
				tempoBpm: 137,
				maxBasesPerRead: 128,
				targetRuntimeSeconds: 135,
				timeSignature: "7/8",
				voiceSettings: {
					A: { preset: "warm-pad", volumeDb: -4, octaveShift: 2 },
					C: { preset: "music-box", volumeDb: -9, octaveShift: 1 },
					G: { preset: "saw-lead", volumeDb: -22, octaveShift: -1 },
					T: { preset: "orchestral-harp", volumeDb: -30, octaveShift: -2 },
				},
			},
			isLoopEnabled: false,
			videoAspectRatio: "9:16",
			videoQuality: "near-lossless",
		},
	};
}

describe("shared settings URL", () => {
	it("round-trips every persistent setting", () => {
		const settings = createCustomizedSettings();
		const url = buildSharedSettingsUrl("https://example.com/rose", settings);
		const parsed = parseSharedSettings(url.search);

		expect(parsed.shouldAutoLoad).toBe(true);
		expect(parsed.settings).toEqual(settings);
		expect(url.searchParams.get("bg")).toBe("space2");
		expect(url.searchParams.get("aVoice")).toBe("warm-pad");
		expect(url.searchParams.get("tOct")).toBe("-2");
	});

	it("hydrates the shared gallery configuration", () => {
		const url = new URL(
			"http://127.0.0.1:5173/?settings=1&bg=space&angle=aggressive-forward-2&material=etched-rose&effect=posterize&stepwise=1&viz=1&vizMode=timeline&layout=vertical-triptych&fixture=err14041549-rosa-gallica&meter=6%2F8&accent=75&quality=near-lossless&aVoice=polysynth-pad&aVol=0&aOct=-1&cVoice=plucked-strings&cVol=0&gVol=0&gOct=-2&tVol=0&tOct=-2",
		);
		const parsed = parseSharedSettings(url.search);

		expect(parsed.shouldAutoLoad).toBe(true);
		expect(parsed.settings).toMatchObject({
			backgroundMode: "space",
			roseAnglePreset: "aggressive-forward-2",
			roseMaterialPreset: "etched-rose",
			overlayEffect: "posterize",
			stepwiseBackgroundEnabled: true,
			bottomVisualizationEnabled: true,
			bottomVisualizationMode: "timeline",
			visualLayoutPreset: "vertical-triptych",
			audio: {
				selectedFixtureId: "err14041549-rosa-gallica",
				mappingOptions: {
					timeSignature: "6/8",
					accentStrengthPercent: 75,
					voiceSettings: {
						A: {
							preset: "polysynth-pad",
							volumeDb: 0,
							octaveShift: -1,
						},
						C: {
							preset: "plucked-strings",
							volumeDb: 0,
							octaveShift: 0,
						},
						G: {
							preset: "square-lead",
							volumeDb: 0,
							octaveShift: -2,
						},
						T: {
							preset: "synth-bass",
							volumeDb: 0,
							octaveShift: -2,
						},
					},
				},
				videoQuality: "near-lossless",
			},
		});
	});

	it("compacts defaults to the version marker", () => {
		const url = buildSharedSettingsUrl(
			"https://example.com/rose?campaign=spring#bloom",
			createDefaultSharedAppSettings(),
		);

		expect([...url.searchParams.entries()]).toEqual([
			["campaign", "spring"],
			["settings", "1"],
		]);
		expect(url.hash).toBe("#bloom");
		expect(parseSharedSettings(url.search)).toEqual({
			settings: createDefaultSharedAppSettings(),
			shouldAutoLoad: true,
		});
	});

	it("falls back safely for invalid values", () => {
		const invalidSearch = new URLSearchParams({
			settings: "1",
			bg: "ocean",
			angle: "upside-down",
			material: "paper",
			effect: "blur",
			stepwise: "yes",
			viz: "2",
			vizMode: "bars",
			layout: "diagonal",
			fixture: "missing",
			reads: "2001",
			stride: "2.5",
			bases: "7",
			tempo: "Infinity",
			meter: "2/4",
			ending: "fade",
			endingSteps: "3",
			accent: "-1",
			runtime: "181",
			loop: "false",
			aspect: "3:2",
			quality: "maximum",
			aVoice: "piano",
			aVol: "-31",
			aOct: "3",
		});

		expect(parseSharedSettings(invalidSearch.toString())).toEqual({
			settings: createDefaultSharedAppSettings(),
			shouldAutoLoad: true,
		});
	});

	it("ignores settings without a supported version marker", () => {
		expect(parseSharedSettings("?settings=2&bg=space")).toEqual({
			settings: createDefaultSharedAppSettings(),
			shouldAutoLoad: false,
		});
		expect(parseSharedSettings("?bg=space").shouldAutoLoad).toBe(false);
	});

	it("preserves unrelated URL state and replaces stale owned parameters", () => {
		const url = buildSharedSettingsUrl(
			"https://example.com/exhibit?bg=space&tempo=60&utm_source=gallery#rose",
			createDefaultSharedAppSettings(),
		);

		expect(url.pathname).toBe("/exhibit");
		expect(url.searchParams.get("utm_source")).toBe("gallery");
		expect(url.searchParams.has("bg")).toBe(false);
		expect(url.searchParams.has("tempo")).toBe(false);
		expect(url.searchParams.get("settings")).toBe("1");
		expect(url.hash).toBe("#rose");
	});
});
