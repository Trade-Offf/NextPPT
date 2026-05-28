/** Minimal ULID generator (no dependency) */
const CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(): string {
  const t = Date.now();
  let s = '';
  let n = t;
  for (let i = 9; i >= 0; i--) {
    s = CHARS[n % 32]! + s;
    n = Math.floor(n / 32);
  }
  for (let i = 0; i < 16; i++) s += CHARS[Math.floor(Math.random() * 32)]!;
  return s;
}
