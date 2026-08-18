import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	DicesIcon,
	Loader2Icon,
	MenuIcon,
	PauseIcon,
	PlayIcon,
	XIcon,
} from "lucide-react";
import "./App.css";
import { Button } from "./components/ui/button";
import { AudioPanel } from "./components/AudioPanel";
import { ArtistStatement } from "./components/ArtistStatement";
import { BackgroundMenu } from "./components/BackgroundMenu";
import { ShareSettingsButton } from "./components/ShareSettingsButton";
import { VisualLayersMenu } from "./components/VisualLayersMenu";
import {
	BACKGROUND_MODE_PROJECT_IDS,
	type BackgroundMode,
} from "./components/background-mode";
import type { OverlayEffect } from "./components/overlay-effect";
import type { RoseAnglePreset } from "./components/rose-angle";
import type { RoseMaterialPreset } from "./components/rose-material";
import {
	RoseScene,
	type RoseSceneCaptureController,
} from "./components/RoseScene";
import { UnicornBackground } from "./components/UnicornBackground";
import { useGenomicAudio } from "./hooks/useGenomicAudio";
import {
	getContainedVideoCaptureViewport,
	type VideoCaptureRequest,
	type VideoCaptureSession,
	type VideoCaptureViewport,
} from "./audio/video-export-options";
import {
	type BottomVisualizationMode,
	type VisualLayoutPreset,
} from "./visualization/types";
import {
	buildSharedSettingsUrl,
	type SharedAppSettings,
} from "./shared-settings";
import {
	createRandomizedExperienceSettings,
	resolveInitialExperienceSettings,
} from "./random-settings";

const LOADING_COMMAND = "Run ROSE-DNA.exe //////// loading ";
const LOADING_DOT_CYCLES = 5;
const LOADING_DOT_TYPING_DELAY = 280;
const LOADING_DOT_CYCLE_DURATION = 1_250;

function AppLoadingOverlay() {
	const [displayedText, setDisplayedText] = useState("");
	const [isLeaving, setIsLeaving] = useState(false);
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		const timeouts: number[] = [];
		const schedule = (callback: () => void, delay: number) => {
			timeouts.push(window.setTimeout(callback, delay));
		};
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const characterDelay = prefersReducedMotion ? 0 : 52;

		if (prefersReducedMotion) {
			setDisplayedText(`${LOADING_COMMAND}...`);
		} else {
			Array.from(LOADING_COMMAND).forEach((_, index) => {
				schedule(
					() => setDisplayedText(LOADING_COMMAND.slice(0, index + 1)),
					characterDelay * (index + 1),
				);
			});

			const commandTypingDuration = characterDelay * LOADING_COMMAND.length;

			for (let cycle = 0; cycle < LOADING_DOT_CYCLES; cycle += 1) {
				const cycleStart =
					commandTypingDuration + cycle * LOADING_DOT_CYCLE_DURATION;

				for (let dotCount = 1; dotCount <= 3; dotCount += 1) {
					schedule(
						() =>
							setDisplayedText(
								`${LOADING_COMMAND}${".".repeat(dotCount)}`,
							),
						cycleStart + LOADING_DOT_TYPING_DELAY * dotCount,
					);
				}

				if (cycle < LOADING_DOT_CYCLES - 1) {
					schedule(
						() => setDisplayedText(LOADING_COMMAND),
						cycleStart + LOADING_DOT_CYCLE_DURATION,
					);
				}
			}
		}

		const animationDuration = prefersReducedMotion
			? 650
			: characterDelay * LOADING_COMMAND.length +
				LOADING_DOT_CYCLES * LOADING_DOT_CYCLE_DURATION +
				300;
		schedule(() => setIsLeaving(true), animationDuration);
		schedule(() => setIsVisible(false), animationDuration + 500);

		return () => {
			timeouts.forEach((timeout) => window.clearTimeout(timeout));
		};
	}, []);

	if (!isVisible) {
		return null;
	}

	return (
		<div
			className={`app-loading-overlay${isLeaving ? " is-leaving" : ""}`}
			role="status"
			aria-live="polite"
		>
			<span className="app-loading-copy" aria-hidden="true">
				{displayedText}
				{displayedText.length < LOADING_COMMAND.length ? (
					<span className="app-loading-cursor" />
				) : null}
			</span>
			<span className="app-loading-accessible-copy">ROSE-DNA is loading.</span>
		</div>
	);
}

