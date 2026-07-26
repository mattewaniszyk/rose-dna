// SceneBackdrop copies the Unicorn Studio background canvas into a texture so
// overlay effects can reach it. That copy only works if the source canvas keeps
// its drawing buffer: with the default preserveDrawingBuffer: false, the buffer
// is released as soon as the frame is composited, and every read outside that
// exact moment comes back fully transparent.
//
// The SDK creates its own WebGL context and exposes no way to configure it, so
// the attribute is forced on at the one place it is observable — the getContext
// call itself. Installed from main.tsx before React mounts, since the patch has
// to be in place before the SDK requests its context.

const PATCHED = Symbol.for("rose-dna.preserveDrawingBuffer");

type PatchedCanvasPrototype = HTMLCanvasElement & {
	[PATCHED]?: true;
};

export function enablePreservedDrawingBuffers() {
	const prototype = HTMLCanvasElement.prototype as PatchedCanvasPrototype;

	if (prototype[PATCHED]) {
		return;
	}

	prototype[PATCHED] = true;

	const originalGetContext = prototype.getContext;

	// Overload-preserving passthrough: only WebGL requests are touched, and only
	// to add the one attribute. Everything else is forwarded untouched.
	function patchedGetContext(
		this: HTMLCanvasElement,
		contextId: string,
		options?: unknown,
	) {
		// Scoped to the background container so the main render canvas keeps the
		// default: preserving its buffer would cost a copy every frame, and the
		// composer already renders through its own render targets.
		if (
			(contextId === "webgl" || contextId === "webgl2") &&
			this.closest(".unicorn-background") !== null
		) {
			return originalGetContext.call(this, contextId, {
				...(options as WebGLContextAttributes | undefined),
				preserveDrawingBuffer: true,
			});
		}

		return originalGetContext.call(
			this,
			contextId as "2d",
			options as CanvasRenderingContext2DSettings,
		);
	}

	prototype.getContext =
		patchedGetContext as typeof HTMLCanvasElement.prototype.getContext;
}
