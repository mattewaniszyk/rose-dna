import { Color, DoubleSide, ShaderMaterial } from "three";

export type LiquidMetalParams = {
	colorBack: string;
	// Band crest color. White keeps the classic blown-out chrome highlight; a
	// saturated value trades that white for hue at the brightest point, which the
	// tint burn alone cannot do (burning leaves pure white pure white).
	colorHighlight: string;
	colorTint: string;
	tintOpacity: number;
	softness: number;
	repetition: number;
	shiftRed: number;
	shiftBlue: number;
	distortion: number;
	contour: number;
	angle: number;
	speed: number;
	noiseScale: number;
	fresnelPower: number;
	// View-based form: darkens facing surfaces and lifts rims with the highlight
	// hue. 0 leaves chrome / liquid-rose unchanged.
	formAmount: number;
};

export const LIQUID_METAL_DEFAULTS: LiquidMetalParams = {
	colorBack: "#05060a",
	colorHighlight: "#ffffff",
	colorTint: "#d6e0f0",
	tintOpacity: 0.55,
	softness: 0.34,
	repetition: 3.2,
	shiftRed: 0.055,
	shiftBlue: 0.045,
	distortion: 0.26,
	contour: 0.78,
	angle: 0.62,
	speed: 0.22,
	noiseScale: 2.4,
	fresnelPower: 2.2,
	formAmount: 0,
};

const LIQUID_METAL_VERTEX_SHADER = /* glsl */ `
varying vec3 vViewNormal;
varying vec3 vViewPosition;

void main() {
	vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);

	vViewPosition = viewPosition.xyz;
	vViewNormal = normalize(normalMatrix * normal);

	gl_Position = projectionMatrix * viewPosition;
}
`;

