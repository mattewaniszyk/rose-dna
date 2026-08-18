import { ChevronDownIcon, OrbitIcon } from "lucide-react";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
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
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					collisionPadding={12}
					sideOffset={10}
					className="scene-menu-panel rounded-3xl p-2"
				>
					<DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/55">
						Scene Background
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuRadioGroup
						value={backgroundMode}
						onValueChange={(value) => {
							if (!disabled) {
								onBackgroundModeChange(value as BackgroundMode);
							}
						}}
					>
						{BACKGROUND_OPTIONS.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								value={option.value}
								className="items-start rounded-2xl px-2 py-2.5 pr-9 focus:bg-white/8 focus:text-white"
							>
								<span className="flex flex-col gap-0.5">
									<span className="text-sm font-medium text-white/92">
										{option.label}
									</span>
									<span className="text-xs leading-relaxed text-white/55">
										{option.description}
									</span>
								</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/55">
						Rose Angle
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuRadioGroup
						value={roseAnglePreset}
						onValueChange={(value) => {
							if (!disabled) {
								onRoseAnglePresetChange(value as RoseAnglePreset);
							}
						}}
					>
						{ROSE_ANGLE_PRESET_OPTIONS.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								value={option.value}
								className="items-start rounded-2xl px-2 py-2.5 pr-9 focus:bg-white/8 focus:text-white"
							>
								<span className="flex flex-col gap-0.5">
									<span className="text-sm font-medium text-white/92">
										{option.label}
									</span>
									<span className="text-xs leading-relaxed text-white/55">
										{option.description}
									</span>
								</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/55">
						Rose Material
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuRadioGroup
						value={roseMaterialPreset}
						onValueChange={(value) => {
							if (!disabled) {
								onRoseMaterialPresetChange(
									value as RoseMaterialPreset,
								);
							}
						}}
					>
						{ROSE_MATERIAL_OPTIONS.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								value={option.value}
								className="items-start rounded-2xl px-2 py-2.5 pr-9 focus:bg-white/8 focus:text-white"
							>
								<span className="flex flex-col gap-0.5">
									<span className="text-sm font-medium text-white/92">
										{option.label}
									</span>
									<span className="text-xs leading-relaxed text-white/55">
										{option.description}
									</span>
								</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/55">
						Overlay Effect
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuRadioGroup
						value={overlayEffect}
						onValueChange={(value) => {
							if (!disabled) {
								onOverlayEffectChange(value as OverlayEffect);
							}
						}}
					>
						{OVERLAY_EFFECT_OPTIONS.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								value={option.value}
								className="items-start rounded-2xl px-2 py-2.5 pr-9 focus:bg-white/8 focus:text-white"
							>
								<span className="flex flex-col gap-0.5">
									<span className="text-sm font-medium text-white/92">
										{option.label}
									</span>
									<span className="text-xs leading-relaxed text-white/55">
										{option.description}
									</span>
								</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
