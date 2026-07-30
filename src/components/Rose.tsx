import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
	Box3,
	Color,
	DoubleSide,
	Material,
	Mesh,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	Object3D,
	type ShaderMaterial,
	type Texture,
	type Vector2,
	Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import roseModelUrl from "../assets/rose-model/rose.glb?url";
import {
	createLiquidMetalMaterial,
	type LiquidMetalParams,
	setLiquidMetalTime,
} from "./rose-liquid-metal";
import {
	isRoseShaderPreset,
	needsPhysicalMaterial,
	ROSE_MATERIAL_CONFIGS,
	ROSE_PART_BY_MATERIAL_NAME,
	ROSE_SHADER_CONFIGS,
	type RoseMaterialConfig,
	type RoseMaterialPreset,
	type RosePart,
} from "./rose-material";

type SurfaceMapKey = "normalMap" | "roughnessMap" | "metalnessMap" | "aoMap";

const SURFACE_MAP_KEYS: SurfaceMapKey[] = [
	"normalMap",
	"roughnessMap",
	"metalnessMap",
	"aoMap",
];

type SurfaceMapped = Partial<Record<SurfaceMapKey, Texture | null>> & {
	normalScale?: Vector2;
};

// Lends one material's surface textures to another so both parts shade as the
// same surface. Every rose mesh carries TEXCOORD_0 and TANGENT, so the borrowed
// maps sample against the target's own unwrap.
function copySurfaceMaps(target: Material, source: Material) {
	const from = source as Material & SurfaceMapped;
	const to = target as Material & SurfaceMapped;

	SURFACE_MAP_KEYS.forEach((key) => {
		if (key in from && key in to) {
			to[key] = from[key] ?? null;
		}
	});

	if (from.normalScale && to.normalScale) {
		to.normalScale.copy(from.normalScale);
	}

	target.needsUpdate = true;
}

function findMaterialByName(root: Object3D, name: string) {
	let match: Material | null = null;

	root.traverse((node) => {
		if (match || !isMesh(node)) {
			return;
		}

		const materials = Array.isArray(node.material)
			? node.material
			: [node.material];

		match = materials.find((material) => material.name === name) ?? null;
	});

	return match as Material | null;
}

function classifyRosePart(material: Material): RosePart {
	return ROSE_PART_BY_MATERIAL_NAME[material.name] ?? "other";
}

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

function upgradeToPhysicalMaterial(material: Material) {
	if (material instanceof MeshPhysicalMaterial) {
		return material;
	}

	if (!(material instanceof MeshStandardMaterial)) {
		return material;
	}

	// Build a fresh Physical material. MeshPhysicalMaterial.copy / Standard.copy
	// both break Physical-only state (defines, clearcoat vectors, etc.).
	const physical = new MeshPhysicalMaterial();

	physical.name = material.name;
	physical.color.copy(material.color);
	physical.map = material.map;
	physical.metalness = material.metalness;
	physical.roughness = material.roughness;
	physical.metalnessMap = material.metalnessMap;
	physical.roughnessMap = material.roughnessMap;
	physical.normalMap = material.normalMap;
	if (material.normalScale) {
		physical.normalScale.copy(material.normalScale);
	}
	physical.aoMap = material.aoMap;
	physical.aoMapIntensity = material.aoMapIntensity;
	physical.emissive.copy(material.emissive);
	physical.emissiveMap = material.emissiveMap;
	physical.emissiveIntensity = material.emissiveIntensity;
	physical.envMapIntensity = material.envMapIntensity;
	physical.vertexColors = material.vertexColors;
	physical.opacity = material.opacity;
	physical.transparent = material.transparent;
	physical.side = material.side;

	return physical;
}

