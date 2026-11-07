import * as THREE from 'three'
import { NOISE_GLSL, PREMULTIPLIED, PREMULTIPLY_OUT, centredQuad, fxLite, fxOctaves, instanced, noRaycast } from './fxShaders.ts'

/**
 * Blasts: shell impacts, muzzle flashes and shell smoke.
 *
 * Three instanced pools, each one draw call, each animated entirely on the GPU
 * from a single clock. Emitting writes one slot of a ring buffer; updating is
 * one uniform. That matters because the particle clock runs inside the fixed
 * simulation step, which at 4× speed is two dozen updates per frame.
 *
 *  - puffs: camera-facing gas - the flash, the fireball that cools into soot,
 *    the smoke plume, dust kicked along the ground, muzzle and shell smoke
 *  - ground: decals - the shockwave of dust and the scorch mark it leaves
 *  - debris: voxel chunks thrown out, bouncing once, glowing as they cool
 *
 * Seeds come from Math.random: this is presentation and must never touch the
 * simulation stream that co-op and replays depend on.
 */

const PUFFS = 224
const GROUND = 40
const DEBRIS = 112
const DEAD = -1e5

class Ring {
  readonly geometry: THREE.InstancedBufferGeometry
  private arrays: Float32Array[]
  private attrs: THREE.InstancedBufferAttribute[]
  private cursor = 0
  private dirty = false

  constructor(base: THREE.BufferGeometry, names: string[], readonly size: number) {
    this.arrays = names.map(() => new Float32Array(size * 4))
    this.attrs = this.arrays.map(a => new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage))
    this.geometry = instanced(base, Object.fromEntries(names.map((n, i) => [n, this.attrs[i]])), size)
    this.reset()
  }

  /** claim the next slot and fill its attributes, four floats each */
  push(...rows: [number, number, number, number][]): void {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.size
    rows.forEach((row, n) => this.arrays[n].set(row, i * 4))
    this.dirty = true
  }

  flush(): void {
    if (!this.dirty) return
    this.dirty = false
    for (const attr of this.attrs) attr.needsUpdate = true
  }

  reset(): void {
    for (const a of this.arrays) a.fill(0)
    // the first attribute's w is the birth time; far past means dead
    for (let i = 0; i < this.size; i++) this.arrays[0][i * 4 + 3] = DEAD
    this.cursor = 0
    this.dirty = true
  }
}

// ---- shaders -----------------------------------------------------------------

const PUFF_VERT = /* glsl */`
  uniform float uTime;
  attribute vec4 aA;   // position, birth
  attribute vec4 aB;   // size, seed, drift x, drift z
  attribute vec4 aC;   // life, rise, kind (0 fireball, 1 smoke, 2 flash), heat | opacity
  varying vec2 vUv;
  varying float vAge,vSeed,vKind,vHeat;
  void main(){
    float tt=uTime-aA.w;
    float age=tt/aC.x;
    vUv=uv;vAge=age;vSeed=aB.y;vKind=aC.z;vHeat=aC.w;
    if(age<0.||age>=1.){gl_Position=vec4(0.,0.,2.,1.);return;}
    float kind=aC.z;
    bool dust=kind>.5&&kind<1.5&&aC.w>=2.;
    float drag=kind<.5?3.4:dust?2.6:1.5;
    vec3 v=vec3(aB.z,aC.y,aB.w);
    vec3 p=aA.xyz;
    if(kind<1.5)p+=v*(1.-exp(-drag*tt))/drag;
    // hot gas keeps climbing after the burst has spent itself
    p.y+=(kind<.5?.5:dust?.03:.16)*tt*tt;
    float grow=kind<.5?mix(.32,1.,1.-pow(1.-min(age*2.4,1.),3.))*(1.+age*.6)
      :kind<1.5?mix(.42,1.,sqrt(age))*(1.+age*.5)
      :mix(.75,1.2,age);
    float size=aB.x*grow;
    vec4 mv=modelViewMatrix*vec4(p,1.);
    // lean each quad towards the eye so a puff on the ground is not sliced by it
    mv.z+=size*.7;
    float r=aB.y*6.2831+tt*(fract(aB.y*7.)-.5)*1.4;
    mv.xy+=mat2(cos(r),-sin(r),sin(r),cos(r))*position.xy*size;
    gl_Position=projectionMatrix*mv;
  }`

