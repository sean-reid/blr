export type Theme = 'light' | 'dark';

function current(): Theme {
	return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export const theme = $state<{ value: Theme }>({ value: 'light' });

export function initTheme() {
	theme.value = current();
}

export function toggleTheme() {
	const next: Theme = theme.value === 'dark' ? 'light' : 'dark';
	theme.value = next;
	if (next === 'dark') document.documentElement.dataset.theme = 'dark';
	else delete document.documentElement.dataset.theme;
	localStorage.setItem('theme', next);
}
