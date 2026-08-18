import {
	AudioLinesIcon,
	ChevronDownIcon,
	FileMusicIcon,
	FilmIcon,
	Loader2Icon,
	PauseIcon,
	PlayIcon,
	SquareIcon,
	XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	CANONICAL_BASES,
	DEFAULT_VOICE_SETTINGS,
	GROUP_ENDING_MODES,
	TIME_SIGNATURES,
	VOICE_PRESET_DEFINITIONS,
	VOICE_PRESET_FAMILIES,
	VOICE_PRESET_IDS,
	type CanonicalBase,
	type GroupEndingMode,
	type TimeSignature,
	type VoicePresetId,
	type VoiceSettings,
} from "@/audio/types";
import type { GenomicAudioController } from "@/hooks/useGenomicAudio";
import {
	VIDEO_ASPECT_RATIOS,
	VIDEO_ASPECT_RATIO_CONFIGS,
	VIDEO_QUALITY_CONFIGS,
	VIDEO_QUALITY_PRESETS,
	type VideoAspectRatio,
	type VideoQualityPreset,
} from "@/audio/video-export-options";

type AudioPanelProps = {
	audio: GenomicAudioController;
};

type NumericAudioControlProps = {
	disabled: boolean;
	help: string;
	id: string;
	label: string;
	max: number;
	min: number;
	onChange: (value: number) => void;
	scale?: "linear" | "logarithmic";
	value: number;
};

function valueToSliderPosition(
	value: number,
	min: number,
	max: number,
	scale: NumericAudioControlProps["scale"],
) {
	if (scale !== "logarithmic") {
		return value;
	}

	const boundedValue = Math.max(min, Math.min(max, value));
	return Math.round(
		(Math.log(boundedValue / min) / Math.log(max / min)) * 100
	);
}

function sliderPositionToValue(
	position: number,
	min: number,
	max: number,
	scale: NumericAudioControlProps["scale"],
) {
	if (scale !== "logarithmic") {
		return Math.round(position);
	}

	return Math.round(min * (max / min) ** (position / 100));
}

function NumericAudioControl({
	disabled,
	help,
	id,
	label,
	max,
	min,
	onChange,
	scale = "linear",
	value,
}: NumericAudioControlProps) {
	const helpId = `${id}-help`;
	const sliderValue = valueToSliderPosition(value, min, max, scale);
	const sliderMin = scale === "logarithmic" ? 0 : min;
	const sliderMax = scale === "logarithmic" ? 100 : max;

	return (
		<div className="audio-field">
			<div className="audio-control-heading">
				<label className="audio-label" htmlFor={id}>
					{label}
				</label>
				<input
					type="number"
					className="audio-value-input"
					aria-label={`${label} exact value`}
					aria-describedby={helpId}
					min={min}
					max={max}
					value={value}
					onChange={(event) => onChange(Number(event.target.value || 0))}
					disabled={disabled}
				/>
			</div>
			<input
				id={id}
				type="range"
				className="audio-control-range"
				aria-describedby={helpId}
				aria-valuetext={String(value)}
				min={sliderMin}
				max={sliderMax}
				step={1}
				value={sliderValue}
				onChange={(event) =>
					onChange(
						sliderPositionToValue(
							Number(event.target.value),
							min,
							max,
							scale,
						),
					)
				}
				disabled={disabled}
			/>
			<p className="audio-field-help" id={helpId}>
				{help}
			</p>
		</div>
	);
}

type VoiceControlProps = {
	base: CanonicalBase;
	disabled: boolean;
	isPreviewing: boolean;
	onOctaveChange: (value: number) => void;
	onPresetChange: (value: VoicePresetId) => void;
	onPreview: () => void;
	onVolumeChange: (value: number) => void;
	settings: VoiceSettings;
};

