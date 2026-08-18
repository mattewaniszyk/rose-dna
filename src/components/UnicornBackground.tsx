import UnicornScene from "unicornstudio-react";

const UNICORN_SDK_URL =
	"https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.8/dist/unicornStudio.umd.js";

type UnicornBackgroundProps = {
	projectId: string;
	onReady?: () => void;
};

export function UnicornBackground({
	projectId,
	onReady,
}: UnicornBackgroundProps) {
	return (
		<div className="unicorn-background" aria-hidden="true">
			<UnicornScene
				key={projectId}
				className="unicorn-background-canvas"
				projectId={projectId}
				sdkUrl={UNICORN_SDK_URL}
				width="100%"
				height="100%"
				lazyLoad={false}
				production={true}
				onLoad={onReady}
				onError={(error) => {
					console.warn(
						"[rose-dna] Unicorn background failed to load; continuing without it.",
						error,
					);
					onReady?.();
				}}
			/>
		</div>
	);
}
