import { VisemeIndex } from './index';

let pending: Promise<VisemeIndex> | null = null;

export function loadIndex(): Promise<VisemeIndex> {
	pending ??= import('./data/words.json').then((m) => new VisemeIndex(m.default));
	return pending;
}
