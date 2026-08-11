export function downloadBlob(blob: Blob, fileName: string) {
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement("a");

	anchor.href = objectUrl;
	anchor.download = fileName;
	anchor.style.display = "none";
	document.body.append(anchor);
	anchor.click();
	anchor.remove();

	window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
