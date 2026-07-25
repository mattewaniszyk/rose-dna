import { ChevronDownIcon } from "lucide-react";
import {
	BACKGROUND_MODE_LABELS,
	BACKGROUND_OPTIONS,
	type BackgroundMode,
} from "./background-mode";
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
	backgroundMode: BackgroundMode;
	onBackgroundModeChange: (backgroundMode: BackgroundMode) => void;
	roseAnglePreset: RoseAnglePreset;
	onRoseAnglePresetChange: (roseAnglePreset: RoseAnglePreset) => void;
	roseMaterialPreset: RoseMaterialPreset;
	onRoseMaterialPresetChange: (
		roseMaterialPreset: RoseMaterialPreset,
	) => void;
};

export function BackgroundMenu({
	backgroundMode,
	onBackgroundModeChange,
	roseAnglePreset,
	onRoseAnglePresetChange,
	roseMaterialPreset,
	onRoseMaterialPresetChange,
}: BackgroundMenuProps) {
	return (
		<div className="app-menu">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						className="group h-11 min-w-[14rem] justify-between rounded-full border-white/10 bg-black/55 px-3 text-left text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white sm:min-w-[16rem]"
					>
						<span className="flex min-w-0 flex-col items-start gap-0.5">
							<span className="text-[0.64rem] font-medium uppercase tracking-[0.22em] text-white/55">
								Scene
							</span>
							<span className="max-w-[12.5rem] truncate text-sm font-medium text-white/92 sm:max-w-[15.5rem]">
								{BACKGROUND_MODE_LABELS[backgroundMode]} ·{" "}
								{ROSE_ANGLE_PRESET_LABELS[roseAnglePreset]} ·{" "}
								{ROSE_MATERIAL_LABELS[roseMaterialPreset]}
							</span>
						</span>
						<ChevronDownIcon className="size-4 text-white/60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					sideOffset={10}
					className="w-72 min-w-72 rounded-3xl border border-white/10 bg-black/80 p-2 text-white shadow-[0_22px_65px_rgba(0,0,0,0.48)] backdrop-blur-xl"
				>
					<DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/55">
						Scene Background
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="mx-1 bg-white/10" />
					<DropdownMenuRadioGroup
						value={backgroundMode}
						onValueChange={(value) =>
							onBackgroundModeChange(value as BackgroundMode)
						}
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
						onValueChange={(value) =>
							onRoseAnglePresetChange(value as RoseAnglePreset)
						}
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
						onValueChange={(value) =>
							onRoseMaterialPresetChange(
								value as RoseMaterialPreset,
							)
						}
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
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
