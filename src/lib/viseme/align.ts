export interface Alignment {
	score: number;
	perWord: number[];
}

// Aligns the original viseme sequence against the concatenated visemes of the
// replacement words and reports how many of each word's shapes were matched.
export function alignWords(original: readonly string[], words: readonly string[][]): Alignment {
	const b: string[] = [];
	const owner: number[] = [];
	words.forEach((w, k) => {
		for (const v of w) {
			b.push(v);
			owner.push(k);
		}
	});
	const m = original.length;
	const n = b.length;
	const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
	for (let i = 0; i <= m; i++) d[i][0] = i;
	for (let j = 0; j <= n; j++) d[0][j] = j;
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const sub = d[i - 1][j - 1] + (original[i - 1] === b[j - 1] ? 0 : 1);
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, sub);
		}
	}
	const matched = new Array<number>(words.length).fill(0);
	let i = m;
	let j = n;
	while (i > 0 && j > 0) {
		const same = original[i - 1] === b[j - 1];
		if (d[i][j] === d[i - 1][j - 1] + (same ? 0 : 1)) {
			if (same) matched[owner[j - 1]]++;
			i--;
			j--;
		} else if (d[i][j] === d[i][j - 1] + 1) {
			j--;
		} else {
			i--;
		}
	}
	const len = Math.max(m, n);
	return {
		score: len === 0 ? 1 : 1 - d[m][n] / len,
		perWord: words.map((w, k) => (w.length ? matched[k] / w.length : 0))
	};
}