function VoiceControl({
	base,
	disabled,
	isPreviewing,
	onOctaveChange,
	onPresetChange,
	onPreview,
	onVolumeChange,
	settings,
}: VoiceControlProps) {
	const descriptionId = `voice-${base.toLowerCase()}-help`;

	return (
		<fieldset className="audio-voice-card" disabled={disabled}>
			<legend className="sr-only">DNA base {base} voice</legend>
			<div className="audio-voice-heading">
				<span className="audio-base-badge" aria-hidden="true">
					{base}
				</span>
				<label className="audio-voice-preset">
					<span className="audio-label">Instrument</span>
					<select
						className="audio-select"
						aria-describedby={descriptionId}
						value={settings.preset}
						onChange={(event) =>
							onPresetChange(event.target.value as VoicePresetId)
						}
					>
						{VOICE_PRESET_FAMILIES.map((family) => (
							<optgroup key={family} label={family}>
								{VOICE_PRESET_IDS.filter(
									(preset) =>
										VOICE_PRESET_DEFINITIONS[preset].family ===
										family,
								).map((preset) => (
									<option key={preset} value={preset}>
										{VOICE_PRESET_DEFINITIONS[preset].label}
									</option>
								))}
							</optgroup>
						))}
					</select>
				</label>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="audio-voice-preview"
					title={`${isPreviewing ? "Stop" : "Preview"} ${VOICE_PRESET_DEFINITIONS[settings.preset].label}`}
					aria-label={`${isPreviewing ? "Stop previewing" : "Preview"} ${VOICE_PRESET_DEFINITIONS[settings.preset].label} for base ${base}`}
					aria-pressed={isPreviewing}
					onClick={onPreview}
				>
					{isPreviewing ? (
						<SquareIcon className="size-3.5" />
					) : (
						<PlayIcon className="size-3.5" />
					)}
				</Button>
			</div>

			<div className="audio-voice-tuning">
				<label className="audio-voice-slider">
					<span className="audio-control-heading">
						<span className="audio-label">Volume</span>
						<span className="audio-voice-value">
							{settings.volumeDb} dB
						</span>
					</span>
					<input
						type="range"
						className="audio-control-range"
						aria-describedby={descriptionId}
						min={-30}
						max={0}
						step={1}
						value={settings.volumeDb}
						onChange={(event) =>
							onVolumeChange(Number(event.target.value))
						}
					/>
				</label>

				<label className="audio-voice-slider">
					<span className="audio-control-heading">
						<span className="audio-label">Octave</span>
						<span className="audio-voice-value">
							{settings.octaveShift > 0 ? "+" : ""}
							{settings.octaveShift}
						</span>
					</span>
					<input
						type="range"
						className="audio-control-range"
						aria-describedby={descriptionId}
						min={-2}
						max={2}
						step={1}
						value={settings.octaveShift}
						onChange={(event) =>
							onOctaveChange(Number(event.target.value))
						}
					/>
				</label>
			</div>

			<p className="audio-field-help" id={descriptionId}>
				Every {base} base uses this instrument, relative loudness, and
				pitch shift. Preview plays its FluidR3 sampled sound before
				mapping.
			</p>
		</fieldset>
	);
}

