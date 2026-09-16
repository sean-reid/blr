import { describe, expect, it } from 'vitest';
import { outputName } from './remux';

describe('outputName', () => {
	it('inserts blr before the extension and always writes mp4', () => {
		expect(outputName('holiday.mov')).toBe('holiday.blr.mp4');
		expect(outputName('clip')).toBe('clip.blr.mp4');
		expect(outputName('a.b.webm')).toBe('a.b.blr.mp4');
	});
});
