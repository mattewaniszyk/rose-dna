import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

// The Unicorn Studio background lives in its own WebGL canvas below the scene,
// so the composer cannot see it. Copying it into a texture and hanging that on
// scene.background pulls it into the render pass the effects operate on.

// The source canvas is created with preserveDrawingBuffer: false, so its pixels
// are only readable from inside the same animation frame that drew them. That
// makes the copy inherently timing-sensitive: whenever our frame drifts out of
// step with the background's, a read comes back blank. So capture is never
// abandoned outright — it keeps probing, and a live capture that starts coming
// back blank drops back to probing and releases scene.background, which lets the
// untouched DOM background show through again instead of going black.
const CAPTURE_INTERVAL = 1 / 30;
const RECHECK_INTERVAL = 2;
// Capturing at the source's own backing size keeps fine detail — a starfield
// downscaled to a fixed 960x540 loses most of its stars, which then vanish
// entirely once an effect quantizes the frame.
const MAX_CAPTURE_EDGE = 2560;
const PROBE_WIDTH = 96;
const PROBE_HEIGHT = 54;
const PROBE_INTERVAL = 0.25;
const PROBE_TIMEOUT_SECONDS = 6;

type CaptureStatus = "waiting" | "live";

function findUnicornCanvas() {
	return document.querySelector<HTMLCanvasElement>(
		".unicorn-background canvas",
	);
}

// A WebGL canvas built without preserveDrawingBuffer can read back empty. There
// is no way to feature-detect that on a canvas we do not own, so the source is
// probed until it yields something. A failed readback comes back as all zero
// bytes, so any non-zero byte anywhere means the copy is working — scanning the
// whole probe buffer matters, because a dark starfield puts very little in it.
function hasVisibleContent(
	source: HTMLCanvasElement,
	probe: CanvasRenderingContext2D,
) {
	probe.clearRect(0, 0, PROBE_WIDTH, PROBE_HEIGHT);
	probe.drawImage(source, 0, 0, PROBE_WIDTH, PROBE_HEIGHT);

	const { data } = probe.getImageData(0, 0, PROBE_WIDTH, PROBE_HEIGHT);

	for (let index = 0; index < data.length; index += 1) {
		if (data[index] > 2) {
			return true;
		}
	}

	return false;
}

function fitCaptureSize(source: HTMLCanvasElement) {
	const scale = Math.min(
		1,
		MAX_CAPTURE_EDGE / Math.max(source.width, source.height),
	);

	return {
		width: Math.max(1, Math.round(source.width * scale)),
		height: Math.max(1, Math.round(source.height * scale)),
	};
}

export function SceneBackdrop() {
	const scene = useThree((state) => state.scene);

	// Deliberately not willReadFrequently: that flag forces a CPU-backed canvas,
	// which would turn the per-frame copy into a readback. Reads happen on the
	// separate probe canvas instead.
	const capture = useMemo(() => {
		const canvas = document.createElement("canvas");

		return { canvas, context: canvas.getContext("2d") };
	}, []);

	const probe = useMemo(() => {
		const canvas = document.createElement("canvas");

		canvas.width = PROBE_WIDTH;
		canvas.height = PROBE_HEIGHT;

		return canvas.getContext("2d", { willReadFrequently: true });
	}, []);

	const progress = useRef({
		status: "waiting" as CaptureStatus,
		sinceCapture: 0,
		sinceProbe: 0,
		sinceRecheck: 0,
		waited: 0,
		warned: false,
		texture: null as CanvasTexture | null,
	});

	useEffect(() => {
		const state = progress.current;

		return () => {
			if (!state.texture) {
				return;
			}

			if (scene.background === state.texture) {
				scene.background = null;
			}

			state.texture.dispose();
			state.texture = null;
		};
	}, [scene]);

	useFrame((_, delta) => {
		const state = progress.current;

		if (!capture.context) {
			return;
		}

		const source = findUnicornCanvas();

		if (state.status === "live") {
			state.sinceCapture += delta;
			state.sinceRecheck += delta;

			// A capture that has started reading blank must not keep painting an
			// opaque black frame over the live background beneath.
			if (state.sinceRecheck >= RECHECK_INTERVAL) {
				state.sinceRecheck = 0;

				if (!source || !probe || !hasVisibleContent(source, probe)) {
					if (state.texture) {
						if (scene.background === state.texture) {
							scene.background = null;
						}

						state.texture.dispose();
						state.texture = null;
					}

					state.status = "waiting";
					return;
				}
			}

			if (state.sinceCapture < CAPTURE_INTERVAL || !source) {
				return;
			}

			state.sinceCapture = 0;

			const { canvas, context } = capture;
			const { width, height } = fitCaptureSize(source);

			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}

			context.drawImage(source, 0, 0, width, height);

			if (state.texture) {
				state.texture.needsUpdate = true;
			}

			return;
		}

		state.sinceProbe += delta;

		if (state.sinceProbe < PROBE_INTERVAL) {
			return;
		}

		state.sinceProbe = 0;
		state.waited += PROBE_INTERVAL;

		if (
			source &&
			source.width > 0 &&
			source.height > 0 &&
			probe &&
			hasVisibleContent(source, probe)
		) {
			const { canvas, context } = capture;
			const { width, height } = fitCaptureSize(source);

			canvas.width = width;
			canvas.height = height;
			context.drawImage(source, 0, 0, width, height);

			const texture = new CanvasTexture(canvas);

			texture.colorSpace = SRGBColorSpace;

			state.texture = texture;
			state.status = "live";
			state.sinceRecheck = 0;
			scene.background = texture;

			return;
		}

		// Warn once so the situation is diagnosable, but keep probing: the read
		// may well start working on a later frame.
		if (!state.warned && state.waited > PROBE_TIMEOUT_SECONDS) {
			state.warned = true;
			console.warn(
				"[rose-dna] Background capture is reading back blank; overlay effects will apply to the rose only until it recovers.",
			);
		}
	});

	return null;
}
