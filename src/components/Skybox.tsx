import { BackSide } from "three";
import type { BackgroundMode } from "./background-mode";

type SkyboxProps = {
	backgroundMode: BackgroundMode;
};

export function Skybox({ backgroundMode }: SkyboxProps) {
	if (backgroundMode !== "black") {
		return null;
	}

	return <BlackSkybox />;
}

function BlackSkybox() {
	return (
		<mesh scale={[60, 60, 60]}>
			<boxGeometry args={[1, 1, 1]} />
			<meshBasicMaterial
				color="#000000"
				side={BackSide}
				fog={false}
				toneMapped={false}
			/>
		</mesh>
	);
}
