import { CanvasTexture, Color, NearestFilter, Vector2 } from "three";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { HalftonePass } from "three/examples/jsm/postprocessing/HalftonePass.js";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { LuminosityShader } from "three/examples/jsm/shaders/LuminosityShader.js";
import { SobelOperatorShader } from "three/examples/jsm/shaders/SobelOperatorShader.js";
import type { ActiveOverlayEffect, OverlayEffect } from "./overlay-effect";

export type OverlayPassContext = {
	width: number;
	height: number;
	pixelRatio: number;
};

// Three skips in-material tone mapping and sRGB encode whenever it renders into
// a render target, so the pass chain runs in linear working space until
// OutputPass. Bloom wants that linear HDR input; every perceptual effect —
// anything thresholding luminance — has to run after OutputPass instead, or its
// mid-tones land far darker than they look on screen.
export type OverlayPassStage = "scene" | "display";

export type OverlayPassBundle = {
	stage: OverlayPassStage;
	passes: Pass[];
	// Logical size plus ratio: cell-based effects need the ratio to keep a
	// constant apparent size, and the composer only hands passes device pixels.
	setSize: (width: number, height: number, pixelRatio: number) => void;
	dispose: () => void;
};

// Every custom pass below carries the source alpha through rather than writing
// 1. Normally the frame is opaque anyway (black skybox, or the captured
// backdrop), but if SceneBackdrop never validates its capture the scene stays
// transparent — and writing an opaque frame there would paint over the DOM
// background layer instead of letting it show through.
const OVERLAY_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Recursive Bayer construction in pure float math. GLSL ES 1.00 forbids dynamic
// indexing into a const threshold array, so the matrix is computed instead of
// looked up.
const BAYER_CHUNK = /* glsl */ `
float bayer2(vec2 a) {
	a = floor(a);
	return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
	return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

float bayer8(vec2 a) {
	return bayer4(0.5 * a) * 0.25 + bayer2(a);
}
`;

// Deliberately not named "luminance": three prepends its common chunk to every
// ShaderMaterial, and that already declares luminance(const in vec3), so the
// shader fails to compile on the redefinition.
const LUMINANCE_CHUNK = /* glsl */ `
// Deep saturated red carries a luminance around 0.12, so thresholding the rose
// on luminance alone leaves almost every cell in the darkest bucket. Leaning
// most of the way toward the channel maximum keeps neutrals honest while giving
// the bloom something to quantize.
const float OVERLAY_SHADE_MIX = 0.65;

float overlayLuminance(vec3 color) {
	return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float overlayShade(vec3 color) {
	float value = max(color.r, max(color.g, color.b));

	return mix(overlayLuminance(color), value, OVERLAY_SHADE_MIX);
}
`;

export type DitherParams = {
	cellSize: number;
	levels: number;
	darkColor: string;
	lightColor: string;
	tint: number;
};

export const DITHER_DEFAULTS: DitherParams = {
	cellSize: 3,
	levels: 4,
	darkColor: "#0a0206",
	lightColor: "#ffe8f0",
	// 0 keeps the source color; raise toward 1 for the rose-tinted duotone.
	tint: 0,
};

const DITHER_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 u_resolution;
uniform float u_cellSize;
uniform float u_levels;
uniform vec3 u_darkColor;
uniform vec3 u_lightColor;
uniform float u_tint;

varying vec2 vUv;

${LUMINANCE_CHUNK}
${BAYER_CHUNK}

