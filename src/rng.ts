export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(rng: Rng, items: { item: T; weight: number }[]): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let roll = rng() * total;
  for (const entry of items) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return items[items.length - 1].item;
}

export function expInterval(rng: Rng, lambdaPerSec: number): number {
  if (lambdaPerSec <= 0) return Infinity;
  const u = Math.min(Math.max(rng(), 1e-9), 1 - 1e-9);
  return -Math.log(u) / lambdaPerSec;
}
