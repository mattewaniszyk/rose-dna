import { useCallback, useMemo, useRef, useState } from "react";
import "./App.css";
import { AudioPanel } from "./components/AudioPanel";
import { BackgroundMenu } from "./components/BackgroundMenu";
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
	getCapturePixelRatio,
	type VideoCaptureRequest,
	type VideoCaptureSession,
} from "./audio/video-export-options";
import { audioBufferFrameAt } from "./visualization/audio-analysis";
import { getVisualCompositionLayout } from "./visualization/canvas-layout";
import {
	createVisualizationModel,
	drawBottomVisualization,
} from "./visualization/renderers";
import {
	DEFAULT_VISUAL_LAYER_SETTINGS,
	type BottomVisualizationMode,
	type VisualLayoutPreset,
} from "./visualization/types";

function drawCanvasCover(
	context: CanvasRenderingContext2D,
	source: HTMLCanvasElement,
	width: number,
	height: number,
) {
	const sourceAspect = source.width / Math.max(1, source.height);
	const targetAspect = width / Math.max(1, height);
	let sourceX = 0;
	let sourceY = 0;
	let sourceWidth = source.width;
	let sourceHeight = source.height;

	if (sourceAspect > targetAspect) {
		sourceWidth = source.height * targetAspect;
		sourceX = (source.width - sourceWidth) / 2;
	} else {
		sourceHeight = source.width / targetAspect;
		sourceY = (source.height - sourceHeight) / 2;
	}

	context.drawImage(
		source,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
		0,
		0,
		width,
		height,
	);
}

function waitForSceneCapture(
	getController: () => RoseSceneCaptureController | null,
	isBackdropReady: () => boolean,
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

			if (controller) {
				controller.renderFrame(warmupFrameCount / 30, 0);
				warmupFrameCount += 1;
			}

			if (
				controller &&
				controller.canvas.width > 0 &&
				controller.canvas.height > 0 &&
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
	const [backgroundMode, setBackgroundMode] =
		useState<BackgroundMode>("black");
	const [roseAnglePreset, setRoseAnglePreset] =
		useState<RoseAnglePreset>("default");
	const [roseMaterialPreset, setRoseMaterialPreset] =
		useState<RoseMaterialPreset>("default");
	const [overlayEffect, setOverlayEffect] = useState<OverlayEffect>("none");
	const [stepwiseBackgroundEnabled, setStepwiseBackgroundEnabled] =
		useState(DEFAULT_VISUAL_LAYER_SETTINGS.stepwiseBackgroundEnabled);
	const [bottomVisualizationEnabled, setBottomVisualizationEnabled] =
		useState(DEFAULT_VISUAL_LAYER_SETTINGS.bottomVisualizationEnabled);
	const [bottomVisualizationMode, setBottomVisualizationMode] =
		useState<BottomVisualizationMode>(
			DEFAULT_VISUAL_LAYER_SETTINGS.bottomVisualizationMode,
		);
	const [visualLayoutPreset, setVisualLayoutPreset] =
		useState<VisualLayoutPreset>(
			DEFAULT_VISUAL_LAYER_SETTINGS.visualLayoutPreset,
		);
	const unicornProjectId = BACKGROUND_MODE_PROJECT_IDS[backgroundMode];
	const sceneCaptureControllerRef =
		useRef<RoseSceneCaptureController | null>(null);
	const backdropReadyRef = useRef(false);
	const requiresBackdropRef = useRef(Boolean(unicornProjectId));
	const [isVideoCaptureActive, setIsVideoCaptureActive] = useState(false);
	const [videoCapturePixelRatio, setVideoCapturePixelRatio] = useState(1);
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
		setVideoCapturePixelRatio(1);
	}, []);

	const prepareVideoScene = useCallback(async (
		request: VideoCaptureRequest,
		signal?: AbortSignal,
	): Promise<VideoCaptureSession> => {
		setVideoCapturePixelRatio(
			getCapturePixelRatio(request, window.innerWidth, window.innerHeight),
		);
		setIsVideoCaptureActive(true);

		try {
			const controller = await waitForSceneCapture(
				() => sceneCaptureControllerRef.current,
				() =>
					!requiresBackdropRef.current || backdropReadyRef.current,
				signal,
			);

			if (!bottomVisualizationEnabled) {
				return {
					canvas: controller.canvas,
					renderFrame: controller.renderFrame,
					release: releaseVideoScene,
				};
			}

			const compositeCanvas = document.createElement("canvas");
			compositeCanvas.width = request.width;
			compositeCanvas.height = request.height;
			const compositeContext = compositeCanvas.getContext("2d", {
				alpha: false,
			});
			const bottomCanvas = document.createElement("canvas");
			const compositionLayout = getVisualCompositionLayout(
				stepwiseBackgroundEnabled ? visualLayoutPreset : "balanced",
				request.width / Math.max(1, request.height),
			);
			const visualizationRect = compositionLayout.visualization;
			bottomCanvas.width = Math.max(
				1,
				Math.round(request.width * visualizationRect.width),
			);
			bottomCanvas.height = Math.max(
				1,
				Math.round(request.height * visualizationRect.height),
			);
			const bottomContext = bottomCanvas.getContext("2d");

			if (!compositeContext || !bottomContext) {
				throw new Error("The video visualization canvas could not be created.");
			}

			const visualizationModel = createVisualizationModel(request.sequence);
			let firstVisualizationFrame = true;

			return {
				canvas: compositeCanvas,
				renderFrame: (elapsedSeconds, audioEnergy) => {
					controller.renderFrame(elapsedSeconds, audioEnergy);
					compositeContext.clearRect(0, 0, request.width, request.height);
					drawCanvasCover(
						compositeContext,
						controller.canvas,
						request.width,
						request.height,
					);
					drawBottomVisualization(
						bottomContext,
						bottomVisualizationMode,
						visualizationModel,
						elapsedSeconds,
						audioBufferFrameAt(request.audioBuffer, elapsedSeconds),
						{
							reset: firstVisualizationFrame,
							vertical: compositionLayout.visualizationVertical,
						},
					);
					firstVisualizationFrame = false;
					compositeContext.drawImage(
						bottomCanvas,
						Math.round(request.width * visualizationRect.x),
						Math.round(request.height * visualizationRect.y),
					);
				},
				release: releaseVideoScene,
			};
		} catch (error) {
			releaseVideoScene();
			throw error;
		}
	}, [
		bottomVisualizationEnabled,
		bottomVisualizationMode,
		releaseVideoScene,
		stepwiseBackgroundEnabled,
		visualLayoutPreset,
	]);
	const videoExportBridge = useMemo(
		() => ({
			prepareScene: prepareVideoScene,
		}),
		[prepareVideoScene],
	);
	const genomicAudio = useGenomicAudio(videoExportBridge);
	const isExporting = genomicAudio.exportStatus === "exporting";
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
				videoCapturePixelRatio={videoCapturePixelRatio}
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
				</div>
			</div>
		</main>
	);
}

export default App;
