import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
	Box3,
	Color,
	DoubleSide,
	Material,
	Mesh,
	Object3D,
	Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import roseModelUrl from "../assets/rose-model/rose.glb?url";
import {
	createLiquidMetalMaterial,
	setLiquidMetalTime,
} from "./rose-liquid-metal";
import {
	isRoseShaderPreset,
	ROSE_MATERIAL_CONFIGS,
	type RoseMaterialConfig,
	type RoseMaterialPreset,
} from "./rose-material";

function blendColor(
	materialColor: Color,
	blend: NonNullable<RoseMaterialConfig["petalColor"]>,
) {
	const [red, green, blue] = blend.target;
	const targetColor = new Color(red, green, blue);

	materialColor.lerp(targetColor, blend.mix);
}

function applyScalarControl(
	value: number,
	control: RoseMaterialConfig["metalness"],
) {
	if (control.mode === "cap") {
		return Math.min(value, control.value);
	}

	return control.value;
}

function applyRoughnessControl(
	value: number,
	control: RoseMaterialConfig["roughness"],
) {
	if (control.mode === "clamp") {
		return Math.max(control.min, Math.min(value, control.max));
	}

	return control.value;
}

function tweakMaterial(material: Material, config: RoseMaterialConfig) {
	if (!("side" in material)) {
		return;
	}

	material.side = DoubleSide;

	if ("map" in material && config.stripBaseColorMap) {
		material.map = null;
	}

	if ("emissiveMap" in material && config.stripEmissiveMap) {
		material.emissiveMap = null;
	}

	if ("vertexColors" in material && config.disableVertexColors) {
		material.vertexColors = false;
	}

	if ("metalness" in material && typeof material.metalness === "number") {
		material.metalness = applyScalarControl(
			material.metalness,
			config.metalness,
		);
	}

	if ("roughness" in material && typeof material.roughness === "number") {
		material.roughness = applyRoughnessControl(
			material.roughness,
			config.roughness,
		);
	}

	if (
		"clearcoat" in material &&
		typeof material.clearcoat === "number" &&
		config.clearcoat !== undefined
	) {
		material.clearcoat = config.clearcoat;
	}

	if (
		"clearcoatRoughness" in material &&
		typeof material.clearcoatRoughness === "number" &&
		config.clearcoatRoughness !== undefined
	) {
		material.clearcoatRoughness = config.clearcoatRoughness;
	}

	if (
		"envMapIntensity" in material &&
		typeof material.envMapIntensity === "number" &&
		config.envMapIntensity !== undefined
	) {
		material.envMapIntensity = config.envMapIntensity;
	}

	if (
		"color" in material &&
		material.color instanceof Color &&
		"emissive" in material &&
		material.emissive instanceof Color &&
		"emissiveIntensity" in material &&
		typeof material.emissiveIntensity === "number"
	) {
		if (config.forceColor) {
			material.color.setRGB(...config.forceColor);
			material.emissive.setRGB(0, 0, 0);
			material.emissiveIntensity = 0;
			material.needsUpdate = true;
			return;
		}

		if (
			material.color.r > material.color.g &&
			material.color.r > material.color.b
		) {
			if (config.petalColor) {
				blendColor(material.color, config.petalColor);
			}

			material.emissive
				.copy(material.color)
				.multiplyScalar(config.petalEmissiveScalar);
			material.emissiveIntensity = config.petalEmissiveIntensity;
		} else if (material.color.g >= material.color.r) {
			if (config.stemColor) {
				blendColor(material.color, config.stemColor);
			}

			material.emissive.setRGB(...config.stemEmissive);
			material.emissiveIntensity = config.stemEmissiveIntensity;
		}
	}

	material.needsUpdate = true;
}

function isMesh(node: Object3D): node is Mesh {
	return (node as Mesh).isMesh === true;
}

