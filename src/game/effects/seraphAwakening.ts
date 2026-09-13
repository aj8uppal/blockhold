import * as THREE from 'three'
import type { Projectile } from '../projectiles.ts'
import { setFlash } from '../../voxel/builder.ts'

/** A three-beat arrival on the render clock: transfer, gathering, release.
 * No combat delay, camera jolt, simulation randomness or replay-state changes. */
export function seraphAwakening(from: THREE.Vector3, to: THREE.Vector3, ground: number, solar: boolean, model?: THREE.Group): Projectile {
  const mesh = new THREE.Group(), geometry = new THREE.BoxGeometry(1,1,1)
  mesh.name = 'seraph-awakening'
  const material = new THREE.MeshBasicMaterial({color:solar?0xf5d486:0xa98bd2,transparent:true,depthWrite:false,toneMapped:false})
  const cubes = new THREE.InstancedMesh(geometry,material,24)
  cubes.frustumCulled=false;mesh.add(cubes)
  const ringGeometry = new THREE.RingGeometry(.88,1,32)
  const glow = (opacity=0) => new THREE.MeshBasicMaterial({color:0xef3046,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})
  const rings = Array.from({length:4},()=>{const r=new THREE.Mesh(ringGeometry,glow());r.rotation.x=-Math.PI/2;mesh.add(r);return r})
  const shadow=new THREE.Mesh(new THREE.RingGeometry(0,1,32),glow())
  shadow.material.color.setHex(0x180910);shadow.rotation.x=-Math.PI/2;shadow.position.set(to.x,ground+.045,to.z);mesh.add(shadow)
  const height=Math.max(2.8,to.y-ground+1.2)
  const column=new THREE.Mesh(new THREE.CylinderGeometry(.18,.95,height,16,1,true),glow())
  column.position.set(to.x,ground+height/2,to.z);mesh.add(column)
  const eye=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),glow())
  eye.position.copy(to);mesh.add(eye)
  const pose=new THREE.Object3D(),sourceColor=material.color.clone(),red=new THREE.Color(0xff4a43)
  const clamp=(n:number)=>Math.max(0,Math.min(1,n)),smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t)}
  let age=0
  return {mesh,done:true,update(){},updateVisual(dt){
    age+=dt
    // The original trail remains, with a longer arc and a second stream.
    for(let i=0;i<24;i++){
      if(i<12){
        const p=clamp((age-i*.04)/.85),k=smooth(p),side=i%2?1:-1
        pose.position.lerpVectors(from,to,k);pose.position.y+=Math.sin(p*Math.PI)*(.65+side*.08)
        pose.position.x+=Math.sin(p*Math.PI)*side*.09
        pose.scale.setScalar(p>0&&p<1?.08+Math.sin(p*Math.PI)*.07:0)
      }else{
        const p=clamp((age-1.03-(i-12)*.018)/1.25),a=(i-12)*2.39996
        const r=Math.sin(p*Math.PI/2)*1.75
        pose.position.set(to.x+Math.cos(a)*r,to.y+Math.sin(p*Math.PI)*.6-p*1.2,to.z+Math.sin(a)*r)
        pose.scale.setScalar(p>0&&p<1?.1*(1-p):0)
      }
      pose.rotation.set(age*.3,age+i,0);pose.updateMatrix();cubes.setMatrixAt(i,pose.matrix)
    }
    cubes.instanceMatrix.needsUpdate=true
    material.color.copy(sourceColor).lerp(red,smooth((age-.4)/.7))
    const gather=smooth(age/.65)*(1-smooth((age-.9)/.65))
    shadow.scale.setScalar(1.2+gather*.7);shadow.material.opacity=gather*.34
    column.scale.set(1+gather*.25,1,1+gather*.25);column.material.opacity=gather*.16
    for(let i=0;i<2;i++){
      const p=clamp((age-i*.18)/1.15)
      rings[i].position.set(to.x,ground+.07+(to.y-ground)*smooth(p),to.z)
      rings[i].scale.setScalar(1.25*(1-smooth(p))+.12)
      rings[i].material.opacity=Math.sin(p*Math.PI)*.52
    }
    for(let i=2;i<4;i++){
      const p=clamp((age-1.03-(i-2)*.17)/1.15)
      rings[i].position.set(to.x,ground+.07+(i-2)*.025,to.z)
      rings[i].scale.setScalar(.8+smooth(p)*2.8)
      rings[i].material.opacity=Math.sin(p*Math.PI)*.85*(1-p)
    }
    const arrival=smooth((age-.85)/.2)*(1-smooth((age-1.07)/.55))
    eye.scale.setScalar(.12+arrival*.52);eye.material.opacity=arrival*.18
    if(model) setFlash(model,arrival*.14,0xff3042)
    return age<2.8
  },dispose(){
    if(model)setFlash(model,0)
    cubes.dispose();geometry.dispose();material.dispose();ringGeometry.dispose()
    for(const r of rings)r.material.dispose()
    for(const m of[column,eye,shadow]){m.geometry.dispose();m.material.dispose()}
  }}
}
