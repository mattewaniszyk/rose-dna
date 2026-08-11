import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { downloadBlob } from "@/audio/download";
import type {
	Mp3ExportProgress,
	Mp3ExportStage,
} from "@/audio/export-mp3";
import { FASTQ_FIXTURES } from "@/audio/fixtures";
import { loadFastqFixtureData } from "@/audio/fastq";
import { mapDatasetToSequence } from "@/audio/mapping";
import {
	createSampledElectronicVoice,
	createSampledGenomicVoiceBank,
} from "@/audio/sampled-voices";
import {
	buildTonePart,
	type ScheduledGenomicPlayback,
} from "@/audio/playback";
import {
	DEFAULT_MAPPING_OPTIONS,
	DEFAULT_PARSE_OPTIONS,
	DEFAULT_VOICE_SETTINGS,
	VOICE_PRESET_DEFINITIONS,
	type CanonicalBase,
	type FastqDataset,
	type FastqFixture,
	type FastqParseOptions,
	type GenomicMusicSequence,
	type GroupEndingMode,
	type MappingOptions,
	type TimeSignature,
	type VoicePresetId,
	type VoiceSettingsByBase,
} from "@/audio/types";
import {
	disposeGenomicVoiceBank,
	type GenomicVoiceBank,
} from "@/audio/voices";
import type { GenomicVoice } from "@/audio/voice-types";

type BuildStatus = "idle" | "loading" | "ready" | "error";
type ExportStatus = "idle" | "exporting" | "done" | "error";