function applyCrystalRainbow(material: MeshPhysicalMaterial, strength: number) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uRainbowStrength = { value: strength };

		if (!shader.fragmentShader.includes("uRainbowStrength")) {
			shader.fragmentShader = shader.fragmentShader.replace(
				"void main() {",
				/* glsl */ `
				uniform float uRainbowStrength;

				vec3 roseCrystalHue(float h) {
					vec3 k = vec3(1.0, 2.0 / 3.0, 1.0 / 3.0);
					vec3 p = abs(fract(h + k) * 6.0 - 3.0);
					return clamp(p - 1.0, 0.0, 1.0);
				}

				void main() {
				`,
			);
		}

		// Physical materials end at opaque_fragment (not output_fragment).
		shader.fragmentShader = shader.fragmentShader.replace(
			"#include <opaque_fragment>",
			/* glsl */ `
			{
				float ndotv = abs(dot(geometryNormal, geometryViewDir));
				float fresnel = pow(clamp(1.0 - ndotv, 0.0, 1.0), 1.4);
				float wash = 0.1 + fresnel * 0.72;
				float split = fresnel * 1.95
					+ geometryNormal.x * 0.3
					+ geometryNormal.y * 0.18
					+ geometryNormal.z * 0.08;
				vec3 prism = vec3(
					roseCrystalHue(fract(split + 0.07)).r,
					roseCrystalHue(fract(split)).g,
					roseCrystalHue(fract(split - 0.09)).b
				);
				outgoingLight *= mix(vec3(1.0), prism * 1.15, wash * 0.22);
				outgoingLight += prism * wash * uRainbowStrength;
				diffuseColor.a = mix(
					diffuseColor.a,
					min(1.0, diffuseColor.a + 0.42),
					fresnel * 0.8
				);
			}
			#include <opaque_fragment>
			`,
		);
	};
	material.customProgramCacheKey = () =>
		`crystal-rainbow-v2-${strength.toFixed(2)}`;
	material.needsUpdate = true;
}

