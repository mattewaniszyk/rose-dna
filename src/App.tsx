import { useState } from "react";
import "./App.css";
import { BackgroundMenu } from "./components/BackgroundMenu";
import {
	BACKGROUND_MODE_PROJECT_IDS,
	type BackgroundMode,
} from "./components/background-mode";
import type { RoseAnglePreset } from "./components/rose-angle";
import type { RoseMaterialPreset } from "./components/rose-material";
import { RoseScene } from "./components/RoseScene";
import { UnicornBackground } from "./components/UnicornBackground";

function App() {
	const [backgroundMode, setBackgroundMode] =
		useState<BackgroundMode>("space");
	const [roseAnglePreset, setRoseAnglePreset] =
		useState<RoseAnglePreset>("default");
	const [roseMaterialPreset, setRoseMaterialPreset] =
		useState<RoseMaterialPreset>("default");
	const unicornProjectId = BACKGROUND_MODE_PROJECT_IDS[backgroundMode];

	return (
		<main className="app-shell" data-background-mode={backgroundMode}>
			{unicornProjectId ? (
				<UnicornBackground
					key={backgroundMode}
					projectId={unicornProjectId}
				/>
			) : null}
			<RoseScene
				backgroundMode={backgroundMode}
				roseAnglePreset={roseAnglePreset}
				roseMaterialPreset={roseMaterialPreset}
			/>
			<div className="app-overlay">
				<BackgroundMenu
					backgroundMode={backgroundMode}
					onBackgroundModeChange={setBackgroundMode}
					roseAnglePreset={roseAnglePreset}
					onRoseAnglePresetChange={setRoseAnglePreset}
					roseMaterialPreset={roseMaterialPreset}
					onRoseMaterialPresetChange={setRoseMaterialPreset}
				/>
			</div>
		</main>
	);
}

export default App;
