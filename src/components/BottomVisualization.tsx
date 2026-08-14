import { useEffect, useMemo, useRef, useState } from "react";
import type { GenomicMusicSequence } from "@/audio/types";
import {
	createVisualizationModel,
	drawBottomVisualization,
} from "@/visualization/renderers";
import {
	getCanvasPixelSize,
	getVisualCompositionLayout,
} from "@/visualization/canvas-layout";
import type {
	BottomVisualizationMode,
	VisualLayoutPreset,
	VisualizationAudioFrame,
} from "@/visualization/types";

type BottomVisualizationProps = {
	getAudioFrame: () => VisualizationAudioFrame;
	getPlaybackPosition: () => number;
	isPlaying: boolean;
	layoutPreset: VisualLayoutPreset;
	mode: BottomVisualizationMode;
	sequence: GenomicMusicSequence;
};

const EMPTY_AUDIO_FRAME: VisualizationAudioFrame = {
	waveform: new Float32Array(),
	spectrum: new Float32Array(),
};

export function BottomVisualization({
	getAudioFrame,
	getPlaybackPosition,
	isPlaying,
	layoutPreset,
	mode,
	sequence,
}: BottomVisualizationProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [viewportAspect, setViewportAspect] = useState(() =>
		typeof window === "undefined"
			? 16 / 9
			: window.innerWidth / Math.max(1, window.innerHeight),
	);
	const lastAudioFrameRef = useRef<VisualizationAudioFrame>(EMPTY_AUDIO_FRAME);
	const model = useMemo(() => createVisualizationModel(sequence), [sequence]);
	const layout = useMemo(
		() => getVisualCompositionLayout(layoutPreset, viewportAspect),
		[layoutPreset, viewportAspect],
	);

	useEffect(() => {
		let animationFrame = 0;
		const updateViewportAspect = () => {
			window.cancelAnimationFrame(animationFrame);
			animationFrame = window.requestAnimationFrame(() => {
				setViewportAspect(
					window.innerWidth / Math.max(1, window.innerHeight),
				);
			});
		};

		window.addEventListener("resize", updateViewportAspect);
		return () => {
			window.removeEventListener("resize", updateViewportAspect);
			window.cancelAnimationFrame(animationFrame);
		};
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;

		if (!canvas) {
			return;
		}

		const context = canvas.getContext("2d");

		if (!context) {
			return;
		}

		let animationFrame = 0;
		let disposed = false;
		let observedWidth = canvas.clientWidth;
		let observedHeight = canvas.clientHeight;
		const resize = () => {
			const ratio = Math.min(2, window.devicePixelRatio || 1);
			const { width, height } = getCanvasPixelSize(
				observedWidth,
				observedHeight,
				ratio,
			);

			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
				return true;
			}

			return false;
		};
		const draw = () => {
			const resized = resize();
			const position = getPlaybackPosition();
			if (isPlaying) {
				lastAudioFrameRef.current = getAudioFrame();
			} else if (position <= 0) {
				lastAudioFrameRef.current = EMPTY_AUDIO_FRAME;
			}
			drawBottomVisualization(
				context,
				mode,
				model,
				position,
				lastAudioFrameRef.current,
				{
					reset: resized,
					vertical: layout.visualizationVertical,
				},
			);
		};
		const animate = () => {
			if (disposed) {
				return;
			}

			draw();
			animationFrame = window.requestAnimationFrame(animate);
		};
		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];

			if (entry) {
				observedWidth = entry.contentRect.width;
				observedHeight = entry.contentRect.height;
			}

			draw();
		});
		resizeObserver.observe(canvas);
		context.clearRect(0, 0, canvas.width, canvas.height);

		if (isPlaying) {
			animationFrame = window.requestAnimationFrame(animate);
		} else {
			draw();
		}

		return () => {
			disposed = true;
			window.cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
		};
	}, [
		getAudioFrame,
		getPlaybackPosition,
		isPlaying,
		layout.visualizationVertical,
		mode,
		model,
	]);

	return (
		<div
			className="bottom-visualization"
			style={{
				left: `${layout.visualization.x * 100}%`,
				top: `${layout.visualization.y * 100}%`,
				width: `${layout.visualization.width * 100}%`,
				height: `${layout.visualization.height * 100}%`,
			}}
			role="img"
			aria-label={`${mode.replace("-", " ")} visualization of the genomic audio sequence`}
		>
			<canvas ref={canvasRef} />
		</div>
	);
}
