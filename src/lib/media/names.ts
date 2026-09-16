export function outputName(original: string): string {
	const dot = original.lastIndexOf('.');
	const stem = dot > 0 ? original.slice(0, dot) : original;
	return `${stem}.blr.mp4`;
}
