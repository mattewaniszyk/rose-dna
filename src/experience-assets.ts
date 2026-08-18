import roseModelUrl from "./assets/rose-model/rose.glb?url";

export const ROSE_MODEL_URL = roseModelUrl;

const ROSE_PREFETCH_ATTRIBUTE = "data-rose-dna-prefetch";

export function prefetchExperienceAssets() {
	if (
		typeof document === "undefined" ||
		document.head.querySelector(
			`link[${ROSE_PREFETCH_ATTRIBUTE}="rose-model"]`,
		)
	) {
		return;
	}

	const rosePreload = document.createElement("link");
	rosePreload.rel = "preload";
	rosePreload.as = "fetch";
	rosePreload.href = ROSE_MODEL_URL;
	rosePreload.crossOrigin = "anonymous";
	rosePreload.setAttribute(ROSE_PREFETCH_ATTRIBUTE, "rose-model");
	document.head.append(rosePreload);
}
