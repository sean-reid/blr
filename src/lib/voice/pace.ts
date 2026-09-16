// Running estimate of how fast the synthesiser speaks, in syllables per
// second, so readings can be ranked by predicted length before any call.
export const PACE_PRIOR = 6;
const STORAGE_KEY = 'blr.pace';

export class Pace {
	private total = 0;
	private seconds = 0;

	constructor(private readonly prior = PACE_PRIOR) {
		this.restore();
	}

	update(syllables: number, seconds: number) {
		if (syllables <= 0 || seconds <= 0) return;
		this.total += syllables;
		this.seconds += seconds;
		this.persist();
	}

	// Measurements survive reloads so the first render of a session already
	// knows how fast the voice speaks.
	private restore() {
		try {
			const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
			if (!saved) return;
			const { total, seconds } = JSON.parse(saved) as { total: number; seconds: number };
			if (total > 0 && seconds > 0) {
				this.total = total;
				this.seconds = seconds;
			}
		} catch {
			/* no storage */
		}
	}

	private persist() {
		try {
			globalThis.localStorage?.setItem(
				STORAGE_KEY,
				JSON.stringify({ total: this.total, seconds: this.seconds })
			);
		} catch {
			/* no storage */
		}
	}

	get rate(): number {
		return this.seconds > 0 ? this.total / this.seconds : this.prior;
	}

	predict(syllables: number): number {
		return syllables / this.rate;
	}
}

export interface Candidate<T> {
	item: T;
	syllables: number;
}

// Orders candidates by how close their predicted spoken length is to the
// target; ties keep the incoming order, which is the ranker's.
export function orderByFit<T>(candidates: Candidate<T>[], target: number, pace: Pace): T[] {
	if (target <= 0) return candidates.map((c) => c.item);
	return candidates
		.map((c, i) => ({
			c,
			i,
			score: Math.abs(Math.log(Math.max(0.05, pace.predict(c.syllables)) / target))
		}))
		.sort((a, b) => a.score - b.score || a.i - b.i)
		.map((x) => x.c.item);
}
