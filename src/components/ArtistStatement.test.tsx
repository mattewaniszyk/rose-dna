// @vitest-environment happy-dom

import { useState } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtistStatement } from "./ArtistStatement";

function ArtistStatementHarness() {
	const [isOpen, setIsOpen] = useState(false);

	return <ArtistStatement isOpen={isOpen} onOpenChange={setIsOpen} />;
}

describe("ArtistStatement", () => {
	afterEach(cleanup);
	afterEach(() => vi.useRealTimers());

	it("opens and closes the statement from its accessible toggle", () => {
		const view = render(<ArtistStatementHarness />);
		const openButton = view.getByRole("button", {
			name: "Show artist statement",
		});

		expect(openButton.getAttribute("aria-expanded")).toBe("false");
		expect(view.queryByRole("dialog")).toBeNull();

		fireEvent.click(openButton);

		expect(
			view.getByRole("dialog", { name: "LOAD //////// ARTIST STATEMENT" }),
		).toBeTruthy();
		const closeButton = view.getByRole("button", {
			name: "Hide artist statement",
		});
		expect(closeButton.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(closeButton);

		expect(view.queryByRole("dialog")).toBeNull();
	});

	it("closes the open statement with Escape", () => {
		const view = render(<ArtistStatementHarness />);

		fireEvent.click(
			view.getByRole("button", { name: "Show artist statement" }),
		);
		fireEvent.keyDown(document, { key: "Escape" });

		expect(view.queryByRole("dialog")).toBeNull();
		expect(
			view.getByRole("button", { name: "Show artist statement" }),
		).toBeTruthy();
	});

	it("types the full statement only on its first opening", () => {
		vi.useFakeTimers();
		const view = render(<ArtistStatementHarness />);

		fireEvent.click(
			view.getByRole("button", { name: "Show artist statement" }),
		);
		const typingCopy = view.container.querySelector(
			".artist-statement-typing-copy",
		);
		expect(typingCopy?.textContent).toBe("");

		act(() => vi.advanceTimersByTime(34 * 4));
		expect(typingCopy?.textContent).toBe("LOAD");

		act(() => vi.runAllTimers());
		expect(
			view.container.querySelector(".artist-statement-typing-copy"),
		).toBeNull();

		fireEvent.click(
			view.getByRole("button", { name: "Hide artist statement" }),
		);
		fireEvent.click(
			view.getByRole("button", { name: "Show artist statement" }),
		);

		expect(
			view.container.querySelector(".artist-statement-typing-copy"),
		).toBeNull();
		expect(
			view.getByRole("heading", {
				name: "LOAD //////// ARTIST STATEMENT",
			}),
		).toBeTruthy();
	});

	it("exposes the acknowledgement links", () => {
		vi.useFakeTimers();
		const view = render(<ArtistStatementHarness />);

		fireEvent.click(
			view.getByRole("button", { name: "Show artist statement" }),
		);
		act(() => vi.runAllTimers());

		expect(
			view
				.getByRole("link", {
					name: "https://en.wikipedia.org/wiki/FASTQ_format",
				})
				.getAttribute("href"),
		).toBe("https://en.wikipedia.org/wiki/FASTQ_format");
		expect(
			view
				.getByRole("link", {
					name: "https://doi.org/10.1162/LEON.e.2578",
				})
				.getAttribute("href"),
		).toBe("https://doi.org/10.1162/LEON.e.2578");
	});
});