function getStemAnchor(root: Object3D) {
	const sample = new Vector3();
	let minimumY = Number.POSITIVE_INFINITY;
	let maximumY = Number.NEGATIVE_INFINITY;

	root.updateMatrixWorld(true);

	root.traverse((node) => {
		if (!isMesh(node)) {
			return;
		}

		const positionAttribute = node.geometry.getAttribute("position");

		for (let index = 0; index < positionAttribute.count; index += 1) {
			sample
				.fromBufferAttribute(positionAttribute, index)
				.applyMatrix4(node.matrixWorld);
			minimumY = Math.min(minimumY, sample.y);
			maximumY = Math.max(maximumY, sample.y);
		}
	});

	const bounds = new Box3().setFromObject(root);
	const center = bounds.getCenter(new Vector3());
	const height = maximumY - minimumY || bounds.getSize(new Vector3()).y || 1;
	const cutoff = minimumY + height * 0.22;
	let stemX = 0;
	let stemZ = 0;
	let count = 0;

	root.traverse((node) => {
		if (!isMesh(node)) {
			return;
		}

		const positionAttribute = node.geometry.getAttribute("position");

		for (let index = 0; index < positionAttribute.count; index += 1) {
			sample
				.fromBufferAttribute(positionAttribute, index)
				.applyMatrix4(node.matrixWorld);

			if (sample.y > cutoff) {
				continue;
			}

			stemX += sample.x;
			stemZ += sample.z;
			count += 1;
		}
	});

	return {
		x: count > 0 ? stemX / count : center.x,
		z: count > 0 ? stemZ / count : center.z,
		centerY: center.y,
		minimumY,
		height,
	};
}

type RoseProps = {
	materialPreset?: RoseMaterialPreset;
};

type PreparedRose = {
	root: Object3D;
	clonedMaterials: Material[];
};

function cloneMaterial(material: Material, config: RoseMaterialConfig) {
	const nextMaterial = material.clone();

	tweakMaterial(nextMaterial, config);

	return nextMaterial;
}

export function Rose({ materialPreset = "default" }: RoseProps) {
	const gltf = useLoader(GLTFLoader, roseModelUrl);
	const materialConfig = isRoseShaderPreset(materialPreset)
		? null
		: ROSE_MATERIAL_CONFIGS[materialPreset];

	// Shared across every rose mesh so one u_time drives the whole bloom.
	const liquidMetalMaterial = useMemo(
		() => (materialConfig === null ? createLiquidMetalMaterial() : null),
		[materialConfig],
	);

	const prepared = useMemo<PreparedRose>(() => {
		const root = gltf.scene.clone(true);
		const clonedMaterials: Material[] = [];

		const resolveMaterial = (material: Material) => {
			if (materialConfig === null) {
				return liquidMetalMaterial as Material;
			}

			const nextMaterial = cloneMaterial(material, materialConfig);

			clonedMaterials.push(nextMaterial);

			return nextMaterial;
		};

		root.traverse((node) => {
			if (!isMesh(node)) {
				return;
			}

			node.castShadow = false;
			node.receiveShadow = false;

			if (Array.isArray(node.material)) {
				node.material = node.material.map(resolveMaterial);
				return;
			}

			node.material = resolveMaterial(node.material);
		});

		const anchor = getStemAnchor(root);
		const scale = 3.7 / anchor.height;
		const blossomBias = anchor.height * 0.18;

		root.position.set(
			-anchor.x,
			-(anchor.centerY + blossomBias),
			-anchor.z,
		);
		root.scale.setScalar(scale);

		return { root, clonedMaterials };
	}, [gltf, liquidMetalMaterial, materialConfig]);

	useEffect(() => {
		const { clonedMaterials } = prepared;

		return () => {
			clonedMaterials.forEach((material) => {
				material.dispose();
			});
		};
	}, [prepared]);

	useEffect(() => {
		if (!liquidMetalMaterial) {
			return;
		}

		return () => {
			liquidMetalMaterial.dispose();
		};
	}, [liquidMetalMaterial]);

	useFrame(({ clock }) => {
		if (!liquidMetalMaterial) {
			return;
		}

		setLiquidMetalTime(liquidMetalMaterial, clock.elapsedTime);
	});

	return <primitive object={prepared.root} />;
}
