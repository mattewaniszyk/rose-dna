import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { downloadBlob } from "@/audio/download";
import type {
	Mp3ExportProgress,
} from "@/audio/export-mp3";
import type {
	MediaExportKind,
	MediaExportStage,
} from "@/audio/export-media";
import { FASTQ_FIXTURES } from "@/audio/fixtures";
import { loadAndMapFastqFixture } from "@/audio/load-map";
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
import {
	DEFAULT_VIDEO_ASPECT_RATIO,
	DEFAULT_VIDEO_QUALITY_PRESET,
	type VideoAspectRatio,
	type VideoCaptureRequest,
	type VideoCaptureSession,
	type VideoQualityPreset,
} from "@/audio/video-export-options";
import type { GenomicAudioSettings } from "@/shared-settings";

type BuildStatus = "idle" | "loading" | "ready" | "error";
type ExportStatus = "idle" | "exporting" | "done" | "error";

type VideoExportBridge = {
	prepareScene: (
		request: VideoCaptureRequest,
		signal?: AbortSignal,
	) => Promise<VideoCaptureSession>;
};

type UseGenomicAudioOptions = {
	autoLoadInitialFixture?: boolean;
	initialSettings?: GenomicAudioSettings;
};

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

function cloneMappingOptions(mappingOptions: MappingOptions): MappingOptions {
	return {
		...mappingOptions,
		voiceSettings: {
			A: { ...mappingOptions.voiceSettings.A },
			C: { ...mappingOptions.voiceSettings.C },
			G: { ...mappingOptions.voiceSettings.G },
			T: { ...mappingOptions.voiceSettings.T },
		},
	};
}

function getSourceConfigurationKey(
	selectedFixtureId: string,
	parseOptions: FastqParseOptions,
) {
	return `${selectedFixtureId}:${JSON.stringify(parseOptions)}`;
}

