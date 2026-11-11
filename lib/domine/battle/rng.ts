// State is an unsigned 32-bit integer; zero is a valid seed.
export function random(seed: number): { seed: number; value: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let value = Math.imul(next ^ (next >>> 15), next | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { seed: next, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 };
}

export function seedFor(text: string, seed: number): number {
  let value = seed >>> 0;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value;
}
