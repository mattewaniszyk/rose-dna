import { CheckIcon, ChevronDownIcon, OrbitIcon } from "lucide-react";
import {
	BACKGROUND_MODE_LABELS,
	BACKGROUND_OPTIONS,
	type BackgroundMode,
} from "./background-mode";
import {
	OVERLAY_EFFECT_LABELS,
	OVERLAY_EFFECT_OPTIONS,
	type OverlayEffect,
} from "./overlay-effect";
import {
	ROSE_ANGLE_PRESET_LABELS,
	ROSE_ANGLE_PRESET_OPTIONS,
	type RoseAnglePreset,
} from "./rose-angle";
import {
	ROSE_MATERIAL_LABELS,
	ROSE_MATERIAL_OPTIONS,
	type RoseMaterialPreset,
} from "./rose-material";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SceneOption = {
	description: string;
	label: string;
	value: string;
};

type SceneOptionGroupProps = {
	disabled: boolean;
	label: string;
	name: string;
	onValueChange: (value: string) => void;
	options: readonly SceneOption[];
	value: string;
};

function SceneOptionGroup({
	disabled,
	label,
	name,
	onValueChange,
	options,
	value,
}: SceneOptionGroupProps) {
	return (
		<fieldset className="scene-option-group" disabled={disabled}>
			<legend className="scene-option-group-label">{label}</legend>
			<div className="scene-option-group-items">
				{options.map((option) => (
					<label className="scene-option" key={option.value}>
						<input
							className="scene-option-input"
							type="radio"
							name={name}
							value={option.value}
							checked={option.value === value}
							onChange={() => onValueChange(option.value)}
						/>
						<span className="scene-option-copy">
							<span className="scene-option-label">{option.label}</span>
							<span className="scene-option-description">
								{option.description}
							</span>
						</span>
						<CheckIcon className="scene-option-check" aria-hidden="true" />
					</label>
				))}
			</div>
		</fieldset>
	);
}

type BackgroundMenuProps = {
	disabled?: boolean;
	backgroundMode: BackgroundMode;
	onBackgroundModeChange: (backgroundMode: BackgroundMode) => void;
	roseAnglePreset: RoseAnglePreset;
	onRoseAnglePresetChange: (roseAnglePreset: RoseAnglePreset) => void;
	roseMaterialPreset: RoseMaterialPreset;
	onRoseMaterialPresetChange: (
		roseMaterialPreset: RoseMaterialPreset,
	) => void;
	overlayEffect: OverlayEffect;
	onOverlayEffectChange: (overlayEffect: OverlayEffect) => void;
};

export function BackgroundMenu({
	disabled = false,
	backgroundMode,
	onBackgroundModeChange,
	roseAnglePreset,
	onRoseAnglePresetChange,
	roseMaterialPreset,
	onRoseMaterialPresetChange,
	overlayEffect,
	onOverlayEffectChange,
}: BackgroundMenuProps) {
	// The summary already truncates at three labels, so the effect only earns a
	// slot once it is doing something.
	const summary = [
		BACKGROUND_MODE_LABELS[backgroundMode],
		ROSE_ANGLE_PRESET_LABELS[roseAnglePreset],
		ROSE_MATERIAL_LABELS[roseMaterialPreset],
		...(overlayEffect === "none"
			? []
			: [OVERLAY_EFFECT_LABELS[overlayEffect]]),
	].join(" · ");

	return (
		<div className="app-menu">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						disabled={disabled}
						variant="outline"
						className="group h-11 min-w-[14rem] justify-between gap-3 rounded-full border-white/10 bg-black/55 pl-5 pr-4 text-left text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white sm:min-w-[16rem]"
					>
						<span className="flex min-w-0 flex-1 items-center gap-3">
							<OrbitIcon className="size-4 shrink-0 text-white/65" />
							<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
								<span className="text-[0.64rem] font-medium uppercase tracking-[0.22em] text-white/55">
									Scene
								</span>
								<span className="w-full truncate text-sm font-medium text-white/92">
									{summary}
								</span>
							</span>
						</span>
						<ChevronDownIcon className="size-4 text-white/60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					collisionPadding={12}
					sideOffset={10}
					className="scene-menu-panel rounded-3xl p-2"
				>
					<SceneOptionGroup
						disabled={disabled}
						label="Scene Background"
						name="scene-background"
						options={BACKGROUND_OPTIONS}
						value={backgroundMode}
						onValueChange={(value) => {
							if (!disabled) {
								onBackgroundModeChange(value as BackgroundMode);
							}
						}}
					/>
					<div className="scene-option-separator" />
					<SceneOptionGroup
						disabled={disabled}
						label="Rose Angle"
						name="rose-angle"
						options={ROSE_ANGLE_PRESET_OPTIONS}
						value={roseAnglePreset}
						onValueChange={(value) => {
							if (!disabled) {
								onRoseAnglePresetChange(value as RoseAnglePreset);
							}
						}}
					/>
					<div className="scene-option-separator" />
					<SceneOptionGroup
						disabled={disabled}
						label="Rose Material"
						name="rose-material"
						options={ROSE_MATERIAL_OPTIONS}
						value={roseMaterialPreset}
						onValueChange={(value) => {
							if (!disabled) {
								onRoseMaterialPresetChange(
									value as RoseMaterialPreset,
								);
							}
						}}
					/>
					<div className="scene-option-separator" />
					<SceneOptionGroup
						disabled={disabled}
						label="Overlay Effect"
						name="overlay-effect"
						options={OVERLAY_EFFECT_OPTIONS}
						value={overlayEffect}
						onValueChange={(value) => {
							if (!disabled) {
								onOverlayEffectChange(value as OverlayEffect);
							}
						}}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