const PUFF_FRAG = /* glsl */`
  ${NOISE_GLSL}
  varying vec2 vUv;
  varying float vAge,vSeed,vKind,vHeat;
  void main(){
    vec2 p=vUv*2.-1.;
    float r=length(p);
    if(r>1.)discard;
    vec3 col;float a,fxGlow;
    if(vKind>1.5){
      // the flash: a white point that blooms orange and is gone
      float f=exp(-r*r*6.)*(1.-vAge)*(1.-vAge)*.85;
      col=mix(vec3(1.,.38,.08),vec3(1.,.9,.7),exp(-r*r*16.));
      a=0.;fxGlow=f;
    }else{
      float n=fxFbm(p*1.6+vec2(vSeed*17.3,vSeed*5.1-vAge*.9));
      float n2=fxFbm(p*3.4+vec2(vSeed*3.1+vAge*.6,vAge*1.4));
      float dens=1.-smoothstep(.3,.95,r+(n-.5)*.95+(n2-.5)*.3);
      float lit=clamp(.5+p.y*.42+(n-.5)*.8,0.,1.);
      if(vKind<.5){
        // fireball: white-hot core, orange rim, cooling outward and over time
        float temp=clamp((1.08-vAge*2.5+vHeat*.12)*(1.15-r*.8)+(n2-.5)*.7,0.,1.);
        vec3 fire=fxFireRamp(temp);
        float burning=smoothstep(.12,.48,temp);
        vec3 soot=mix(vec3(.045,.038,.032),vec3(.29,.265,.24),lit);
        soot+=vec3(.55,.17,.03)*smoothstep(.02,.3,temp)*(1.-lit);
        col=mix(soot,fire,burning);
        float fade=1.-smoothstep(.45,1.,vAge);
        a=dens*fade*mix(.6,.5,burning);
        fxGlow=max(a,dens*burning*fade);
      }else{
        // smoke (grey) or dust (earth), with opacity carried in the heat slot
        bool isDust=vHeat>=2.;
        float opacity=isDust?vHeat-2.:vHeat;
        vec3 grey=mix(vec3(.11,.105,.1),vec3(.6,.585,.56),lit);
        vec3 dust=mix(vec3(.27,.21,.15),vec3(.74,.64,.49),lit);
        col=isDust?dust:grey;
        float fade=smoothstep(0.,.12,vAge)*(1.-smoothstep(.4,1.,vAge));
        a=dens*fade*opacity;
        fxGlow=a;
      }
    }
    if(fxGlow<.003)discard;
    gl_FragColor=vec4(col,a);
    ${PREMULTIPLY_OUT}
  }`

const GROUND_VERT = /* glsl */`
  uniform float uTime;
  attribute vec4 aA;   // position, birth
  attribute vec4 aB;   // radius, seed, life, kind (0 shockwave, 1 scorch)
  varying vec2 vUv;
  varying float vAge,vSeed,vKind;
  void main(){
    float age=(uTime-aA.w)/aB.z;
    vUv=uv;vAge=age;vSeed=aB.y;vKind=aB.w;
    if(age<0.||age>=1.){gl_Position=vec4(0.,0.,2.,1.);return;}
    // -y keeps the quad facing up, so it is not culled from above
    vec3 p=aA.xyz+vec3(position.x,0.,-position.y)*aB.x;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`

