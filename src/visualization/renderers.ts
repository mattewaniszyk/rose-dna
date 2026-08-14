import { Hap } from "@strudel/core/hap.mjs";
import { Pattern, gap, pure, stepcat } from "@strudel/core/pattern.mjs";
import { TimeSpan } from "@strudel/core/timespan.mjs";
import { __pianoroll } from "@strudel/draw/pianoroll.mjs";
import "@strudel/draw/spiral.mjs";
import { pitchwheel } from "@strudel/draw/pitchwheel.mjs";
import type { GenomicMusicSequence } from "@/audio/types";
import {
	BASE_COLORS,
	complementBase,
	getFocusedEventIndex,
	secondsPerMeasure,
} from "./sequence";
import type {
	BottomVisualizationMode,
	VisualLayoutPreset,
	VisualizationAudioFrame,
} from "./types";
import { getVisualCompositionLayout } from "./canvas-layout";

type StrudelValue = {
	note: number;
	velocity: number;
	gain: number;
	color: string;
	label: string;
	activeLabel: string;
};

export type VisualizationModel = {
	haps: Array<Hap<StrudelValue>>;
	secondsPerCycle: number;
	spiralPainters: ReturnType<Pattern["getPainters"]>;
};

type StepwiseValue = StrudelValue & {
	base: string;
	lane: "sounded" | "complement";
};

export type StepwiseVisualizationModel = {
	complementPattern: Pattern;
	secondsPerCycle: number;
	sequence: GenomicMusicSequence;
	soundedPattern: Pattern;
	stepsPerCycle: number;
};

export function createVisualizationModel(
	sequence: GenomicMusicSequence,
): VisualizationModel {
	const secondsPerCycle = secondsPerMeasure(sequence);
	const haps = sequence.events.map((event) => {
		const span = new TimeSpan(
			event.time / secondsPerCycle,
			(event.time + event.duration) / secondsPerCycle,
		);
		const complement = complementBase(event.base);

		return new Hap(span, span, {
			note: event.midi,
			velocity: event.velocity,
			gain: 1,
			color: BASE_COLORS[event.base],
			label: `${event.base}·${complement}`,
			activeLabel: `${event.base}↔${complement}`,
		});
	});
	const pattern = new Pattern(() => haps).spiral({
		steady: 0.96,
		stretch: 1,
		activeColor: "#f4adc8",
		inactiveColor: "rgba(255,255,255,0.2)",
		colorizeInactive: 1,
		fade: true,
	});

	return {
		haps,
		secondsPerCycle,
		spiralPainters: pattern.getPainters(),
	};
}

export function createStepwiseVisualizationModel(
	sequence: GenomicMusicSequence,
): StepwiseVisualizationModel {
	const secondsPerCycle = secondsPerMeasure(sequence);
	const stepsPerCycle =
		secondsPerCycle / (60 / sequence.tempoBpm / 4);
	let patterns: {
		complementPattern: Pattern;
		soundedPattern: Pattern;
	} | null = null;
	const getPatterns = () => {
		if (patterns) {
			return patterns;
		}

		const soundedSteps: Array<[number, Pattern]> = [];
		const complementSteps: Array<[number, Pattern]> = [];
		const leadingStepWeight =
			((sequence.events[0]?.time ?? 0) / secondsPerCycle) * stepsPerCycle;

		if (leadingStepWeight > 0) {
			soundedSteps.push([leadingStepWeight, gap(leadingStepWeight)]);
			complementSteps.push([leadingStepWeight, gap(leadingStepWeight)]);
		}

		for (
			let eventIndex = 0;
			eventIndex < sequence.events.length;
			eventIndex += 1
		) {
			const event = sequence.events[eventIndex];
			const nextTime =
				sequence.events[eventIndex + 1]?.time ?? sequence.runtimeSeconds;
			const stepWeight = Math.max(
				0.001,
				((nextTime - event.time) / secondsPerCycle) * stepsPerCycle,
			);
			const complement = complementBase(event.base);

			soundedSteps.push([
				stepWeight,
				pure({
					note: 9,
					velocity: event.velocity,
					gain: 1,
					color: BASE_COLORS[event.base],
					label: event.base,
					activeLabel: event.base,
					base: event.base,
					lane: "sounded",
				} satisfies StepwiseValue),
			]);
			complementSteps.push([
				stepWeight,
				pure({
					note: 4,
					velocity: event.velocity,
					gain: 1,
					color: BASE_COLORS[complement],
					label: complement,
					activeLabel: complement,
					base: complement,
					lane: "complement",
				} satisfies StepwiseValue),
			]);
		}

		patterns = {
			soundedPattern: stepcat(...soundedSteps).pace(stepsPerCycle),
			complementPattern: stepcat(...complementSteps).pace(stepsPerCycle),
		};
		return patterns;
	};
	const model: StepwiseVisualizationModel = {
		sequence,
		secondsPerCycle,
		stepsPerCycle,
		get soundedPattern() {
			return getPatterns().soundedPattern;
		},
		get complementPattern() {
			return getPatterns().complementPattern;
		},
	};

	return model;
}

