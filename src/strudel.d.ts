declare module "@strudel/core" {
	export class TimeSpan {
		constructor(begin: number, end: number);
		begin: number;
		end: number;
	}

	export class Hap<T = Record<string, unknown>> {
		constructor(whole: TimeSpan, part: TimeSpan, value: T, context?: object);
		whole: TimeSpan;
		part: TimeSpan;
		value: T;
		duration: number;
		endClipped: number;
		isActive(time: number): boolean;
	}

	export class Pattern {
		constructor(query: (state: unknown) => unknown[]);
		pace(steps: number): Pattern;
		queryArc(begin: number, end: number): Array<Hap>;
		setSteps(steps: number): Pattern;
		spiral(options?: object): Pattern;
		getPainters(): Array<(
			context: CanvasRenderingContext2D,
			time: number,
			haps: Array<Hap>,
			drawTime: [number, number],
		) => void>;
	}
}

declare module "@strudel/core/hap.mjs" {
	export { Hap } from "@strudel/core";
}

declare module "@strudel/core/pattern.mjs" {
	export { Pattern } from "@strudel/core";
	export function gap(steps: number): Pattern;
	export const silence: unknown;
	export function isPattern(value: unknown): boolean;
	export function pure(value: unknown): Pattern;
	export function register(...args: unknown[]): unknown;
	export function stepcat(...patterns: unknown[]): Pattern;
}

declare module "@strudel/core/timespan.mjs" {
	export { TimeSpan } from "@strudel/core";
}

declare module "@strudel/core/state.mjs" {
	export class State {}
}

declare module "@strudel/core/schedulerState.mjs" {
	export function getTime(): number;
}

declare module "@strudel/core/util.mjs" {
	export function noteToMidi(note: string | number): number;
	export function midiToFreq(midi: number): number;
	export function freqToMidi(frequency: number): number;
	export function getFrequency(hap: unknown): number;
}

declare module "@strudel/draw" {
	import type { Hap } from "@strudel/core";

	export function __pianoroll(options: {
		ctx: CanvasRenderingContext2D;
		time: number;
		haps: Array<Hap>;
		[key: string]: unknown;
	}): void;

	export function pitchwheel(options: {
		ctx: CanvasRenderingContext2D;
		haps: Array<Hap>;
		[key: string]: unknown;
	}): void;
}

declare module "@strudel/draw/pianoroll.mjs" {
	export { __pianoroll } from "@strudel/draw";
}

declare module "@strudel/draw/pitchwheel.mjs" {
	export { pitchwheel } from "@strudel/draw";
}

declare module "@strudel/draw/spiral.mjs" {}