function formatSeconds(seconds: number) {
	if (!Number.isFinite(seconds) || seconds <= 0) {
		return "0:00";
	}

	const rounded = Math.floor(seconds);
	const minutes = Math.floor(rounded / 60);
	const remainder = rounded % 60;

	return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function getStatusLabel(audio: GenomicAudioController) {
	if (audio.isPreparingVoices) {
		return "Loading instrument samples";
	}

	if (audio.exportStatus === "exporting") {
		return {
			"rendering-audio": "Rendering audio",
			"preparing-scene": "Preparing scene",
			"recording-video": "Recording video",
			"loading-encoder": "Loading encoder",
			"encoding-mp3": "Encoding MP3",
			"encoding-mp4": "Encoding MP4",
		}[audio.exportStage ?? "rendering-audio"];
	}

	if (audio.isPlaying) {
		return `Playing · ${audio.audioContextState} · ${audio.playbackTriggerCount}`;
	}

	if (audio.buildError || audio.exportError) {
		return "Error";
	}

	if (audio.exportStatus === "done") {
		return `${audio.exportKind?.toUpperCase() ?? "Export"} ready`;
	}

	if (audio.buildStatus === "ready") {
		return "Ready";
	}

	if (audio.buildStatus === "loading") {
		return "Loading & mapping";
	}

	if (audio.buildStatus === "error" || audio.exportStatus === "error") {
		return "Error";
	}

	return "Not mapped";
}

export function AudioPanel({ audio }: AudioPanelProps) {
	const runtimeSeconds = audio.sequence?.runtimeSeconds ?? 0;
	const hasSequence = Boolean(audio.sequence && audio.sequence.events.length);
	const isLoading = audio.buildStatus === "loading";
	const isExporting = audio.exportStatus === "exporting";
	const statusLabel = getStatusLabel(audio);
	const triggerRuntime =
		audio.sequence?.runtimeSeconds ??
		audio.mappingOptions.targetRuntimeSeconds;
	const selectedTimeSignature =
		audio.mappingOptions.timeSignature ?? "4/4";
	const accentStrengthPercent =
		audio.mappingOptions.accentStrengthPercent ?? 100;
	const groupEndingLengthSteps =
		audio.mappingOptions.groupEndingLengthSteps ?? 1;
	const groupEndingMode =
		audio.mappingOptions.groupEndingMode ?? "sustain";
	const voiceSettings =
		audio.mappingOptions.voiceSettings ?? DEFAULT_VOICE_SETTINGS;
	const videoAspectConfig =
		VIDEO_ASPECT_RATIO_CONFIGS[audio.videoAspectRatio];
	const videoQualityConfig = VIDEO_QUALITY_CONFIGS[audio.videoQuality];

	return (
		<div className="audio-menu">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="group h-11 min-w-[14rem] justify-between gap-3 rounded-full border-white/10 bg-black/55 pl-5 pr-4 text-left text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white sm:min-w-[16rem]"
					>
						<span className="flex min-w-0 flex-1 items-center gap-3">
							<AudioLinesIcon className="size-4 shrink-0 text-white/65" />
							<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
								<span className="text-[0.64rem] font-medium uppercase tracking-[0.22em] text-white/55">
									Audio
								</span>
								<span className="w-full truncate text-sm font-medium text-white/92">
									{audio.activeFixture?.label ?? "Genomic audio"}{" "}
									· {selectedTimeSignature} ·{" "}
									{formatSeconds(triggerRuntime)} ·{" "}
									{statusLabel}
								</span>
							</span>
						</span>
						<ChevronDownIcon className="size-4 text-white/60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
					</Button>
				</PopoverTrigger>

				<PopoverContent
					align="end"
					sideOffset={10}
					collisionPadding={12}
					className="audio-panel"
				>
					<header className="audio-panel-header">
						<div>
							<p className="audio-panel-eyebrow">Genomic Audio</p>
							<h2 className="audio-panel-title">
								FASTQ to MIDI, MP3, and MP4
							</h2>
						</div>
						<div className="audio-panel-status">{statusLabel}</div>
					</header>

					<div className="audio-mapping-guide">
						<p className="audio-mapping-guide-title">
							How the DNA becomes sound
						</p>
						<p>
							Each A, C, G, or T becomes a note in its own sampled
							voice. R1 reads use a lower pitch range, R2 reads use a
							higher range, and FASTQ quality controls loudness. Playback
							and MP3 use FluidR3 sounds; MIDI uses the corresponding
							General MIDI program.
						</p>
					</div>

					<div className="audio-grid">
						<label
							className="audio-label"
							htmlFor="fastq-fixture-select"
						>
							Fixture Pair
						</label>
						<select
							id="fastq-fixture-select"
							aria-describedby="fastq-fixture-description fastq-fixture-help"
							className="audio-select"
							value={audio.selectedFixtureId}
							onChange={(event) =>
								audio.setSelectedFixtureId(event.target.value)
							}
							disabled={isLoading || isExporting}
						>
							{audio.fixtures.map((fixture) => (
								<option key={fixture.id} value={fixture.id}>
									{fixture.label}
								</option>
							))}
						</select>

						<p
							className="audio-caption"
							id="fastq-fixture-description"
						>
							{audio.activeFixture?.description ??
								"No fixture selected."}
						</p>
						<p className="audio-field-help" id="fastq-fixture-help">
							Chooses a paired DNA sample. R1 and R2 are two sequencing
							directions from that sample, and both contribute notes.
						</p>

						<section
							className="audio-voice-section"
							aria-labelledby="audio-voice-section-title"
						>
							<div>
								<p
									className="audio-label"
									id="audio-voice-section-title"
								>
									Base Voices
								</p>
								<p className="audio-field-help">
									Assign each DNA letter an instrument. Volume balances
									that letter against the others; octave moves all of its
									notes up or down without changing the DNA mapping. Samples
									download and cache on first use.
								</p>
							</div>
							<div className="audio-voice-list">
								{CANONICAL_BASES.map((base) => (
									<VoiceControl
										key={base}
										base={base}
										settings={
											voiceSettings[base] ??
											DEFAULT_VOICE_SETTINGS[base]
										}
										disabled={isLoading || isExporting}
										isPreviewing={audio.previewingBase === base}
										onPresetChange={(preset) =>
											audio.setVoicePreset(base, preset)
										}
										onVolumeChange={(volumeDb) =>
											audio.setVoiceVolumeDb(base, volumeDb)
										}
										onOctaveChange={(octaveShift) =>
											audio.setVoiceOctaveShift(base, octaveShift)
										}
										onPreview={() =>
											void (audio.previewingBase === base
												? audio.stopVoicePreview()
												: audio.previewVoice(base))
										}
									/>
								))}
							</div>
						</section>

						<div className="audio-field-grid">
							<NumericAudioControl
								id="reads-per-file"
								label="Reads / File"
								min={4}
								max={2000}
								scale="logarithmic"
								value={audio.parseOptions.maxReadsPerFile}
								onChange={audio.setMaxReadsPerFile}
								disabled={isLoading || isExporting}
								help="Keeps this many reads from each R1/R2 file. More reads bring more DNA regions into the pool used to choose notes."
							/>

							<NumericAudioControl
								id="read-stride"
								label="Read Stride"
								min={1}
								max={5000}
								scale="logarithmic"
								value={audio.parseOptions.readStride}
								onChange={audio.setReadStride}
								disabled={isLoading || isExporting}
								help="Keeps every Nth read. A larger stride samples DNA from positions farther apart in the FASTQ file."
							/>

							<NumericAudioControl
								id="bases-per-read"
								label="Bases / Read"
								min={8}
								max={250}
								value={audio.mappingOptions.maxBasesPerRead}
								onChange={audio.setMaxBasesPerRead}
								disabled={isLoading || isExporting}
								help="Examines the first N DNA letters in each read. Later base positions broaden the note pool and can raise the pitch."
							/>

							<NumericAudioControl
								id="tempo-bpm"
								label="Tempo (BPM)"
								min={48}
								max={180}
								value={audio.mappingOptions.tempoBpm}
								onChange={audio.setTempoBpm}
								disabled={isLoading || isExporting}
								help="Sets the musical pulse and note density. Higher BPM fits more DNA notes into the same runtime and is stored in MIDI."
							/>

							<label className="audio-field audio-field-wide">
								<span className="audio-label">Time Signature</span>
								<select
									className="audio-select"
									aria-describedby="time-signature-help"
									value={selectedTimeSignature}
									onChange={(event) =>
										audio.setTimeSignature(
											event.target.value as TimeSignature,
										)
									}
									disabled={isLoading || isExporting}
								>
									{TIME_SIGNATURES.map((timeSignature) => (
										<option key={timeSignature} value={timeSignature}>
											{timeSignature}
										</option>
									))}
								</select>
								<span
									className="audio-field-help"
									id="time-signature-help"
								>
									Groups notes into measures and rhythmic pulses. 6/8 has
									two main pulses; 7/8 uses a 2+2+3 grouping. MIDI stores
									this meter.
								</span>
							</label>

							<label className="audio-field audio-field-wide">
								<span className="audio-label">Group Ending</span>
								<select
									className="audio-select"
									aria-describedby="group-ending-help"
									value={groupEndingMode}
									onChange={(event) =>
										audio.setGroupEndingMode(
											event.target.value as GroupEndingMode,
										)
									}
									disabled={isLoading || isExporting}
								>
									{GROUP_ENDING_MODES.map((mode) => (
										<option key={mode} value={mode}>
											{mode === "sustain" ? "Sustain" : "Breath"}
										</option>
									))}
								</select>
								<span
									className="audio-field-help"
									id="group-ending-help"
								>
									Sustain holds the preceding DNA note into the next group;
									Breath leaves the same space silent.
								</span>
							</label>

							<NumericAudioControl
								id="accent-strength"
								label="Accent Strength (%)"
								min={0}
								max={100}
								value={accentStrengthPercent}
								onChange={audio.setAccentStrengthPercent}
								disabled={isLoading || isExporting}
								help="Controls how strongly downbeats and group pulses stand out. At 0%, FASTQ quality alone sets note loudness."
							/>

							<NumericAudioControl
								id="group-ending-length"
								label={`${groupEndingMode === "sustain" ? "Sustain" : "Breath"} (Steps)`}
								min={0}
								max={2}
								value={groupEndingLengthSteps}
								onChange={audio.setGroupEndingLengthSteps}
								disabled={isLoading || isExporting}
								help={
									groupEndingMode === "sustain"
										? "Holds the final note for 0–2 additional sixteenth-note steps before the next rhythmic group."
										: "Leaves 0–2 sixteenth-note gaps before each rhythmic group."
								}
							/>
						</div>

						<label className="audio-field">
							<span className="audio-label">
								Runtime (seconds)
							</span>
							<span className="audio-range-row">
								<input
									type="range"
									className="audio-range"
									aria-describedby="runtime-help"
									min={30}
									max={180}
									step={15}
									value={
										audio.mappingOptions.targetRuntimeSeconds
									}
									onChange={(event) =>
										audio.setTargetRuntimeSeconds(
											Number(event.target.value),
										)
									}
									disabled={isLoading || isExporting}
								/>
								<span className="audio-range-value">
									{formatSeconds(
										audio.mappingOptions.targetRuntimeSeconds,
									)}
								</span>
							</span>
							<span className="audio-field-help" id="runtime-help">
								Sets the exact loop, MP3, and MP4 length. Selected DNA bases
								are spread across this duration; MIDI uses the same sequence.
							</span>
						</label>

						<label className="audio-field">
							<span className="audio-label">MP4 Aspect Ratio</span>
							<select
								className="audio-select"
								aria-describedby="video-aspect-ratio-help"
								value={audio.videoAspectRatio}
								onChange={(event) =>
									audio.setVideoAspectRatio(
										event.target.value as VideoAspectRatio,
									)
								}
								disabled={isExporting}
							>
								{VIDEO_ASPECT_RATIOS.map((aspectRatio) => (
									<option key={aspectRatio} value={aspectRatio}>
										{VIDEO_ASPECT_RATIO_CONFIGS[aspectRatio].label}
									</option>
								))}
							</select>
							<span
								className="audio-field-help"
								id="video-aspect-ratio-help"
							>
								Center-crops the live scene to fill the selected frame. The MP4
								stores an explicit {audio.videoAspectRatio} display ratio.
							</span>
						</label>

						<label className="audio-field">
							<span className="audio-label">MP4 Quality</span>
							<select
								className="audio-select"
								aria-describedby="video-quality-help"
								value={audio.videoQuality}
								onChange={(event) =>
									audio.setVideoQuality(
										event.target.value as VideoQualityPreset,
									)
								}
								disabled={isExporting}
							>
								{VIDEO_QUALITY_PRESETS.map((quality) => (
									<option key={quality} value={quality}>
										{VIDEO_QUALITY_CONFIGS[quality].label} ·{" "}
										{VIDEO_QUALITY_CONFIGS[quality].description}
									</option>
								))}
							</select>
							<span className="audio-field-help" id="video-quality-help">
								{videoQualityConfig.description}. Near-lossless minimizes visible
								compression but can create very large files; the browser recording
								stage prevents a mathematically lossless result.
							</span>
						</label>

						<Button
							variant="secondary"
							size="sm"
							className="audio-action"
							onClick={() => void audio.loadSelectedFixture()}
							disabled={isLoading || isExporting}
						>
							{isLoading ? (
								<>
									<Loader2Icon className="size-3.5 animate-spin" />
									Loading & mapping...
								</>
							) : (
								"Load and Map"
							)}
						</Button>
					</div>

					<div className="audio-transport">
						<div className="audio-runtime-row">
							<span>
								Runtime {formatSeconds(audio.playbackSeconds)} /{" "}
								{formatSeconds(runtimeSeconds)}
							</span>
							<label className="audio-loop-toggle">
								<input
									type="checkbox"
									checked={audio.isLoopEnabled}
									onChange={(event) =>
										audio.setIsLoopEnabled(
											event.target.checked,
										)
									}
									disabled={!hasSequence || isExporting}
								/>
								Loop
							</label>
						</div>

						<div className="audio-buttons">
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									void (audio.isPlaying
										? audio.pause()
										: audio.play())
								}
								disabled={
									!hasSequence || audio.isPreparingVoices || isExporting
								}
							>
								{audio.isPreparingVoices ? (
									<>
										<Loader2Icon className="size-3.5 animate-spin" /> Loading
									</>
								) : audio.isPlaying ? (
									<>
										<PauseIcon className="size-3.5" /> Pause
									</>
								) : (
									<>
										<PlayIcon className="size-3.5" /> Play
									</>
								)}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={audio.stop}
								disabled={!hasSequence || isExporting}
							>
								<SquareIcon className="size-3.5" /> Stop
							</Button>
						</div>

						<div className="audio-export-buttons">
							<Button
								variant="default"
								size="sm"
								onClick={() => void audio.exportMp3()}
								disabled={!hasSequence || isExporting}
							>
								{isExporting && audio.exportKind === "mp3" ? (
									<Loader2Icon className="size-3.5 animate-spin" />
								) : null}
								Export MP3
							</Button>
							<Button
								variant="default"
								size="sm"
								onClick={() => void audio.exportMp4()}
								disabled={
									!hasSequence ||
									isExporting ||
									!audio.isVideoExportSupported
								}
								title={
									audio.isVideoExportSupported
										? `Record ${videoAspectConfig.width}×${videoAspectConfig.height} ${audio.videoAspectRatio} MP4 at ${videoQualityConfig.label} quality`
										: "This browser does not support MP4 scene capture"
								}
							>
								{isExporting && audio.exportKind === "mp4" ? (
									<Loader2Icon className="size-3.5 animate-spin" />
								) : (
									<FilmIcon className="size-3.5" />
								)}
								MP4
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void audio.exportMidi()}
								disabled={!hasSequence || isExporting}
							>
								<FileMusicIcon className="size-3.5" /> MIDI
							</Button>
						</div>

						{!audio.isVideoExportSupported ? (
							<p className="audio-field-help">
								MP4 export is not available in this browser.
							</p>
						) : null}

						{isExporting ? (
							<div className="audio-export-progress">
								<div
									className="audio-progress-track"
									aria-hidden="true"
								>
									<div
										className="audio-progress-value"
										style={{
											width: `${Math.round(audio.exportProgress * 100)}%`,
										}}
									/>
								</div>
								<div className="audio-progress-copy">
									<span>{statusLabel}</span>
									<span>
										{audio.exportStage === "recording-video"
											? `${formatSeconds(audio.exportProgress * runtimeSeconds)} / ${formatSeconds(runtimeSeconds)}`
											: `${Math.round(audio.exportProgress * 100)}%`}
									</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={audio.cancelExport}
								>
									<XIcon className="size-3.5" /> Cancel Export
								</Button>
							</div>
						) : null}

						<div className="audio-metrics">
							<p>
								Notes {audio.sequence?.noteCount ?? 0} · Reads{" "}
								{audio.sequence?.readCount ?? 0} · R1/R2 sampled{" "}
								{audio.dataset?.r1.selectedReads ?? 0}/
								{audio.dataset?.r2.selectedReads ?? 0}
							</p>
							<p>
								Meter {audio.sequence?.timeSignature ?? selectedTimeSignature}
								{" "}· {audio.sequence?.tempoBpm ?? audio.mappingOptions.tempoBpm} BPM
							</p>
							<p>
								Audio pulse{" "}
								{Math.round(audio.audioEnergy * 100)}% · Parsed
								in{" "}
								{Math.round(
									audio.dataset?.parseDurationMs ?? 0,
								)}
								ms
							</p>
							<p>
								Context {audio.audioContextState} · Triggers{" "}
								{audio.playbackTriggerCount}
							</p>
						</div>

						<p className="audio-caption">
							Voice, volume, and octave choices are shared by playback,
							MP3, MP4, and MIDI. MP4 recording runs in real time and the
							tab must stay visible; browser encoding may take several more
							minutes. FluidR3 samples are licensed CC BY 3.0.
						</p>
					</div>

					{audio.buildError ? (
						<p className="audio-error">{audio.buildError}</p>
					) : null}
					{audio.exportError ? (
						<p className="audio-error">{audio.exportError}</p>
					) : null}
				</PopoverContent>
			</Popover>
		</div>
	);
}