function clearCanvas(context: CanvasRenderingContext2D) {
	context.clearRect(0, 0, context.canvas.width, context.canvas.height);
}

function drawTimeline(
	context: CanvasRenderingContext2D,
	model: VisualizationModel,
	timeCycles: number,
	vertical: boolean,
) {
	clearCanvas(context);
	__pianoroll({
		ctx: context,
		time: timeCycles,
		haps: model.haps,
		cycles: 4,
		playhead: 0.35,
		hideNegative: true,
		labels: true,
		fold: true,
		fill: true,
		fillActive: true,
		strokeActive: true,
		background: "transparent",
		playheadColor: "rgba(255,255,255,0.88)",
		inactive: "rgba(255,255,255,0.3)",
		active: "#ffffff",
		fontFamily: "Geist Variable, sans-serif",
		vertical,
	});
}

function drawSpiral(
	context: CanvasRenderingContext2D,
	model: VisualizationModel,
	timeCycles: number,
) {
	clearCanvas(context);
	const visible = model.haps.filter(
		(hap) => hap.whole.begin <= timeCycles + 1 && hap.endClipped >= timeCycles - 3,
	);
	const { width, height } = context.canvas;
	const insetRotations = 3;
	const maxAngle = visible.reduce((largest, hap) => {
		const from = Number(hap.whole.begin) - timeCycles + insetRotations;
		const to = Number(hap.endClipped) - timeCycles + insetRotations;
		return Math.max(largest, Math.abs(from), Math.abs(to));
	}, insetRotations);
	const estimatedRadius = 80 * maxAngle + 24;
	const availableRadius = Math.min(width, height) * 0.41;
	const fitScale = Math.min(
		1,
		Math.max(0.2, availableRadius / Math.max(1, estimatedRadius)),
	);

	context.save();
	context.translate(width / 2, height / 2);
	context.scale(fitScale, fitScale);
	context.translate(-width / 2, -height / 2);

	for (const painter of model.spiralPainters) {
		painter(context, timeCycles, visible, [-3, 1]);
	}
	context.restore();
}

function drawPitchWheel(
	context: CanvasRenderingContext2D,
	model: VisualizationModel,
	timeCycles: number,
) {
	clearCanvas(context);
	pitchwheel({
		ctx: context,
		haps: model.haps.filter((hap) => hap.isActive(timeCycles)),
		edo: 12,
		circle: 1,
		hapcircles: 1,
		mode: "flake",
		margin: Math.max(12, context.canvas.height * 0.08),
		thickness: Math.max(2, context.canvas.height * 0.008),
		hapRadius: Math.max(4, context.canvas.height * 0.018),
	});
}

