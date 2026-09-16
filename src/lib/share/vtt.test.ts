import { describe, expect, it } from 'vitest';
import type { ShareLine } from './types';
import { stamp, toVtt } from './vtt';

const line = (over: Partial<ShareLine>): ShareLine => ({
	speaker: 0,
	start: 0,
	end: 1,
	original: 'hello',
	text: 'yellow',
	...over
});

describe('stamp', () => {
	it('formats hours, minutes, seconds and milliseconds', () => {
		expect(stamp(0)).toBe('00:00:00.000');
		expect(stamp(7.25)).toBe('00:00:07.250');
		expect(stamp(65.0004)).toBe('00:01:05.000');
		expect(stamp(3661.999)).toBe('01:01:01.999');
	});

	it('clamps negative times to zero', () => {
		expect(stamp(-3)).toBe('00:00:00.000');
	});
});

describe('toVtt', () => {
	it('writes one cue per line with a voice tag', () => {
		const vtt = toVtt([
			line({ speaker: 0, start: 1.2, end: 2.8, text: 'My cat is mad' }),
			line({ speaker: 1, start: 3, end: 4.5, text: 'So is mine' })
		]);
		expect(vtt).toBe(
			'WEBVTT\n\n' +
				'1\n00:00:01.200 --> 00:00:02.800\n<v Speaker A>My cat is mad\n\n' +
				'2\n00:00:03.000 --> 00:00:04.500\n<v Speaker B>So is mine\n'
		);
	});

	it('orders cues by start time', () => {
		const vtt = toVtt([
			line({ start: 5, end: 6, text: 'second' }),
			line({ start: 1, end: 2, text: 'first' })
		]);
		expect(vtt.indexOf('first')).toBeLessThan(vtt.indexOf('second'));
		expect(vtt).toMatch(/^WEBVTT\n\n1\n00:00:01\.000/);
	});

	it('skips empty lines and keeps cues at least half a second long', () => {
		const vtt = toVtt([
			line({ start: 1, end: 1.1, text: 'blink' }),
			line({ start: 2, end: 3, text: '   ' })
		]);
		expect(vtt).toContain('00:00:01.000 --> 00:00:01.500');
		expect(vtt).not.toContain('\n2\n');
	});

	it('escapes markup in the text', () => {
		expect(toVtt([line({ text: 'a <b> & c' })])).toContain('<v Speaker A>a &lt;b&gt; &amp; c');
	});
});
