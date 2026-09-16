import type { Viseme } from './classes';

type Rule = [pattern: RegExp, visemes: Viseme[]];

const RULES: Rule[] = [
	[/^tch/, ['CH']],
	[/^th/, ['TH']],
	[/^sh/, ['CH']],
	[/^ch/, ['CH']],
	[/^ph/, ['FF']],
	[/^wh/, ['WW']],
	[/^ck/, ['KK']],
	[/^ng/, ['KK']],
	[/^qu/, ['KK', 'WW']],
	[/^ee|^ea|^ie|^ei/, ['IH']],
	[/^oo|^ou|^ue|^ew/, ['WW']],
	[/^ow|^oa|^oi|^oy|^au|^aw/, ['OH']],
	[/^ai|^ay|^ey/, ['EH']],
	[/^[pbm]/, ['PP']],
	[/^[fv]/, ['FF']],
	[/^[tdnlsz]/, ['DD']],
	[/^c[eiy]/, ['DD']],
	[/^[ckgqxh]/, ['KK']],
	[/^[j]/, ['CH']],
	[/^r/, ['RR']],
	[/^w/, ['WW']],
	[/^y/, ['IH']],
	[/^a/, ['AA']],
	[/^e/, ['EH']],
	[/^i/, ['IH']],
	[/^o/, ['OH']],
	[/^u/, ['AA']]
];

export function spellingToVisemes(word: string): Viseme[] {
	let rest = word.toLowerCase().replace(/[^a-z]/g, '');
	if (rest.length > 3 && rest.endsWith('e') && !/[aeiou]e$/.test(rest)) rest = rest.slice(0, -1);
	const out: Viseme[] = [];
	while (rest.length) {
		let matched = false;
		for (const [re, vis] of RULES) {
			const m = re.exec(rest);
			if (!m) continue;
			for (const v of vis) if (out[out.length - 1] !== v) out.push(v);
			rest = rest.slice(m[0].length);
			matched = true;
			break;
		}
		if (!matched) rest = rest.slice(1);
	}
	return out;
}

export function spellingSyllables(word: string): number {
	const w = word.toLowerCase().replace(/[^a-z]/g, '');
	const groups = w.match(/[aeiouy]+/g)?.length ?? 0;
	const silentE = w.length > 3 && /[^aeiou]e$/.test(w) ? 1 : 0;
	return Math.max(1, groups - silentE);
}
