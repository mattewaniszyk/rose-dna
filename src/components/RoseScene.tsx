import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	Suspense,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type RefObject,
} from "react";
import {
	BackSide,
	BoxGeometry,
	CatmullRomCurve3,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	PMREMGenerator,
	Scene,
	TubeGeometry,
	Vector3,
	type Group,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OverlayEffects } from "./OverlayEffects";
import { Rose } from "./Rose";
import {
	BACKGROUND_MODE_PROJECT_IDS,
	type BackgroundMode,
} from "./background-mode";
import { isActiveOverlayEffect, type OverlayEffect } from "./overlay-effect";
import {
	ROSE_ANGLE_PRESET_ROTATIONS,
	type RoseAnglePreset,
} from "./rose-angle";
import {
	isBareMetalPreset,
	isDimStudioLitPreset,
	isGlassPreset,
	isRoseShaderPreset,
	type RoseMaterialPreset,
} from "./rose-material";
import {
	sanitizeAnimationDelta,
	sanitizeAudioEnergy,
} from "./rose-animation";
import { SceneBackdrop } from "./SceneBackdrop";
import { SceneVisualization } from "./SceneVisualization";
import { Skybox } from "./Skybox";
import { StepwiseBackdrop } from "./StepwiseBackdrop";
import type { GenomicMusicSequence } from "@/audio/types";
import type { VideoCaptureViewport } from "@/audio/video-export-options";
import { audioBufferFrameAt } from "@/visualization/audio-analysis";
import type {
	BottomVisualizationMode,
	VisualLayoutPreset,
	VisualizationAudioFrame,
} from "@/visualization/types";

type SceneEnvironmentProps = {
	roseMaterialPreset: RoseMaterialPreset;
};

