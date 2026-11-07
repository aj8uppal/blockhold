import * as THREE from 'three'

/**
 * Shared pieces for the fire and explosion shaders.
 *
 * Everything here is presentation: the noise is a hash of position and time,
 * never the simulation stream, so co-op boards and replays stay identical no
 * matter what the GPU draws.
 */

/** One octave count for every effect, changed in place when quality changes. */
export const fxOctaves = { value: 4 }

/**
 * 0 = High, 1 = Balanced, 2 = Low/Battery. Fewer octaves of turbulence and,
 * through the listeners, fewer instances per effect on the weaker tiers.
 */
let currentTier = -1
const tierListeners: ((tier: number) => void)[] = []
export function setFxQuality(tier: number): void {
  if (tier === currentTier) return
  currentTier = tier
  fxOctaves.value = tier >= 2 ? 2 : tier === 1 ? 3 : 4
  for (const listener of tierListeners) listener(tier)
}
export function onFxQuality(listener: (tier: number) => void): void {
  tierListeners.push(listener)
  if (currentTier >= 0) listener(currentTier)
}
export const fxLite = (): boolean => currentTier >= 2

/** Value noise and fractal turbulence; `fxFbm` normalises to roughly 0..1. */
export const NOISE_GLSL = /* glsl */`
  uniform int uOct;
  float fxHash(vec2 p){
    vec3 p3=fract(vec3(p.xyx)*.1031);
    p3+=dot(p3,p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
  }
  float fxNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    vec2 u=f*f*(3.-2.*f);
    return mix(mix(fxHash(i),fxHash(i+vec2(1.,0.)),u.x),
               mix(fxHash(i+vec2(0.,1.)),fxHash(i+vec2(1.,1.)),u.x),u.y);
  }
  float fxFbm(vec2 p){
    float s=0.,a=.5,n=0.;
    for(int i=0;i<5;i++){
      if(i>=uOct)break;
      s+=a*fxNoise(p);n+=a;
      p=mat2(1.62,1.18,-1.18,1.62)*p+vec2(3.1,1.7);
      a*=.5;
    }
    return s/n;
  }
  // Temperature to emitted colour, in linear light. Cool soot-red at the
  // fringe, through orange and yellow, to a near-white core.
  vec3 fxFireRamp(float t){
    vec3 c=mix(vec3(.16,.012,.0),vec3(.85,.10,.006),smoothstep(.0,.3,t));
    c=mix(c,vec3(1.,.36,.03),smoothstep(.25,.55,t));
    c=mix(c,vec3(1.,.70,.20),smoothstep(.5,.8,t));
    c=mix(c,vec3(1.,.95,.78),smoothstep(.8,1.,t));
    return c;
  }
`

/**
 * Premultiplied "over": a colour can glow (rgb with little alpha, which adds
 * light) and occlude (alpha, which hides what is behind) in the same pixel.
 * Fire is mostly the first, smoke mostly the second.
 */
export const PREMULTIPLIED: Partial<THREE.ShaderMaterialParameters> = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  toneMapped: false,
}

/** Linear colour + coverage → premultiplied output, colour-converted. */
export const PREMULTIPLY_OUT = /* glsl */`
  #include <colorspace_fragment>
  gl_FragColor.rgb*=fxGlow;
`

/** A unit quad (-0.5..0.5 × 0..1) for flames that stand on their base. */
export function standingQuad(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, .5, 1, 0, -.5, 1, 0], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  return g
}

/** A unit quad (-1..1) for billboards and ground decals. */
export function centredQuad(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  return g
}

/** Copy a base geometry's attributes into an instanced one. */
export function instanced(base: THREE.BufferGeometry, attrs: Record<string, THREE.InstancedBufferAttribute>, count: number): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  for (const [name, attr] of Object.entries(base.attributes)) g.setAttribute(name, attr)
  for (const [name, attr] of Object.entries(attrs)) g.setAttribute(name, attr)
  g.instanceCount = count
  // positions are computed on the GPU; a generous bound keeps three from
  // treating the shared geometry as empty
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
  return g
}

/** Effects are never picked. */
export const noRaycast = (): void => {}
