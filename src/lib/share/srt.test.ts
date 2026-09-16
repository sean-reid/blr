import { describe, expect, it } from 'vitest';
import { vttToSrt } from './srt';
import { toVtt } from './vtt';

describe('vttToSrt', () => {
	it('drops the header, uses comma millis and names the speaker in text', () => {
		const vtt = toVtt([
			{ speaker: 0, start: 1.2, end: 2.8, original: 'x', text: 'My cat is mad' },
			{ speaker: 1, start: 3, end: 4.5, original: 'y', text: 'So is mine' }
		]);
		expect(vttToSrt(vtt)).toBe(
			'1\n00:00:01,200 --> 00:00:02,800\nSpeaker A: My cat is mad\n\n' +
				'2\n00:00:03,000 --> 00:00:04,500\nSpeaker B: So is mine\n'
		);
	});

	it('carries renamed speakers and unescapes markup', () => {
		const vtt = toVtt([{ speaker: 0, start: 0, end: 1, original: 'x', text: 'a <b> & c' }], {
			0: 'Nat'
		});
		expect(vtt).toContain('<v Nat>a &lt;b&gt; &amp; c');
		expect(vttToSrt(vtt)).toBe('1\n00:00:00,000 --> 00:00:01,000\nNat: a <b> & c\n');
	});

	it('renumbers and skips blocks without timing', () => {
		const srt = vttToSrt('WEBVTT\n\nNOTE hi\n\n7\n00:00:05.000 --> 00:00:06.000\nlate\n');
		expect(srt).toBe('1\n00:00:05,000 --> 00:00:06,000\nlate\n');
	});
});
