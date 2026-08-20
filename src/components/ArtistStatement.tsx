import { useEffect, useRef, useState } from "react";
import { FileTextIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type ArtistStatementProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
};

const ARTIST_STATEMENT_ID = "artist-statement";
const ARTIST_STATEMENT_TITLE_ID = "artist-statement-title";
const ARTIST_STATEMENT_TITLE = "LOAD //////// ARTIST STATEMENT";
const ARTIST_STATEMENT_INTRO =
	"Rose DNA is a Ubiquitous Music (UBIMUS) art project to explore the use of data, in the form of DNA, to create music. Ubiquitous music (UBIMUS) is a field of research that combines several perspectives from music computing, human-computer interaction, creativity studies, and education, with a strong social and community underpinning. The term owes its origins to concepts and ideas around ubiquitous computing, connecting with the principle that deep technologies “weave themselves into the fabric of everyday life until they are indistinguishable from it”";
const ARTIST_STATEMENT_DNA =
	"DNA is ubiquitous information relevant to all cellular lifeforms on earth. DNA contains the nucleotides: Adenine, Guanine, Cytosine and Thymine. Here we present a new way to look at DNA using a method and application to map the data from FASTQ files to MIDI outputs.";
const ARTIST_STATEMENT_SOUND_HEADING = "How the DNA becomes sound:";
const ARTIST_STATEMENT_SOUND =
	"Each A, C, G, or T becomes a note in its own sampled voice. R1 reads use a lower pitch range, R2 reads use a higher range, and FASTQ quality controls loudness. Playback and MP3 use FluidR3 sounds; MIDI uses the corresponding General MIDI program.";
const ARTIST_STATEMENT_DATA =
	"Data mapping (like data visualization) allows us to transmute data into different forms like music. We invite the viewer to consider the interconnectedness of the data around us and how data, and our understanding of it, can give us a greater perspective on ourselves and the world around us. We hope that you enjoy this short video demoing the concept of a musical sequence composed from the genomic sequence of a rose.";
const ARTIST_STATEMENT_ACKNOWLEDGEMENTS = "Acknowledgements:";
const FASTQ_URL = "https://en.wikipedia.org/wiki/FASTQ_format";
const FASTQ_ACKNOWLEDGEMENT = `FASTQ: ${FASTQ_URL}`;
const UBIQUITOUS_MUSIC_HEADING = "Ubiquitous Music Definition:";
const DOI_URL = "https://doi.org/10.1162/LEON.e.2578";
const UBIQUITOUS_MUSIC_CITATION =
	`Anthony Lewis Brooks, Damián Keller, Martin K. Koszolko; Exploring the Interdisciplinary Dimensions of Second-Wave Ubiquitous Music. Leonardo 2026; 59 (1): 5–9. doi: ${DOI_URL}`;
const ARTIST_STATEMENT_TEXT = [
	ARTIST_STATEMENT_TITLE,
	ARTIST_STATEMENT_INTRO,
	ARTIST_STATEMENT_DNA,
	ARTIST_STATEMENT_SOUND_HEADING,
	ARTIST_STATEMENT_SOUND,
	ARTIST_STATEMENT_DATA,
	ARTIST_STATEMENT_ACKNOWLEDGEMENTS,
	FASTQ_ACKNOWLEDGEMENT,
	UBIQUITOUS_MUSIC_HEADING,
	UBIQUITOUS_MUSIC_CITATION,
].join("\n\n");
const TITLE_TYPING_DELAY = 34;
const BODY_TYPING_DELAY = 20;
const BODY_CHARACTERS_PER_TICK = 5;