function drawCanvasFrame(
	context: CanvasRenderingContext2D,
	source: HTMLCanvasElement,
	width: number,
	height: number,
) {
	context.drawImage(
		source,
		0,
		0,
		source.width,
		source.height,
		0,
		0,
		width,
		height,
	);
}

function waitForSceneCapture(
	getController: () => RoseSceneCaptureController | null,
	isBackdropReady: () => boolean,
	targetAspect: number,
	signal?: AbortSignal,
) {
	return new Promise<RoseSceneCaptureController>((resolve, reject) => {
		let animationFrame = 0;
		let readyFrameCount = 0;
		let warmupFrameCount = 0;
		const startedAt = performance.now();

		const cleanup = () => {
			window.cancelAnimationFrame(animationFrame);
			signal?.removeEventListener("abort", onAbort);
		};

		const onAbort = () => {
			cleanup();
			reject(
				signal?.reason instanceof Error
					? signal.reason
					: new DOMException("MP4 export was cancelled.", "AbortError"),
			);
		};

		const poll = (timestamp: number) => {
			const controller = getController();
			const canvasAspect = controller
				? controller.canvas.width / Math.max(1, controller.canvas.height)
				: 0;

			if (controller) {
				controller.renderFrame(warmupFrameCount / 30, 0);
				warmupFrameCount += 1;
			}

			if (
				controller &&
				controller.canvas.width > 0 &&
				controller.canvas.height > 0 &&
				Math.abs(canvasAspect - targetAspect) < 0.002 &&
				isBackdropReady()
			) {
				readyFrameCount += 1;

				if (readyFrameCount >= 2) {
					cleanup();
					controller.resetTimeline();
					resolve(controller);
					return;
				}
			} else {
				readyFrameCount = 0;
			}

			if (timestamp - startedAt > 15_000) {
				cleanup();
				reject(
					new Error(
						"The selected scene background was not ready for video capture.",
					),
				);
				return;
			}

			animationFrame = window.requestAnimationFrame(poll);
		};

		if (signal?.aborted) {
			onAbort();
			return;
		}

		signal?.addEventListener("abort", onAbort, { once: true });
		animationFrame = window.requestAnimationFrame(poll);
	});
}

