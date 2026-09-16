const TIMING = /^(\d{2}:\d{2}:\d{2})\.(\d{3}) --> (\d{2}:\d{2}:\d{2})\.(\d{3})$/;

export function vttToSrt(vtt: string): string {
	const blocks = vtt.replace(/\r\n/g, '\n').trim().split(/\n{2,}/).slice(1);
	const cues: string[] = [];
	for (const block of blocks) {
		const rows = block.split('\n');
		const at = rows.findIndex((r) => TIMING.test(r));
		if (at < 0) continue;
		const timing = rows[at].replace(TIMING, '$1,$2 --> $3,$4');
		const text = rows.slice(at + 1).map(plain).join('\n');
		cues.push(`${cues.length + 1}\n${timing}\n${text}`);
	}
	return cues.join('\n\n') + '\n';
}

function plain(row: string): string {
	return row
		.replace(/<v\s+([^>]*)>/g, '$1: ')
		.replace(/<\/?[^>]+>/g, '')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}