export function ArtistStatement({
	isOpen,
	onOpenChange,
}: ArtistStatementProps) {
	const toggleRef = useRef<HTMLButtonElement>(null);
	const [visibleCharacterCount, setVisibleCharacterCount] = useState(0);
	const [hasPlayedTypingAnimation, setHasPlayedTypingAnimation] =
		useState(false);

	useEffect(() => {
		if (!isOpen || hasPlayedTypingAnimation) {
			return;
		}

		const prefersReducedMotion =
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

		if (prefersReducedMotion) {
			setVisibleCharacterCount(ARTIST_STATEMENT_TEXT.length);
			setHasPlayedTypingAnimation(true);
			return;
		}

		let timeout = 0;
		let characterCount = 0;
		const typeNextCharacters = () => {
			const isTypingTitle = characterCount < ARTIST_STATEMENT_TITLE.length;
			characterCount = Math.min(
				ARTIST_STATEMENT_TEXT.length,
				characterCount + (isTypingTitle ? 1 : BODY_CHARACTERS_PER_TICK),
			);
			setVisibleCharacterCount(characterCount);

			if (characterCount >= ARTIST_STATEMENT_TEXT.length) {
				setHasPlayedTypingAnimation(true);
				return;
			}

			timeout = window.setTimeout(
				typeNextCharacters,
				isTypingTitle ? TITLE_TYPING_DELAY : BODY_TYPING_DELAY,
			);
		};

		timeout = window.setTimeout(typeNextCharacters, TITLE_TYPING_DELAY);

		return () => window.clearTimeout(timeout);
	}, [hasPlayedTypingAnimation, isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		toggleRef.current?.focus();

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") {
				return;
			}

			event.preventDefault();
			setHasPlayedTypingAnimation(true);
			onOpenChange(false);
			window.requestAnimationFrame(() => toggleRef.current?.focus());
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onOpenChange]);

	const label = isOpen ? "Hide artist statement" : "Show artist statement";
	const handleOpenChange = (nextIsOpen: boolean) => {
		if (!nextIsOpen && isOpen) {
			setHasPlayedTypingAnimation(true);
		}

		onOpenChange(nextIsOpen);
	};
	const toggle = (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					ref={toggleRef}
					type="button"
					variant="outline"
					size="icon"
					className="artist-statement-toggle h-11 w-11 rounded-full border-white/10 bg-black/55 text-white shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/70 hover:text-white"
					aria-controls={ARTIST_STATEMENT_ID}
					aria-expanded={isOpen}
					aria-label={label}
					onClick={() => handleOpenChange(!isOpen)}
				>
					{isOpen ? (
						<XIcon className="size-4" aria-hidden="true" />
					) : (
						<FileTextIcon className="size-4" aria-hidden="true" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent sideOffset={8}>{label}</TooltipContent>
		</Tooltip>
	);

	return (
		<>
			{!isOpen ? toggle : null}

			{isOpen ? (
				<div
					id={ARTIST_STATEMENT_ID}
					className="artist-statement-overlay"
					role="dialog"
					aria-modal="true"
					aria-labelledby={ARTIST_STATEMENT_TITLE_ID}
				>
					{toggle}
					{!hasPlayedTypingAnimation ? (
						<>
							<h1
								id={ARTIST_STATEMENT_TITLE_ID}
								className="artist-statement-accessible-title"
							>
								{ARTIST_STATEMENT_TITLE}
							</h1>
							<p className="artist-statement-accessible-copy">
								{ARTIST_STATEMENT_TEXT}
							</p>
							<article
								className="artist-statement-content artist-statement-typing-content"
								aria-hidden="true"
							>
								<div className="artist-statement-typing-copy">
									{ARTIST_STATEMENT_TEXT.slice(0, visibleCharacterCount)}
									<span className="artist-statement-cursor" />
								</div>
							</article>
						</>
					) : (
						<article className="artist-statement-content">
							<h1 id={ARTIST_STATEMENT_TITLE_ID}>
								{ARTIST_STATEMENT_TITLE}
							</h1>

							<p>{ARTIST_STATEMENT_INTRO}</p>

							<p>{ARTIST_STATEMENT_DNA}</p>

							<section aria-labelledby="artist-statement-sound-heading">
								<h2 id="artist-statement-sound-heading">
									{ARTIST_STATEMENT_SOUND_HEADING}
								</h2>
								<p>{ARTIST_STATEMENT_SOUND}</p>
							</section>

							<p>{ARTIST_STATEMENT_DATA}</p>

							<section
								className="artist-statement-acknowledgements"
								aria-labelledby="artist-statement-acknowledgements-heading"
							>
								<h2 id="artist-statement-acknowledgements-heading">
									{ARTIST_STATEMENT_ACKNOWLEDGEMENTS}
								</h2>
								<p>
									FASTQ:{` `}
									<a href={FASTQ_URL} target="_blank" rel="noreferrer">
										{FASTQ_URL}
									</a>
								</p>

								<h3>{UBIQUITOUS_MUSIC_HEADING}</h3>
								<p>
									Anthony Lewis Brooks, Damián Keller, Martin K. Koszolko;
									Exploring the Interdisciplinary Dimensions of Second-Wave
									Ubiquitous Music. Leonardo 2026; 59 (1): 5–9. doi:{` `}
									<a href={DOI_URL} target="_blank" rel="noreferrer">
										{DOI_URL}
									</a>
								</p>
							</section>
						</article>
					)}
				</div>
			) : null}
		</>
	);
}
