import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
	CanvasTexture,
	MathUtils,
	SRGBColorSpace,
	Vector3,
	type Mesh,
	type MeshBasicMaterial,
	type PerspectiveCamera,
} from "three";
import type { GenomicMusicSequence } from "@/audio/types";
import {
	createStepwiseVisualizationModel,
	drawStepwiseBackground,
} from "@/visualization/renderers";
import {
	getAspectPreservingCoverSize,
	getCanvasPixelSize,
} from "@/visualization/canvas-layout";
import { getFocusedEventIndex } from "@/visualization/sequence";
import type { VisualLayoutPreset } from "@/visualization/types";

type StepwiseBackdropProps = {
	captureActive: boolean;
	captureTimeRef: RefObject<number>;
	getPlaybackPosition: () => number;
	layoutPreset: VisualLayoutPreset;
	sequence: GenomicMusicSequence;
};

function createCanvasTextureResource(width = 1, height = 1) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;

	return { canvas, context, texture };
}

export function StepwiseBackdrop({
	captureActive,
	captureTimeRef,
	getPlaybackPosition,
	layoutPreset,
	sequence,
}: StepwiseBackdropProps) {
	const { gl } = useThree();
	const meshRef = useRef<Mesh>(null);
	const layoutPresetRef = useRef(layoutPreset);
	const renderKeyRef = useRef("");
	const cameraDirection = useMemo(() => new Vector3(), []);
	const model = useMemo(
		() => createStepwiseVisualizationModel(sequence),
		[sequence],
	);
	const initialResource = useMemo(() => createCanvasTextureResource(), []);
	const resourceRef = useRef(initialResource);
	layoutPresetRef.current = layoutPreset;

	useEffect(() => {
		return () => {
			resourceRef.current.texture.dispose();
		};
	}, []);

	useEffect(() => {
		renderKeyRef.current = "";
	}, [model]);

	useFrame(({ camera, size }) => {
		const mesh = meshRef.current;
		const perspectiveCamera = camera as PerspectiveCamera;
		const distance = 18;

		const { width, height } = getCanvasPixelSize(
			size.width,
			size.height,
			gl.getPixelRatio(),
		);

		if (!mesh) {
			return;
		}

		let resource = resourceRef.current;
		if (resource.canvas.width !== width || resource.canvas.height !== height) {
			const nextResource = createCanvasTextureResource(width, height);
			const material = mesh.material as MeshBasicMaterial;
			material.map = nextResource.texture;
			material.needsUpdate = true;
			resource.texture.dispose();
			resourceRef.current = nextResource;
			resource = nextResource;
			renderKeyRef.current = "";
		}

		const { context, texture } = resource;
		if (!context) {
			return;
		}

		camera.getWorldDirection(cameraDirection);
		mesh.position.copy(camera.position).addScaledVector(cameraDirection, distance);
		mesh.quaternion.copy(camera.quaternion);

		const viewportHeight =
			2 * Math.tan(MathUtils.degToRad(perspectiveCamera.fov) / 2) * distance;
		const viewportWidth = viewportHeight * perspectiveCamera.aspect;
		const plane = getAspectPreservingCoverSize(
			viewportWidth,
			viewportHeight,
			width,
			height,
		);
		mesh.scale.set(plane.width, plane.height, 1);

		const playbackPosition = captureActive
			? captureTimeRef.current
			: getPlaybackPosition();
		const focusedIndex = getFocusedEventIndex(
			sequence.events,
			playbackPosition,
		);
		const renderKey = `${width}:${height}:${layoutPresetRef.current}:${focusedIndex}`;

		if (renderKey === renderKeyRef.current) {
			return;
		}

		drawStepwiseBackground(
			context,
			model,
			playbackPosition,
			{ layoutPreset: layoutPresetRef.current },
		);
		renderKeyRef.current = renderKey;
		texture.needsUpdate = true;
	});

	return (
		<mesh ref={meshRef} renderOrder={-1000} frustumCulled={false}>
			<planeGeometry args={[1, 1]} />
			<meshBasicMaterial
				map={initialResource.texture}
				transparent
				depthTest
				depthWrite={false}
				fog={false}
				toneMapped={false}
			/>
		</mesh>
	);
}
