import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Connected, offset chunks form each tongue; their silhouettes stay crisp
// from every angle without screen-space pixelation or a smooth droplet shape.
const chunks=[
  [0,.10,0,.72,.20,.62],[-.06,.28,.01,.60,.20,.54],
  [.04,.46,-.01,.46,.20,.43],[-.04,.63,.02,.33,.18,.31],
  [.02,.78,0,.22,.15,.21],[.07,.91,.02,.13,.14,.13],
  [.32,.24,-.04,.24,.26,.27],[.38,.43,-.02,.14,.17,.17],
].map(([x,y,z,w,h,d])=>new THREE.BoxGeometry(w,h,d).translate(x,y,z))
const flameGeometry=mergeGeometries(chunks)!
chunks.forEach(g=>g.dispose())
const smokeGeometry = new THREE.SphereGeometry(1, 8, 6)
const groundGeometry = new THREE.PlaneGeometry(2, 2)
groundGeometry.rotateX(-Math.PI / 2)
const vertex = /* glsl */`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`

/** Three instanced/static draws per patch. Time and fade are the only frame
 * uploads; smoke and tongues move on the GPU without per-tick particle work. */
export class GroundFire {
  readonly group = new THREE.Group()
  private uniforms = { uTime: { value: 0 }, uFade: { value: 0 }, uHeat: { value: 0 } }
  private flames: THREE.InstancedMesh
  private smoke: THREE.InstancedMesh
  private hearth: THREE.Mesh
  private extinguished: number | null = null

  constructor(at: THREE.Vector3, radius: number, private started: number, private until: number) {
    this.group.name = 'mortar-fire'
    this.group.position.copy(at); this.group.position.y += .035
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, uniforms: this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime,uHeat;
        varying float vHeight,vFacing,vCore,vSeed;
        void main(){
          vec4 center=instanceMatrix*vec4(0,0,0,1);
          float seed=dot(center.xz,vec2(21.7,13.3));
          vCore=step(.03,center.y);vSeed=seed;
          float t=uTime*5.5+seed;
          vec3 p=position;
          vHeight=p.y;
          p.x+=sin(t-p.y*3.)*p.y*p.y*.27;
          p.z+=cos(t*.83+p.y*4.)*p.y*p.y*.2;
          p.y*=.82+.14*sin(t)+.08*sin(t*1.71);
          p*=uHeat;
          vec4 mv=modelViewMatrix*instanceMatrix*vec4(p,1.);
          vFacing=abs(dot(normalize(normalMatrix*normal),normalize(-mv.xyz)));
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uHeat,uTime;
        varying float vHeight,vFacing,vCore,vSeed;
        void main(){
          float heat=(1.-vHeight)*.60+vFacing*.30+sin(vHeight*12.-uTime*7.+vSeed)*.06;
          vec3 color=mix(vec3(.82,.075,.008),vec3(1.,.36,.025),smoothstep(.1,.55,heat));
          color=mix(color,vec3(1.,.84,.34),smoothstep(.57,.97,heat));
          color=mix(color,mix(vec3(1.,.97,.66),vec3(1.,.65,.12),vHeight),vCore);
          gl_FragColor=vec4(color,uHeat*mix(.84,.94,vCore));
          #include <colorspace_fragment>
        }`,
    })
    this.flames = new THREE.InstancedMesh(flameGeometry, material, 18)
    this.flames.frustumCulled = false
    const pose = new THREE.Object3D()
    for (let i = 0; i < this.flames.count; i++) {
      const n=i%9,core=i>=9,angle=n*2.39996,spread=radius*.68*Math.sqrt(n/8)
      pose.position.set(Math.cos(angle)*spread,core?.04:.01,Math.sin(angle)*spread)
      const width=(.42+.045*(n%3))*(core?.60:1)
      pose.scale.set(width,(.38+.32*(Math.sin(n*7.3)*.5+.5))*(core?.60:1),width)
      pose.updateMatrix(); this.flames.setMatrixAt(i, pose.matrix)
    }
    this.flames.instanceMatrix.needsUpdate = true
    this.smoke = new THREE.InstancedMesh(smokeGeometry, new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime,uFade;
        varying float vAlpha,vLight;
        void main(){
          vec4 center=instanceMatrix*vec4(0,0,0,1);
          float seed=dot(center.xz,vec2(17.3,9.7));
          float life=fract(uTime*.34+seed);
          float size=(.09+life*.16)*sin(life*3.14159);
          vec3 p=center.xyz+position*size;
          p.y+=.42+life*1.2;
          p.x+=life*.22+sin(seed+life*4.)*.08;
          p.z+=sin(seed)*life*.13;
          vAlpha=sin(life*3.14159)*uFade*.28;
          vLight=.5+.5*dot(normal,normalize(vec3(-.4,1.,.5)));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: /* glsl */`
        varying float vAlpha,vLight;
        void main(){
          gl_FragColor=vec4(mix(vec3(.10,.105,.11),vec3(.25,.25,.24),vLight),vAlpha);
          #include <colorspace_fragment>
        }`,
    }),8)
    this.smoke.frustumCulled = false
    for (let i=0;i<this.smoke.count;i++) {
      const angle=i*2.39996,spread=radius*.5*Math.sqrt((i+1)/8)
      pose.position.set(Math.cos(angle)*spread,0,Math.sin(angle)*spread)
      pose.scale.setScalar(1);pose.updateMatrix();this.smoke.setMatrixAt(i,pose.matrix)
    }
    this.smoke.instanceMatrix.needsUpdate=true
    this.hearth = new THREE.Mesh(groundGeometry, new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,toneMapped:false,uniforms:this.uniforms,vertexShader:vertex,
      fragmentShader: /* glsl */`
        uniform float uTime,uFade,uHeat;
        varying vec2 vUv;
        void main(){
          vec2 p=vUv*2.-1.;
          float ripple=sin(p.x*17.+sin(p.y*9.))*sin(p.y*19.+p.x*4.);
          float edge=1.-smoothstep(.65,.98,length(p)+ripple*.06);
          float coal=smoothstep(.55,.96,ripple)*(.65+.35*sin(uTime*2.+p.x*12.));
          vec3 color=mix(vec3(.045,.033,.028),vec3(.95,.12,.008),coal*(.4+uHeat*.6));
          gl_FragColor=vec4(color,edge*.64*uFade);
          #include <colorspace_fragment>
        }`,
    }))
    this.hearth.scale.setScalar(radius)
    this.group.add(this.hearth,this.flames,this.smoke)
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
    this.group.removeFromParent()
    for(const mesh of [this.flames,this.smoke]) {mesh.dispose();(mesh.material as THREE.Material).dispose()}
    ;(this.hearth.material as THREE.Material).dispose()
    // Small geometries are shared by every patch.
  }
}
