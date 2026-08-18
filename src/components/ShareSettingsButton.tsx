import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyStatus = "idle" | "copied" | "error";

type ShareSettingsButtonProps = {
	url: string;
};

function copyWithTextarea(value: string) {
	const textarea = document.createElement("textarea");
	textarea.value = value;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.append(textarea);
	textarea.select();

	try {
		if (!document.execCommand("copy")) {
			throw new Error("The browser did not copy the settings link.");
		}
	} finally {
		textarea.remove();
	}
}

async function copyText(value: string) {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(value);
			return;
		} catch {
			// Clipboard access can be unavailable outside a secure context.
		}
	}

	copyWithTextarea(value);
}

export function ShareSettingsButton({ url }: ShareSettingsButtonProps) {
	const [status, setStatus] = useState<CopyStatus>("idle");
	const resetTimerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (resetTimerRef.current !== null) {
				window.clearTimeout(resetTimerRef.current);
			}
		};
	}, []);

	const handleCopy = async () => {
		if (resetTimerRef.current !== null) {
			window.clearTimeout(resetTimerRef.current);
		}

		try {
			await copyText(url);
			setStatus("copied");
		} catch {
			setStatus("error");
		}

		resetTimerRef.current = window.setTimeout(() => {
			setStatus("idle");
			resetTimerRef.current = null;
		}, 2400);
	};

	const label =
		status === "copied"
			? "Settings link copied"
			: status === "error"
				? "Could not copy link"
				: "Copy Settings Link";
	const StatusIcon =
		status === "copied"
			? CheckIcon
			: status === "error"
				? TriangleAlertIcon
				: CopyIcon;

	return (
		<div className="share-settings-control">
			<Button
				type="button"
				variant="outline"
				className="h-11 w-fit justify-between gap-3 rounded-full border-white/10 bg-black/55 px-4 text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white"
				onClick={() => void handleCopy()}
			>
				<span className="utility-action-label" aria-live="polite">
					{label}
				</span>
				<StatusIcon className="size-4" aria-hidden="true" />
			</Button>
		</div>
	);
}
