import UnicornScene from "unicornstudio-react";

const UNICORN_SDK_URL =
	"https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.8/dist/unicornStudio.umd.js";

type UnicornBackgroundProps = {
	projectId: string;
};

export function UnicornBackground({ projectId }: UnicornBackgroundProps) {
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
			/>
		</div>
	);
}