void main() {
	vec2 pixel = vUv * u_resolution;
	vec2 cell = floor(pixel / u_cellSize);
	vec2 sampleUv = (cell + 0.5) * u_cellSize / u_resolution;

	vec4 texel = texture2D(tDiffuse, sampleUv);
	vec3 color = texel.rgb;
	float steps = max(u_levels - 1.0, 1.0);
	// The pattern repeats every 8 cells; wrapping first keeps the squared term
	// in bayer2 small enough to stay exact in float.
	float threshold = bayer8(mod(cell, 8.0)) - 0.5;

	// Thresholding each channel on its own is what keeps the hue: the red of the
	// bloom survives quantization instead of collapsing into a single shade.
	// This also sidesteps the luminance problem overlayShade exists to solve,
	// since a saturated channel stays strong on its own axis.
	vec3 quantized = clamp(
		floor(color * steps + threshold + 0.5) / steps,
		0.0,
		1.0
	);

	// u_tint blends toward the older single-shade duotone ramp: 0 keeps full
	// color, 1 is the rose-tinted two-tone look.
	float shade = clamp(
		floor(overlayShade(color) * steps + threshold + 0.5) / steps,
		0.0,
		1.0
	);
	vec3 duotone = mix(u_darkColor, u_lightColor, shade);

	gl_FragColor = vec4(mix(quantized, duotone, u_tint), texel.a);
}
`;

export type AsciiParams = {
	cellSize: number;
	inkColor: string;
	colorMix: number;
	gamma: number;
};

export const ASCII_DEFAULTS: AsciiParams = {
	cellSize: 9,
	inkColor: "#ffd9e6",
	colorMix: 0.55,
	gamma: 0.55,
};

const ASCII_GLYPHS = " .:-=+*#%@";
const ASCII_TILE_SIZE = 16;

// Built at runtime so the effect ships without a glyph atlas asset.
function createAsciiAtlas() {
	const canvas = document.createElement("canvas");

	canvas.width = ASCII_TILE_SIZE * ASCII_GLYPHS.length;
	canvas.height = ASCII_TILE_SIZE;

	const context = canvas.getContext("2d");

	if (context) {
		context.fillStyle = "#000000";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = "#ffffff";
		context.font = `bold ${ASCII_TILE_SIZE - 3}px ui-monospace, Menlo, monospace`;
		context.textAlign = "center";
		context.textBaseline = "middle";

		Array.from(ASCII_GLYPHS).forEach((glyph, index) => {
			context.fillText(
				glyph,
				index * ASCII_TILE_SIZE + ASCII_TILE_SIZE / 2,
				ASCII_TILE_SIZE / 2,
			);
		});
	}

	const texture = new CanvasTexture(canvas);

	texture.minFilter = NearestFilter;
	texture.magFilter = NearestFilter;
	texture.generateMipmaps = false;

	return texture;
}

const ASCII_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D u_atlas;
uniform vec2 u_resolution;
uniform float u_cellSize;
uniform float u_glyphCount;
uniform vec3 u_inkColor;
uniform float u_colorMix;
uniform float u_gamma;

varying vec2 vUv;

${LUMINANCE_CHUNK}

void main() {
	vec2 pixel = vUv * u_resolution;
	vec2 cell = floor(pixel / u_cellSize);
	vec2 cellUv = fract(pixel / u_cellSize);
	vec2 sampleUv = (cell + 0.5) * u_cellSize / u_resolution;

	vec4 texel = texture2D(tDiffuse, sampleUv);
	vec3 color = texel.rgb;
	float shade = pow(clamp(overlayShade(color), 0.0, 1.0), u_gamma);
	float index = floor(shade * (u_glyphCount - 1.0) + 0.5);

	vec2 atlasUv = vec2((index + cellUv.x) / u_glyphCount, cellUv.y);
	float glyph = texture2D(u_atlas, atlasUv).r;

	vec3 ink = mix(u_inkColor, color, u_colorMix);

	// Alpha follows the source, never the glyph mask. Multiplying by the mask
	// would make the gaps between glyphs transparent, letting the un-effected
	// background canvas show through and mixing two looks in one frame.
	gl_FragColor = vec4(ink * glyph, texel.a);
}
`;

export type PixelateParams = {
	cellSize: number;
};

export const PIXELATE_DEFAULTS: PixelateParams = {
	cellSize: 7,
};

// Same shader, finer grid: enough to still read as pixel art while keeping the
// petal edges legible.
export const PIXELATE_SMALL_DEFAULTS: PixelateParams = {
	cellSize: 3,
};

const PIXELATE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 u_resolution;
uniform float u_cellSize;

varying vec2 vUv;

void main() {
	vec2 cell = floor(vUv * u_resolution / u_cellSize);
	vec2 sampleUv = (cell + 0.5) * u_cellSize / u_resolution;

	gl_FragColor = texture2D(tDiffuse, sampleUv);
}
`;

export type PosterizeParams = {
	levels: number;
	saturation: number;
};

export const POSTERIZE_DEFAULTS: PosterizeParams = {
	levels: 5,
	saturation: 1.25,
};

const POSTERIZE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float u_levels;
uniform float u_saturation;

varying vec2 vUv;

${LUMINANCE_CHUNK}

void main() {
	vec4 texel = texture2D(tDiffuse, vUv);
	vec3 color = texel.rgb;

	color = mix(vec3(overlayLuminance(color)), color, u_saturation);
	color = clamp(color, 0.0, 1.0);

	float top = max(u_levels - 1.0, 1.0);
	vec3 quantized = min(floor(color * u_levels), vec3(top)) / top;

	gl_FragColor = vec4(quantized, texel.a);
}
`;

