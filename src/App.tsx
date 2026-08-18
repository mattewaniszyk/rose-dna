import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DicesIcon, Loader2Icon } from "lucide-react";
import "./App.css";
import { Button } from "./components/ui/button";
import { AudioPanel } from "./components/AudioPanel";
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
	parseSharedSettings,
	type SharedAppSettings,
} from "./shared-settings";
import { createRandomizedExperienceSettings } from "./random-settings";

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
		() => parseSharedSettings(window.location.search),
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
	useEffect(() => {
		if (window.location.href !== shareUrl) {
			window.history.replaceState(window.history.state, "", shareUrl);
		}
	}, [shareUrl]);
	const isExporting = genomicAudio.exportStatus === "exporting";
	const isRandomizeDisabled = isExporting;
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
			<div className="app-overlay">
				<div className="app-control-stack">
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
					<div className="utility-controls">
						<div className="randomize-control">
							<Button
								type="button"
								variant="outline"
								className="h-11 w-fit justify-between gap-3 rounded-full border-white/10 bg-black/55 px-5 text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white"
								onClick={() => void handleRandomize()}
								disabled={isRandomizeDisabled}
								aria-busy={genomicAudio.isRandomizing}
							>
								<span>
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
					</div>
				</div>
			</div>
		</main>
	);
}

export default App;
