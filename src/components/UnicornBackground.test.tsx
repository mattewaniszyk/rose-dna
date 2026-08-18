// @vitest-environment happy-dom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnicornBackground } from "./UnicornBackground";

const unicornSceneState = vi.hoisted(() => ({
	props: null as null | {
		onError?: (error: Error) => void;
		onLoad?: () => void;
	},
}));

vi.mock("unicornstudio-react", () => ({
	default: (props: typeof unicornSceneState.props) => {
		unicornSceneState.props = props;
		return <div data-testid="unicorn-scene" />;
	},
}));

describe("UnicornBackground", () => {
	afterEach(() => {
		cleanup();
		unicornSceneState.props = null;
		vi.restoreAllMocks();
	});

	it("settles startup readiness when the background loads", () => {
		const onReady = vi.fn();
		render(<UnicornBackground projectId="project" onReady={onReady} />);

		act(() => unicornSceneState.props?.onLoad?.());

		expect(onReady).toHaveBeenCalledTimes(1);
	});

	it("settles startup readiness when the background fails", () => {
		const onReady = vi.fn();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		render(<UnicornBackground projectId="project" onReady={onReady} />);

		act(() =>
			unicornSceneState.props?.onError?.(new Error("background unavailable")),
		);

		expect(onReady).toHaveBeenCalledTimes(1);
	});
});