function App() {
	const initialSharedSettings = useMemo(
		() => resolveInitialExperienceSettings(window.location.search),
		[],
	);
	const [backgroundMode, setBackgroundMode] =
		useState<BackgroundMode>(initialSharedSettings.settings.backgroundMode);
	const [roseAnglePreset, setRoseAnglePreset] =
		useState<RoseAnglePreset>(initialSharedSettings.settings.roseAnglePreset);
	const [roseMaterialPreset, setRoseMaterialPreset] =
		useState<RoseMaterialPreset>(
			initialSharedSettings.settings.roseMaterialPreset,
		);
	const [overlayEffect, setOverlayEffect] = useState<OverlayEffect>(
		initialSharedSettings.settings.overlayEffect,
	);
	const [stepwiseBackgroundEnabled, setStepwiseBackgroundEnabled] =
		useState(initialSharedSettings.settings.stepwiseBackgroundEnabled);
	const [bottomVisualizationEnabled, setBottomVisualizationEnabled] =
		useState(initialSharedSettings.settings.bottomVisualizationEnabled);
	const [bottomVisualizationMode, setBottomVisualizationMode] =
		useState<BottomVisualizationMode>(
			initialSharedSettings.settings.bottomVisualizationMode,
		);
	const [visualLayoutPreset, setVisualLayoutPreset] =
		useState<VisualLayoutPreset>(
			initialSharedSettings.settings.visualLayoutPreset,
		);
	const [controlsExpanded, setControlsExpanded] = useState(false);
	const [artistStatementOpen, setArtistStatementOpen] = useState(false);
	const unicornProjectId = BACKGROUND_MODE_PROJECT_IDS[backgroundMode];
	const sceneCaptureControllerRef =
		useRef<RoseSceneCaptureController | null>(null);
	const backdropReadyRef = useRef(false);
	const requiresBackdropRef = useRef(Boolean(unicornProjectId));
	const [isVideoCaptureActive, setIsVideoCaptureActive] = useState(false);
	const [videoCaptureAudioBuffer, setVideoCaptureAudioBuffer] =
		useState<AudioBuffer | null>(null);
	const [videoCaptureViewport, setVideoCaptureViewport] =
		useState<VideoCaptureViewport | null>(null);
	requiresBackdropRef.current = Boolean(unicornProjectId);
	const handleBackdropReadyChange = useCallback((ready: boolean) => {
		backdropReadyRef.current = ready;
	}, []);
	const handleSceneCaptureControllerChange = useCallback(
		(controller: RoseSceneCaptureController | null) => {
			sceneCaptureControllerRef.current = controller;
		},
		[],
	);
	const releaseVideoScene = useCallback(() => {
		setIsVideoCaptureActive(false);
		setVideoCaptureAudioBuffer(null);
		setVideoCaptureViewport(null);
	}, []);

	const prepareVideoScene = useCallback(async (
		request: VideoCaptureRequest,
		signal?: AbortSignal,
	): Promise<VideoCaptureSession> => {
		setVideoCaptureAudioBuffer(request.audioBuffer);
		setVideoCaptureViewport(
			getContainedVideoCaptureViewport(
				request.width,
				request.height,
				window.innerWidth,
				window.innerHeight,
			),
		);
		setIsVideoCaptureActive(true);

		try {
			const controller = await waitForSceneCapture(
				() => sceneCaptureControllerRef.current,
				() =>
					!requiresBackdropRef.current || backdropReadyRef.current,
				request.width / request.height,
				signal,
			);
			const captureCanvas = document.createElement("canvas");
			captureCanvas.width = request.width;
			captureCanvas.height = request.height;
			const captureContext = captureCanvas.getContext("2d", {
				alpha: false,
			});

			if (!captureContext) {
				throw new Error("The video capture canvas could not be created.");
			}

			captureContext.imageSmoothingEnabled = true;
			captureContext.imageSmoothingQuality = "high";

			return {
				canvas: captureCanvas,
				renderFrame: (elapsedSeconds, audioEnergy) => {
					controller.renderFrame(elapsedSeconds, audioEnergy);
					captureContext.clearRect(0, 0, request.width, request.height);
					drawCanvasFrame(
						captureContext,
						controller.canvas,
						request.width,
						request.height,
					);
				},
				release: releaseVideoScene,
			};
		} catch (error) {
			releaseVideoScene();
			throw error;
		}
	}, [
		releaseVideoScene,
	]);
	const videoExportBridge = useMemo(
		() => ({
			prepareScene: prepareVideoScene,
		}),
		[prepareVideoScene],
	);
	const genomicAudio = useGenomicAudio(videoExportBridge, {
		initialSettings: initialSharedSettings.settings.audio,
		autoLoadInitialFixture: initialSharedSettings.shouldAutoLoad,
	});
	const sharedSettings = useMemo<SharedAppSettings>(
		() => ({
			backgroundMode,
			roseAnglePreset,
			roseMaterialPreset,
			overlayEffect,
			stepwiseBackgroundEnabled,
			bottomVisualizationEnabled,
			bottomVisualizationMode,
			visualLayoutPreset,
			audio: {
				selectedFixtureId: genomicAudio.selectedFixtureId,
				parseOptions: genomicAudio.parseOptions,
				mappingOptions: genomicAudio.mappingOptions,
				isLoopEnabled: genomicAudio.isLoopEnabled,
				videoAspectRatio: genomicAudio.videoAspectRatio,
				videoQuality: genomicAudio.videoQuality,
			},
		}),
		[
			backgroundMode,
			bottomVisualizationEnabled,
			bottomVisualizationMode,
			genomicAudio.isLoopEnabled,
			genomicAudio.mappingOptions,
			genomicAudio.parseOptions,
			genomicAudio.selectedFixtureId,
			genomicAudio.videoAspectRatio,
			genomicAudio.videoQuality,
			overlayEffect,
			roseAnglePreset,
			roseMaterialPreset,
			stepwiseBackgroundEnabled,
			visualLayoutPreset,
		],
	);
	const shareUrl = useMemo(
		() => buildSharedSettingsUrl(window.location.href, sharedSettings).href,
		[sharedSettings],
	);
	const handleRandomize = useCallback(async () => {
		const nextSettings = createRandomizedExperienceSettings(sharedSettings);

		setBackgroundMode(nextSettings.backgroundMode);
		setRoseAnglePreset(nextSettings.roseAnglePreset);
		setRoseMaterialPreset(nextSettings.roseMaterialPreset);
		setOverlayEffect(nextSettings.overlayEffect);
		setStepwiseBackgroundEnabled(nextSettings.stepwiseBackgroundEnabled);
		setBottomVisualizationEnabled(nextSettings.bottomVisualizationEnabled);
		setBottomVisualizationMode(nextSettings.bottomVisualizationMode);
		setVisualLayoutPreset(nextSettings.visualLayoutPreset);

		await genomicAudio.loadSettingsAndPlayLooping(nextSettings.audio);
	}, [genomicAudio, sharedSettings]);
	const handleArtistStatementOpenChange = useCallback((isOpen: boolean) => {
		setArtistStatementOpen(isOpen);

		if (isOpen) {
			setControlsExpanded(false);
		}
	}, []);
	useEffect(() => {
		if (window.location.href !== shareUrl) {
			window.history.replaceState(window.history.state, "", shareUrl);
		}
	}, [shareUrl]);
	const isExporting = genomicAudio.exportStatus === "exporting";
	const isRandomizeDisabled = isExporting;
	const hasPlayableSequence = Boolean(genomicAudio.sequence?.events.length);
	const isPlaybackLoading =
		genomicAudio.buildStatus === "loading" || genomicAudio.isPreparingVoices;
	const playbackLabel = isPlaybackLoading
		? "Loading audio"
		: genomicAudio.isPlaying
			? "Pause audio"
			: "Play audio";
	const activeStepwiseLayoutPreset: VisualLayoutPreset =
		stepwiseBackgroundEnabled && bottomVisualizationEnabled
			? visualLayoutPreset
			: "layered";
	const activeVisualizationLayoutPreset: VisualLayoutPreset =
		stepwiseBackgroundEnabled && bottomVisualizationEnabled
			? visualLayoutPreset
			: "balanced";

	return (
		<main className="app-shell" data-background-mode={backgroundMode}>
			<AppLoadingOverlay />
			<ArtistStatement
				isOpen={artistStatementOpen}
				onOpenChange={handleArtistStatementOpenChange}
			/>
			{unicornProjectId ? (
				<UnicornBackground
					key={backgroundMode}
					projectId={unicornProjectId}
				/>
			) : null}
			<RoseScene
				backgroundMode={backgroundMode}
				bottomVisualizationEnabled={bottomVisualizationEnabled}
				bottomVisualizationMode={bottomVisualizationMode}
				overlayEffect={overlayEffect}
				roseAnglePreset={roseAnglePreset}
				roseMaterialPreset={roseMaterialPreset}
				audioEnergy={genomicAudio.audioEnergy}
				videoCaptureActive={isVideoCaptureActive}
				videoCaptureAudioBuffer={videoCaptureAudioBuffer}
				videoCaptureViewport={videoCaptureViewport}
				onSceneCaptureControllerChange={
					handleSceneCaptureControllerChange
				}
				onBackdropReadyChange={handleBackdropReadyChange}
				getPlaybackPosition={genomicAudio.getPlaybackPosition}
				getVisualizationAudioFrame={genomicAudio.getVisualizationAudioFrame}
				isPlaying={genomicAudio.isPlaying}
				sequence={genomicAudio.sequence}
				stepwiseBackgroundEnabled={stepwiseBackgroundEnabled}
				stepwiseLayoutPreset={activeStepwiseLayoutPreset}
				visualizationLayoutPreset={activeVisualizationLayoutPreset}
			/>
			{!artistStatementOpen ? (
				<div className="app-overlay">
					<div className="app-control-stack">
					<div className="utility-controls">
						<div className="playback-control">
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="h-11 w-11 rounded-full border-white/10 bg-black/55 text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white"
								onClick={() =>
									void (genomicAudio.isPlaying
										? genomicAudio.pause()
										: genomicAudio.play())
								}
								disabled={
									!hasPlayableSequence || isPlaybackLoading || isExporting
								}
								aria-busy={isPlaybackLoading}
								aria-label={playbackLabel}
								title={playbackLabel}
							>
								{isPlaybackLoading ? (
									<Loader2Icon
										className="size-4 animate-spin"
										aria-hidden="true"
									/>
								) : genomicAudio.isPlaying ? (
									<PauseIcon className="size-4" aria-hidden="true" />
								) : (
									<PlayIcon className="size-4" aria-hidden="true" />
								)}
							</Button>
						</div>
						<div className="randomize-control">
							<Button
								type="button"
								variant="outline"
								className="h-11 w-fit justify-between gap-3 rounded-full border-white/10 bg-black/55 px-4 text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white"
								onClick={() => void handleRandomize()}
								disabled={isRandomizeDisabled}
								aria-busy={genomicAudio.isRandomizing}
							>
								<span className="utility-action-label">
									{genomicAudio.isRandomizing ? "Randomizing..." : "Randomize"}
								</span>
								{genomicAudio.isRandomizing ? (
									<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
								) : (
									<DicesIcon className="size-4" aria-hidden="true" />
								)}
							</Button>
						</div>
						<ShareSettingsButton url={shareUrl} />
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="controls-toggle h-11 w-11 rounded-full border-white/10 bg-black/55 text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white"
							aria-controls="app-configuration-controls"
							aria-expanded={controlsExpanded}
							aria-label={controlsExpanded ? "Hide controls" : "Show controls"}
							title={controlsExpanded ? "Hide controls" : "Show controls"}
							onClick={() => setControlsExpanded((expanded) => !expanded)}
						>
							{controlsExpanded ? (
								<XIcon className="size-4" aria-hidden="true" />
							) : (
								<MenuIcon className="size-4" aria-hidden="true" />
							)}
						</Button>
					</div>
					<div
						id="app-configuration-controls"
						className="app-configuration-controls"
						hidden={!controlsExpanded}
					>
						{controlsExpanded ? (
							<>
								<BackgroundMenu
									disabled={isExporting}
									backgroundMode={backgroundMode}
									onBackgroundModeChange={setBackgroundMode}
									roseAnglePreset={roseAnglePreset}
									onRoseAnglePresetChange={setRoseAnglePreset}
									roseMaterialPreset={roseMaterialPreset}
									onRoseMaterialPresetChange={setRoseMaterialPreset}
									overlayEffect={overlayEffect}
									onOverlayEffectChange={setOverlayEffect}
								/>
								<VisualLayersMenu
									bottomVisualizationEnabled={bottomVisualizationEnabled}
									bottomVisualizationMode={bottomVisualizationMode}
									disabled={isExporting}
									hasSequence={Boolean(genomicAudio.sequence?.events.length)}
									onBottomVisualizationEnabledChange={setBottomVisualizationEnabled}
									onBottomVisualizationModeChange={setBottomVisualizationMode}
									onStepwiseBackgroundEnabledChange={setStepwiseBackgroundEnabled}
									stepwiseBackgroundEnabled={stepwiseBackgroundEnabled}
									onVisualLayoutPresetChange={setVisualLayoutPreset}
									visualLayoutPreset={visualLayoutPreset}
								/>
								<AudioPanel audio={genomicAudio} />
							</>
						) : null}
					</div>
					</div>
				</div>
			) : null}
		</main>
	);
}

export default App;
