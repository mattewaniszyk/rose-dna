import {
	StrictMode,
	useCallback,
	useEffect,
	useRef,
	useState,
	type ComponentType,
} from "react";
import { prefetchExperienceAssets } from "./experience-assets";
import "./Startup.css";

export const LOADING_COMMAND = "Run ROSE-DNA.exe //////// loading ";
export const LOADING_CHARACTER_DELAY = 52;
export const LOADING_MINIMUM_DOT_CYCLES = 5;
export const LOADING_DOT_TYPING_DELAY = 280;
export const LOADING_DOT_CYCLE_DURATION = 1_250;
export const LOADING_REDUCED_MOTION_DURATION = 650;
export const LOADING_FADE_REMOVAL_DELAY = 500;
export const LOADING_ANIMATION_DURATION =
	LOADING_CHARACTER_DELAY * LOADING_COMMAND.length +
	LOADING_MINIMUM_DOT_CYCLES * LOADING_DOT_CYCLE_DURATION +
	300;

type LoadingFrame = {
	at: number;
	text: string;
};

type ExperienceProps = {
	onReady?: () => void;
};

type ExperienceModule = {
	default: ComponentType<ExperienceProps>;
};

type StartupProps = {
	loadExperience?: () => Promise<ExperienceModule>;
};

function buildCommandFrames(): LoadingFrame[] {
	return Array.from(LOADING_COMMAND).map(
		(_, index) => ({
			at: LOADING_CHARACTER_DELAY * (index + 1),
			text: LOADING_COMMAND.slice(0, index + 1),
		}),
	);
}

const COMMAND_TYPING_DURATION =
	LOADING_CHARACTER_DELAY * LOADING_COMMAND.length;
const COMMAND_FRAMES = buildCommandFrames();

function getDotCycleState(elapsed: number) {
	const cycleElapsed =
		(elapsed - COMMAND_TYPING_DURATION) % LOADING_DOT_CYCLE_DURATION;
	const dotCount = Math.min(
		3,
		Math.floor(cycleElapsed / LOADING_DOT_TYPING_DELAY),
	);
	const nextCycleTransition =
		dotCount < 3
			? (dotCount + 1) * LOADING_DOT_TYPING_DELAY
			: LOADING_DOT_CYCLE_DURATION;

	return {
		text: `${LOADING_COMMAND}${".".repeat(dotCount)}`,
		nextTransition: elapsed - cycleElapsed + nextCycleTransition,
	};
}

function importExperience() {
	return import("./App.tsx");
}

export function Startup({ loadExperience = importExperience }: StartupProps) {
	const [displayedText, setDisplayedText] = useState("");
	const [introComplete, setIntroComplete] = useState(false);
	const [Experience, setExperience] =
		useState<ComponentType<ExperienceProps> | null>(null);
	const [experienceReady, setExperienceReady] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const [isLeaving, setIsLeaving] = useState(false);
	const [isOverlayVisible, setIsOverlayVisible] = useState(true);
	const importPromiseRef = useRef<Promise<ExperienceModule> | null>(null);

	useEffect(() => {
		prefetchExperienceAssets();
	}, []);

	useEffect(() => {
		if (experienceReady || loadError) {
			return;
		}

		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		let timeout = 0;
		let frameIndex = 0;
		let hasCompletedIntro = false;
		const startedAt = performance.now();
		const duration = prefersReducedMotion
			? LOADING_REDUCED_MOTION_DURATION
			: LOADING_ANIMATION_DURATION;

		if (prefersReducedMotion) {
			setDisplayedText(`${LOADING_COMMAND}...`);
		}

		const advance = () => {
			const elapsed = performance.now() - startedAt;
			let nextTransition = duration;

			if (!prefersReducedMotion) {
				if (elapsed < COMMAND_TYPING_DURATION) {
					let nextText: string | null = null;

					while (
						frameIndex < COMMAND_FRAMES.length &&
						COMMAND_FRAMES[frameIndex].at <= elapsed
					) {
						nextText = COMMAND_FRAMES[frameIndex].text;
						frameIndex += 1;
					}

					if (nextText !== null) {
						setDisplayedText(nextText);
					}

					nextTransition =
						COMMAND_FRAMES[frameIndex]?.at ?? COMMAND_TYPING_DURATION;
				} else {
					const dotCycle = getDotCycleState(elapsed);
					setDisplayedText(dotCycle.text);
					nextTransition = dotCycle.nextTransition;
				}
			}

			if (!hasCompletedIntro && elapsed >= duration) {
				hasCompletedIntro = true;
				setIntroComplete(true);
			}

			if (prefersReducedMotion && hasCompletedIntro) {
				return;
			}

			if (!hasCompletedIntro) {
				nextTransition = Math.min(nextTransition, duration);
			}

			timeout = window.setTimeout(
				advance,
				Math.max(0, nextTransition - elapsed),
			);
		};

		advance();

		return () => window.clearTimeout(timeout);
	}, [experienceReady, loadError]);

	useEffect(() => {
		if (!introComplete) {
			return;
		}

		let active = true;
		importPromiseRef.current ??= loadExperience();
		void importPromiseRef.current.then(
			(module) => {
				if (active) {
					setExperience(() => module.default);
				}
			},
			() => {
				if (active) {
					setLoadError(true);
				}
			},
		);

		return () => {
			active = false;
		};
	}, [introComplete, loadExperience]);

	useEffect(() => {
		if (!experienceReady || loadError) {
			return;
		}

		let firstPaintFrame = 0;
		let secondPaintFrame = 0;
		let removalTimeout = 0;

		firstPaintFrame = window.requestAnimationFrame(() => {
			secondPaintFrame = window.requestAnimationFrame(() => {
				setIsLeaving(true);
				removalTimeout = window.setTimeout(
					() => setIsOverlayVisible(false),
					LOADING_FADE_REMOVAL_DELAY,
				);
			});
		});

		return () => {
			window.cancelAnimationFrame(firstPaintFrame);
			window.cancelAnimationFrame(secondPaintFrame);
			window.clearTimeout(removalTimeout);
		};
	}, [experienceReady, loadError]);

	const handleExperienceReady = useCallback(() => {
		setExperienceReady(true);
	}, []);

	return (
		<>
			{Experience ? (
				<StrictMode>
					<Experience onReady={handleExperienceReady} />
				</StrictMode>
			) : null}
			{isOverlayVisible ? (
				<div
					className={`app-loading-overlay${isLeaving ? " is-leaving" : ""}`}
					role={loadError ? "alert" : "status"}
					aria-live={loadError ? "assertive" : "polite"}
				>
					{loadError ? (
						<div className="app-loading-error">
							<span>ROSE-DNA failed to load.</span>
							<button
								type="button"
								className="app-loading-retry"
								onClick={() => window.location.reload()}
							>
								Refresh to retry
							</button>
						</div>
					) : (
						<>
							<span className="app-loading-copy" aria-hidden="true">
								{displayedText}
								{displayedText.length < LOADING_COMMAND.length ? (
									<span className="app-loading-cursor" />
								) : null}
							</span>
							<span className="app-loading-accessible-copy">
								ROSE-DNA is loading.
							</span>
						</>
					)}
				</div>
			) : null}
		</>
	);
}
