import { safeLocal } from './boot.ts'

export const QUALITY_OPTIONS = {
  auto: 'Automatic', high: 'High', balanced: 'Balanced', low: 'Low', battery: 'Battery saver',
} as const
export type QualityPreference = keyof typeof QUALITY_OPTIONS
export function readQuality(): QualityPreference {
  const value = safeLocal.get('blockhold.quality')
  return value && Object.hasOwn(QUALITY_OPTIONS, value) ? value as QualityPreference : 'auto'
}
export function writeQuality(value: QualityPreference): void { safeLocal.set('blockhold.quality', value) }
export function qualityTierFor(value: QualityPreference, touch: boolean): number {
  return value === 'auto' ? touch ? 1 : 0 : value === 'high' ? 0 : value === 'balanced' ? 1 : 2
}
