import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourceDir = path.join(
	projectRoot,
	"node_modules",
	"@ffmpeg",
	"core",
	"dist",
	"esm",
);
const destinationDir = path.join(projectRoot, "public", "ffmpeg");
const requiredFiles = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

if (!existsSync(sourceDir)) {
	console.error(
		"[prepare:ffmpeg-core] source directory not found:",
		sourceDir,
	);
	process.exit(1);
}

mkdirSync(destinationDir, { recursive: true });

for (const fileName of requiredFiles) {
	const sourcePath = path.join(sourceDir, fileName);
	const destinationPath = path.join(destinationDir, fileName);

	if (!existsSync(sourcePath)) {
		console.error("[prepare:ffmpeg-core] missing source file:", sourcePath);
		process.exit(1);
	}

	copyFileSync(sourcePath, destinationPath);
}

console.log("[prepare:ffmpeg-core] ffmpeg core assets copied to public/ffmpeg");
