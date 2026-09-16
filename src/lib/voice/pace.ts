// Running estimate of how fast the synthesiser speaks, in syllables per
// second, so readings can be ranked by predicted length before any call.
export class Pace {
	private total = 0;
	private seconds = 0;

	constructor(private readonly prior = 4.8) {}

	update(syllables: number, seconds: number) {
		if (syllables <= 0 || seconds <= 0) return;
		this.total += syllables;
		this.seconds += seconds;
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