function createBareMetalEnvironmentTexture(pmremGenerator: PMREMGenerator) {
	const scene = new Scene();
	const boxGeometry = new BoxGeometry(20, 20, 20);
	const topPanelGeometry = new PlaneGeometry(5.4, 4.6);
	const sidePanelGeometry = new PlaneGeometry(1.15, 12.8);
	const backPanelGeometry = new PlaneGeometry(4.2, 8.4);
	const lowerStripGeometry = new PlaneGeometry(5.2, 0.9);
	const ribbonOneGeometry = new TubeGeometry(
		new CatmullRomCurve3([
			new Vector3(-5.6, 3.8, -3.1),
			new Vector3(-2.8, 2.6, -0.8),
			new Vector3(0.2, 1.2, 1.7),
			new Vector3(3.6, 2.4, 3.3),
			new Vector3(5.8, 3.2, 4.8),
		]),
		160,
		0.28,
		18,
		false,
	);
	const ribbonTwoGeometry = new TubeGeometry(
		new CatmullRomCurve3([
			new Vector3(5.2, -3.9, -2.8),
			new Vector3(2.8, -2.2, -0.2),
			new Vector3(0.3, -0.8, 1.6),
			new Vector3(-2.6, -1.6, 3.8),
			new Vector3(-5.4, -3.1, 5.2),
		]),
		160,
		0.22,
		18,
		false,
	);
	const ribbonThreeGeometry = new TubeGeometry(
		new CatmullRomCurve3([
			new Vector3(-4.8, -4.2, 2.8),
			new Vector3(-1.8, -2.8, 1.1),
			new Vector3(1.4, -2.2, -0.9),
			new Vector3(3.8, -3.1, -3.2),
			new Vector3(5.6, -4.3, -5),
		]),
		160,
		0.18,
		18,
		false,
	);
	const materials = [
		new MeshBasicMaterial({ color: "#020202", side: BackSide }),
		new MeshBasicMaterial({ color: "#ffffff" }),
		new MeshBasicMaterial({ color: "#eef1f6" }),
		new MeshBasicMaterial({ color: "#24272d" }),
		new MeshBasicMaterial({ color: "#b9c0cb" }),
	];
	const [
		roomMaterial,
		brightMaterial,
		softMaterial,
		mutedMaterial,
		ribbonMaterial,
	] = materials;
	const geometries = [
		boxGeometry,
		topPanelGeometry,
		sidePanelGeometry,
		backPanelGeometry,
		lowerStripGeometry,
		ribbonOneGeometry,
		ribbonTwoGeometry,
		ribbonThreeGeometry,
	];

	const room = new Mesh(boxGeometry, roomMaterial);
	scene.add(room);

	const topPanel = new Mesh(topPanelGeometry, brightMaterial);
	topPanel.position.set(0, 5.15, -0.35);
	topPanel.rotation.x = Math.PI / 2;
	scene.add(topPanel);

	const backPanel = new Mesh(backPanelGeometry, softMaterial);
	backPanel.position.set(0, 0.15, -6.05);
	scene.add(backPanel);

	const frontPanel = new Mesh(backPanelGeometry, mutedMaterial);
	frontPanel.position.set(0, -0.2, 5.95);
	frontPanel.rotation.y = Math.PI;
	scene.add(frontPanel);

	const leftStrip = new Mesh(sidePanelGeometry, brightMaterial);
	leftStrip.position.set(-5.9, 0.1, 0);
	leftStrip.rotation.y = Math.PI / 2;
	scene.add(leftStrip);

	const rightStrip = new Mesh(sidePanelGeometry, brightMaterial);
	rightStrip.position.set(5.9, 0.1, 0);
	rightStrip.rotation.y = -Math.PI / 2;
	scene.add(rightStrip);

	const lowerRearStrip = new Mesh(lowerStripGeometry, softMaterial);
	lowerRearStrip.position.set(0, -2.8, -4.9);
	lowerRearStrip.rotation.x = -Math.PI / 8;
	scene.add(lowerRearStrip);

	const lowerFrontStrip = new Mesh(lowerStripGeometry, brightMaterial);
	lowerFrontStrip.position.set(0, -3.45, 4.8);
	lowerFrontStrip.rotation.x = Math.PI / 8;
	lowerFrontStrip.rotation.y = Math.PI;
	scene.add(lowerFrontStrip);

	const ribbonOne = new Mesh(ribbonOneGeometry, brightMaterial);
	scene.add(ribbonOne);

	const ribbonTwo = new Mesh(ribbonTwoGeometry, ribbonMaterial);
	scene.add(ribbonTwo);

	const ribbonThree = new Mesh(ribbonThreeGeometry, softMaterial);
	scene.add(ribbonThree);

	const texture = pmremGenerator.fromScene(scene, 0).texture;

	geometries.forEach((geometry) => {
		geometry.dispose();
	});
	materials.forEach((material) => {
		material.dispose();
	});

	return texture;
}

function SceneEnvironment({ roseMaterialPreset }: SceneEnvironmentProps) {
	const { gl, scene } = useThree();
	const reflectiveEnvironments = useMemo(() => {
		const pmremGenerator = new PMREMGenerator(gl);
		const frozenTexture = pmremGenerator.fromScene(
			new RoomEnvironment(),
			0.05,
		).texture;
		const metalTexture = pmremGenerator.fromScene(
			new RoomEnvironment(),
			0,
		).texture;
		const bareMetalTexture =
			createBareMetalEnvironmentTexture(pmremGenerator);

		pmremGenerator.dispose();

		return {
			frozen: frozenTexture,
			metal: metalTexture,
			bareMetal: bareMetalTexture,
		};
	}, [gl]);

	useEffect(() => {
		// Shader presets take null: they render with an unlit ShaderMaterial that
		// never samples the environment.
		scene.environment = isRoseShaderPreset(roseMaterialPreset)
			? null
			: roseMaterialPreset === "frozen"
				? reflectiveEnvironments.frozen
				: roseMaterialPreset === "metal"
					? reflectiveEnvironments.metal
					: isBareMetalPreset(roseMaterialPreset)
						? reflectiveEnvironments.bareMetal
						: null;

		return () => {
			if (
				scene.environment === reflectiveEnvironments.frozen ||
				scene.environment === reflectiveEnvironments.metal ||
				scene.environment === reflectiveEnvironments.bareMetal
			) {
				scene.environment = null;
			}
		};
	}, [reflectiveEnvironments, roseMaterialPreset, scene]);

	useEffect(() => {
		return () => {
			reflectiveEnvironments.frozen.dispose();
			reflectiveEnvironments.metal.dispose();
			reflectiveEnvironments.bareMetal.dispose();
		};
	}, [reflectiveEnvironments]);

	return null;
}

