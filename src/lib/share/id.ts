export const ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const ID_LENGTH = 10;

const ID_PATTERN = new RegExp(`^[${ID_ALPHABET}]{${ID_LENGTH}}$`);

export function newId(random: (n: number) => Uint8Array = randomBytes): string {
	let out = '';
	while (out.length < ID_LENGTH) {
		for (const b of random(ID_LENGTH)) {
			if (b < ID_ALPHABET.length * 8) out += ID_ALPHABET[b % ID_ALPHABET.length];
			if (out.length === ID_LENGTH) break;
		}
	}
	return out;
}

export function isId(s: string): boolean {
	return ID_PATTERN.test(s);
}

function randomBytes(n: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(n));
}
