import { ChevronDownIcon, Layers3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	BOTTOM_VISUALIZATION_LABELS,
	BOTTOM_VISUALIZATION_MODES,
	VISUAL_LAYOUT_DESCRIPTIONS,
	VISUAL_LAYOUT_LABELS,
	VISUAL_LAYOUT_PRESETS,
	type BottomVisualizationMode,
	type VisualLayoutPreset,
} from "@/visualization/types";

type VisualLayersMenuProps = {
	bottomVisualizationEnabled: boolean;
	bottomVisualizationMode: BottomVisualizationMode;
	disabled: boolean;
	hasSequence: boolean;
	onBottomVisualizationEnabledChange: (enabled: boolean) => void;
	onBottomVisualizationModeChange: (mode: BottomVisualizationMode) => void;
	onStepwiseBackgroundEnabledChange: (enabled: boolean) => void;
	onVisualLayoutPresetChange: (preset: VisualLayoutPreset) => void;
	stepwiseBackgroundEnabled: boolean;
	visualLayoutPreset: VisualLayoutPreset;
};

export function VisualLayersMenu({
	bottomVisualizationEnabled,
	bottomVisualizationMode,
	disabled,
	hasSequence,
	onBottomVisualizationEnabledChange,
	onBottomVisualizationModeChange,
	onStepwiseBackgroundEnabledChange,
	onVisualLayoutPresetChange,
	stepwiseBackgroundEnabled,
	visualLayoutPreset,
}: VisualLayersMenuProps) {
	const layerSummary = stepwiseBackgroundEnabled
		? bottomVisualizationEnabled
			? `Stepwise + ${BOTTOM_VISUALIZATION_LABELS[bottomVisualizationMode]}`
			: "Stepwise"
		: bottomVisualizationEnabled
			? BOTTOM_VISUALIZATION_LABELS[bottomVisualizationMode]
			: "Both off";
	const activeSummary =
		stepwiseBackgroundEnabled && bottomVisualizationEnabled
			? `${VISUAL_LAYOUT_LABELS[visualLayoutPreset]} · ${layerSummary}`
			: layerSummary;

	return (
		<div className="visual-layers-menu">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="group h-11 min-w-[14rem] justify-between gap-3 rounded-full border-white/10 bg-black/55 pl-5 pr-4 text-left text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white sm:min-w-[16rem]"
					>
						<span className="flex min-w-0 items-center gap-3">
							<Layers3Icon className="size-4 shrink-0 text-white/65" />
							<span className="flex min-w-0 flex-col items-start gap-0.5">
								<span className="text-[0.64rem] font-medium uppercase tracking-[0.22em] text-white/55">
									Visual Layers
								</span>
								<span className="max-w-[12rem] truncate text-sm font-medium text-white/92">
									{activeSummary}
								</span>
							</span>
						</span>
						<ChevronDownIcon className="size-4 text-white/60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
					</Button>
				</PopoverTrigger>

				<PopoverContent align="end" sideOffset={10} className="visual-layers-panel">
					<header>
						<p className="audio-panel-eyebrow">Visual Layers</p>
						<h2 className="audio-panel-title">Sequence and sound feedback</h2>
					</header>

					<label className="visual-layer-toggle">
						<span>
							<strong>Stepwise Background</strong>
							<small>Scrolling sounded bases and generated complements behind the rose.</small>
						</span>
						<input
							type="checkbox"
							checked={stepwiseBackgroundEnabled}
							onChange={(event) =>
								onStepwiseBackgroundEnabledChange(event.target.checked)
							}
							disabled={disabled || !hasSequence}
						/>
					</label>

					<label className="visual-layer-toggle">
						<span>
							<strong>Audio Visualization</strong>
							<small>Independent Strudel or audio feedback placed by the selected composition.</small>
						</span>
						<input
							type="checkbox"
							checked={bottomVisualizationEnabled}
							onChange={(event) =>
								onBottomVisualizationEnabledChange(event.target.checked)
							}
							disabled={disabled || !hasSequence}
						/>
					</label>

					<label className="audio-field">
						<span className="audio-label">Visualization Mode</span>
						<select
							className="audio-select"
							value={bottomVisualizationMode}
							onChange={(event) =>
								onBottomVisualizationModeChange(
									event.target.value as BottomVisualizationMode,
								)
							}
							disabled={disabled || !hasSequence}
						>
							{BOTTOM_VISUALIZATION_MODES.map((mode) => (
								<option key={mode} value={mode}>
									{BOTTOM_VISUALIZATION_LABELS[mode]}
								</option>
							))}
						</select>
					</label>

					<label className="audio-field">
						<span className="audio-label">Composition</span>
						<select
							className="audio-select"
							value={visualLayoutPreset}
							onChange={(event) =>
								onVisualLayoutPresetChange(
									event.target.value as VisualLayoutPreset,
								)
							}
							disabled={
								disabled ||
								!hasSequence ||
								!stepwiseBackgroundEnabled ||
								!bottomVisualizationEnabled
							}
						>
							{VISUAL_LAYOUT_PRESETS.map((preset) => (
								<option key={preset} value={preset}>
									{VISUAL_LAYOUT_LABELS[preset]}
								</option>
							))}
						</select>
						<small className="visual-layout-description">
							{stepwiseBackgroundEnabled && bottomVisualizationEnabled
								? VISUAL_LAYOUT_DESCRIPTIONS[visualLayoutPreset]
								: "Enable both layers to arrange the two code regions and visualization together."}
						</small>
					</label>
				</PopoverContent>
			</Popover>
		</div>
	);
}
