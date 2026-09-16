function factorize(n: number): number[] {
	const out: number[] = [];
	let rest = n;
	for (const p of [5, 3, 2]) {
		while (rest % p === 0) {
			out.push(p);
			rest /= p;
		}
	}
	if (rest !== 1) throw new Error(`FFT size ${n} must factor into 2, 3 and 5`);
	return out;
}

/** Mixed-radix Cooley-Tukey FFT for lengths whose prime factors are 2, 3 and 5. */
export class FFT {
	readonly n: number;
	private readonly stages: number[];
	private readonly perm: Uint32Array;
	private readonly cos: Float64Array;
	private readonly sin: Float64Array;
	private readonly scratchRe: Float64Array;
	private readonly scratchIm: Float64Array;
	private readonly aRe = new Float64Array(5);
	private readonly aIm = new Float64Array(5);

	constructor(n: number) {
		this.n = n;
		const outer = factorize(n);
		this.stages = [...outer].reverse();
		this.perm = new Uint32Array(n);
		this.fillPerm(outer, 0, 0, 1, n, 0);
		this.cos = new Float64Array(n);
		this.sin = new Float64Array(n);
		for (let k = 0; k < n; k++) {
			this.cos[k] = Math.cos((2 * Math.PI * k) / n);
			this.sin[k] = Math.sin((2 * Math.PI * k) / n);
		}
		this.scratchRe = new Float64Array(n);
		this.scratchIm = new Float64Array(n);
	}

	private fillPerm(
		outer: number[],
		pos: number,
		start: number,
		stride: number,
		len: number,
		depth: number
	) {
		if (len === 1) {
			this.perm[pos] = start;
			return;
		}
		const p = outer[depth];
		const m = len / p;
		for (let r = 0; r < p; r++) {
			this.fillPerm(outer, pos + r * m, start + r * stride, stride * p, m, depth + 1);
		}
	}

	forward(re: Float64Array, im: Float64Array) {
		this.transform(re, im, -1);
	}

	/** Inverse transform scaled by 1/n. */
	inverse(re: Float64Array, im: Float64Array) {
		this.transform(re, im, 1);
		const s = 1 / this.n;
		for (let i = 0; i < this.n; i++) {
			re[i] *= s;
			im[i] *= s;
		}
	}

	private transform(re: Float64Array, im: Float64Array, sign: number) {
		const { n, perm, scratchRe, scratchIm, cos, sin, aRe, aIm } = this;
		scratchRe.set(re);
		scratchIm.set(im);
		for (let i = 0; i < n; i++) {
			re[i] = scratchRe[perm[i]];
			im[i] = scratchIm[perm[i]];
		}

		let m = 1;
		for (const p of this.stages) {
			const span = p * m;
			const twStride = n / span;
			const rootStride = n / p;
			for (let g = 0; g < n; g += span) {
				for (let k = 0; k < m; k++) {
					const base = g + k;
					aRe[0] = re[base];
					aIm[0] = im[base];
					for (let r = 1; r < p; r++) {
						const idx = base + r * m;
						const t = r * k * twStride;
						const c = cos[t];
						const s = sign * sin[t];
						const xr = re[idx];
						const xi = im[idx];
						aRe[r] = xr * c - xi * s;
						aIm[r] = xr * s + xi * c;
					}
					if (p === 2) {
						re[base] = aRe[0] + aRe[1];
						im[base] = aIm[0] + aIm[1];
						re[base + m] = aRe[0] - aRe[1];
						im[base + m] = aIm[0] - aIm[1];
						continue;
					}
					for (let q = 0; q < p; q++) {
						let sr = aRe[0];
						let si = aIm[0];
						for (let r = 1; r < p; r++) {
							const t = ((r * q) % p) * rootStride;
							const c = cos[t];
							const s = sign * sin[t];
							sr += aRe[r] * c - aIm[r] * s;
							si += aRe[r] * s + aIm[r] * c;
						}
						re[base + q * m] = sr;
						im[base + q * m] = si;
					}
				}
			}
			m = span;
		}
	}
}