type SuspendedRoseProps = {
	roseAnglePreset: RoseAnglePreset;
	roseMaterialPreset: RoseMaterialPreset;
	audioEnergy: number;
	captureAudioEnergyRef: RefObject<number>;
	videoCaptureActive: boolean;
};

function SuspendedRose({
	roseAnglePreset,
	roseMaterialPreset,
	audioEnergy,
	captureAudioEnergyRef,
	videoCaptureActive,
}: SuspendedRoseProps) {
	const floatRef = useRef<Group>(null);
	const pivotRef = useRef<Group>(null);
	const floatPhaseRef = useRef<number | null>(null);
	const smoothedEnergyRef = useRef(0);
	const [tiltX, tiltY, tiltZ] = ROSE_ANGLE_PRESET_ROTATIONS[roseAnglePreset];

	useLayoutEffect(() => {
		const baseY = roseAnglePreset === "top-down" ? -0.2 : -0.58;

		floatPhaseRef.current = null;
		smoothedEnergyRef.current = 0;

		if (floatRef.current) {
			floatRef.current.position.y = baseY;
			floatRef.current.rotation.x = 0;
			floatRef.current.rotation.z = 0;
		}

		if (pivotRef.current) {
			pivotRef.current.rotation.y = 0;
		}
	}, [roseAnglePreset, videoCaptureActive]);

	useFrame(({ clock }, delta) => {
		const elapsed = Number.isFinite(clock.elapsedTime)
			? Math.max(0, clock.elapsedTime)
			: 0;
		const safeDelta = sanitizeAnimationDelta(delta);
		const baseY = roseAnglePreset === "top-down" ? -0.2 : -0.58;
		const currentEnergy = videoCaptureActive
			? captureAudioEnergyRef.current
			: audioEnergy;
		const targetEnergy = sanitizeAudioEnergy(currentEnergy);
		const smoothing = 1 - Math.exp(-safeDelta * 7);

		if (!Number.isFinite(smoothedEnergyRef.current)) {
			smoothedEnergyRef.current = 0;
		}

		smoothedEnergyRef.current +=
			(targetEnergy - smoothedEnergyRef.current) * smoothing;

		const pulse = sanitizeAudioEnergy(smoothedEnergyRef.current);
		const orbitSpeed = 0.18 + pulse * 0.32;
		const floatAmount = 0.04 + pulse * 0.018;
		const wobble = 0.012 + pulse * 0.008;

		if (
			floatPhaseRef.current === null ||
			!Number.isFinite(floatPhaseRef.current)
		) {
			floatPhaseRef.current = elapsed * 0.72;
		} else {
			floatPhaseRef.current += safeDelta * (0.72 + pulse * 0.18);
		}

		if (floatRef.current) {
			floatRef.current.position.y =
				baseY + Math.sin(floatPhaseRef.current) * floatAmount;
			floatRef.current.rotation.x = Math.sin(elapsed * 0.26) * wobble;
			floatRef.current.rotation.z = Math.cos(elapsed * 0.24) * wobble;
		}

		if (pivotRef.current) {
			if (!Number.isFinite(pivotRef.current.rotation.y)) {
				pivotRef.current.rotation.y = 0;
			}

			pivotRef.current.rotation.y += safeDelta * orbitSpeed;
		}
	});

	return (
		<group ref={floatRef} scale={0.98}>
			<group rotation={[tiltX, tiltY, tiltZ]}>
				<group ref={pivotRef}>
					<Rose materialPreset={roseMaterialPreset} />
				</group>
			</group>
		</group>
	);
}

