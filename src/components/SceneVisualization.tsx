import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
	CanvasTexture,
	MathUtils,
	SRGBColorSpace,
	Vector3,
	type Mesh,
	type PerspectiveCamera,
} from "three";
import type { GenomicMusicSequence } from "@/audio/types";
import {
	getCanvasPixelSize,
	getSquareContainedRect,
	getVisualCompositionLayout,
} from "@/visualization/canvas-layout";
import {
	createVisualizationModel,
	drawBottomVisualization,
} from "@/visualization/renderers";
import type {
	BottomVisualizationMode,
	VisualLayoutPreset,
	VisualizationAudioFrame,
} from "@/visualization/types";

type SceneVisualizationProps = {
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

export function SceneVisualization({
	getAudioFrame,
	getPlaybackPosition,
	isPlaying,
	layoutPreset,
	mode,
	sequence,
}: SceneVisualizationProps) {
	const { gl } = useThree();
	const meshRef = useRef<Mesh>(null);
	const lastAudioFrameRef = useRef<VisualizationAudioFrame>(EMPTY_AUDIO_FRAME);
	const lastModeRef = useRef<BottomVisualizationMode>(mode);
	const lastPlaybackPositionRef = useRef(0);
	const liveStateRef = useRef({
		getAudioFrame,
		getPlaybackPosition,
		isPlaying,
		layoutPreset,
		mode,
	});
	const forward = useMemo(() => new Vector3(), []);
	const right = useMemo(() => new Vector3(), []);
	const up = useMemo(() => new Vector3(), []);
	const model = useMemo(() => createVisualizationModel(sequence), [sequence]);
	const resource = useMemo(() => {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		const texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;

		return { canvas, context, texture };
	}, []);
	liveStateRef.current = {
		getAudioFrame,
		getPlaybackPosition,
		isPlaying,
		layoutPreset,
		mode,
	};

	useEffect(() => {
		return () => resource.texture.dispose();
	}, [resource]);

	useFrame(({ camera, size }) => {
		const mesh = meshRef.current;
		const { canvas, context, texture } = resource;

		if (!mesh || !context) {
			return;
		}

		const liveState = liveStateRef.current;
		const layout = getVisualCompositionLayout(
			liveState.layoutPreset,
			size.width / Math.max(1, size.height),
		);
		const radial =
			liveState.mode === "spiral" || liveState.mode === "pitch-wheel";
		const rect = radial
			? getSquareContainedRect(layout.visualization, size.width, size.height)
			: layout.visualization;
		const { width, height } = getCanvasPixelSize(
			size.width * rect.width,
			size.height * rect.height,
			gl.getPixelRatio(),
		);
		const resized = canvas.width !== width || canvas.height !== height;
		const modeChanged = lastModeRef.current !== liveState.mode;

		if (resized) {
			canvas.width = width;
			canvas.height = height;
		}
		if (modeChanged) {
			context.clearRect(0, 0, canvas.width, canvas.height);
			lastModeRef.current = liveState.mode;
		}

		const playbackPosition = liveState.getPlaybackPosition();
		const timelineReset =
			playbackPosition + 1 / 120 < lastPlaybackPositionRef.current;
		lastPlaybackPositionRef.current = playbackPosition;
		if (liveState.isPlaying) {
			lastAudioFrameRef.current = liveState.getAudioFrame();
		} else if (playbackPosition <= 0) {
			lastAudioFrameRef.current = EMPTY_AUDIO_FRAME;
		}

		drawBottomVisualization(
			context,
			liveState.mode,
			model,
			playbackPosition,
			lastAudioFrameRef.current,
			{
				reset: resized || modeChanged || timelineReset,
				vertical: layout.visualizationVertical,
			},
		);
		texture.needsUpdate = true;

		const perspectiveCamera = camera as PerspectiveCamera;
		const distance = 17;
		const viewportHeight =
			2 * Math.tan(MathUtils.degToRad(perspectiveCamera.fov) / 2) * distance;
		const viewportWidth = viewportHeight * perspectiveCamera.aspect;
		const centerX = rect.x + rect.width / 2;
		const centerY = rect.y + rect.height / 2;

		camera.getWorldDirection(forward);
		right.set(1, 0, 0).applyQuaternion(camera.quaternion);
		up.set(0, 1, 0).applyQuaternion(camera.quaternion);
		mesh.position
			.copy(camera.position)
			.addScaledVector(forward, distance)
			.addScaledVector(right, (centerX - 0.5) * viewportWidth)
			.addScaledVector(up, (0.5 - centerY) * viewportHeight);
		mesh.quaternion.copy(camera.quaternion);
		mesh.scale.set(
			viewportWidth * rect.width,
			viewportHeight * rect.height,
			1,
		);
	});

	return (
		<mesh ref={meshRef} renderOrder={-500} frustumCulled={false}>
			<planeGeometry args={[1, 1]} />
			<meshBasicMaterial
				map={resource.texture}
				transparent
				depthTest
				depthWrite={false}
				fog={false}
				toneMapped={false}
			/>
		</mesh>
	);
}
