// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackgroundMenu } from "./BackgroundMenu";

describe("BackgroundMenu", () => {
	afterEach(cleanup);

	it("keeps the scene popover open while changing settings", () => {
		const onBackgroundModeChange = vi.fn();
		const view = render(
			<BackgroundMenu
				backgroundMode="black"
				onBackgroundModeChange={onBackgroundModeChange}
				overlayEffect="none"
				onOverlayEffectChange={vi.fn()}
				roseAnglePreset="default"
				onRoseAnglePresetChange={vi.fn()}
				roseMaterialPreset="default"
				onRoseMaterialPresetChange={vi.fn()}
			/>,
		);
		const trigger = view.getByRole("button", { name: /Scene/ });

		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(
			view.getByRole("radio", {
				name: /Space Show the Unicorn Studio space scene/,
			}),
		);

		expect(onBackgroundModeChange).toHaveBeenCalledWith("space");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});
});