function clampInt(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function formatTimestamp() {
	return new Date().toISOString().replace(/[.:]/g, "-");
}

function stringifyUnknownError(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return JSON.stringify(error);
}

export function useGenomicAudio() {
	const fixtures = useMemo(() => FASTQ_FIXTURES, []);
	const [selectedFixtureId, setSelectedFixtureId] = useState(
		fixtures[0]?.id ?? "",
	);
	const [parseOptions, setParseOptions] =
		useState<FastqParseOptions>(DEFAULT_PARSE_OPTIONS);
	const [mappingOptions, setMappingOptions] =
		useState<MappingOptions>(DEFAULT_MAPPING_OPTIONS);
	const [buildStatus, setBuildStatus] = useState<BuildStatus>("idle");
	const [buildError, setBuildError] = useState<string | null>(null);
	const [dataset, setDataset] = useState<FastqDataset | null>(null);
	const [sequence, setSequence] =
		useState<GenomicMusicSequence | null>(null);
	const [isLoopEnabled, setIsLoopEnabled] = useState(true);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackSeconds, setPlaybackSeconds] = useState(0);
	const [audioEnergy, setAudioEnergy] = useState(0);
	const [playbackTriggerCount, setPlaybackTriggerCount] = useState(0);
	const [audioContextState, setAudioContextState] = useState("not-started");
	const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
	const [exportError, setExportError] = useState<string | null>(null);
	const [exportStage, setExportStage] = useState<Mp3ExportStage | null>(null);
	const [exportProgress, setExportProgress] = useState(0);
	const [previewingBase, setPreviewingBase] =
		useState<CanonicalBase | null>(null);
	const [isPreparingVoices, setIsPreparingVoices] = useState(false);

	const voicesRef = useRef<GenomicVoiceBank | null>(null);
	const voiceBankPromiseRef = useRef<Promise<GenomicVoiceBank> | null>(null);
	const signalChainGenerationRef = useRef(0);
	const previewVoiceRef = useRef<GenomicVoice | null>(null);
	const previewTimerRef = useRef<number | null>(null);
	const previewRequestIdRef = useRef(0);
	const meterRef = useRef<Tone.Meter | null>(null);
	const partRef = useRef<ScheduledGenomicPlayback | null>(null);
	const exportAbortControllerRef = useRef<AbortController | null>(null);
	const hasLoadedEncoderRef = useRef(false);
	const sourceConfigurationKey = `${selectedFixtureId}:${JSON.stringify(parseOptions)}`;
	const mappingConfigurationKey = JSON.stringify(mappingOptions);
	const previousSourceConfigurationKeyRef = useRef(sourceConfigurationKey);
	const previousMappingConfigurationKeyRef = useRef(mappingConfigurationKey);
	const loadedSourceConfigurationKeyRef = useRef<string | null>(null);
	const currentSourceConfigurationKeyRef = useRef(sourceConfigurationKey);
	const currentMappingOptionsRef = useRef(mappingOptions);
	currentSourceConfigurationKeyRef.current = sourceConfigurationKey;
	currentMappingOptionsRef.current = mappingOptions;

	const disposeSignalChain = useCallback(() => {
		signalChainGenerationRef.current += 1;
		voiceBankPromiseRef.current = null;

		// Playback owns references to the voice bank. Dispose it before the
		// samplers so its final stop cannot call into an already-disposed Smplr.
		if (partRef.current) {
			partRef.current.dispose();
			partRef.current = null;
		}

		if (meterRef.current) {
			meterRef.current.dispose();
			meterRef.current = null;
		}

		disposeGenomicVoiceBank(voicesRef.current);
		voicesRef.current = null;
	}, []);

	const ensureSignalChain = useCallback(async (voiceSettings: VoiceSettingsByBase) => {
		if (voicesRef.current && meterRef.current) {
			return voicesRef.current;
		}

		if (voiceBankPromiseRef.current) {
			return voiceBankPromiseRef.current;
		}

		const generation = signalChainGenerationRef.current;
		const bankPromise = createSampledGenomicVoiceBank(voiceSettings);
		voiceBankPromiseRef.current = bankPromise;

		try {
			const voices = await bankPromise;

			if (signalChainGenerationRef.current !== generation) {
				disposeGenomicVoiceBank(voices);
				throw new DOMException(
					"Instrument loading was superseded.",
					"AbortError",
				);
			}

			const meter = new Tone.Meter({ normalRange: true, smoothing: 0.86 });

			for (const voice of Object.values(voices)) {
				voice.connect(meter);
			}

			meter.toDestination();
			voicesRef.current = voices;
			meterRef.current = meter;

			return voices;
		} finally {
			if (voiceBankPromiseRef.current === bankPromise) {
				voiceBankPromiseRef.current = null;
			}
		}
	}, []);

	const updateVoiceSetting = useCallback(
		(
			base: CanonicalBase,
			update: Partial<VoiceSettingsByBase[CanonicalBase]>,
		) => {
			setMappingOptions((current) => ({
				...current,
				voiceSettings: {
					...DEFAULT_VOICE_SETTINGS,
					...current.voiceSettings,
					[base]: {
						...DEFAULT_VOICE_SETTINGS[base],
						...current.voiceSettings?.[base],
						...update,
					},
				},
			}));
		},
		[],
	);

	const setVoicePreset = useCallback(
		(base: CanonicalBase, preset: VoicePresetId) => {
			updateVoiceSetting(base, { preset });
		},
		[updateVoiceSetting],
	);

	const setVoiceVolumeDb = useCallback(
		(base: CanonicalBase, volumeDb: number) => {
			updateVoiceSetting(base, { volumeDb: clampInt(volumeDb, -30, 0) });
		},
		[updateVoiceSetting],
	);

	const setVoiceOctaveShift = useCallback(
		(base: CanonicalBase, octaveShift: number) => {
			updateVoiceSetting(base, {
				octaveShift: clampInt(octaveShift, -2, 2),
			});
		},
		[updateVoiceSetting],
	);

	const stopVoicePreview = useCallback(() => {
		previewRequestIdRef.current += 1;

		if (previewTimerRef.current !== null) {
			window.clearTimeout(previewTimerRef.current);
			previewTimerRef.current = null;
		}

		if (previewVoiceRef.current) {
			previewVoiceRef.current.releaseAll(Tone.now());
			previewVoiceRef.current.dispose();
			previewVoiceRef.current = null;
		}

		setPreviewingBase(null);
	}, []);

	const previewVoice = useCallback(
		async (base: CanonicalBase) => {
			stopVoicePreview();
			const requestId = previewRequestIdRef.current;
			setPreviewingBase(base);
			partRef.current?.stop();
			setPlaybackSeconds(0);
			setAudioEnergy(0);
			setIsPlaying(false);

			const settings =
				mappingOptions.voiceSettings?.[base] ?? DEFAULT_VOICE_SETTINGS[base];
			const family = VOICE_PRESET_DEFINITIONS[settings.preset].family;
			const context = Tone.getContext();

			await context.resume();

			if (previewRequestIdRef.current !== requestId) {
				return;
			}

			Tone.getDestination().mute = false;
			Tone.getDestination().volume.value = 0;
			setAudioContextState(context.state);

			let voice: GenomicVoice;

			try {
				voice = await createSampledElectronicVoice(
					settings.preset,
					settings.volumeDb,
				);
			} catch (error) {
				if (previewRequestIdRef.current === requestId) {
					setPreviewingBase(null);
					setBuildError(
						`Could not load the sampled instrument: ${stringifyUnknownError(error)}`,
					);
				}

				return;
			}

			if (previewRequestIdRef.current !== requestId) {
				voice.dispose();
				return;
			}

			const baseMidi = family === "Bass" ? 43 : 60;
			const rootMidi = Math.max(
				24,
				Math.min(96, baseMidi + settings.octaveShift * 12),
			);
			const chord = [rootMidi, rootMidi + 4, rootMidi + 7].map((midi) =>
				Tone.Frequency(Math.min(108, midi), "midi").toFrequency(),
			);
			const duration =
				family === "Pads" || family === "Strings"
					? 1.8
					: family === "Organs"
						? 1.35
						: 0.85;

			voice.toDestination();
			voice.triggerAttackRelease(chord, duration, Tone.now() + 0.02, 0.76);
			previewVoiceRef.current = voice;

			previewTimerRef.current = window.setTimeout(() => {
				if (previewVoiceRef.current === voice) {
					voice.dispose();
					previewVoiceRef.current = null;
					previewTimerRef.current = null;
					setPreviewingBase(null);
				}
			}, (duration + 3.4) * 1000);
		},
		[mappingOptions.voiceSettings, stopVoicePreview],
	);

	const resetTransport = useCallback(() => {
		partRef.current?.stop();
		setPlaybackSeconds(0);
		setAudioEnergy(0);
		setIsPlaying(false);
	}, []);

	useEffect(() => {
		if (
			previousSourceConfigurationKeyRef.current === sourceConfigurationKey
		) {
			return;
		}

		previousSourceConfigurationKeyRef.current = sourceConfigurationKey;
		loadedSourceConfigurationKeyRef.current = null;
		stopVoicePreview();
		disposeSignalChain();
		resetTransport();
		exportAbortControllerRef.current?.abort();

		setDataset(null);
		setSequence(null);
		setPlaybackTriggerCount(0);
		setBuildStatus("idle");
		setBuildError(null);
		setExportStatus("idle");
		setExportStage(null);
		setExportProgress(0);
		setExportError(null);
	}, [
		sourceConfigurationKey,
		disposeSignalChain,
		resetTransport,
		stopVoicePreview,
	]);

	useEffect(() => {
		if (
			previousMappingConfigurationKeyRef.current === mappingConfigurationKey
		) {
			return;
		}

		previousMappingConfigurationKeyRef.current = mappingConfigurationKey;
		stopVoicePreview();
		disposeSignalChain();
		resetTransport();
		exportAbortControllerRef.current?.abort();

		setPlaybackTriggerCount(0);
		setBuildError(null);
		setExportStatus("idle");
		setExportStage(null);
		setExportProgress(0);
		setExportError(null);

		if (
			dataset &&
			loadedSourceConfigurationKeyRef.current === sourceConfigurationKey
		) {
			setSequence(mapDatasetToSequence(dataset, mappingOptions));
			setBuildStatus("ready");
		} else {
			setSequence(null);
			setBuildStatus("idle");
		}
	}, [
		dataset,
		disposeSignalChain,
		mappingConfigurationKey,
		mappingOptions,
		resetTransport,
		sourceConfigurationKey,
		stopVoicePreview,
	]);

	const setReadStride = useCallback((value: number) => {
		setParseOptions((current) => ({
			...current,
			readStride: clampInt(value, 1, 5000),
		}));
	}, []);

	const setMaxReadsPerFile = useCallback((value: number) => {
		setParseOptions((current) => ({
			...current,
			maxReadsPerFile: clampInt(value, 4, 2000),
		}));
	}, []);

	const setTempoBpm = useCallback((value: number) => {
		setMappingOptions((current) => ({
			...current,
			tempoBpm: clampInt(value, 48, 180),
		}));
	}, []);

	const setAccentStrengthPercent = useCallback((value: number) => {
		setMappingOptions((current) => ({
			...current,
			accentStrengthPercent: clampInt(value, 0, 100),
		}));
	}, []);

	const setGroupEndingLengthSteps = useCallback((value: number) => {
		setMappingOptions((current) => ({
			...current,
			groupEndingLengthSteps: clampInt(value, 0, 2),
		}));
	}, []);

	const setGroupEndingMode = useCallback((value: GroupEndingMode) => {
		setMappingOptions((current) => ({
			...current,
			groupEndingMode: value,
		}));
	}, []);

	const setTimeSignature = useCallback((value: TimeSignature) => {
		setMappingOptions((current) => ({
			...current,
			timeSignature: value,
		}));
	}, []);

	const setMaxBasesPerRead = useCallback((value: number) => {
		setMappingOptions((current) => ({
			...current,
			maxBasesPerRead: clampInt(value, 8, 250),
		}));
	}, []);

	const setTargetRuntimeSeconds = useCallback((value: number) => {
		setMappingOptions((current) => ({
			...current,
			targetRuntimeSeconds: clampInt(value, 30, 180),
		}));
	}, []);

	const resetSequencePlayback = useCallback(
		(_nextSequence: GenomicMusicSequence) => {
			resetTransport();

			if (partRef.current) {
				partRef.current.dispose();
				partRef.current = null;
			}

			setPlaybackTriggerCount(0);
		},
		[resetTransport],
	);

	const loadSelectedFixture = useCallback(async () => {
		const requestedSourceConfigurationKey = sourceConfigurationKey;
		const selectedFixture = fixtures.find(
			(fixture) => fixture.id === selectedFixtureId,
		);

		if (!selectedFixture) {
			setBuildStatus("error");
			setBuildError("The selected FASTQ fixture could not be found.");
			return;
		}

		setBuildStatus("loading");
		setBuildError(null);
		setExportError(null);

		try {
			const nextDataset = await loadFastqFixtureData(
				selectedFixture,
				parseOptions,
			);

			if (
				currentSourceConfigurationKeyRef.current !==
				requestedSourceConfigurationKey
			) {
				return;
			}

			const nextSequence = mapDatasetToSequence(
				nextDataset,
				currentMappingOptionsRef.current,
			);

			resetSequencePlayback(nextSequence);
			loadedSourceConfigurationKeyRef.current =
				requestedSourceConfigurationKey;
			setDataset(nextDataset);
			setSequence(nextSequence);
			setBuildStatus("ready");
			setPlaybackSeconds(0);
		} catch (error) {
			setBuildStatus("error");
			setBuildError(stringifyUnknownError(error));
		}
	}, [
		fixtures,
		parseOptions,
		resetSequencePlayback,
		selectedFixtureId,
		sourceConfigurationKey,
	]);

	const play = useCallback(async () => {
		if (!sequence || sequence.events.length === 0) {
			return;
		}

		setIsPreparingVoices(true);
		setBuildError(null);

		try {
			const context = Tone.getContext();
			await context.resume();
			Tone.getDestination().mute = false;
			Tone.getDestination().volume.value = 0;
			setAudioContextState(context.state);

			if (!partRef.current) {
				const voices = await ensureSignalChain(
					sequence.voiceSettings ?? DEFAULT_VOICE_SETTINGS,
				);
				setPlaybackTriggerCount(0);
				partRef.current = buildTonePart(
					sequence,
					voices,
					() => {
						setPlaybackTriggerCount((current) => current + 1);
					},
					() => {
						setPlaybackSeconds(0);
						setAudioEnergy(0);
						setIsPlaying(false);
					},
				);
			}

			partRef.current.setLoop(isLoopEnabled);
			partRef.current.play();
			setIsPlaying(true);
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError")) {
				setBuildError(
					`Could not load the sampled instruments: ${stringifyUnknownError(error)}`,
				);
			}
		} finally {
			setIsPreparingVoices(false);
		}
	}, [ensureSignalChain, isLoopEnabled, sequence]);

	const pause = useCallback(() => {
		partRef.current?.pause();
		setPlaybackSeconds(partRef.current?.getPosition() ?? 0);
		setIsPlaying(false);
		setAudioEnergy(0);
	}, []);

	const stop = useCallback(() => {
		partRef.current?.stop();

		if (isPreparingVoices) {
			disposeSignalChain();
			setIsPreparingVoices(false);
		}

		setPlaybackSeconds(0);
		setAudioEnergy(0);
		setIsPlaying(false);
	}, [disposeSignalChain, isPreparingVoices]);

	const buildDownloadStem = useCallback(() => {
		const safeFixtureId = (dataset?.fixture.id ?? "genome-audio").replace(
			/[^a-z0-9_-]+/gi,
			"_",
		);

		return `${safeFixtureId}-${formatTimestamp()}`;
	}, [dataset?.fixture.id]);

	const exportMp3 = useCallback(async () => {
		if (!sequence || sequence.events.length === 0) {
			return;
		}

		const abortController = new AbortController();
		exportAbortControllerRef.current?.abort();
		exportAbortControllerRef.current = abortController;
		setExportStatus("exporting");
		setExportError(null);
		setExportStage("rendering");
		setExportProgress(0);

		try {
			const { exportSequenceToMp3 } = await import("@/audio/export-mp3");
			hasLoadedEncoderRef.current = true;
			const blob = await exportSequenceToMp3(sequence, {
				signal: abortController.signal,
				onProgress: (progress: Mp3ExportProgress) => {
					setExportStage(progress.stage);
					setExportProgress(progress.progress);
				},
			});

			downloadBlob(blob, `${buildDownloadStem()}.mp3`);

			setExportStatus("done");
		} catch (error) {
			if (abortController.signal.aborted) {
				setExportStatus("idle");
				setExportError(null);
			} else {
				setExportStatus("error");
				setExportError(stringifyUnknownError(error));
			}
		} finally {
			if (exportAbortControllerRef.current === abortController) {
				exportAbortControllerRef.current = null;
			}

			setExportStage(null);
			setExportProgress(0);
		}
	}, [buildDownloadStem, sequence]);

	const exportMidi = useCallback(async () => {
		if (!sequence || sequence.events.length === 0) {
			return;
		}

		setExportError(null);

		try {
			const { exportSequenceToMidi } = await import("@/audio/export-midi");
			const blob = exportSequenceToMidi(sequence);
			downloadBlob(blob, `${buildDownloadStem()}.mid`);
		} catch (error) {
			setExportError(stringifyUnknownError(error));
		}
	}, [buildDownloadStem, sequence]);

	const cancelExport = useCallback(() => {
		exportAbortControllerRef.current?.abort(
			new DOMException("MP3 export was cancelled.", "AbortError"),
		);
	}, []);

	useEffect(() => {
		partRef.current?.setLoop(isLoopEnabled);
	}, [isLoopEnabled]);

	useEffect(() => {
		if (!isPlaying || !sequence) {
			return;
		}

		let animationFrame = 0;
		let lastUiUpdate = 0;

		const tick = (timestamp: number) => {
			const elapsed = partRef.current?.getPosition() ?? 0;

			if (timestamp - lastUiUpdate >= 90) {
				setPlaybackSeconds(elapsed);
				lastUiUpdate = timestamp;
			}

			const meterValue = Number(meterRef.current?.getValue() ?? 0);
			const normalizedEnergy = Number.isFinite(meterValue)
				? Math.max(0, Math.min(1, meterValue))
				: 0;

			setAudioEnergy((current) => current * 0.8 + normalizedEnergy * 0.2);
			animationFrame = window.requestAnimationFrame(tick);
		};

		animationFrame = window.requestAnimationFrame(tick);

		return () => {
			window.cancelAnimationFrame(animationFrame);
		};
	}, [isPlaying, sequence]);

	useEffect(() => {
		return () => {
			exportAbortControllerRef.current?.abort();
			stopVoicePreview();

			if (partRef.current) {
				partRef.current.dispose();
				partRef.current = null;
			}

			disposeSignalChain();

			if (hasLoadedEncoderRef.current) {
				void import("@/audio/export-mp3").then(({ terminateMp3Encoder }) => {
					terminateMp3Encoder();
				});
			}
		};
	}, [disposeSignalChain, stopVoicePreview]);

	const activeFixture: FastqFixture | null =
		fixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null;

	return {
		fixtures,
		activeFixture,
		selectedFixtureId,
		setSelectedFixtureId,
		parseOptions,
		mappingOptions,
		setReadStride,
		setMaxReadsPerFile,
		setTempoBpm,
		setAccentStrengthPercent,
		setGroupEndingLengthSteps,
		setGroupEndingMode,
		setTimeSignature,
		setMaxBasesPerRead,
		setTargetRuntimeSeconds,
		setVoicePreset,
		setVoiceVolumeDb,
		setVoiceOctaveShift,
		previewVoice,
		stopVoicePreview,
		previewingBase,
		isPreparingVoices,
		buildStatus,
		buildError,
		dataset,
		sequence,
		loadSelectedFixture,
		isLoopEnabled,
		setIsLoopEnabled,
		isPlaying,
		play,
		pause,
		stop,
		playbackSeconds,
		audioEnergy,
		playbackTriggerCount,
		audioContextState,
		exportStatus,
		exportStage,
		exportProgress,
		exportError,
		exportMp3,
		exportMidi,
		cancelExport,
	};
}

export type GenomicAudioController = ReturnType<typeof useGenomicAudio>;
