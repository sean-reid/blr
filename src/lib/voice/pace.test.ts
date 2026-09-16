import { describe, expect, it } from 'vitest';
import { orderByFit, Pace } from './pace';

describe('Pace', () => {
	it('starts from the prior and follows measurements', () => {
		const p = new Pace(4.8);
		expect(p.predict(9.6)).toBeCloseTo(2, 5);
		p.update(10, 2.5);
		expect(p.rate).toBeCloseTo(4, 5);
		p.update(0, 1);
		expect(p.rate).toBeCloseTo(4, 5);
	});
});

describe('orderByFit', () => {
	it('puts the reading whose predicted length is nearest the target first', () => {
		const pace = new Pace(4);
		const out = orderByFit(
			[
				{ item: 'short', syllables: 4 },
				{ item: 'long', syllables: 16 },
				{ item: 'right', syllables: 8 }
			],
			2,
			pace
		);
		expect(out).toEqual(['right', 'short', 'long']);
	});

	it('keeps the incoming order when the target is unknown', () => {
		expect(
			orderByFit(
				[
					{ item: 'a', syllables: 1 },
					{ item: 'b', syllables: 9 }
				],
				0,
				new Pace()
			)
		).toEqual(['a', 'b']);
	});
});
