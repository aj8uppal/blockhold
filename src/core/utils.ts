import * as THREE from 'three'

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const randRange = (a: number, b: number) => a + Math.random() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(randRange(a, b + 1))
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

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
