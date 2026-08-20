// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VisualLayersMenu } from "./VisualLayersMenu";

describe("VisualLayersMenu", () => {
	afterEach(cleanup);

	it("does not autofocus the first layer control when the panel opens", () => {
		const view = render(
			<VisualLayersMenu
				bottomVisualizationEnabled
				bottomVisualizationMode="spiral"
				disabled={false}
				hasSequence
				onBottomVisualizationEnabledChange={vi.fn()}
				onBottomVisualizationModeChange={vi.fn()}
				onStepwiseBackgroundEnabledChange={vi.fn()}
				onVisualLayoutPresetChange={vi.fn()}
				stepwiseBackgroundEnabled
				visualLayoutPreset="balanced"
			/>,
		);

		fireEvent.click(view.getByRole("button", { name: /Visual Layers/ }));

		expect(document.activeElement).not.toBe(
			view.getByRole("checkbox", { name: /Stepwise Background/ }),
		);
		expect(document.activeElement).not.toBe(
			view.getByLabelText("Visualization Mode"),
		);
		expect(document.activeElement).toBe(view.getByRole("dialog"));
	});
});