const GROUND_FRAG = /* glsl */`
  ${NOISE_GLSL}
  uniform float uTime;
  varying vec2 vUv;
  varying float vAge,vSeed,vKind;
  void main(){
    vec2 p=vUv*2.-1.;
    float r=length(p);
    if(r>1.)discard;
    vec3 col,glow;float a;
    if(vKind<.5){
      // a ring of dust racing outward, with the ground lit white for an instant
      float R=1.-pow(1.-vAge,2.8);
      float n=fxNoise(vec2(atan(p.y,p.x)*4.+vSeed*9.,vAge*3.));
      float w=.09+.12*vAge;
      float band=exp(-pow((r-R*.9)/w,2.))*(.65+.35*n);
      float floorDust=(1.-smoothstep(0.,R*.85,r))*.3;
      float fade=(1.-vAge)*(1.-vAge);
      col=vec3(.62,.53,.40);
      a=(band*.42+floorDust*.25)*fade;
      glow=vec3(1.,.42,.1)*exp(-r*r*9.)*max(0.,1.-vAge*3.5)*.55;
    }else{
      // the scorch: an irregular black blot with splashed streaks and embers
      float n=fxFbm(p*2.2+vSeed*7.);
      float streak=fxNoise(vec2(atan(p.y,p.x)*3.2+vSeed*5.,r*1.5));
      float m=1.-smoothstep(.38,.98,r+(n-.5)*.62-streak*.18);
      float fade=1.-smoothstep(.55,1.,vAge);
      col=mix(vec3(.025,.02,.016),vec3(.08,.062,.048),n);
      a=m*.5*fade;
      // a few embers left in the crater, gone within a second
      float v=fxNoise(p*7.+vSeed*3.);
      float spots=smoothstep(.82,.95,v)*smoothstep(.8,.15,r);
      glow=vec3(1.,.26,.03)*(spots*.4*(1.-smoothstep(0.,.14,vAge))+exp(-r*r*5.)*.35*(1.-smoothstep(0.,.07,vAge)));
    }
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
    vec3 base=gl_FragColor.rgb*a;
    gl_FragColor=vec4(glow,1.);
    #include <colorspace_fragment>
    gl_FragColor=vec4(base+gl_FragColor.rgb,a);
  }`

const DEBRIS_VERT = /* glsl */`
  uniform float uTime;
  attribute vec4 aA;   // position, birth
  attribute vec4 aB;   // velocity, size
  attribute vec4 aC;   // ground y, seed, life, heat
  varying vec3 vNormal;
  varying float vHot,vSeed;
  const float G=10.5;
  mat3 axisAngle(vec3 a,float t){
    float c=cos(t),s=sin(t),k=1.-c;
    return mat3(c+a.x*a.x*k,a.y*a.x*k+a.z*s,a.z*a.x*k-a.y*s,
                a.x*a.y*k-a.z*s,c+a.y*a.y*k,a.z*a.y*k+a.x*s,
                a.x*a.z*k+a.y*s,a.y*a.z*k-a.x*s,c+a.z*a.z*k);
  }
  void main(){
    float t=uTime-aA.w,life=aC.z;
    vSeed=aC.y;
    if(t<0.||t>=life){gl_Position=vec4(0.,0.,2.,1.);return;}
    float size=aB.w*(1.-smoothstep(life*.72,life,t));
    vec3 v=aB.xyz,p0=aA.xyz;
    float floorY=aC.x+size*.5;
    float h0=max(p0.y-floorY,0.);
    float t1=(v.y+sqrt(v.y*v.y+2.*G*h0))/G;
    vec3 p;float spin;
    if(t<t1){p=p0+v*t;p.y-=.5*G*t*t;spin=t;}
    else{
      // one bounce, then a short skid to rest
      vec3 land=p0+v*t1;land.y=floorY;
      float vy=(G*t1-v.y)*.3;
      vec2 vxz=v.xz*.42;
      float t2=2.*vy/G,tb=min(t-t1,t2);
      p=land+vec3(vxz.x,0.,vxz.y)*tb;p.y+=vy*tb-.5*G*tb*tb;
      float ts=max(0.,t-t1-t2);
      p.xz+=vxz*.5*(1.-exp(-ts*7.))/3.5;
      spin=t1+tb*.6+(1.-exp(-ts*7.))*.05;
    }
    vec3 axis=normalize(vec3(sin(aC.y*12.9),cos(aC.y*7.3),sin(aC.y*3.7+1.)));
    mat3 rot=axisAngle(axis,spin*(7.+fract(aC.y*3.1)*9.));
    vNormal=rot*normal;
    vHot=aC.w*(1.-smoothstep(0.,.75,t));
    gl_Position=projectionMatrix*viewMatrix*vec4(p+rot*position*size,1.);
  }`