const LIQUID_METAL_FRAGMENT_SHADER = /* glsl */ `
uniform float u_time;
uniform vec3 u_colorBack;
uniform vec3 u_colorHighlight;
uniform vec3 u_colorTint;
uniform float u_tintOpacity;
uniform float u_softness;
uniform float u_repetition;
uniform float u_shiftRed;
uniform float u_shiftBlue;
uniform float u_distortion;
uniform float u_contour;
uniform float u_angle;
uniform float u_speed;
uniform float u_noiseScale;
uniform float u_fresnelPower;
uniform float u_formAmount;

varying vec3 vViewNormal;
varying vec3 vViewPosition;

// 2D simplex noise by Ian McEwan / Ashima Arts (MIT).
vec2 mod289(vec2 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 mod289(vec3 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
	return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec2 v) {
	const vec4 C = vec4(
		0.211324865405187,
		0.366025403784439,
		-0.577350269189626,
		0.024390243902439
	);

	vec2 i = floor(v + dot(v, C.yy));
	vec2 x0 = v - i + dot(i, C.xx);
	vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	vec4 x12 = x0.xyxy + C.xxzz;
	x12.xy -= i1;

	i = mod289(i);

	vec3 p = permute(
		permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
	);

	vec3 m = max(
		0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
		0.0
	);
	m = m * m;
	m = m * m;

	vec3 x = 2.0 * fract(p * C.www) - 1.0;
	vec3 h = abs(x) - 0.5;
	vec3 ox = floor(x + 0.5);
	vec3 a0 = x - ox;

	m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

	vec3 g;
	g.x = a0.x * x0.x + h.x * x0.y;
	g.yz = a0.yz * x12.xz + h.yz * x12.yw;

	return 130.0 * dot(m, g);
}

// Per-cycle band profile: hard bright edge, hot plateau, fast falloff, soft
// secondary lobe, back to black. The shift lives inside the fract so the
// profile returns to the same value at both ends and the seam stays invisible.
float getColorChanges(float stripe, float shift, float blur) {
	float w = clamp(blur, 0.001, 0.45);
	float t = fract(stripe + shift);

	float value = smoothstep(0.0, w, t);
	value -= smoothstep(0.35 - w, 0.35 + w, t);
	value += 0.62 * smoothstep(0.55 - w, 0.55 + w, t);
	value -= 0.62 * smoothstep(1.0 - w, 1.0, t);

	return clamp(value, 0.0, 1.0);
}

void main() {
	vec3 normal = normalize(vViewNormal);

	if (!gl_FrontFacing) {
		normal = -normal;
	}

	vec3 viewDir = normalize(-vViewPosition);

	// 3D analog of the flat canvas UV: a matcap coordinate off the reflect vector.
	vec3 reflected = reflect(-viewDir, normal);
	float matcapScale = 2.0 * sqrt(
		reflected.x * reflected.x +
		reflected.y * reflected.y +
		(reflected.z + 1.0) * (reflected.z + 1.0)
	);
	vec2 uv = reflected.xy / max(matcapScale, 1e-4);

	float cosAngle = cos(u_angle);
	float sinAngle = sin(u_angle);
	uv = mat2(cosAngle, -sinAngle, sinAngle, cosAngle) * uv;

	// 3D analog of the shape edge gradient that warps the bands at the silhouette.
	float facing = clamp(abs(dot(normal, viewDir)), 0.0, 1.0);
	float fresnel = pow(1.0 - facing, u_fresnelPower);

	float drift = u_time * u_speed;
	float noise =
		0.65 * snoise(uv * u_noiseScale + vec2(0.0, drift)) +
		0.35 * snoise(uv * (u_noiseScale * 2.1) - vec2(drift * 0.7, 0.0));

	float direction = uv.x + 0.5;
	direction += u_distortion * noise;
	direction += u_contour * fresnel;
	direction += drift * 0.35;

	float stripe = fract(direction * u_repetition);
	float blur = 0.5 * u_softness * u_softness + 0.004;

	vec3 metal = vec3(
		getColorChanges(stripe, u_shiftRed, blur),
		getColorChanges(stripe, 0.0, blur),
		getColorChanges(stripe, -u_shiftBlue, blur)
	);

	vec3 color = mix(u_colorBack, u_colorHighlight, metal);
	vec3 burned = 1.0 - min(
		vec3(1.0),
		(1.0 - color) / max(u_colorTint, vec3(1e-4))
	);
	color = mix(color, burned, u_tintOpacity);

	// Soft form from the same fresnel used to warp bands: facing goes darker,
	// rims lean toward the highlight hue so saturated presets keep their color.
	if (u_formAmount > 0.0) {
		float shade = mix(0.72, 1.18, fresnel);
		vec3 rim = mix(color, u_colorHighlight, fresnel * 0.55);
		color = mix(color, rim * shade, u_formAmount);
	}

	gl_FragColor = vec4(color, 1.0);

	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

export function createLiquidMetalMaterial(params?: Partial<LiquidMetalParams>) {
	const settings = { ...LIQUID_METAL_DEFAULTS, ...params };

	return new ShaderMaterial({
		uniforms: {
			u_time: { value: 0 },
			u_colorBack: { value: new Color(settings.colorBack) },
			u_colorHighlight: { value: new Color(settings.colorHighlight) },
			u_colorTint: { value: new Color(settings.colorTint) },
			u_tintOpacity: { value: settings.tintOpacity },
			u_softness: { value: settings.softness },
			u_repetition: { value: settings.repetition },
			u_shiftRed: { value: settings.shiftRed },
			u_shiftBlue: { value: settings.shiftBlue },
			u_distortion: { value: settings.distortion },
			u_contour: { value: settings.contour },
			u_angle: { value: settings.angle },
			u_speed: { value: settings.speed },
			u_noiseScale: { value: settings.noiseScale },
			u_fresnelPower: { value: settings.fresnelPower },
			u_formAmount: { value: settings.formAmount },
		},
		vertexShader: LIQUID_METAL_VERTEX_SHADER,
		fragmentShader: LIQUID_METAL_FRAGMENT_SHADER,
		side: DoubleSide,
		toneMapped: false,
	});
}

export function setLiquidMetalTime(material: ShaderMaterial, time: number) {
	material.uniforms.u_time.value = time;
}
