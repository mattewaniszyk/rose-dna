// @vitest-environment happy-dom

import { StrictMode, type ComponentType } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	LOADING_ANIMATION_DURATION,
	LOADING_CHARACTER_DELAY,
	LOADING_COMMAND,
	LOADING_DOT_CYCLE_DURATION,
	LOADING_DOT_TYPING_DELAY,
	LOADING_FADE_REMOVAL_DELAY,
	LOADING_REDUCED_MOTION_DURATION,
	Startup,
} from "./Startup";

vi.mock("./experience-assets", () => ({
	prefetchExperienceAssets: vi.fn(),
}));

type TestExperienceProps = {
	onReady?: () => void;
};

type TestExperienceModule = {
	default: ComponentType<TestExperienceProps>;
};

function TestExperience({ onReady }: TestExperienceProps) {
	return (
		<button type="button" onClick={onReady}>
			Mark experience ready
		</button>
	);
}

function createExperienceLoader() {
	return vi.fn(async () => ({
		default: TestExperience as ComponentType<TestExperienceProps>,
	}));
}

function setReducedMotion(matches: boolean) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) => ({
			matches: matches && query === "(prefers-reduced-motion: reduce)",
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	);
}

async function flushExperienceImport() {
	await act(async () => {
		await Promise.resolve();
	});
}

describe("Startup", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		vi.spyOn(performance, "now").mockImplementation(() => Date.now());
		vi.spyOn(window, "requestAnimationFrame").mockImplementation(
			(callback) =>
				window.setTimeout(() => callback(performance.now()), 16),
		);
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
			window.clearTimeout(handle);
		});
		setReducedMotion(false);
	});

	afterEach(() => {
		cleanup();
		document.head
			.querySelectorAll('link[data-rose-dna-prefetch="rose-model"]')
			.forEach((link) => link.remove());
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("types the command and dots at the existing timing boundaries", () => {
		const loadExperience = createExperienceLoader();
		const view = render(<Startup loadExperience={loadExperience} />);
		const copy = view.container.querySelector(".app-loading-copy");

		expect(copy?.textContent).toBe("");

		act(() => vi.advanceTimersByTime(LOADING_CHARACTER_DELAY * 4));
		expect(copy?.textContent).toBe("Run ");

		const commandTypingDuration =
			LOADING_CHARACTER_DELAY * LOADING_COMMAND.length;
		act(() =>
			vi.advanceTimersByTime(
				commandTypingDuration - LOADING_CHARACTER_DELAY * 4,
			),
		);
		expect(copy?.textContent).toBe(LOADING_COMMAND);

		act(() => vi.advanceTimersByTime(LOADING_DOT_TYPING_DELAY));
		expect(copy?.textContent).toBe(`${LOADING_COMMAND}.`);

		act(() => vi.advanceTimersByTime(LOADING_DOT_TYPING_DELAY));
		expect(copy?.textContent).toBe(`${LOADING_COMMAND}..`);

		act(() => vi.advanceTimersByTime(LOADING_DOT_TYPING_DELAY));
		expect(copy?.textContent).toBe(`${LOADING_COMMAND}...`);
		expect(loadExperience).not.toHaveBeenCalled();
	});

	it("does not mount the experience until the intro is complete", async () => {
		const loadExperience = createExperienceLoader();
		const view = render(<Startup loadExperience={loadExperience} />);

		act(() => vi.advanceTimersByTime(LOADING_ANIMATION_DURATION - 1));
		expect(loadExperience).not.toHaveBeenCalled();
		expect(
			view.queryByRole("button", { name: "Mark experience ready" }),
		).toBeNull();

		act(() => vi.advanceTimersByTime(1));
		await flushExperienceImport();

		expect(loadExperience).toHaveBeenCalledTimes(1);
		expect(
			view.getByRole("button", { name: "Mark experience ready" }),
		).toBeTruthy();
	});

	it("keeps cycling the dots when loading takes longer than the minimum intro", async () => {
		let resolveExperience:
			| ((module: TestExperienceModule) => void)
			| undefined;
		const loadExperience = vi.fn(
			() =>
				new Promise<TestExperienceModule>((resolve) => {
					resolveExperience = resolve;
				}),
		);
		const view = render(<Startup loadExperience={loadExperience} />);
		const copy = view.container.querySelector(".app-loading-copy");

		act(() => vi.advanceTimersByTime(LOADING_ANIMATION_DURATION));
		expect(loadExperience).toHaveBeenCalledTimes(1);
		expect(copy?.textContent).toBe(`${LOADING_COMMAND}.`);

		act(() => vi.advanceTimersByTime(LOADING_DOT_TYPING_DELAY - 20));
		expect(copy?.textContent).toBe(`${LOADING_COMMAND}..`);

		act(() =>
			vi.advanceTimersByTime(
				LOADING_DOT_CYCLE_DURATION - LOADING_DOT_TYPING_DELAY + 20,
			),
		);
		expect(copy?.textContent).toBe(`${LOADING_COMMAND}.`);

		resolveExperience?.({
			default: TestExperience as ComponentType<TestExperienceProps>,
		});
		await flushExperienceImport();
	});

	it("keeps the completed overlay until readiness and two painted frames", async () => {
		const view = render(
			<Startup loadExperience={createExperienceLoader()} />,
		);

		act(() => vi.advanceTimersByTime(LOADING_ANIMATION_DURATION));
		await flushExperienceImport();

		const overlay = view.getByRole("status");
		expect(overlay.classList.contains("is-leaving")).toBe(false);

		fireEvent.click(
			view.getByRole("button", { name: "Mark experience ready" }),
		);
		act(() => vi.advanceTimersByTime(31));
		expect(overlay.classList.contains("is-leaving")).toBe(false);

		act(() => vi.advanceTimersByTime(1));
		expect(overlay.classList.contains("is-leaving")).toBe(true);

		act(() => vi.advanceTimersByTime(LOADING_FADE_REMOVAL_DELAY));
		expect(view.queryByRole("status")).toBeNull();
	});

	it("uses the short static intro for reduced motion", async () => {
		setReducedMotion(true);
		const loadExperience = createExperienceLoader();
		const view = render(<Startup loadExperience={loadExperience} />);

		expect(
			view.container.querySelector(".app-loading-copy")?.textContent,
		).toBe(`${LOADING_COMMAND}...`);

		act(() =>
			vi.advanceTimersByTime(LOADING_REDUCED_MOTION_DURATION - 1),
		);
		expect(loadExperience).not.toHaveBeenCalled();

		act(() => vi.advanceTimersByTime(1));
		await flushExperienceImport();
		expect(loadExperience).toHaveBeenCalledTimes(1);
	});

	it("imports the experience only once under Strict Mode", async () => {
		const loadExperience = createExperienceLoader();
		render(
			<StrictMode>
				<Startup loadExperience={loadExperience} />
			</StrictMode>,
		);

		act(() => vi.advanceTimersByTime(LOADING_ANIMATION_DURATION));
		await flushExperienceImport();

		expect(loadExperience).toHaveBeenCalledTimes(1);
	});

	it("shows an accessible retry message when the app module fails", async () => {
		const loadExperience = vi.fn(() =>
			Promise.reject(new Error("chunk unavailable")),
		);
		const view = render(<Startup loadExperience={loadExperience} />);

		act(() => vi.advanceTimersByTime(LOADING_ANIMATION_DURATION));
		await flushExperienceImport();

		expect(view.getByRole("alert").textContent).toContain(
			"ROSE-DNA failed to load.",
		);
		expect(
			view.getByRole("button", { name: "Refresh to retry" }),
		).toBeTruthy();
	});
});