export type RoseSceneCaptureController = {
	canvas: HTMLCanvasElement;
	renderFrame: (elapsedSeconds: number, audioEnergy: number) => void;
	resetTimeline: () => void;
};

type SceneCaptureControllerProps = {
	active: boolean;
	audioEnergyRef: RefObject<number>;
	elapsedSecondsRef: RefObject<number>;
	onChange?: (controller: RoseSceneCaptureController | null) => void;
};

function SceneCaptureController({
	active,
	audioEnergyRef,
	elapsedSecondsRef,
	onChange,
}: SceneCaptureControllerProps) {
	const { advance, gl, setFrameloop } = useThree();

	useEffect(() => {
		if (!active) {
			onChange?.(null);
			return;
		}

		setFrameloop("never");

		const controller: RoseSceneCaptureController = {
			canvas: gl.domElement,
			renderFrame: (elapsedSeconds, audioEnergy) => {
				audioEnergyRef.current = audioEnergy;
				elapsedSecondsRef.current = elapsedSeconds;
				// Every requested export frame must be self-contained. In particular,
				// do not let a composer or transparent texture preserve pixels from
				// the preceding live/capture frame.
				gl.setRenderTarget(null);
				gl.clear(true, true, true);
				// R3F's `frameloop="never"` path subtracts this value directly
				// from clock.elapsedTime, so it must remain in seconds.
				advance(elapsedSeconds, true);
			},
			resetTimeline: () => {
				audioEnergyRef.current = 0;
				elapsedSecondsRef.current = 0;
				// Calling this again intentionally resets the manual clock to zero
				// after the scene/backdrop warm-up frames.
				setFrameloop("never");
			},
		};

		onChange?.(controller);

		return () => {
			audioEnergyRef.current = 0;
			elapsedSecondsRef.current = 0;
			onChange?.(null);
			setFrameloop("always");
		};
	}, [
		active,
		advance,
		audioEnergyRef,
		elapsedSecondsRef,
		gl,
		onChange,
		setFrameloop,
	]);

	return null;
}

type RoseSceneProps = {
	backgroundMode: BackgroundMode;
	overlayEffect: OverlayEffect;
	roseAnglePreset: RoseAnglePreset;
	roseMaterialPreset: RoseMaterialPreset;
	audioEnergy?: number;
	bottomVisualizationEnabled: boolean;
	bottomVisualizationMode: BottomVisualizationMode;
	videoCaptureActive?: boolean;
	videoCaptureAudioBuffer?: AudioBuffer | null;
	videoCaptureViewport?: VideoCaptureViewport | null;
	onSceneCanvasChange?: (canvas: HTMLCanvasElement | null) => void;
	onSceneCaptureControllerChange?: (
		controller: RoseSceneCaptureController | null,
	) => void;
	onBackdropReadyChange?: (ready: boolean) => void;
	getPlaybackPosition: () => number;
	getVisualizationAudioFrame: () => VisualizationAudioFrame;
	isPlaying: boolean;
	sequence: GenomicMusicSequence | null;
	stepwiseBackgroundEnabled: boolean;
	stepwiseLayoutPreset: VisualLayoutPreset;
	visualizationLayoutPreset: VisualLayoutPreset;
};

