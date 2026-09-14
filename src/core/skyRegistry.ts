import type * as THREE from 'three'
import type { SkyDef } from './sky.ts'

/**
 * Who paints a layered sky. The painter (sky.ts) ships with the Frontier,
 * the only boards that ask for one, and installs itself here when they load;
 * until then every dome is the campaign's plain gradient.
 */
export const skyRegistry: { paint: ((top: number, bottom: number, sky: SkyDef) => THREE.ShaderMaterial) | null } = { paint: null }