const DEBRIS_FRAG = /* glsl */`
  uniform vec3 uPalette[3];
  varying vec3 vNormal;
  varying float vHot,vSeed;
  void main(){
    float pick=fract(vSeed*3.17);
    vec3 base=pick<.4?uPalette[0]:pick<.8?uPalette[1]:uPalette[2];
    vec3 n=normalize(vNormal);
    float ndl=max(dot(n,normalize(vec3(-.45,.85,.35))),0.);
    vec3 col=base*(.34+.62*ndl)+vec3(1.,.3,.04)*vHot*1.2;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

// ---- system ------------------------------------------------------------------

export interface BlastOpts {
  /** ground height under the blast, for decals and landing debris (default: y - 0.15) */
  ground?: number
  /** leave a fading scorch mark */
  scorch?: boolean
  /** a cluster bomblet: the same blast, smaller and cheaper */
  small?: boolean
  /** throw voxel chunks (default true) */
  debris?: boolean
}

const rand = Math.random
const between = (a: number, b: number) => a + rand() * (b - a)

export class BlastFx {
  readonly group = new THREE.Group()
  private clock = 0
  private uniforms = { uTime: { value: 0 }, uOct: fxOctaves }
  private puffs = new Ring(centredQuad(), ['aA', 'aB', 'aC'], PUFFS)
  private ground = new Ring(centredQuad(), ['aA', 'aB'], GROUND)
  private debris = new Ring(new THREE.BoxGeometry(1, 1, 1), ['aA', 'aB', 'aC'], DEBRIS)
  private materials: THREE.ShaderMaterial[] = []

  constructor() {
    this.group.name = 'blast-fx'
    const add = (ring: Ring, material: THREE.ShaderMaterial, order: number) => {
      const mesh = new THREE.Mesh(ring.geometry, material)
      mesh.frustumCulled = false
      mesh.raycast = noRaycast
      mesh.renderOrder = order
      this.materials.push(material)
      this.group.add(mesh)
    }
    const ground = new THREE.ShaderMaterial({ ...PREMULTIPLIED, uniforms: this.uniforms, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
    add(this.ground, ground, 1)
    const palette = [0x4a3826, 0x7b6648, 0x5c5953].map(hex => new THREE.Color(hex))
    add(this.debris, new THREE.ShaderMaterial({ uniforms: { ...this.uniforms, uPalette: { value: palette } }, vertexShader: DEBRIS_VERT, fragmentShader: DEBRIS_FRAG }), 0)
    add(this.puffs, new THREE.ShaderMaterial({ ...PREMULTIPLIED, uniforms: this.uniforms, vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG }), 5)
  }

  update(dt: number): void {
    this.clock += dt
    this.uniforms.uTime.value = this.clock
    this.puffs.flush(); this.ground.flush(); this.debris.flush()
  }

  clear(): void {
    this.clock = 0
    this.uniforms.uTime.value = 0
    this.puffs.reset(); this.ground.reset(); this.debris.reset()
  }

  dispose(): void {
    for (const m of this.materials) m.dispose()
    this.puffs.geometry.dispose(); this.ground.geometry.dispose(); this.debris.geometry.dispose()
  }

  private puff(x: number, y: number, z: number, delay: number, size: number, vx: number, vy: number, vz: number, life: number, kind: 0 | 1 | 2, heat: number): void {
    this.puffs.push([x, y, z, this.clock + delay], [size, rand(), vx, vz], [life, vy, kind, heat])
  }

  /** A shell landing: flash, fireball into soot, shockwave, chunks, dust, scorch. */
  explosion(x: number, y: number, z: number, scale: number, o: BlastOpts = {}): void {
    const lite = fxLite()
    const small = !!o.small
    const s = scale
    const ground = o.ground ?? y - .15
    // flash
    this.puff(x, y + .1 * s, z, 0, (small ? .38 : .6) * s, 0, 0, 0, small ? .08 : .11, 2, 0)
    // fireball: a cluster of hot cells, pushed out and up, cooling into soot
    const cells = small ? 2 : lite ? 3 : 5
    for (let i = 0; i < cells; i++) {
      const a = rand() * Math.PI * 2, r = i === 0 ? 0 : between(.06, .2) * s
      const push = between(.25, .6) * s
      this.puff(x + Math.cos(a) * r, y + between(.02, .16) * s, z + Math.sin(a) * r, i * .02,
        between(.24, .32) * s * (i === 0 ? 1.15 : 1), Math.cos(a) * push, between(.5, 1.0) * s, Math.sin(a) * push,
        between(.7, .95) * (small ? .8 : 1), 0, i === 0 ? 1 : between(0, .6))
    }
    // a slower column of smoke that outlives the fire
    const plume = small ? 1 : lite ? 1 : 3
    for (let i = 0; i < plume; i++) {
      this.puff(x + between(-.15, .15) * s, y + .25 * s, z + between(-.15, .15) * s, .12 + i * .07,
        between(.3, .4) * s, between(-.15, .15), between(.45, .8), between(-.15, .15), between(1.2, 1.6), 1, .4)
    }
    // dust thrown low along the ground
    const dust = small ? 2 : lite ? 3 : 6
    for (let i = 0; i < dust; i++) {
      const a = (i / dust) * Math.PI * 2 + rand() * .6, sp = between(1.1, 1.9) * s
      this.puff(x + Math.cos(a) * .2 * s, ground + .14 * s, z + Math.sin(a) * .2 * s, .02,
        between(.16, .24) * s, Math.cos(a) * sp, between(.05, .25), Math.sin(a) * sp, between(.7, 1.0), 1, 2 + .45)
    }
    // shockwave and scorch, laid on the ground
    this.ground.push([x, ground + .03, z, this.clock], [(small ? .7 : 1.15) * s, rand(), small ? .28 : .36, 0])
    if (o.scorch) this.ground.push([x, ground + .022, z, this.clock], [(small ? .26 : .4) * s, rand(), small ? 2.6 : 4.5, 1])
    // voxel chunks
    if (o.debris !== false) {
      const chunks = Math.round((small ? 2 : 5 + 3 * s) * (lite ? .5 : 1))
      for (let i = 0; i < chunks; i++) {
        const a = rand() * Math.PI * 2, sp = between(.55, 1.5) * Math.sqrt(s)
        this.debris.push([x + Math.cos(a) * .1, y + .05, z + Math.sin(a) * .1, this.clock],
          [Math.cos(a) * sp, between(2.4, 4.0) * Math.sqrt(s), Math.sin(a) * sp, between(.035, .07) * Math.sqrt(s) * (small ? .8 : 1)],
          [ground, rand() * 10, between(1.4, 2.2), rand() < .55 ? 1 : 0])
      }
    }
  }

  /**
   * The barrel's report: a flash at the mouth, a short tongue of fire and a
   * ring of smoke. Mortars lob, so the report leaves along the barrel's
   * elevation (`up`), clear of the mouth where the barrel itself would hide it.
   */
  muzzle(x: number, y: number, z: number, dx: number, dz: number, scale: number, up = .75): void {
    const lite = fxLite()
    const s = scale, len = Math.hypot(dx, dz) || 1
    const flat = Math.sqrt(Math.max(0, 1 - up * up))
    const fx = dx / len * flat, fz = dz / len * flat, fy = up
    const ox = x + fx * .16 * s, oy = y + fy * .16 * s, oz = z + fz * .16 * s
    this.puff(ox + fx * .08 * s, oy + fy * .08 * s, oz + fz * .08 * s, 0, .52 * s, 0, 0, 0, .1, 2, 0)
    for (let i = 0; i < (lite ? 1 : 3); i++) {
      const sp = between(1.6, 2.8) * s
      this.puff(ox, oy, oz, i * .012, between(.14, .2) * s, fx * sp, fy * sp, fz * sp, between(.22, .32), 0, 1)
    }
    const smoke = lite ? 3 : 6
    for (let i = 0; i < smoke; i++) {
      // a loose ring around the line of fire, drifting out and climbing
      const a = (i / smoke) * Math.PI * 2 + rand()
      const rx = Math.cos(a), rz = Math.sin(a)
      const sp = between(.5, 1.0) * s
      this.puff(ox, oy, oz, .02 + i * .015, between(.15, .22) * s,
        fx * sp * .8 + rx * .45 * s, fy * sp * .6 + .15, fz * sp * .8 + rz * .45 * s, between(1.0, 1.5), 1, .6)
    }
  }

  /** One soft puff behind a shell in flight; the caller spaces them by distance. */
  shellSmoke(x: number, y: number, z: number): void {
    this.puff(x, y, z, 0, between(.09, .13), between(-.05, .05), between(.05, .2), between(-.05, .05), between(.55, .8), 1, .38)
  }
}
