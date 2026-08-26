import * as THREE from 'three'

/** touch-class pointer: hover is not expressible, so info must never be hover-gated */
export const isCoarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The simulation RNG.
 *
 * Every roll that can change the outcome of a battle draws from here, so a
 * run is reproducible from its seed: two players on the same seed see the
 * same fight. Decoration and particles deliberately keep using Math.random
 * directly — they must never consume from this stream, or a different
 * particle quality tier would desync the simulation.
 *
 * Fixed-timestep alone was never enough for this; the draws had to be seeded too.
 */
let simRng: () => number = Math.random

/** seed the simulation; pass null to return to unseeded play */
export function setSimSeed(seed: number | null): void {
  simRng = seed === null ? Math.random : seededRandom(seed)
}

/** a raw simulation draw in [0, 1) */
export const simRandom = (): number => simRng()

/** a seeded probability check */
export const simChance = (p: number): boolean => simRng() < p

export const randRange = (a: number, b: number) => a + simRng() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(randRange(a, b + 1))
export const pick = <T>(arr: T[]): T => arr[Math.floor(simRng() * arr.length)]

// Mulberry32: deterministic decoration scatter per level
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleColor(base: number, amount: number, rng: () => number = Math.random): number {
  const c = new THREE.Color(base)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(
    (hsl.h + (rng() - 0.5) * amount * 0.15 + 1) % 1,
    clamp(hsl.s + (rng() - 0.5) * amount * 0.4, 0, 1),
    clamp(hsl.l + (rng() - 0.5) * amount * 0.5, 0, 1),
  )
  return c.getHex()
}

/** Angle-lerp along shortest arc */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * clamp(t, 0, 1)
}

export const dist2D = (ax: number, az: number, bx: number, bz: number) =>
  Math.hypot(ax - bx, az - bz)

export function formatGold(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : `${Math.floor(n)}`
}
