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
	type VideoCaptureRequest,
	type VideoCaptureSession,
} from "./audio/video-export-options";
import {
	DEFAULT_VISUAL_LAYER_SETTINGS,
	type BottomVisualizationMode,
	type VisualLayoutPreset,
} from "./visualization/types";

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
	const [videoCaptureAudioBuffer, setVideoCaptureAudioBuffer] =
		useState<AudioBuffer | null>(null);
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
	}, []);

	const prepareVideoScene = useCallback(async (
		request: VideoCaptureRequest,
		signal?: AbortSignal,
	): Promise<VideoCaptureSession> => {
		setVideoCaptureAudioBuffer(request.audioBuffer);
		setIsVideoCaptureActive(true);

		try {
			const controller = await waitForSceneCapture(
				() => sceneCaptureControllerRef.current,
				() =>
					!requiresBackdropRef.current || backdropReadyRef.current,
				signal,
			);

			return {
				canvas: controller.canvas,
				renderFrame: controller.renderFrame,
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
				videoCaptureAudioBuffer={videoCaptureAudioBuffer}
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