function drawScope(
	context: CanvasRenderingContext2D,
	frame: VisualizationAudioFrame,
	timeSeconds: number,
	vertical: boolean,
) {
	clearCanvas(context);
	const { width, height } = context.canvas;
	const samples = frame.waveform;
	context.strokeStyle = "#f4adc8";
	context.lineWidth = Math.max(2, height * 0.008);
	context.shadowColor = "rgba(244,173,200,0.7)";
	context.shadowBlur = Math.max(6, height * 0.04);
	context.beginPath();

	if (!samples.length) {
		if (vertical) {
			context.moveTo(width / 2, 0);
			context.lineTo(width / 2, height);
		} else {
			context.moveTo(0, height / 2);
			context.lineTo(width, height / 2);
		}
	} else {
		const sweepOffset = Math.floor(
			(timeSeconds * Math.max(24, samples.length * 0.18)) % samples.length,
		);
		for (let index = 0; index < samples.length; index += 1) {
			const progress = index / Math.max(1, samples.length - 1);
			const sample = samples[(index + sweepOffset) % samples.length];
			const x = vertical
				? width / 2 + sample * width * 0.42
				: progress * width;
			const y = vertical
				? progress * height
				: height / 2 - sample * height * 0.42;

			if (index === 0) {
				context.moveTo(x, y);
			} else {
				context.lineTo(x, y);
			}
		}
	}

	context.stroke();
	context.shadowBlur = 0;
}

function drawSpectrum(
	context: CanvasRenderingContext2D,
	frame: VisualizationAudioFrame,
	reset: boolean,
	vertical: boolean,
) {
	const { width, height } = context.canvas;
	const speed = Math.max(
		1,
		Math.round((vertical ? height : width) / 480),
	);

	if (reset) {
		clearCanvas(context);
	} else {
		context.globalCompositeOperation = "copy";
		if (vertical) {
			context.drawImage(context.canvas, 0, -speed);
		} else {
			context.drawImage(context.canvas, -speed, 0);
		}
	}

	context.globalCompositeOperation = "source-over";
	const stripX = vertical ? 0 : reset ? 0 : width - speed;
	const stripY = vertical ? (reset ? 0 : height - speed) : 0;
	const stripWidth = vertical ? width : reset ? width : speed;
	const stripHeight = vertical ? (reset ? height : speed) : height;
	context.clearRect(stripX, stripY, stripWidth, stripHeight);

	for (let index = 0; index < frame.spectrum.length; index += 1) {
		const decibels = frame.spectrum[index];
		const intensity = Math.max(0, Math.min(1, (decibels + 100) / 100));
		const frequencyProgress =
			Math.log(index + 1) / Math.log(frame.spectrum.length + 1);
		context.fillStyle = `rgba(244,173,200,${intensity})`;
		if (vertical) {
			const x = frequencyProgress * width;
			context.fillRect(
				x,
				stripY,
				Math.max(1, width / 180),
				stripHeight,
			);
		} else {
			const y = height - frequencyProgress * height;
			context.fillRect(
				stripX,
				y,
				stripWidth,
				Math.max(1, height / 180),
			);
		}
	}
}

type BottomVisualizationDrawOptions = {
	reset?: boolean;
	vertical?: boolean;
};

export function drawBottomVisualization(
	context: CanvasRenderingContext2D,
	mode: BottomVisualizationMode,
	model: VisualizationModel,
	timeSeconds: number,
	audioFrame: VisualizationAudioFrame,
	options: BottomVisualizationDrawOptions = {},
) {
	const timeCycles = timeSeconds / model.secondsPerCycle;
	const { reset = false, vertical = false } = options;

	switch (mode) {
		case "timeline":
			drawTimeline(context, model, timeCycles, vertical);
			break;
		case "spiral":
			drawSpiral(context, model, timeCycles);
			break;
		case "pitch-wheel":
			drawPitchWheel(context, model, timeCycles);
			break;
		case "scope":
			drawScope(context, audioFrame, timeSeconds, vertical);
			break;
		case "spectrum":
			drawSpectrum(context, audioFrame, reset, vertical);
			break;
	}
}

type StepwiseCodeEntry = {
	active: boolean;
	base: string;
	color: string;
	weight: number;
};

