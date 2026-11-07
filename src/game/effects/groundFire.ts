import * as THREE from 'three'
import { NOISE_GLSL, PREMULTIPLIED, PREMULTIPLY_OUT, centredQuad, fxOctaves, instanced, noRaycast, onFxQuality, standingQuad } from './fxShaders.ts'

/**
 * Burning ground: the scar a Dragonfire Mortar or the Emberthrone leaves.
 *
 * Four draws per patch, all animated on the GPU from one clock:
 *  - hearth: a charred decal with pulsing coal cracks and a soft heat glow
 *  - flames: camera-facing tongues shaded with domain-warped turbulence and a
 *    temperature ramp, so they lick, gust and fray instead of standing still
 *  - smoke: a few soft, warm-lit puffs that drift away and thin out
 *  - embers: tiny voxel cubes that rise, wander and cool from white to red
 *
 * The geometry of every layer is shared by every patch; a patch owns only its
 * materials (for its clock and heat). Nothing here reads the simulation RNG.
 */

// ---- shared, static geometry ------------------------------------------------

/** Tongues in a unit disk, ordered so the first few already cover the patch. */
const TONGUES = (() => {
  const raw: [number, number, number, number, number][] = []
  const n = 9
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + .2) / n) * .66
    const a = i * 2.39996 + .4
    const jitter = Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1)
    // each quad is a stretch of fire bed; the heart burns tallest
    const h = (1.15 - r * .55) * (.8 + jitter * .4)
    const w = 1.05 - r * .3 + jitter * .15
    raw.push([Math.cos(a) * r, Math.sin(a) * r, h, w, i * 1.731 + .37])
  }
  // even indices first: a lite patch keeps the spread, not just the middle
  return [...raw.filter((_, i) => i % 2 === 0), ...raw.filter((_, i) => i % 2 === 1)]
})()

const tongueAttr = new THREE.InstancedBufferAttribute(new Float32Array(TONGUES.flatMap(t => t.slice(0, 4))), 4)
const tongueSeed = new THREE.InstancedBufferAttribute(new Float32Array(TONGUES.map(t => t[4])), 1)
const flameGeometry = instanced(standingQuad(), { aTongue: tongueAttr, aSeed: tongueSeed }, TONGUES.length)

const SMOKE = 7
const smokeGeometry = instanced(centredQuad(), {
  aSeed: new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: SMOKE }, (_, i) => i / SMOKE + i * .137)), 1),
}, SMOKE)

const EMBERS = 22
const emberGeometry = instanced(new THREE.BoxGeometry(1, 1, 1), {
  aSeed: new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: EMBERS }, (_, i) => i * 2.39996 + .11)), 1),
}, EMBERS)

const hearthGeometry = new THREE.PlaneGeometry(2, 2)
hearthGeometry.rotateX(-Math.PI / 2)

onFxQuality(tier => {
  flameGeometry.instanceCount = tier >= 2 ? 5 : tier === 1 ? 7 : TONGUES.length
  smokeGeometry.instanceCount = tier >= 2 ? 3 : tier === 1 ? 5 : SMOKE
  emberGeometry.instanceCount = tier >= 2 ? 9 : tier === 1 ? 15 : EMBERS
})

/** a light breeze every patch agrees on, so the board reads as one weather */
const WIND = /* glsl */`const vec2 WIND=vec2(.82,.34);`

// ---- shaders -----------------------------------------------------------------

