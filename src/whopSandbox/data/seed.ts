export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  bool: (p: number) => boolean;
};

export function makeRng(seed: number): Rng {
  let t = seed >>> 0;
  const next = () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.floor(next() * (hi - lo + 1)) + lo;
  };
  const pick = <T,>(arr: readonly T[]) => arr[int(0, Math.max(0, arr.length - 1))] as T;
  const bool = (p: number) => next() < p;
  return { next, int, pick, bool };
}

export function getRequestSeed(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  return v;
}


