import * as THREE from 'three'
import { fireGeometry, fireBases } from './fireGeometry.ts'

const smokeGeometry = new THREE.IcosahedronGeometry(1, 1)
const sparkGeometry = new THREE.PlaneGeometry(2, 2)
const activeFires = new Set<GroundFire>()
const groundGeometry = new THREE.PlaneGeometry(2, 2)
groundGeometry.rotateX(-Math.PI / 2)
const vertex = /* glsl */`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`

/** Four instanced/static draws per patch. Time and fade are the only frame
 * uploads; smoke and tongues move on the GPU without per-tick particle work. */
export class GroundFire {
  readonly group = new THREE.Group()
  private uniforms = { uGlow: {value: 1}, uTime: { value: 0 }, uFade: { value: 0 }, uHeat: { value: 0 } }
  private flames: THREE.Mesh
  private smoke: THREE.InstancedMesh
  private hearth: THREE.Mesh
  private sparks: THREE.InstancedMesh
  get heat(): number { return this.uniforms.uHeat.value }
  private extinguished: number | null = null

  constructor(at: THREE.Vector3, readonly radius: number, private started: number, private until: number) {
    this.group.name = 'mortar-fire'
    this.group.position.copy(at); this.group.position.y += .035
    const material = new THREE.ShaderMaterial({
      depthWrite: true, toneMapped: false, vertexColors: true, uniforms: {...this.uniforms,uRadius:{value:radius}},
      side: THREE.DoubleSide,
      // Each tongue holds a short pose, then flicks into the next. Its facets
      // share the beat; only the middle and tip move, never the planted foot.
      vertexShader: /* glsl */`
        uniform float uTime,uHeat,uRadius;
        attribute vec4 aBase;
        attribute float aSeed;
        varying vec3 vColor,vLocal;
        void main(){
          vColor=color;vLocal=position;
          float beat=uTime*(9.+1.3*sin(aSeed))+aSeed;
          float tick=floor(beat),blend=smoothstep(.65,1.,fract(beat));
          float t=(tick+blend)*.45+aSeed;
          float flick=mix(sin(tick*2.17+aSeed),sin((tick+1.)*2.17+aSeed),blend);
          vec3 p=position;
          float y=p.y;
          p.x+=sin(t-y*4.)*y*y*.13;
          p.z+=cos(t*.73-y*3.)*y*y*.07;
          p.x*=1.-y*.12*sin(t-y*3.);
          p.y+=y*y*(.12*sin(t-y*2.)+.07*flick);
          vec2 view=normalize(cameraPosition.xz-modelMatrix[3].xz);
          float a=atan(view.x,view.y)+sin(aSeed)*.65,c=cos(a),s=sin(a);
          p.xz=mat2(c,-s,s,c)*p.xz*aBase.w;
          float front=smoothstep(.0,.55,dot(aBase.xy,view));
          p.y*=aBase.z;
          p*=uHeat*(1.-front*.22);
          p.xz+=aBase.xy*uRadius;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      // Unlit, asymmetric heat regions follow the rising core through the volume.
      fragmentShader: /* glsl */`
        varying vec3 vColor,vLocal;
        void main(){
          vec2 p=floor(vLocal.xy*14.+.5)/14.;
          float axis=.035*sin(p.y*7.);
          vec3 color=vec3(.88,.057,.003);
          if(abs(p.x-axis)<.31-p.y*.20&&p.y<.94)color=vec3(1.,.29,.006);
          if(abs(p.x-axis-.02)<.22-p.y*.17&&p.y<.78)color=vec3(1.,.67,.025);
          if(abs(p.x-axis+.015)<.11-p.y*.13&&p.y>.055&&p.y<.54)color=vec3(1.,.92,.61);
          gl_FragColor=vec4(color*vColor,1.);
          #include <colorspace_fragment>
        }`,
    })
    this.flames = new THREE.Mesh(fireGeometry, material)
    this.flames.frustumCulled = false
    const pose = new THREE.Object3D()
    this.smoke = new THREE.InstancedMesh(smokeGeometry, new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime,uFade;
        varying float vAlpha,vLight;
        void main(){
          vec4 center=instanceMatrix*vec4(0,0,0,1);
          float seed=dot(center.xz,vec2(17.3,9.7))+center.y*17.;
          float low=step(.32,center.y);
          float life=fract(uTime*.34+seed);
          float size=mix(.10+life*.23,.12+life*.14,low)*sin(life*3.14159);
          vec3 p=vec3(center.x,0,center.z)+position*size;
          p.y+=mix(.35+life*.9,.12+life*.45,low);
          p.x+=life*.22+sin(seed+life*4.)*.08;
          p.z+=sin(seed)*life*.13;
          vAlpha=sin(life*3.14159)*uFade*mix(.19,.13,low);
          vLight=.5+.5*dot(normal,normalize(vec3(-.4,1.,.5)));
          vec4 mv=modelViewMatrix*vec4(p,1.);
          vAlpha*=pow(max(0.,dot(normalize(normalMatrix*normal),normalize(-mv.xyz))),1.3);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vAlpha,vLight;
        void main(){
          gl_FragColor=vec4(mix(vec3(.10,.105,.11),vec3(.25,.25,.24),vLight),vAlpha);
          #include <colorspace_fragment>
        }`,
    }),9)
    this.smoke.frustumCulled = false
    for (let i=0;i<this.smoke.count;i++) {
      const [x,z]=fireBases[i%8]
      pose.position.set(x*radius*1.1,i*.071,z*radius*1.1)
      pose.scale.setScalar(1);pose.updateMatrix();this.smoke.setMatrixAt(i,pose.matrix)
    }
    this.smoke.instanceMatrix.needsUpdate=true
    this.hearth = new THREE.Mesh(groundGeometry, new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,toneMapped:false,uniforms:{...this.uniforms,uBases:{value:fireBases.slice(0,8).map(b=>new THREE.Vector2(b[0],b[1]))}},vertexShader:vertex,
      fragmentShader: /* glsl */`
        uniform float uTime,uFade,uHeat;
        uniform vec2 uBases[8];
        varying vec2 vUv;
        void main(){
          vec2 p=vUv*2.-1.;
          float ripple=sin(p.x*17.+sin(p.y*9.))*sin(p.y*19.+p.x*4.);
          float base=0.;
          for(int i=0;i<8;i++){vec2 d=p-uBases[i];base+=exp(-dot(d,d)*24.);}
          float edge=smoothstep(.06,.75,base+ripple*.06);
          float coal=smoothstep(.5,.92,ripple)*min(1.,base)*(.72+.28*sin(uTime*2.+p.x*12.));
          vec3 color=mix(vec3(.018,.016,.014),vec3(1.,.19,.008),coal*(.35+uHeat*.65));
          gl_FragColor=vec4(color,edge*(.66+ripple*.08)*uFade);
          #include <colorspace_fragment>
        }`,
    }))
    this.hearth.scale.setScalar(radius)
    this.sparks = new THREE.InstancedMesh(sparkGeometry,new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,
      uniforms:this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime,uHeat,uGlow;
        varying vec2 vUv;
        varying float vAlpha,vLife,vGlow;
        void main(){
          vUv=uv;
          vec3 base=instanceMatrix[3].xyz;
          float id=base.y,seed=id*2.39996;
          vGlow=1.-step(8.,id);
          float life=fract(uTime*(.42+.05*sin(seed))+seed);
          vLife=life;
          float large=step(.75,fract(seed*.31));
          float size=mix(.012,.03,large)*sin(life*3.14159);
          base.y=.1+large*.4+life*(.6+large*.3);
          base.xz+=vec2(sin(seed),cos(seed*.7))*life*.19;
          vAlpha=sin(life*3.14159)*uHeat;
          if(vGlow>.5){base.y=.15;size=.24;vAlpha=.16*uHeat*uGlow;}
          vec4 mv=modelViewMatrix*vec4(base,1.);
          float a=.7+life*.5,c=cos(a),s=sin(a);
          mv.xy+=mat2(c,-s,s,c)*position.xy*size;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        varying float vAlpha,vLife,vGlow;
        void main(){
          float soft=pow(max(0.,1.-length(vUv*2.-1.)),2.);
          vec3 color=mix(vec3(1.,.55,.04),vec3(.85,.10,.008),vLife*(1.-vGlow));
          gl_FragColor=vec4(color,vAlpha*mix(1.,soft,vGlow));
          #include <colorspace_fragment>
        }`,
    }),22)
    this.sparks.name='fire-glow-and-embers';this.sparks.frustumCulled=false
    for(let i=0;i<22;i++){
      const [x,z]=fireBases[i%8]
      pose.position.set(x*radius,i,z*radius);pose.updateMatrix();this.sparks.setMatrixAt(i,pose.matrix)
    }
    this.group.add(this.hearth,this.flames,this.smoke,this.sparks)
    activeFires.add(this)
    this.update(started)
  }

  /** Cooling is presentation only; the damage zone has already expired. */
  extinguish(time: number): void { this.extinguished = time }

  update(time: number): boolean {
    const age=time-this.started,cooling=this.extinguished===null?0:time-this.extinguished
    this.uniforms.uTime.value=age
    this.uniforms.uFade.value=Math.max(0,Math.min(1,age/.2,1-cooling/1.8))
    this.uniforms.uHeat.value=this.extinguished===null?Math.max(0,Math.min(1,age/.16,(this.until-time)/.55)):0
    this.flames.visible=this.uniforms.uHeat.value>0
    return cooling<1.8
  }

  dispose(): void {
    activeFires.delete(this)
    this.group.removeFromParent()
    for(const mesh of [this.flames,this.smoke,this.sparks]) {if(mesh instanceof THREE.InstancedMesh)mesh.dispose();(mesh.material as THREE.Material).dispose()}
    ;(this.hearth.material as THREE.Material).dispose()
    // Small geometries are shared by every patch.
  }
}

/** Two stable, shadowless lights for the whole scene; adding a patch never
 * changes the material shader variants or creates a light per particle. */
export function updateFireLights(lights: readonly THREE.PointLight[], camera: THREE.Vector3): void {
  let previous: GroundFire | undefined
  for(const light of lights){
    let best: GroundFire | undefined, score=0
    for(const fire of activeFires){
      if(previous && fire.group.position.distanceToSquared(previous.group.position)<previous.radius*previous.radius)continue
      const weight=fire.heat/(1+fire.group.position.distanceToSquared(camera))
      if(weight>score){best=fire;score=weight}
    }
    light.intensity=best?best.heat*.35:0
    if(best){light.position.copy(best.group.position);light.position.y+=.32;light.distance=best.radius*1.65;previous=best}
  }
}