const FLAME_VERT = /* glsl */`
  ${WIND}
  uniform float uTime,uHeat,uRadius,uSize,uSeed;
  attribute vec4 aTongue;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed,vFront,vTall;
  void main(){
    vUv=uv;
    float seed=aSeed+uSeed;
    vSeed=seed;
    vec3 base=vec3(aTongue.x*uRadius,0.,aTongue.y*uRadius);
    vec3 world=(modelMatrix*vec4(base,1.)).xyz;
    vec3 toCam=cameraPosition-world;
    vec3 fwd=normalize(toCam);
    vec3 right=normalize(cross(vec3(0.,1.,0.),toCam));
    // half cylindrical, half spherical: upright like fire, but still readable
    // from the steep camera a tower defence board is played from
    vec3 up=normalize(mix(vec3(0.,1.,0.),cross(fwd,right),.42));
    // tongues in front of the patch sit lower, so the fire never hides a foe
    vFront=smoothstep(-.1,.75,dot(normalize(aTongue.xy+1e-4),normalize(toCam.xz)))*length(aTongue.xy)/.74;
    float t=uTime;
    float gust=.84+.13*sin(t*2.7+seed*5.1)+.09*sin(t*6.9+seed*11.3)+.05*sin(t*13.1+seed*3.7);
    float flare=1.+.55*exp(-t*4.5);
    float h=aTongue.z*uSize*uHeat*gust*flare*(1.-vFront*.28);
    float w=aTongue.w*uSize*.62*mix(.55,1.,uHeat);
    vTall=h;
    vec3 p=world+right*position.x*w+up*position.y*h;
    // the crown leans downwind and sways; the foot stays planted
    float y2=position.y*position.y;
    p.xz+=WIND*y2*h*.22+vec2(sin(t*3.3+seed),cos(t*2.6+seed*1.7))*y2*h*.07;
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
  }`

const FLAME_FRAG = /* glsl */`
  ${NOISE_GLSL}
  uniform float uTime,uHeat,uFade;
  varying vec2 vUv;
  varying float vSeed,vFront,vTall;
  void main(){
    float t=uTime;
    vec2 p=vec2((vUv.x-.5)*2.,vUv.y);
    // Each quad is a stretch of fire bed. Turbulence scrolling upward sets
    // where every lick reaches; a pixel burns if it is below that height, and
    // its temperature is how far below - hot at the root, red at the tip.
    float bend=(fxNoise(vec2(p.y*1.3-t*.9,vSeed))-.5)*.4*p.y;
    vec2 q=vec2(p.x+bend,p.y);
    float n=fxFbm(vec2(q.x*3.1+vSeed*7.,q.y*1.3-t*2.0));
    float n2=fxFbm(vec2(q.x*6.4+vSeed*3.,q.y*2.6-t*3.6));
    // a rounded dome, so the quad has no corners of its own
    float dome=pow(max(0.,1.-q.x*q.x),.8);
    float reach=dome*(.12+n*1.0+(n2-.5)*.42);
    // temperature by distance below the local tip, softened by a fixed band
    // so small licks get feathered edges rather than a cut-out line
    float temp=clamp((reach-p.y)/(.1+reach*.55),0.,1.);
    // wisps tearing free above the tips
    float wisp=smoothstep(.62,.9,fxFbm(vec2(q.x*5.+vSeed,q.y*3.2-t*4.4)))*smoothstep(reach+.32,reach,p.y)*step(reach,p.y)*dome;
    temp=max(temp,wisp*.42);
    temp=clamp(temp*(.85+n2*.35)*mix(.55,1.,uHeat),0.,1.);
    vec3 col=fxFireRamp(temp*.87);
    // a dark, sooty rim at the tips keeps the outline on bright ground
    float fringe=smoothstep(.0,.12,temp)*(1.-smoothstep(.12,.34,temp))*smoothstep(reach*.35,reach*.8,p.y);
    col=mix(col,vec3(.12,.03,.008),fringe*.6);
    // no edges of its own: the root sinks into the char and the sides into air
    float soft=smoothstep(0.,.24,p.y+(n2-.5)*.12)*smoothstep(0.,.45,dome);
    float glow=smoothstep(.0,.35,temp)*soft;
    float cover=(smoothstep(.0,.2,temp)*.4+smoothstep(.4,.75,temp)*.45)*soft;
    glow*=uFade*(1.-vFront*.25);
    cover*=uFade*(1.-vFront*.5);
    if(glow<.004&&cover<.004)discard;
    float fxGlow=max(glow,cover);
    gl_FragColor=vec4(col,cover);
    ${PREMULTIPLY_OUT}
  }`

