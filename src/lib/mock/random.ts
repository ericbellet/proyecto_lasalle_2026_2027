/**
 * Deterministic randomness.
 *
 * Every mock number in the platform comes from here, keyed by a string seed, so
 * two people running `npm run db:seed` on different machines get byte-identical
 * datasets and a screenshot in the docs never goes stale.
 */

/** 32-bit string hash (FNV-1a), used to turn a label into a numeric seed. */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: string | number) {
    const numeric = typeof seed === "number" ? seed : hashSeed(seed);
    // Zero is a fixed point for the generator below.
    this.state = numeric === 0 ? 0x9e3779b9 : numeric;
  }

  /** mulberry32 — small, fast, and good enough for synthetic data. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** Box–Muller, so the synthetic series has believable tails. */
  normal(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), Number.EPSILON);
    const u2 = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick called with an empty array");
    return items[this.int(0, items.length - 1)] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = this.int(0, index);
      const a = copy[index] as T;
      copy[index] = copy[swap] as T;
      copy[swap] = a;
    }
    return copy;
  }

  /** Weighted pick without replacement. */
  sample<T>(items: readonly T[], count: number, weights?: number[]): T[] {
    if (!weights) return this.shuffle(items).slice(0, count);
    const pool = items.map((item, index) => ({ item, weight: Math.max(weights[index] ?? 0, 1e-6) }));
    const chosen: T[] = [];
    for (let round = 0; round < count && pool.length > 0; round += 1) {
      const total = pool.reduce((acc, entry) => acc + entry.weight, 0);
      let threshold = this.next() * total;
      let index = 0;
      while (index < pool.length - 1) {
        threshold -= pool[index]?.weight ?? 0;
        if (threshold <= 0) break;
        index += 1;
      }
      const [entry] = pool.splice(index, 1);
      if (entry) chosen.push(entry.item);
    }
    return chosen;
  }
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