function applyBiolumeVeinMask(material: MeshStandardMaterial) {
	material.onBeforeCompile = (shader) => {
		shader.fragmentShader = shader.fragmentShader.replace(
			"#include <emissivemap_fragment>",
			/* glsl */ `
			#include <emissivemap_fragment>
			{
				// geometryNormal isn't defined until lights_fragment_begin — use
				// the already-resolved shading normal + view varying instead.
				vec3 biolumeView = normalize( vViewPosition );
				float ndotv = abs( dot( normal, biolumeView ) );
				float rim = pow( clamp( 1.0 - ndotv, 0.0, 1.0 ), 2.2 );
				float vein = 0.0;
				#ifdef USE_MAP
					vec4 biolumeSample = texture2D( map, vMapUv );
					vein = max(
						biolumeSample.r,
						max( biolumeSample.g, biolumeSample.b )
					);
					vein = pow( clamp( vein * 1.2, 0.0, 1.0 ), 1.15 );
				#endif
				float mask = max( rim * 1.35, vein * 0.35 );
				totalEmissiveRadiance *= mix( 0.12, 1.55, clamp( mask, 0.0, 1.0 ) );
			}
			`,
		);
	};
	material.customProgramCacheKey = () => "biolume-rim-v2";
	material.needsUpdate = true;
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

	if (config.stripSurfaceMaps) {
		if ("normalMap" in material) {
			material.normalMap = null;
		}

		if ("roughnessMap" in material) {
			material.roughnessMap = null;
		}

		if ("metalnessMap" in material) {
			material.metalnessMap = null;
		}

		if ("aoMap" in material) {
			material.aoMap = null;
		}
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

	if (material instanceof MeshPhysicalMaterial) {
		if (config.iridescence !== undefined) {
			material.iridescence = config.iridescence;
		}

		if (config.iridescenceIOR !== undefined) {
			material.iridescenceIOR = config.iridescenceIOR;
		}

		if (config.iridescenceThicknessRange !== undefined) {
			material.iridescenceThicknessRange = config.iridescenceThicknessRange;
		}

		if (config.transmission !== undefined) {
			material.transmission = config.transmission;
		}

		if (config.thickness !== undefined) {
			material.thickness = config.thickness;
		}

		if (config.ior !== undefined) {
			material.ior = config.ior;
		}

		if (config.attenuationColor !== undefined) {
			material.attenuationColor.setRGB(...config.attenuationColor);
		}

		if (config.attenuationDistance !== undefined) {
			material.attenuationDistance = config.attenuationDistance;
		}

		if (config.specularIntensity !== undefined) {
			material.specularIntensity = config.specularIntensity;
		}

		if (config.specularColor !== undefined) {
			material.specularColor.setRGB(...config.specularColor);
		}

		if (config.rainbowFresnel !== undefined && config.rainbowFresnel > 0) {
			applyCrystalRainbow(material, config.rainbowFresnel);
		}
	}

	if (config.opacity !== undefined && "opacity" in material) {
		material.opacity = config.opacity;
	}

	if (config.transparent !== undefined && "transparent" in material) {
		material.transparent = config.transparent;
	}

	if (config.depthWrite !== undefined && "depthWrite" in material) {
		material.depthWrite = config.depthWrite;
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

		const part = classifyRosePart(material);

		if (part === "petal") {
			if (config.petalColor) {
				blendColor(material.color, config.petalColor);
			}

			if (config.petalEmissive) {
				material.emissive.setRGB(...config.petalEmissive);
			} else {
				material.emissive
					.copy(material.color)
					.multiplyScalar(config.petalEmissiveScalar);
			}

			material.emissiveIntensity = config.petalEmissiveIntensity;
		} else if (part === "stem") {
			if (config.stemColor) {
				blendColor(material.color, config.stemColor);
			}

			material.emissive.setRGB(...config.stemEmissive);
			material.emissiveIntensity = config.stemEmissiveIntensity;
		}

		if (
			config.biolumeVeinMask &&
			material instanceof MeshStandardMaterial
		) {
			applyBiolumeVeinMask(material);
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

function cloneMaterial(
	material: Material,
	config: RoseMaterialConfig,
	surfaceMapSource: Material | null,
) {
	let nextMaterial = material.clone();

	if (needsPhysicalMaterial(config)) {
		nextMaterial = upgradeToPhysicalMaterial(nextMaterial);
	}

	tweakMaterial(nextMaterial, config);

	if (surfaceMapSource && surfaceMapSource !== material) {
		copySurfaceMaps(nextMaterial, surfaceMapSource);
	}

	return nextMaterial;
}

export function Rose({ materialPreset = "default" }: RoseProps) {
	const gltf = useLoader(GLTFLoader, roseModelUrl);
	const materialConfig = isRoseShaderPreset(materialPreset)
		? null
		: ROSE_MATERIAL_CONFIGS[materialPreset];
	const shaderConfig = isRoseShaderPreset(materialPreset)
		? ROSE_SHADER_CONFIGS[materialPreset]
		: null;

	// One material per distinct tuning, shared across every mesh that uses it, so
	// a single u_time drives the whole bloom and untinted presets still allocate
	// exactly one material.
	const shaderMaterials = useMemo(() => {
		if (!shaderConfig) {
			return null;
		}

		const base = createLiquidMetalMaterial(shaderConfig.base);
		const forPart = (override?: Partial<LiquidMetalParams>) =>
			override
				? createLiquidMetalMaterial({ ...shaderConfig.base, ...override })
				: base;

		const byPart: Record<RosePart, ShaderMaterial> = {
			petal: forPart(shaderConfig.petal),
			stem: forPart(shaderConfig.stem),
			other: base,
		};

		return { byPart, all: [...new Set(Object.values(byPart))] };
	}, [shaderConfig]);

	const prepared = useMemo<PreparedRose>(() => {
		const root = gltf.scene.clone(true);
		const clonedMaterials: Material[] = [];
		// Resolved against the untouched source materials, so it stays valid
		// while the traverse below swaps each mesh over to its clone.
		const surfaceMapSource = materialConfig?.surfaceMapSource
			? findMaterialByName(root, materialConfig.surfaceMapSource)
			: null;

		const resolveMaterial = (material: Material) => {
			if (materialConfig === null) {
				const { byPart } = shaderMaterials as NonNullable<
					typeof shaderMaterials
				>;

				return byPart[classifyRosePart(material)] as Material;
			}

			const nextMaterial = cloneMaterial(
				material,
				materialConfig,
				surfaceMapSource,
			);

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
	}, [gltf, materialConfig, shaderMaterials]);

	useEffect(() => {
		const { clonedMaterials } = prepared;

		return () => {
			clonedMaterials.forEach((material) => {
				material.dispose();
			});
		};
	}, [prepared]);

	useEffect(() => {
		if (!shaderMaterials) {
			return;
		}

		return () => {
			shaderMaterials.all.forEach((material) => {
				material.dispose();
			});
		};
	}, [shaderMaterials]);

	useFrame(({ clock }) => {
		if (!shaderMaterials) {
			return;
		}

		shaderMaterials.all.forEach((material) => {
			setLiquidMetalTime(material, clock.elapsedTime);
		});
	});

	return <primitive object={prepared.root} />;
}
