import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import type { ActiveOverlayEffect } from "./overlay-effect";
import { createOverlayPasses } from "./overlay-effect-passes";

type OverlayEffectsProps = {
	overlayEffect: ActiveOverlayEffect;
};

export function OverlayEffects({ overlayEffect }: OverlayEffectsProps) {
	const gl = useThree((state) => state.gl);
	const scene = useThree((state) => state.scene);
	const camera = useThree((state) => state.camera);
	const size = useThree((state) => state.size);

	const composition = useMemo(() => {
		const pixelRatio = gl.getPixelRatio();
		const drawingBuffer = gl.getDrawingBufferSize(new Vector2());
		const bundle = createOverlayPasses(overlayEffect, {
			width: drawingBuffer.x / pixelRatio,
			height: drawingBuffer.y / pixelRatio,
			pixelRatio,
		});

		const composer = new EffectComposer(gl);
		const renderPass = new RenderPass(scene, camera);
		// The sRGB encode three normally only performs when rendering straight
		// to the canvas. Without this the whole frame comes out dark.
		const outputPass = new OutputPass();

		composer.setPixelRatio(pixelRatio);
		composer.addPass(renderPass);

		if (bundle?.stage === "scene") {
			bundle.passes.forEach((pass) => {
				composer.addPass(pass);
			});
		}

		composer.addPass(outputPass);

		if (bundle?.stage === "display") {
			bundle.passes.forEach((pass) => {
				composer.addPass(pass);
			});
		}

		return { bundle, composer, outputPass, renderPass };
	}, [camera, gl, overlayEffect, scene]);

	useEffect(() => {
		const pixelRatio = gl.getPixelRatio();

		composition.composer.setPixelRatio(pixelRatio);
		composition.composer.setSize(size.width, size.height);
		composition.bundle?.setSize(size.width, size.height, pixelRatio);
	}, [composition, gl, size]);

	useEffect(() => {
		return () => {
			composition.composer.dispose();
			composition.renderPass.dispose();
			composition.outputPass.dispose();
			composition.bundle?.dispose();
		};
	}, [composition]);

	// Priority above 0 hands the render loop to the composer: R3F stops issuing
	// its own render call for this canvas.
	useFrame((_, delta) => {
		composition.composer.render(delta);
	}, 1);

	return null;
}
