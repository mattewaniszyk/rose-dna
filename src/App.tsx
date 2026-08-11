import { useCallback, useMemo, useRef, useState } from "react";
import "./App.css";
import { AudioPanel } from "./components/AudioPanel";
import { BackgroundMenu } from "./components/BackgroundMenu";
import {
	BACKGROUND_MODE_PROJECT_IDS,
	type BackgroundMode,
} from "./components/background-mode";
import type { OverlayEffect } from "./components/overlay-effect";
import type { RoseAnglePreset } from "./components/rose-angle";
import type { RoseMaterialPreset } from "./components/rose-material";
import { RoseScene } from "./components/RoseScene";
import { UnicornBackground } from "./components/UnicornBackground";
import { useGenomicAudio } from "./hooks/useGenomicAudio";
import {
	getCapturePixelRatio,
	type VideoCaptureRequest,
} from "./audio/video-export-options";

function waitForSceneCapture(
	getCanvas: () => HTMLCanvasElement | null,
	isBackdropReady: () => boolean,
	signal?: AbortSignal,
) {
	return new Promise<HTMLCanvasElement>((resolve, reject) => {
		let animationFrame = 0;
		let readyFrameCount = 0;
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
			const canvas = getCanvas();

			if (canvas && canvas.width > 0 && canvas.height > 0 && isBackdropReady()) {
				readyFrameCount += 1;

				if (readyFrameCount >= 2) {
					cleanup();
					resolve(canvas);
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
	const unicornProjectId = BACKGROUND_MODE_PROJECT_IDS[backgroundMode];
	const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const backdropReadyRef = useRef(false);
	const requiresBackdropRef = useRef(Boolean(unicornProjectId));
	const [isVideoCaptureActive, setIsVideoCaptureActive] = useState(false);
	const [videoCaptureEnergy, setVideoCaptureEnergy] = useState(0);
	const [videoCapturePixelRatio, setVideoCapturePixelRatio] = useState(1);
	requiresBackdropRef.current = Boolean(unicornProjectId);
	const handleSceneCanvasChange = useCallback(
		(canvas: HTMLCanvasElement | null) => {
			sceneCanvasRef.current = canvas;
		},
		[],
	);
	const handleBackdropReadyChange = useCallback((ready: boolean) => {
		backdropReadyRef.current = ready;
	}, []);

	const prepareVideoScene = useCallback(async (
		request: VideoCaptureRequest,
		signal?: AbortSignal,
	) => {
		setVideoCapturePixelRatio(
			getCapturePixelRatio(request, window.innerWidth, window.innerHeight),
		);
		setIsVideoCaptureActive(true);

		try {
			return await waitForSceneCapture(
				() => sceneCanvasRef.current,
				() =>
					!requiresBackdropRef.current || backdropReadyRef.current,
				signal,
			);
		} catch (error) {
			setIsVideoCaptureActive(false);
			setVideoCapturePixelRatio(1);
			throw error;
		}
	}, []);
	const releaseVideoScene = useCallback(() => {
		setIsVideoCaptureActive(false);
		setVideoCaptureEnergy(0);
		setVideoCapturePixelRatio(1);
	}, []);
	const videoExportBridge = useMemo(
		() => ({
			prepareScene: prepareVideoScene,
			releaseScene: releaseVideoScene,
			onVisualEnergy: setVideoCaptureEnergy,
		}),
		[prepareVideoScene, releaseVideoScene],
	);
	const genomicAudio = useGenomicAudio(videoExportBridge);
	const isExporting = genomicAudio.exportStatus === "exporting";

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
				overlayEffect={overlayEffect}
				roseAnglePreset={roseAnglePreset}
				roseMaterialPreset={roseMaterialPreset}
				audioEnergy={
					isVideoCaptureActive
						? videoCaptureEnergy
						: genomicAudio.audioEnergy
				}
				videoCaptureActive={isVideoCaptureActive}
				videoCapturePixelRatio={videoCapturePixelRatio}
				onSceneCanvasChange={handleSceneCanvasChange}
				onBackdropReadyChange={handleBackdropReadyChange}
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
					<AudioPanel audio={genomicAudio} />
				</div>
			</div>
		</main>
	);
}

export default App;