const SMOKE_VERT = /* glsl */`
  ${WIND}
  uniform float uTime,uHeat,uFade,uRadius,uSeed;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vLife,vAlpha,vSeed;
  void main(){
    vUv=uv;
    float seed=aSeed+uSeed;
    vSeed=seed;
    float life=fract(uTime*.24+seed);
    vLife=life;
    float a=seed*6.2831;
    vec3 c=vec3(cos(a)*uRadius*.42,0.,sin(a)*uRadius*.42);
    c.y=.35+life*1.55*(.6+.4*uHeat);
    c.xz+=WIND*life*life*.9+vec2(sin(seed*9.+life*3.),cos(seed*7.+life*2.))*.12*life;
    float size=(.18+life*.55)*(.6+.4*uRadius);
    vec4 mv=modelViewMatrix*vec4(c,1.);
    vec3 toCam=normalize(cameraPosition-(modelMatrix*vec4(c,1.)).xyz);
    float front=smoothstep(-.2,.5,dot(normalize(c.xz+1e-4),normalize(toCam.xz)));
    vAlpha=sin(life*3.14159)*uFade*(.35+.65*uHeat)*(1.-front*.55);
    float r=seed*4.+life*1.3;
    mv.xy+=mat2(cos(r),-sin(r),sin(r),cos(r))*position.xy*size;
    gl_Position=projectionMatrix*mv;
  }`

const SMOKE_FRAG = /* glsl */`
  ${NOISE_GLSL}
  uniform float uHeat;
  varying vec2 vUv;
  varying float vLife,vAlpha,vSeed;
  void main(){
    vec2 p=vUv*2.-1.;
    float n=fxFbm(p*1.7+vec2(vSeed*13.,vLife*1.6));
    float d=1.-smoothstep(.25,1.,length(p)+(n-.5)*.75);
    // soot, lit from above, warmed from beneath while the fire still burns
    float lit=clamp(.55+p.y*.35+(n-.5)*.6,0.,1.);
    vec3 col=mix(vec3(.045,.04,.038),vec3(.26,.245,.235),lit);
    col+=vec3(.42,.12,.02)*(1.-vLife)*uHeat*(1.-lit)*.9;
    float a=d*vAlpha*.34;
    if(a<.003)discard;
    float fxGlow=a;
    gl_FragColor=vec4(col,a);
    ${PREMULTIPLY_OUT}
  }`

const EMBER_VERT = /* glsl */`
  ${WIND}
  uniform float uTime,uHeat,uFade,uRadius,uSeed;
  attribute float aSeed;
  varying float vTemp,vAlpha;
  void main(){
    float seed=aSeed+uSeed;
    float rate=.5+.25*fract(seed*.37);
    float life=fract(uTime*rate+fract(seed*.61));
    float cyc=floor(uTime*rate+fract(seed*.61));
    float a=seed*2.1+cyc*1.7,r=uRadius*(.15+.6*fract(seed*.73+cyc*.31));
    vec3 c=vec3(cos(a)*r,.05,sin(a)*r);
    float rise=(.55+.5*fract(seed*.19+cyc*.53))*(.45+.55*uHeat);
    c.y+=life*rise*1.3;
    // a curl-like wander, growing as the ember climbs out of the updraft
    c.x+=sin(life*7.+seed*3.)*.09*life+WIND.x*life*life*.5;
    c.z+=cos(life*5.3+seed*5.)*.09*life+WIND.y*life*life*.5;
    vTemp=1.-life;
    vAlpha=smoothstep(0.,.08,life)*(1.-smoothstep(.65,1.,life))*uFade*(.4+.6*uHeat);
    float size=mix(.016,.032,fract(seed*.91))*(1.-life*.55);
    float s=uTime*(2.+fract(seed)*3.)+seed;
    mat3 spin=mat3(cos(s),0.,-sin(s),0.,1.,0.,sin(s),0.,cos(s))*mat3(1.,0.,0.,0.,cos(s*.7),sin(s*.7),0.,-sin(s*.7),cos(s*.7));
    vec3 p=c+spin*position*size;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`

