import type { Particles } from './particles.ts'
import type { ThemeId } from './types.ts'

/**
 * Each Frontier theme's air: petals, blown sand, spores, rain. The table lives
 * in the main bundle but is filled by frontierScenery.ts when the Frontier
 * loads, so the campaign never carries the Frontier's weather.
 */
export type WeatherFn = (particles: Particles, dt: number, rx: () => number, rz: () => number) => void
export const frontierWeather: Partial<Record<ThemeId, WeatherFn>> = {}