export function useGenomicAudio(
	videoExportBridge?: VideoExportBridge,
	options: UseGenomicAudioOptions = {},
) {
	const fixtures = useMemo(() => FASTQ_FIXTURES, []);
	const [selectedFixtureId, setSelectedFixtureId] = useState(
		options.initialSettings?.selectedFixtureId ?? fixtures[0]?.id ?? "",
	);
	const [parseOptions, setParseOptions] =
		useState<FastqParseOptions>(() => ({
			...(options.initialSettings?.parseOptions ?? DEFAULT_PARSE_OPTIONS),
		}));
	const [mappingOptions, setMappingOptions] =
		useState<MappingOptions>(() => {
			const initialMappingOptions =
				options.initialSettings?.mappingOptions ?? DEFAULT_MAPPING_OPTIONS;
			return {
				...initialMappingOptions,
				voiceSettings: {
					A: { ...initialMappingOptions.voiceSettings.A },
					C: { ...initialMappingOptions.voiceSettings.C },
					G: { ...initialMappingOptions.voiceSettings.G },
					T: { ...initialMappingOptions.voiceSettings.T },
				},
			};
		});
	const [buildStatus, setBuildStatus] = useState<BuildStatus>("idle");
	const [buildError, setBuildError] = useState<string | null>(null);
	const [dataset, setDataset] = useState<FastqDataset | null>(null);
	const [sequence, setSequence] =
		useState<GenomicMusicSequence | null>(null);
	const [isLoopEnabled, setIsLoopEnabled] = useState(
		options.initialSettings?.isLoopEnabled ?? true,
	);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackSeconds, setPlaybackSeconds] = useState(0);
	const [playbackEventIndex, setPlaybackEventIndex] = useState<number | null>(null);
	const [audioEnergy, setAudioEnergy] = useState(0);
	const [playbackTriggerCount, setPlaybackTriggerCount] = useState(0);
	const [audioContextState, setAudioContextState] = useState("not-started");
	const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
	const [exportKind, setExportKind] = useState<MediaExportKind | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);
	const [exportStage, setExportStage] = useState<MediaExportStage | null>(null);
	const [exportProgress, setExportProgress] = useState(0);
	const [isVideoExportSupported, setIsVideoExportSupported] = useState(false);
	const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>(
		options.initialSettings?.videoAspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
	);
	const [videoQuality, setVideoQuality] = useState<VideoQualityPreset>(
		options.initialSettings?.videoQuality ?? DEFAULT_VIDEO_QUALITY_PRESET,
	);
	const [previewingBase, setPreviewingBase] =
		useState<CanonicalBase | null>(null);
	const [isPreparingVoices, setIsPreparingVoices] = useState(false);
	const [isRandomizing, setIsRandomizing] = useState(false);
	const shouldAutoLoadInitialFixtureRef = useRef(
		options.autoLoadInitialFixture ?? false,
	);

	const voicesRef = useRef<GenomicVoiceBank | null>(null);
	const voiceBankPromiseRef = useRef<Promise<GenomicVoiceBank> | null>(null);
	const signalChainGenerationRef = useRef(0);
	const previewVoiceRef = useRef<GenomicVoice | null>(null);
	const previewTimerRef = useRef<number | null>(null);
	const previewRequestIdRef = useRef(0);
	const masterOutputRef = useRef<Tone.Gain | null>(null);
	const meterRef = useRef<Tone.Meter | null>(null);
	const waveformAnalyserRef = useRef<Tone.Analyser | null>(null);
	const spectrumAnalyserRef = useRef<Tone.Analyser | null>(null);
	const partRef = useRef<ScheduledGenomicPlayback | null>(null);
	const loadAbortControllerRef = useRef<AbortController | null>(null);
	const exportAbortControllerRef = useRef<AbortController | null>(null);
	const hasLoadedEncoderRef = useRef(false);
	const loadRequestIdRef = useRef(0);
	const sourceConfigurationKey = getSourceConfigurationKey(
		selectedFixtureId,
		parseOptions,
	);
	const mappingConfigurationKey = JSON.stringify(mappingOptions);
	const previousSourceConfigurationKeyRef = useRef(sourceConfigurationKey);
	const previousMappingConfigurationKeyRef = useRef(mappingConfigurationKey);
	const loadedSourceConfigurationKeyRef = useRef<string | null>(null);
	const currentSourceConfigurationKeyRef = useRef(sourceConfigurationKey);
	const currentMappingOptionsRef = useRef(mappingOptions);
	currentSourceConfigurationKeyRef.current = sourceConfigurationKey;
	currentMappingOptionsRef.current = mappingOptions;

	useEffect(() => {
		let active = true;

		void import("@/audio/export-mp4").then(
			({ isMp4ExportSupported }) => {
				if (active) {
					setIsVideoExportSupported(isMp4ExportSupported());
				}
			},
			() => {
				if (active) {
					setIsVideoExportSupported(false);
				}
			},
		);

		return () => {
			active = false;
		};
	}, []);

	const disposeSignalChain = useCallback(() => {
		signalChainGenerationRef.current += 1;
		voiceBankPromiseRef.current = null;

		// Playback owns references to the voice bank. Dispose it before the
		// samplers so its final stop cannot call into an already-disposed Smplr.
		if (partRef.current) {
			partRef.current.dispose();
			partRef.current = null;
		}

		if (masterOutputRef.current) {
			masterOutputRef.current.dispose();
			masterOutputRef.current = null;
		}

		if (meterRef.current) {
			meterRef.current.dispose();
			meterRef.current = null;
		}

		if (waveformAnalyserRef.current) {
			waveformAnalyserRef.current.dispose();
			waveformAnalyserRef.current = null;
		}

		if (spectrumAnalyserRef.current) {
			spectrumAnalyserRef.current.dispose();
			spectrumAnalyserRef.current = null;
		}

		disposeGenomicVoiceBank(voicesRef.current);
		voicesRef.current = null;
	}, []);

	const ensureSignalChain = useCallback(async (voiceSettings: VoiceSettingsByBase) => {
		if (
			voicesRef.current &&
			masterOutputRef.current &&
			meterRef.current
		) {
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

			const masterOutput = new Tone.Gain(1);
			const meter = new Tone.Meter({ normalRange: true, smoothing: 0.86 });
			const waveformAnalyser = new Tone.Analyser("waveform", 1024);
			const spectrumAnalyser = new Tone.Analyser("fft", 256);

			for (const voice of Object.values(voices)) {
				voice.connect(masterOutput);
			}

			// Keep the audible route direct. Analysis nodes tap the bus in
			// parallel so a visualization can never interrupt or attenuate audio.
			masterOutput.toDestination();
			masterOutput.connect(meter);
			masterOutput.connect(waveformAnalyser);
			masterOutput.connect(spectrumAnalyser);
			voicesRef.current = voices;
			masterOutputRef.current = masterOutput;
			meterRef.current = meter;
			waveformAnalyserRef.current = waveformAnalyser;
			spectrumAnalyserRef.current = spectrumAnalyser;

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
			setPlaybackEventIndex(null);
			setAudioEnergy(0);
			setIsPlaying(false);

			const settings =
				mappingOptions.voiceSettings?.[base] ?? DEFAULT_VOICE_SETTINGS[base];
			const family = VOICE_PRESET_DEFINITIONS[settings.preset].family;
			await Tone.start();
			const context = Tone.getContext();

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
		setPlaybackEventIndex(null);
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
		loadRequestIdRef.current += 1;
		loadAbortControllerRef.current?.abort(
			new DOMException("FASTQ loading was superseded.", "AbortError"),
		);
		loadAbortControllerRef.current = null;
		setIsRandomizing(false);
		loadedSourceConfigurationKeyRef.current = null;
		stopVoicePreview();
		disposeSignalChain();
		resetTransport();
		exportAbortControllerRef.current?.abort();

		setDataset(null);
		setSequence(null);
		setPlaybackTriggerCount(0);
		setPlaybackEventIndex(null);
		setBuildStatus("idle");
		setBuildError(null);
		setExportStatus("idle");
		setExportKind(null);
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
		loadRequestIdRef.current += 1;
		loadAbortControllerRef.current?.abort(
			new DOMException("FASTQ loading was superseded.", "AbortError"),
		);
		loadAbortControllerRef.current = null;
		setIsRandomizing(false);
		stopVoicePreview();
		disposeSignalChain();
		resetTransport();
		exportAbortControllerRef.current?.abort();

		setPlaybackTriggerCount(0);
		setPlaybackEventIndex(null);
		setBuildError(null);
		setExportStatus("idle");
		setExportKind(null);
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
		loadAbortControllerRef.current?.abort(
			new DOMException("FASTQ loading was superseded.", "AbortError"),
		);
		const abortController = new AbortController();
		loadAbortControllerRef.current = abortController;
		const loadRequestId = ++loadRequestIdRef.current;
		const requestedSourceConfigurationKey = sourceConfigurationKey;
		const requestedMappingOptions = currentMappingOptionsRef.current;
		const selectedFixture = fixtures.find(
			(fixture) => fixture.id === selectedFixtureId,
		);

		if (!selectedFixture) {
			if (loadAbortControllerRef.current === abortController) {
				loadAbortControllerRef.current = null;
			}
			setBuildStatus("error");
			setBuildError("The selected FASTQ fixture could not be found.");
			setIsRandomizing(false);
			return;
		}

		setBuildStatus("loading");
		setIsRandomizing(false);
		setBuildError(null);
		setExportError(null);

		try {
			const { dataset: nextDataset, sequence: nextSequence } =
				await loadAndMapFastqFixture(
					selectedFixture,
					parseOptions,
					requestedMappingOptions,
					{ signal: abortController.signal },
				);

			if (
				loadRequestIdRef.current !== loadRequestId ||
				currentSourceConfigurationKeyRef.current !==
					requestedSourceConfigurationKey
			) {
				return;
			}

			resetSequencePlayback(nextSequence);
			loadedSourceConfigurationKeyRef.current =
				requestedSourceConfigurationKey;
			setDataset(nextDataset);
			setSequence(nextSequence);
			setBuildStatus("ready");
			setPlaybackSeconds(0);
		} catch (error) {
			if (loadRequestIdRef.current !== loadRequestId) {
				return;
			}

			setBuildStatus("error");
			setBuildError(stringifyUnknownError(error));
		} finally {
			if (loadAbortControllerRef.current === abortController) {
				loadAbortControllerRef.current = null;
			}
		}
	}, [
		fixtures,
		parseOptions,
		resetSequencePlayback,
		selectedFixtureId,
		sourceConfigurationKey,
	]);

	const loadSettingsAndPlayLooping = useCallback(
		async (settings: GenomicAudioSettings) => {
			loadAbortControllerRef.current?.abort(
				new DOMException("FASTQ loading was superseded.", "AbortError"),
			);
			const abortController = new AbortController();
			loadAbortControllerRef.current = abortController;
			const selectedFixture = fixtures.find(
				(fixture) => fixture.id === settings.selectedFixtureId,
			);
			const loadRequestId = ++loadRequestIdRef.current;

			if (!selectedFixture) {
				loadAbortControllerRef.current = null;
				setBuildStatus("error");
				setBuildError("The selected FASTQ fixture could not be found.");
				setIsRandomizing(false);
				return;
			}

			// Invoke Tone.start() directly from the click call stack so browsers
			// recognize the user gesture even though FASTQ loading happens next.
			const audioStartPromise = Tone.start();
			const nextParseOptions = { ...settings.parseOptions };
			const nextMappingOptions = cloneMappingOptions(settings.mappingOptions);
			const nextSourceConfigurationKey = getSourceConfigurationKey(
				settings.selectedFixtureId,
				nextParseOptions,
			);
			const nextMappingConfigurationKey = JSON.stringify(nextMappingOptions);
			let sequenceWasLoaded = false;

			stopVoicePreview();
			exportAbortControllerRef.current?.abort();
			disposeSignalChain();
			resetTransport();

			// Keep the change-detection effects synchronized with this atomic
			// transition so they do not tear down the sequence we are about to load.
			previousSourceConfigurationKeyRef.current = nextSourceConfigurationKey;
			previousMappingConfigurationKeyRef.current = nextMappingConfigurationKey;
			loadedSourceConfigurationKeyRef.current = null;
			currentSourceConfigurationKeyRef.current = nextSourceConfigurationKey;
			currentMappingOptionsRef.current = nextMappingOptions;

			setSelectedFixtureId(settings.selectedFixtureId);
			setParseOptions(nextParseOptions);
			setMappingOptions(nextMappingOptions);
			setIsLoopEnabled(true);
			setVideoAspectRatio(settings.videoAspectRatio);
			setVideoQuality(settings.videoQuality);
			setDataset(null);
			setSequence(null);
			setPlaybackTriggerCount(0);
			setPlaybackEventIndex(null);
			setIsPreparingVoices(false);
			setIsRandomizing(true);
			setBuildStatus("loading");
			setBuildError(null);
			setExportStatus("idle");
			setExportKind(null);
			setExportStage(null);
			setExportProgress(0);
			setExportError(null);

			try {
				const [{ dataset: nextDataset, sequence: nextSequence }] =
					await Promise.all([
						loadAndMapFastqFixture(
							selectedFixture,
							nextParseOptions,
							nextMappingOptions,
							{ signal: abortController.signal },
						),
						audioStartPromise,
					]);

				if (loadRequestIdRef.current !== loadRequestId) {
					return;
				}

				const context = Tone.getContext();
				Tone.getDestination().mute = false;
				Tone.getDestination().volume.value = 0;
				setAudioContextState(context.state);

				loadedSourceConfigurationKeyRef.current = nextSourceConfigurationKey;
				setDataset(nextDataset);
				setSequence(nextSequence);
				setBuildStatus("ready");
				setPlaybackSeconds(0);
				sequenceWasLoaded = true;
				setIsPreparingVoices(true);

				const voices = await ensureSignalChain(
					nextSequence.voiceSettings ?? DEFAULT_VOICE_SETTINGS,
				);

				if (loadRequestIdRef.current !== loadRequestId) {
					return;
				}

				partRef.current = buildTonePart(
					nextSequence,
					voices,
					(_event, eventIndex) => {
						setPlaybackTriggerCount((current) => current + 1);
						setPlaybackEventIndex(eventIndex);
					},
					() => {
						setPlaybackSeconds(0);
						setPlaybackEventIndex(null);
						setAudioEnergy(0);
						setIsPlaying(false);
					},
				);
				partRef.current.setLoop(true);
				partRef.current.play();
				setIsPlaying(true);
			} catch (error) {
				if (
					loadRequestIdRef.current !== loadRequestId ||
					(error instanceof DOMException && error.name === "AbortError")
				) {
					return;
				}

				if (!sequenceWasLoaded) {
					setBuildStatus("error");
					setDataset(null);
					setSequence(null);
				}
				setBuildError(
					sequenceWasLoaded
						? `Could not load the sampled instruments: ${stringifyUnknownError(error)}`
						: stringifyUnknownError(error),
				);
				setIsPlaying(false);
			} finally {
				if (loadRequestIdRef.current === loadRequestId) {
					setIsPreparingVoices(false);
					setIsRandomizing(false);
				}
				if (loadAbortControllerRef.current === abortController) {
					loadAbortControllerRef.current = null;
				}
			}
		},
		[
			disposeSignalChain,
			ensureSignalChain,
			fixtures,
			resetTransport,
			stopVoicePreview,
		],
	);

	useEffect(() => {
		if (!shouldAutoLoadInitialFixtureRef.current) {
			return;
		}

		shouldAutoLoadInitialFixtureRef.current = false;
		void loadSelectedFixture();
	}, [loadSelectedFixture]);

	const play = useCallback(async () => {
		if (!sequence || sequence.events.length === 0) {
			return;
		}

		setIsPreparingVoices(true);
		setBuildError(null);

		try {
			await Tone.start();
			const context = Tone.getContext();
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
					(_event, eventIndex) => {
						setPlaybackTriggerCount((current) => current + 1);
						setPlaybackEventIndex(eventIndex);
					},
					() => {
						setPlaybackSeconds(0);
						setPlaybackEventIndex(null);
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
		setPlaybackEventIndex(null);
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
		setExportKind("mp3");
		setExportError(null);
		setExportStage("rendering-audio");
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
				setExportKind(null);
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

	const exportMp4 = useCallback(async () => {
		if (
			!sequence ||
			sequence.events.length === 0 ||
			!videoExportBridge
		) {
			return;
		}

		stopVoicePreview();
		partRef.current?.stop();
		setPlaybackSeconds(0);
		setPlaybackEventIndex(null);
		setAudioEnergy(0);
		setIsPlaying(false);

		const abortController = new AbortController();
		const abortWhenHidden = () => {
			if (document.hidden && !abortController.signal.aborted) {
				abortController.abort(
					new Error("Video export stopped because the tab was hidden."),
				);
			}
		};
		exportAbortControllerRef.current?.abort();
		exportAbortControllerRef.current = abortController;
		document.addEventListener("visibilitychange", abortWhenHidden);
		abortWhenHidden();
		setExportStatus("exporting");
		setExportKind("mp4");
		setExportError(null);
		setExportStage("rendering-audio");
		setExportProgress(0);

		try {
			const { exportSequenceToMp4 } = await import("@/audio/export-mp4");
			hasLoadedEncoderRef.current = true;
			const blob = await exportSequenceToMp4(sequence, {
				aspectRatio: videoAspectRatio,
				quality: videoQuality,
				signal: abortController.signal,
				prepareScene: videoExportBridge.prepareScene,
				onProgress: (progress) => {
					setExportStage(progress.stage);
					setExportProgress(progress.progress);
				},
			});

			downloadBlob(blob, `${buildDownloadStem()}.mp4`);
			setExportStatus("done");
		} catch (error) {
			if (
				abortController.signal.aborted &&
				abortController.signal.reason instanceof DOMException &&
				abortController.signal.reason.name === "AbortError"
			) {
				setExportStatus("idle");
				setExportKind(null);
				setExportError(null);
			} else {
				setExportStatus("error");
				setExportError(
					stringifyUnknownError(
						abortController.signal.aborted
							? abortController.signal.reason
							: error,
					),
				);
			}
		} finally {
			document.removeEventListener("visibilitychange", abortWhenHidden);
			if (exportAbortControllerRef.current === abortController) {
				exportAbortControllerRef.current = null;
			}

			setExportStage(null);
			setExportProgress(0);
		}
	}, [
		buildDownloadStem,
		sequence,
		stopVoicePreview,
		videoAspectRatio,
		videoExportBridge,
		videoQuality,
	]);

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
			new DOMException("Export was cancelled.", "AbortError"),
		);
	}, []);

	const getPlaybackPosition = useCallback(
		() => partRef.current?.getPosition() ?? 0,
		[],
	);

	const getVisualizationAudioFrame = useCallback(() => {
		const waveform = waveformAnalyserRef.current?.getValue();
		const spectrum = spectrumAnalyserRef.current?.getValue();

		return {
			waveform:
				waveform instanceof Float32Array
					? waveform
					: new Float32Array(),
			spectrum:
				spectrum instanceof Float32Array
					? spectrum
					: new Float32Array(),
		};
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
			loadRequestIdRef.current += 1;
			loadAbortControllerRef.current?.abort(
				new DOMException("FASTQ loading was cancelled.", "AbortError"),
			);
			exportAbortControllerRef.current?.abort();
			stopVoicePreview();

			if (partRef.current) {
				partRef.current.dispose();
				partRef.current = null;
			}

			disposeSignalChain();

			if (hasLoadedEncoderRef.current) {
				void import("@/audio/export-media").then(({ resetMediaEncoder }) => {
					resetMediaEncoder();
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
		isRandomizing,
		buildStatus,
		buildError,
		dataset,
		sequence,
		loadSelectedFixture,
		loadSettingsAndPlayLooping,
		isLoopEnabled,
		setIsLoopEnabled,
		isPlaying,
		play,
		pause,
		stop,
		playbackSeconds,
		playbackEventIndex,
		getPlaybackPosition,
		getVisualizationAudioFrame,
		audioEnergy,
		playbackTriggerCount,
		audioContextState,
		exportStatus,
		exportKind,
		exportStage,
		exportProgress,
		exportError,
		exportMp3,
		exportMp4,
		exportMidi,
		isVideoExportSupported,
		videoAspectRatio,
		setVideoAspectRatio,
		videoQuality,
		setVideoQuality,
		cancelExport,
	};
}

export type GenomicAudioController = ReturnType<typeof useGenomicAudio>;
