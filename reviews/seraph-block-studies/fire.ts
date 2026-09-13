import * as THREE from 'three'

export type FireDirection = 'hearth' | 'torch' | 'cinder'
export const fireDirections = [
  { id:'hearth', name:'Hearthfire', subtitle:'Compact, connected flame stacks.', detail:'Broad orange bodies, a small golden core, and gently leaning stepped tips.' },
  { id:'torch', name:'Forked Torchfire', subtitle:'A few taller, sculpted flames.', detail:'Distinct forked silhouettes with three warm colors and slow, continuous motion.' },
  { id:'cinder', name:'Cinderfield', subtitle:'Low flames over glowing coals.', detail:'A quieter burning ground patch that keeps enemies and damage numbers readable.' },
] as const
type Piece = { x:number, y:number, z:number, w:number, h:number, d:number, color:number, seed:number, glow?:boolean, ember?:boolean, fixed?:boolean }

/** Review-only volumetric fire. Two instanced cuboid draws, with the same lit
 * rough surfaces as the world and a restrained unlit core. No flame billboards. */
export class FireStudy {
  readonly group=new THREE.Group()
  private lit:THREE.InstancedMesh
  private hot:THREE.InstancedMesh
  private rows:Piece[]=[]
  private pose=new THREE.Object3D()
  constructor(readonly direction:FireDirection,at:THREE.Vector3,readonly radius=1.2){
    this.group.position.copy(at);this.group.position.y+=.04
    const red=0xf36b23,orange=0xffa13d,yellow=0xffd676,core=0xffe6a2
    const count=direction==='torch'?6:direction==='cinder'?9:7
    for(let i=0;i<count;i++){
      const a=i*2.39996,spread=radius*.64*Math.sqrt(i/(count-1)),x=Math.cos(a)*spread,z=Math.sin(a)*spread
      const seed=i*2.7,h=.67+.23*Math.sin(i*3.1),w=.21+.045*(i%3)
      const add=(dx:number,y:number,dz:number,bw:number,bh:number,bd:number,color:number,glow=false)=>this.rows.push({x:x+dx,y,z:z+dz,w:bw,h:bh,d:bd,color,seed,glow})
      if(direction==='hearth'){
        add(0,.15,0,w*1.5,.30,w*1.3,red)
        add(.03,h*.43,0,w,h*.62,w,orange)
        add(.10,h*.76,-.015,w*.64,h*.30,w*.70,orange)
        add(.15,h*.98,-.01,w*.46,h*.20,w*.50,yellow)
        // Visible core on front and back, as a thick inset; no translucent fringes.
        add(.015,.19,w*.56,w*.67,.30,.08,yellow,true)
        add(.045,.39,w*.46,w*.44,.23,.08,yellow,true)
        add(.015,.19,-w*.56,w*.67,.30,.08,yellow,true)
      } else if(direction==='torch'){
        add(0,.17,0,.37,.34,.28,red)
        add(-.045,h*.60,0,.26,h*.92,.22,orange)
        add(-.15,h*1.13,0,.17,h*.33,.16,orange)
        add(-.21,h*1.33,0,.12,h*.17,.13,yellow)
        add(.19,h*.56,0,.20,h*.43,.25,orange)
        add(.23,h*.86,0,.14,h*.27,.19,yellow)
        add(-.06,.34,.16,.16,.50,.09,yellow,true)
        add(-.06,.23,.20,.13,.25,.08,core,true)
        add(-.06,.30,-.16,.17,.46,.09,yellow,true)
      } else {
        add(0,.10,0,.44,.20,.38,red)
        add(.015,.24,0,.32,.25,.30,orange)
        add(-.055,.40,0,.17,.20,.22,yellow)
        add(.08,.20,.17,.14,.22,.08,yellow,true)
        if(i%2===0)this.rows.push({x:x-.05,y:.64,z,w:.10,h:.13,d:.10,color:orange,seed,glow:true,ember:true})
      }
      if(direction==='cinder')this.rows.push({x:x+.17,y:.016,z:z-.12,w:.13,h:.026,d:.12,color:0x634435,seed,fixed:true})
      this.rows.push({x:x+.12,y:.025,z:z+.1,w:.12,h:.026,d:.13,color:orange,seed,glow:true,fixed:true})
    }
    const geometry=new THREE.BoxGeometry(1,1,1)
    this.lit=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({roughness:1,metalness:0,emissive:0xd34b0b,emissiveIntensity:.28}),this.rows.filter(r=>!r.glow).length)
    this.hot=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({toneMapped:false}),this.rows.filter(r=>r.glow).length)
    this.lit.frustumCulled=false;this.hot.frustumCulled=false
    // Fire emits light; it should not cast a pile of hard, black object shadows.
    this.group.add(this.lit,this.hot);this.update(0)
  }
  update(time:number){
    let l=0,g=0
    for(const r of this.rows){
      const phase=time*(this.direction==='torch'?2.6:3.0)+r.seed
      const rise=r.ember?((time*.34+r.seed*.17)%1):0
      const height=r.fixed?1:1+Math.sin(phase)*.20+Math.sin(phase*1.43)*.08
      const sway=r.fixed?0:Math.sin(phase*.8)*.18*r.y
      this.pose.position.set(r.x+sway,r.y*height+rise*.48,r.z)
      const fade=r.ember?Math.sin(rise*Math.PI):1
      this.pose.scale.set(r.w*fade,r.h*height*fade,r.d*fade);this.pose.rotation.set(0,0,0);this.pose.updateMatrix()
      const mesh=r.glow?this.hot:this.lit,i=r.glow?g++:l++
      mesh.setMatrixAt(i,this.pose.matrix);mesh.setColorAt(i,new THREE.Color(r.color))
    }
    this.lit.instanceMatrix.needsUpdate=true;this.hot.instanceMatrix.needsUpdate=true
    if(this.lit.instanceColor)this.lit.instanceColor.needsUpdate=true
    if(this.hot.instanceColor)this.hot.instanceColor.needsUpdate=true
  }
  dispose(){this.group.removeFromParent();this.lit.geometry.dispose();this.lit.dispose();this.hot.dispose();(this.lit.material as THREE.Material).dispose();(this.hot.material as THREE.Material).dispose()}
}