export type ChromaticParams = {
	amount: number;
	vignette: number;
};

export const CHROMATIC_DEFAULTS: ChromaticParams = {
	amount: 0.34,
	vignette: 0.55,
};

const CHROMATIC_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float u_amount;
uniform float u_vignette;

varying vec2 vUv;

void main() {
	vec2 offset = vUv - 0.5;
	float dist = length(offset);
	vec2 shift = offset * u_amount * dist;

	vec4 center = texture2D(tDiffuse, vUv);
	vec3 color = vec3(
		texture2D(tDiffuse, vUv + shift).r,
		center.g,
		texture2D(tDiffuse, vUv - shift).b
	);

	float falloff = smoothstep(0.85, 0.22, dist);

	gl_FragColor = vec4(color * mix(1.0, falloff, u_vignette), center.a);
}
`;

type ResolutionUniformNames = {
	resolution?: string;
	cellSize?: string;
};

// Cell sizes are authored in logical pixels; scaling by the device ratio keeps
// dots and glyphs the same apparent size on HiDPI displays.
function attachResize(
	pass: ShaderPass,
	uniformNames: ResolutionUniformNames,
	baseCellSize: number,
) {
	return (width: number, height: number, pixelRatio: number) => {
		if (uniformNames.resolution) {
			const resolution = pass.uniforms[uniformNames.resolution]
				.value as Vector2;

			resolution.set(width * pixelRatio, height * pixelRatio);
		}

		if (uniformNames.cellSize) {
			pass.uniforms[uniformNames.cellSize].value =
				baseCellSize * pixelRatio;
		}
	};
}

function createCellShaderPass(
	fragmentShader: string,
	uniforms: Record<string, { value: unknown }>,
	baseCellSize: number,
): OverlayPassBundle & { passes: [ShaderPass] } {
	const pass = new ShaderPass({
		uniforms: {
			tDiffuse: { value: null },
			u_resolution: { value: new Vector2(1, 1) },
			u_cellSize: { value: baseCellSize },
			...uniforms,
		},
		vertexShader: OVERLAY_VERTEX_SHADER,
		fragmentShader,
	});

	return {
		stage: "display",
		passes: [pass],
		setSize: attachResize(
			pass,
			{ resolution: "u_resolution", cellSize: "u_cellSize" },
			baseCellSize,
		),
		dispose: () => {
			pass.dispose();
		},
	};
}

function createDitherBundle(): OverlayPassBundle {
	return createCellShaderPass(
		DITHER_FRAGMENT_SHADER,
		{
			u_levels: { value: DITHER_DEFAULTS.levels },
			u_darkColor: { value: new Color(DITHER_DEFAULTS.darkColor) },
			u_lightColor: { value: new Color(DITHER_DEFAULTS.lightColor) },
			u_tint: { value: DITHER_DEFAULTS.tint },
		},
		DITHER_DEFAULTS.cellSize,
	);
}

function createAsciiBundle(): OverlayPassBundle {
	const atlas = createAsciiAtlas();
	const bundle = createCellShaderPass(
		ASCII_FRAGMENT_SHADER,
		{
			u_atlas: { value: null },
			u_glyphCount: { value: ASCII_GLYPHS.length },
			u_inkColor: { value: new Color(ASCII_DEFAULTS.inkColor) },
			u_colorMix: { value: ASCII_DEFAULTS.colorMix },
			u_gamma: { value: ASCII_DEFAULTS.gamma },
		},
		ASCII_DEFAULTS.cellSize,
	);

	// ShaderPass deep-clones its uniforms, so the atlas is attached afterwards:
	// handing it in above would upload a copy and leave this one to leak.
	bundle.passes[0].uniforms.u_atlas.value = atlas;

	return {
		...bundle,
		dispose: () => {
			bundle.dispose();
			atlas.dispose();
		},
	};
}

function createPixelateBundle(): OverlayPassBundle {
	return createCellShaderPass(
		PIXELATE_FRAGMENT_SHADER,
		{},
		PIXELATE_DEFAULTS.cellSize,
	);
}

function createPixelateSmallBundle(): OverlayPassBundle {
	return createCellShaderPass(
		PIXELATE_FRAGMENT_SHADER,
		{},
		PIXELATE_SMALL_DEFAULTS.cellSize,
	);
}

function createPosterizeBundle(): OverlayPassBundle {
	const pass = new ShaderPass({
		uniforms: {
			tDiffuse: { value: null },
			u_levels: { value: POSTERIZE_DEFAULTS.levels },
			u_saturation: { value: POSTERIZE_DEFAULTS.saturation },
		},
		vertexShader: OVERLAY_VERTEX_SHADER,
		fragmentShader: POSTERIZE_FRAGMENT_SHADER,
	});

	return {
		stage: "display",
		passes: [pass],
		setSize: () => {},
		dispose: () => {
			pass.dispose();
		},
	};
}

function createChromaticBundle(): OverlayPassBundle {
	const pass = new ShaderPass({
		uniforms: {
			tDiffuse: { value: null },
			u_amount: { value: CHROMATIC_DEFAULTS.amount },
			u_vignette: { value: CHROMATIC_DEFAULTS.vignette },
		},
		vertexShader: OVERLAY_VERTEX_SHADER,
		fragmentShader: CHROMATIC_FRAGMENT_SHADER,
	});

	return {
		stage: "display",
		passes: [pass],
		setSize: () => {},
		dispose: () => {
			pass.dispose();
		},
	};
}

function createHalftoneBundle(): OverlayPassBundle {
	// HalftonePass keeps its own width/height uniforms in sync through the
	// setSize the composer already calls.
	const pass = new HalftonePass({
		shape: 1,
		radius: 3,
		rotateR: (Math.PI / 12) * 1,
		rotateG: (Math.PI / 12) * 2,
		rotateB: (Math.PI / 12) * 3,
		scatter: 0,
		blending: 1,
		blendingMode: 1,
		greyscale: false,
	});

	return {
		stage: "display",
		passes: [pass],
		setSize: () => {},
		dispose: () => {
			pass.dispose();
		},
	};
}

function createEdgeBundle(): OverlayPassBundle {
	const luminosityPass = new ShaderPass(LuminosityShader);
	const sobelPass = new ShaderPass(SobelOperatorShader);

	return {
		stage: "display",
		passes: [luminosityPass, sobelPass],
		setSize: attachResize(sobelPass, { resolution: "resolution" }, 1),
		dispose: () => {
			luminosityPass.dispose();
			sobelPass.dispose();
		},
	};
}

function createBloomBundle(context: OverlayPassContext): OverlayPassBundle {
	const pass = new UnrealBloomPass(
		new Vector2(
			context.width * context.pixelRatio,
			context.height * context.pixelRatio,
		),
		0.95,
		0.45,
		0.72,
	);

	return {
		// Bloom belongs on the linear HDR frame, before tone mapping.
		stage: "scene",
		passes: [pass],
		setSize: () => {},
		dispose: () => {
			pass.dispose();
		},
	};
}

// Tight rim-biased bloom — only the hottest edges haze, fills stay crisp.
function createBiolumeBloomBundle(
	context: OverlayPassContext,
): OverlayPassBundle {
	const pass = new UnrealBloomPass(
		new Vector2(
			context.width * context.pixelRatio,
			context.height * context.pixelRatio,
		),
		0.4,
		0.16,
		0.62,
	);

	return {
		stage: "scene",
		passes: [pass],
		setSize: () => {},
		dispose: () => {
			pass.dispose();
		},
	};
}

function createGrainBundle(): OverlayPassBundle {
	// FilmPass advances its own time uniform from the delta the composer passes.
	const pass = new FilmPass(0.42, false);

	return {
		stage: "display",
		passes: [pass],
		setSize: () => {},
		dispose: () => {
			pass.dispose();
		},
	};
}

const OVERLAY_PASS_FACTORIES: Record<
	ActiveOverlayEffect,
	(context: OverlayPassContext) => OverlayPassBundle
> = {
	dither: createDitherBundle,
	ascii: createAsciiBundle,
	halftone: createHalftoneBundle,
	pixelate: createPixelateBundle,
	"pixelate-small": createPixelateSmallBundle,
	posterize: createPosterizeBundle,
	edge: createEdgeBundle,
	bloom: createBloomBundle,
	"biolume-bloom": createBiolumeBloomBundle,
	chromatic: createChromaticBundle,
	grain: createGrainBundle,
};

export function createOverlayPasses(
	effect: OverlayEffect,
	context: OverlayPassContext,
): OverlayPassBundle | null {
	if (effect === "none") {
		return null;
	}

	const bundle = OVERLAY_PASS_FACTORIES[effect](context);

	bundle.setSize(context.width, context.height, context.pixelRatio);

	return bundle;
}
