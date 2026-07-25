import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
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
import { Rose } from "./Rose";
import type { BackgroundMode } from "./background-mode";
import {
	ROSE_ANGLE_PRESET_ROTATIONS,
	type RoseAnglePreset,
} from "./rose-angle";
import type { RoseMaterialPreset } from "./rose-material";
import { Skybox } from "./Skybox";

type SceneEnvironmentProps = {
	roseMaterialPreset: RoseMaterialPreset;
};

function createMirrorEnvironmentTexture(pmremGenerator: PMREMGenerator) {
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
	] =
		materials;
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
		const chromeTexture = pmremGenerator.fromScene(
			new RoomEnvironment(),
			0,
		).texture;
		const mirrorChromeTexture = createMirrorEnvironmentTexture(pmremGenerator);

		pmremGenerator.dispose();

		return {
			frozen: frozenTexture,
			metal: chromeTexture,
			chrome: mirrorChromeTexture,
		};
	}, [gl]);

	useEffect(() => {
		scene.environment =
			roseMaterialPreset === "frozen"
				? reflectiveEnvironments.frozen
				: roseMaterialPreset === "metal"
					? reflectiveEnvironments.metal
					: roseMaterialPreset === "chrome"
					? reflectiveEnvironments.chrome
					: null;

		return () => {
			if (
				scene.environment === reflectiveEnvironments.frozen ||
				scene.environment === reflectiveEnvironments.metal ||
				scene.environment === reflectiveEnvironments.chrome
			) {
				scene.environment = null;
			}
		};
	}, [reflectiveEnvironments, roseMaterialPreset, scene]);

	useEffect(() => {
		return () => {
			reflectiveEnvironments.frozen.dispose();
			reflectiveEnvironments.metal.dispose();
			reflectiveEnvironments.chrome.dispose();
		};
	}, [reflectiveEnvironments]);

	return null;
}

type SuspendedRoseProps = {
	roseAnglePreset: RoseAnglePreset;
	roseMaterialPreset: RoseMaterialPreset;
};

function SuspendedRose({
	roseAnglePreset,
	roseMaterialPreset,
}: SuspendedRoseProps) {
	const floatRef = useRef<Group>(null);
	const pivotRef = useRef<Group>(null);
	const [tiltX, tiltY, tiltZ] = ROSE_ANGLE_PRESET_ROTATIONS[roseAnglePreset];

	useFrame(({ clock }, delta) => {
		const elapsed = clock.elapsedTime;

		if (floatRef.current) {
			floatRef.current.position.y =
				-0.58 + Math.sin(elapsed * 0.72) * 0.04;
			floatRef.current.rotation.x = Math.sin(elapsed * 0.26) * 0.012;
			floatRef.current.rotation.z = Math.cos(elapsed * 0.24) * 0.01;
		}

		if (pivotRef.current) {
			pivotRef.current.rotation.y += delta * 0.18;
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

type RoseSceneProps = {
	backgroundMode: BackgroundMode;
	roseAnglePreset: RoseAnglePreset;
	roseMaterialPreset: RoseMaterialPreset;
};

export function RoseScene({
	backgroundMode,
	roseAnglePreset,
	roseMaterialPreset,
}: RoseSceneProps) {
	const fogColor = backgroundMode === "black" ? "#000000" : "#020102";
	const isMirrorChrome = roseMaterialPreset === "chrome";
	const hemisphereIntensity = isMirrorChrome ? 0.18 : 0.82;
	const ambientIntensity = isMirrorChrome ? 0.035 : 0.22;
	const directionalIntensity = isMirrorChrome ? 0.35 : 2.1;
	const frontPointIntensity = isMirrorChrome ? 1.25 : 22;
	const backPointIntensity = isMirrorChrome ? 0.4 : 9;
	const lowerPointIntensity = isMirrorChrome ? 0.15 : 5;

	return (
		<div className="scene" aria-hidden="true">
			<Canvas
				camera={{ position: [0.2, 0.55, 8.9], fov: 34 }}
				dpr={[1, 2]}
				gl={{ alpha: true }}
				onCreated={({ camera, gl }) => {
					gl.setClearAlpha(0);
					camera.lookAt(0, 0.58, 0);
				}}
				style={{ background: "transparent" }}
			>
				<fog attach="fog" args={[fogColor, 12, 20]} />
				<SceneEnvironment roseMaterialPreset={roseMaterialPreset} />
				<Skybox backgroundMode={backgroundMode} />
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
					/>
				</Suspense>
			</Canvas>
		</div>
	);
}
