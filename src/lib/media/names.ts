export function outputName(original: string, ext = 'mp4'): string {
	const dot = original.lastIndexOf('.');
	const stem = dot > 0 ? original.slice(0, dot) : original;
	return `${stem}.blr.${ext}`;
}
