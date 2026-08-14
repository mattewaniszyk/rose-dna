import { describe, expect, it } from "vitest";
import {
	getAspectPreservingCoverSize,
	getCanvasPixelSize,
	getSquareContainedRect,
	getVisualCompositionLayout,
} from "./canvas-layout";

describe("visualization canvas layout", () => {
	it("uses the CSS viewport and pixel ratio for its backing resolution", () => {
		expect(getCanvasPixelSize(853.4, 612.6, 2)).toEqual({
			width: 1707,
			height: 1225,
		});
	});

	it("covers a wider viewport without changing the content aspect", () => {
		const size = getAspectPreservingCoverSize(16, 9, 4, 3);

		expect(size.width).toBe(16);
		expect(size.height).toBe(12);
		expect(size.width / size.height).toBeCloseTo(4 / 3);
	});

	it("covers a taller viewport without changing the content aspect", () => {
		const size = getAspectPreservingCoverSize(9, 16, 16, 9);

		expect(size.width).toBeCloseTo(16 * (16 / 9));
		expect(size.height).toBe(16);
		expect(size.width / size.height).toBeCloseTo(16 / 9);
	});

	it("keeps both balanced Stepwise blocks above the visualization", () => {
		const layout = getVisualCompositionLayout("balanced", 16 / 9);

		expect(layout.sounded.y + layout.sounded.height).toBeLessThan(2 / 3);
		expect(layout.complement.y + layout.complement.height).toBeLessThan(2 / 3);
		expect(layout.metadata.y).toBeLessThan(2 / 3);
	});

	it("creates a true vertical visualization column", () => {
		const layout = getVisualCompositionLayout("vertical-triptych", 16 / 9);

		expect(layout.visualization.height).toBe(1);
		expect(layout.visualization.width).toBeLessThan(1 / 3);
		expect(layout.visualizationVertical).toBe(true);
	});

	it("fits radial visuals into a centered square inside tall columns", () => {
		const rect = getSquareContainedRect(
			{ x: 0.345, y: 0, width: 0.31, height: 1 },
			1600,
			900,
		);

		expect(rect.width * 1600).toBeCloseTo(rect.height * 900);
		expect(rect.x + rect.width / 2).toBeCloseTo(0.5);
		expect(rect.y + rect.height / 2).toBeCloseTo(0.5);
	});

	it("supports visual columns on either side", () => {
		const left = getVisualCompositionLayout("visual-left", 16 / 9);
		const right = getVisualCompositionLayout("visual-right", 16 / 9);

		expect(left.visualization.x).toBe(0);
		expect(left.visualization.height).toBe(1);
		expect(right.visualization.x).toBeGreaterThan(0.5);
		expect(right.visualization.height).toBe(1);
	});

	it("falls back from narrow column layouts on portrait viewports", () => {
		expect(
			getVisualCompositionLayout("vertical-triptych", 9 / 16).resolvedPreset,
		).toBe("sandwich");
		expect(
			getVisualCompositionLayout("split-columns", 9 / 16).resolvedPreset,
		).toBe("balanced");
		expect(
			getVisualCompositionLayout("visual-left", 9 / 16).resolvedPreset,
		).toBe("sandwich");
	});
});