export function RoseScene({
	backgroundMode,
	overlayEffect,
	roseAnglePreset,
	roseMaterialPreset,
	audioEnergy = 0,
	bottomVisualizationEnabled,
	bottomVisualizationMode,
	videoCaptureActive = false,
	videoCaptureAudioBuffer = null,
	videoCaptureViewport = null,
	onSceneCanvasChange,
	onSceneCaptureControllerChange,
	onBackdropReadyChange,
	getPlaybackPosition,
	getVisualizationAudioFrame,
	isPlaying,
	sequence,
	stepwiseBackgroundEnabled,
	stepwiseLayoutPreset,
	visualizationLayoutPreset,
}: RoseSceneProps) {
	const captureAudioEnergyRef = useRef(0);
	const captureElapsedSecondsRef = useRef(0);
	const stepwiseActive = stepwiseBackgroundEnabled && Boolean(sequence);
	const visualizationRenderKey = [
		videoCaptureActive ? "capture" : "live",
		bottomVisualizationMode,
		visualizationLayoutPreset,
	].join(":");
	const getActiveVisualizationPosition = useCallback(
		() =>
			videoCaptureActive
				? captureElapsedSecondsRef.current
				: getPlaybackPosition(),
		[getPlaybackPosition, videoCaptureActive],
	);
	const getActiveVisualizationAudioFrame = useCallback(
		() =>
			videoCaptureActive && videoCaptureAudioBuffer
				? audioBufferFrameAt(
						videoCaptureAudioBuffer,
						captureElapsedSecondsRef.current,
					)
				: getVisualizationAudioFrame(),
		[
			getVisualizationAudioFrame,
			videoCaptureActive,
			videoCaptureAudioBuffer,
		],
	);
	const handleCaptureControllerChange = useCallback(
		(controller: RoseSceneCaptureController | null) => {
			onSceneCaptureControllerChange?.(controller);
		},
		[onSceneCaptureControllerChange],
	);
	const fogColor = backgroundMode === "black" ? "#000000" : "#020102";
	const usesBiolumeBloom =
		roseMaterialPreset === "bioluminescent" && overlayEffect === "none";
	const activeOverlayEffect = usesBiolumeBloom
		? "biolume-bloom"
		: overlayEffect;
	const hasActiveOverlay = isActiveOverlayEffect(activeOverlayEffect);
	// The black mode is already opaque through Skybox, so only the Unicorn
	// backgrounds need capturing into the scene for the effects to reach them.
	const needsBackdrop =
		(hasActiveOverlay || videoCaptureActive) &&
		Boolean(BACKGROUND_MODE_PROJECT_IDS[backgroundMode]);
	const isGlass = isGlassPreset(roseMaterialPreset);
	const dimStudioLit = isDimStudioLitPreset(roseMaterialPreset);
	const hemisphereIntensity = dimStudioLit
		? 0.18
		: roseMaterialPreset === "bioluminescent"
			? 0.28
			: isGlass
				? 0.45
				: 0.82;
	const ambientIntensity = dimStudioLit
		? 0.035
		: roseMaterialPreset === "bioluminescent"
			? 0.06
			: isGlass
				? 0.12
				: 0.22;
	const directionalIntensity = dimStudioLit
		? 0.35
		: roseMaterialPreset === "bioluminescent"
			? 0.7
			: isGlass
				? 1.4
				: 2.1;
	const frontPointIntensity = dimStudioLit
		? 1.25
		: roseMaterialPreset === "bioluminescent"
			? 4
			: isGlass
				? 8
				: 22;
	const backPointIntensity = dimStudioLit
		? 0.4
		: roseMaterialPreset === "bioluminescent"
			? 1.8
			: isGlass
				? 2.5
				: 9;
	const lowerPointIntensity = dimStudioLit
		? 0.15
		: roseMaterialPreset === "bioluminescent"
			? 1
			: isGlass
				? 1
				: 5;

	return (
		<div
			className="scene"
			aria-hidden="true"
			style={
				videoCaptureActive && videoCaptureViewport
					? {
							inset: "auto",
							left: "50%",
							top: "50%",
							width: videoCaptureViewport.width,
							height: videoCaptureViewport.height,
							transform: "translate(-50%, -50%)",
						}
					: undefined
			}
		>
			{/* The capture wrapper adopts the requested output aspect before manual
			    rendering starts, keeping edge-anchored labels inside the video. */}
			<Canvas
				camera={{ position: [0.2, 0.55, 8.9], fov: 34 }}
				dpr={[1, 2]}
				frameloop={videoCaptureActive ? "never" : "always"}
				gl={{ alpha: true }}
				onCreated={({ camera, gl }) => {
					gl.setClearAlpha(0);
					camera.lookAt(0, 0.58, 0);
					onSceneCanvasChange?.(gl.domElement);
				}}
				style={{ background: "transparent" }}
			>
				<SceneCaptureController
					active={videoCaptureActive}
					audioEnergyRef={captureAudioEnergyRef}
					elapsedSecondsRef={captureElapsedSecondsRef}
					onChange={handleCaptureControllerChange}
				/>
				<fog attach="fog" args={[fogColor, 12, 20]} />
				<SceneEnvironment roseMaterialPreset={roseMaterialPreset} />
				{/* Glass uses canvas alpha to reveal the DOM backdrop, so skip the
				    opaque black skybox that would block that see-through. */}
				{isGlass ? null : (
					<Skybox backgroundMode={backgroundMode} />
				)}
				{needsBackdrop ? (
					<SceneBackdrop onReadyChange={onBackdropReadyChange} />
				) : null}
				{stepwiseActive && sequence ? (
					<StepwiseBackdrop
						key={`${videoCaptureActive ? "capture" : "live"}:${stepwiseLayoutPreset}`}
						captureActive={videoCaptureActive}
						captureTimeRef={captureElapsedSecondsRef}
						getPlaybackPosition={getPlaybackPosition}
						layoutPreset={stepwiseLayoutPreset}
						sequence={sequence}
					/>
				) : null}
				{bottomVisualizationEnabled &&
				sequence &&
				(!videoCaptureActive || videoCaptureAudioBuffer) ? (
					<SceneVisualization
						key={visualizationRenderKey}
						getAudioFrame={getActiveVisualizationAudioFrame}
						getPlaybackPosition={getActiveVisualizationPosition}
						isPlaying={videoCaptureActive || isPlaying}
						layoutPreset={visualizationLayoutPreset}
						mode={bottomVisualizationMode}
						sequence={sequence}
					/>
				) : null}
				{hasActiveOverlay ? (
					<OverlayEffects
						overlayEffect={
							activeOverlayEffect as Exclude<
								OverlayEffect,
								"none"
							>
						}
					/>
				) : null}
				<hemisphereLight
					args={["#f8e4eb", "#060607", hemisphereIntensity]}
				/>
				<ambientLight intensity={ambientIntensity} color="#34131d" />
				<directionalLight
					position={[3.8, 5.2, 5.1]}
					intensity={directionalIntensity}
					color="#fff5f7"
				/>
				<pointLight
					position={[2.8, 2.3, 5.8]}
					intensity={frontPointIntensity}
					color="#ffd9e6"
				/>
				<pointLight
					position={[-4.6, 2.9, -3.8]}
					intensity={backPointIntensity}
					color="#7a203f"
				/>
				<pointLight
					position={[0, -2.8, 2.6]}
					intensity={lowerPointIntensity}
					color="#24402e"
				/>
				<Suspense fallback={null}>
					<SuspendedRose
						roseAnglePreset={roseAnglePreset}
						roseMaterialPreset={roseMaterialPreset}
						audioEnergy={audioEnergy}
						captureAudioEnergyRef={captureAudioEnergyRef}
						videoCaptureActive={videoCaptureActive}
					/>
				</Suspense>
			</Canvas>
		</div>
	);
}