function formatStepWeight(weight: number) {
	const rounded = Math.round(weight * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function getStepwiseCodeEntries(
	model: StepwiseVisualizationModel,
	activeIndex: number,
	complement: boolean,
	maxEntries: number,
) {
	const eventCount = model.sequence.events.length;
	const count = Math.min(eventCount, Math.max(1, maxEntries));
	const centeredStart = activeIndex - Math.floor(count / 2);
	const start = Math.max(0, Math.min(centeredStart, eventCount - count));
	const end = start + count;
	const entries: StepwiseCodeEntry[] = [];

	for (let index = start; index < end; index += 1) {
		const event = model.sequence.events[index];
		const nextTime =
			model.sequence.events[index + 1]?.time ?? model.sequence.runtimeSeconds;
		const base = complement ? complementBase(event.base) : event.base;

		entries.push({
			active: index === activeIndex,
			base,
			color: BASE_COLORS[base],
			weight: Math.max(
				0.001,
				((nextTime - event.time) / model.secondsPerCycle) *
					model.stepsPerCycle,
			),
		});
	}

	return { entries, hasBefore: start > 0, hasAfter: end < model.sequence.events.length };
}

function drawStepwiseCodeBlock(
	context: CanvasRenderingContext2D,
	options: {
		activeIndex: number;
		complement: boolean;
		compact: boolean;
		height: number;
		model: StepwiseVisualizationModel;
		width: number;
		x: number;
		y: number;
	},
) {
	const {
		x,
		y,
		width,
		height,
		model,
		activeIndex,
		complement,
		compact,
	} = options;
	context.save();
	context.beginPath();
	context.rect(x, y, width, height);
	context.clip();
	const fontSize = Math.max(
		14,
		Math.min(38, width / 46, height * (compact ? 0.12 : 0.14)),
	);
	const gutterWidth = Math.max(34, fontSize * 1.75);
	const lineHeight = fontSize * 1.48;
	const codeLeft = x + gutterWidth + fontSize * 0.65;
	const codeRight = x + width - fontSize * 0.4;
	const visibleLineCount = Math.max(3, Math.floor(height / lineHeight));
	const entryLineCount = Math.max(1, visibleLineCount - 2);
	let lineNumber = 1;
	let cursorX = codeLeft;
	let cursorY = y + lineHeight;

	context.font = `500 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
	context.textBaseline = "alphabetic";
	const representativeEntryWidth = context.measureText(`[00.00, "A"],  `).width;
	const entriesPerLine = Math.max(
		1,
		Math.floor(
			(codeRight - codeLeft) / Math.max(1, representativeEntryWidth),
		),
	);
	const entryCapacity = Math.min(
		compact ? 180 : 240,
		entryLineCount * entriesPerLine,
	);

	const drawLineNumber = () => {
		context.fillStyle = "rgba(255,255,255,0.23)";
		context.textAlign = "right";
		context.fillText(String(lineNumber), x + gutterWidth, cursorY);
		context.textAlign = "left";
		lineNumber += 1;
	};
	const nextLine = () => {
		cursorX = codeLeft;
		cursorY += lineHeight;
		drawLineNumber();
	};
	const drawToken = (text: string, color: string) => {
		context.fillStyle = color;
		context.fillText(text, cursorX, cursorY);
		cursorX += context.measureText(text).width;
	};

	drawLineNumber();
	drawToken("stepcat", "#c792ea");
	drawToken("(", "rgba(255,255,255,0.52)");
	nextLine();

	const { entries, hasBefore, hasAfter } = getStepwiseCodeEntries(
		model,
		activeIndex,
		complement,
		entryCapacity,
	);
	if (hasBefore) {
		drawToken("…  ", "rgba(255,255,255,0.34)");
	}

	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index];
		const prefix = `[${formatStepWeight(entry.weight)}, `;
		const quotedBase = `"${entry.base}"`;
		const suffix = `]${index < entries.length - 1 || hasAfter ? "," : ""}`;
		const entryWidth = context.measureText(prefix + quotedBase + suffix + " ").width;

		if (cursorX + entryWidth > codeRight && cursorX > codeLeft) {
			nextLine();
		}

		const entryStart = cursorX;
		drawToken(prefix, "rgba(255,255,255,0.55)");
		if (entry.active) {
			context.shadowColor = entry.color;
			context.shadowBlur = Math.max(7, fontSize * 0.42);
		}
		drawToken(quotedBase, entry.active ? "#ffffff" : entry.color);
		context.shadowBlur = 0;
		drawToken(`${suffix} `, "rgba(255,255,255,0.55)");

		if (entry.active) {
			context.strokeStyle = entry.color;
			context.lineWidth = Math.max(1.5, fontSize * 0.055);
			context.beginPath();
			context.moveTo(entryStart, cursorY + fontSize * 0.25);
			context.lineTo(cursorX - fontSize * 0.25, cursorY + fontSize * 0.25);
			context.stroke();
		}
	}

	if (hasAfter) {
		drawToken(" …", "rgba(255,255,255,0.34)");
	}
	nextLine();
	drawToken(").", "rgba(255,255,255,0.52)");
	drawToken("pace", "#c792ea");
	drawToken("(", "rgba(255,255,255,0.52)");
	drawToken(formatStepWeight(model.stepsPerCycle), "#c3e88d");
	drawToken(")", "rgba(255,255,255,0.52)");
	context.restore();
}

export function drawStepwiseBackground(
	context: CanvasRenderingContext2D,
	model: StepwiseVisualizationModel,
	timeSeconds: number,
	options: { layoutPreset?: VisualLayoutPreset } = {},
) {
	const { width, height } = context.canvas;
	const focusedIndex = getFocusedEventIndex(
		model.sequence.events,
		timeSeconds,
	);
	const focused = model.sequence.events[focusedIndex];

	clearCanvas(context);

	if (!focused) {
		return;
	}

	context.save();
	context.globalAlpha = 1;
	context.shadowBlur = 0;
	context.globalCompositeOperation = "source-over";

	const topWash = context.createLinearGradient(0, 0, 0, height * 0.5);
	topWash.addColorStop(0, "rgba(0,0,0,0.48)");
	topWash.addColorStop(0.52, "rgba(0,0,0,0.22)");
	topWash.addColorStop(1, "rgba(0,0,0,0)");
	context.fillStyle = topWash;
	context.fillRect(0, 0, width, height * 0.52);

	const layout = getVisualCompositionLayout(
		options.layoutPreset ?? "layered",
		width / Math.max(1, height),
	);
	if (layout.overlaps) {
		const bottomWashStart = height * 0.48;
		const bottomWash = context.createLinearGradient(
			0,
			bottomWashStart,
			0,
			height,
		);
		bottomWash.addColorStop(0, "rgba(0,0,0,0)");
		bottomWash.addColorStop(0.62, "rgba(0,0,0,0.28)");
		bottomWash.addColorStop(1, "rgba(0,0,0,0.48)");
		context.fillStyle = bottomWash;
		context.fillRect(0, bottomWashStart, width, height - bottomWashStart);
	}

	const vignette = context.createRadialGradient(
		width * 0.5,
		height * 0.5,
		Math.min(width, height) * 0.16,
		width * 0.5,
		height * 0.5,
		Math.max(width, height) * 0.72,
	);
	vignette.addColorStop(0, "rgba(0,0,0,0)");
	vignette.addColorStop(0.74, "rgba(0,0,0,0.08)");
	vignette.addColorStop(1, "rgba(0,0,0,0.34)");
	context.fillStyle = vignette;
	context.fillRect(0, 0, width, height);

	drawStepwiseCodeBlock(context, {
		x: width * layout.sounded.x,
		y: height * layout.sounded.y,
		width: width * layout.sounded.width,
		height: height * layout.sounded.height,
		model,
		activeIndex: focusedIndex,
		complement: false,
		compact: layout.codeCompact,
	});
	drawStepwiseCodeBlock(context, {
		x: width * layout.complement.x,
		y: height * layout.complement.y,
		width: width * layout.complement.width,
		height: height * layout.complement.height,
		model,
		activeIndex: focusedIndex,
		complement: true,
		compact: layout.codeCompact,
	});

	context.textAlign = "left";
	context.textBaseline = "middle";
	context.font = `500 ${Math.max(12, height * 0.017)}px "Geist Variable", sans-serif`;
	context.fillStyle = "rgba(255,255,255,0.5)";
	context.fillText(
		`${focused.direction.toUpperCase()} · read ${focused.sourceReadIndex + 1} · base ${focused.sourceBaseIndex + 1}`,
		width * layout.metadata.x,
		height * layout.metadata.y,
	);
	context.restore();
}