const EMBER_FRAG = /* glsl */`
  varying float vTemp,vAlpha;
  void main(){
    vec3 col=mix(vec3(.5,.04,.0),vec3(1.,.38,.03),smoothstep(.15,.6,vTemp));
    col=mix(col,vec3(1.,.78,.36),smoothstep(.8,1.,vTemp));
    float fxGlow=vAlpha;
    gl_FragColor=vec4(col,vAlpha*.25);
    ${PREMULTIPLY_OUT}
  }`

const HEARTH_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`

const HEARTH_FRAG = /* glsl */`
  ${NOISE_GLSL}
  uniform float uTime,uHeat,uFade,uSeed;
  varying vec2 vUv;
  void main(){
    // the decal spans 1.7 radii, so 1.0 here is the edge of the burning patch
    vec2 p=(vUv*2.-1.)*1.7;
    float r=length(p);
    float n=fxFbm(p*1.9+uSeed);
    float charA=(1.-smoothstep(.5,.82,r+(n-.5)*.55))*.62*uFade;
    vec3 charCol=mix(vec3(.018,.015,.013),vec3(.07,.055,.045),fxNoise(p*7.+uSeed));
    // coal veins: thin ridges in a second field, breathing slowly
    float v=fxNoise(p*5.5+vec2(uSeed*.7,-uSeed));
    float spots=smoothstep(.68,.9,v)*smoothstep(.45,.75,fxNoise(p*2.1-uSeed));
    float breathe=.6+.4*sin(uTime*2.3+fxNoise(p*1.3+uSeed)*6.);
    float coals=spots*smoothstep(1.,.3,r+(n-.5)*.5)*breathe*(.25+.75*uHeat);
    // warm light thrown on the ground around the flames
    float heat=exp(-r*r*3.4)*uHeat;
    vec3 glow=(vec3(1.,.28,.03)*coals*1.1+vec3(1.,.36,.08)*heat*.17)*uFade;
    // char occludes the ground, the glow only adds light on top of it
    gl_FragColor=vec4(charCol,1.);
    #include <colorspace_fragment>
    vec3 charOut=gl_FragColor.rgb*charA;
    gl_FragColor=vec4(glow,1.);
    #include <colorspace_fragment>
    gl_FragColor=vec4(charOut+gl_FragColor.rgb,charA);
  }`

// ---- patch -------------------------------------------------------------------

const activeFires = new Set<GroundFire>()

export class GroundFire {
  readonly group = new THREE.Group()
  private uniforms = {
    uTime: { value: 0 }, uFade: { value: 0 }, uHeat: { value: 0 },
    uRadius: { value: 1 }, uSize: { value: 1 }, uSeed: { value: 0 }, uOct: fxOctaves,
  }
  private hearth: THREE.Mesh
  private flames: THREE.Mesh
  private smoke: THREE.Mesh
  private embers: THREE.Mesh
  get heat(): number { return this.uniforms.uHeat.value }
  /** seconds since ignition, for the light flicker */
  get age(): number { return this.uniforms.uTime.value }
  private extinguished: number | null = null
  private coolingHeat = 0

  constructor(at: THREE.Vector3, readonly radius: number, private started: number, private until: number) {
    this.group.name = 'mortar-fire'
    this.group.position.copy(at); this.group.position.y += .035
    const u = this.uniforms
    u.uRadius.value = radius
    // taller fire on a wider scar, but never towering over the road
    u.uSize.value = .5 + Math.sqrt(radius) * .26
    u.uSeed.value = Math.abs(Math.sin(at.x * 12.9898 + at.z * 78.233) * 43758.5453) % 1 * 9
    const material = (vertexShader: string, fragmentShader: string) => new THREE.ShaderMaterial({ ...PREMULTIPLIED, uniforms: u, vertexShader, fragmentShader })

    this.hearth = new THREE.Mesh(hearthGeometry, material(HEARTH_VERT, HEARTH_FRAG))
    this.hearth.scale.setScalar(radius * 1.7)
    ;(this.hearth.material as THREE.ShaderMaterial).polygonOffset = true
    ;(this.hearth.material as THREE.ShaderMaterial).polygonOffsetFactor = -2
    this.flames = new THREE.Mesh(flameGeometry, material(FLAME_VERT, FLAME_FRAG))
    ;(this.flames.material as THREE.ShaderMaterial).side = THREE.DoubleSide
    this.smoke = new THREE.Mesh(smokeGeometry, material(SMOKE_VERT, SMOKE_FRAG))
    this.embers = new THREE.Mesh(emberGeometry, material(EMBER_VERT, EMBER_FRAG))
    this.hearth.renderOrder = 1
    this.embers.renderOrder = 2
    this.flames.renderOrder = 3
    this.smoke.renderOrder = 4
    this.embers.name = 'fire-embers'
    for (const mesh of [this.hearth, this.flames, this.smoke, this.embers]) {
      mesh.frustumCulled = false
      mesh.raycast = noRaycast
    }
    // order matters to callers: [1] is always the flames
    this.group.add(this.hearth, this.flames, this.smoke, this.embers)
    activeFires.add(this)
    this.update(started)
  }

  /** Cooling is presentation only; the damage zone has already expired. */
  extinguish(time: number): void {
    this.update(time)
    this.coolingHeat = this.heat
    this.extinguished = time
  }

  update(time: number): boolean {
    const age = time - this.started, cooling = this.extinguished === null ? 0 : time - this.extinguished
    const u = this.uniforms
    u.uTime.value = age
    u.uFade.value = Math.max(0, Math.min(1, age / .2, 1 - cooling / 1.8))
    u.uHeat.value = this.extinguished === null
      ? Math.max(0, Math.min(1, age / .16, (this.until - time) / .55))
      : this.coolingHeat * Math.max(0, 1 - cooling / .45)
    this.flames.visible = u.uHeat.value > 0
    return cooling < 1.8
  }

  dispose(): void {
    activeFires.delete(this)
    this.group.removeFromParent()
    for (const mesh of [this.hearth, this.flames, this.smoke, this.embers]) (mesh.material as THREE.Material).dispose()
    // geometries are shared by every patch and live for the session
  }
}

/** Two stable, shadowless lights for the whole scene; adding a patch never
 * changes the material shader variants or creates a light per particle. */
export function updateFireLights(lights: readonly THREE.PointLight[], camera: THREE.Vector3): void {
  let previous: GroundFire | undefined
  for (const light of lights) {
    let best: GroundFire | undefined, score = 0
    for (const fire of activeFires) {
      if (previous && fire.group.position.distanceToSquared(previous.group.position) < previous.radius * previous.radius) continue
      const weight = fire.heat / (1 + fire.group.position.distanceToSquared(camera))
      if (weight > score) { best = fire; score = weight }
    }
    if (best) {
      // an irregular flicker, never a strobe: three incommensurate beats
      const t = best.age
      const flicker = .8 + .1 * Math.sin(t * 11.3) + .06 * Math.sin(t * 23.7 + 1.3) + .04 * Math.sin(t * 5.1 + 2.1)
      light.intensity = best.heat * .35 * Math.min(1, flicker)
      light.position.copy(best.group.position); light.position.y += .32
      light.distance = best.radius * 1.9
      previous = best
    } else light.intensity = 0
  }
}
