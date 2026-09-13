import * as THREE from 'three'
import type { Projectile } from '../projectiles.ts'

/** Render-only transfer. It never enters combat/projectile counts or consumes
 * simulation randomness, so reconnects and old journals keep their exact state. */
export function seraphAwakening(from: THREE.Vector3, to: THREE.Vector3, ground: number, solar: boolean): Projectile {
  const mesh = new THREE.Group(), geometry = new THREE.BoxGeometry(1,1,1)
  mesh.name = 'seraph-awakening'
  const material = new THREE.MeshBasicMaterial({color: solar ? 0xf5d486 : 0xa98bd2,transparent:true,depthWrite:false,toneMapped:false})
  const cubes = new THREE.InstancedMesh(geometry,material,6)
  cubes.frustumCulled = false
  mesh.add(cubes)
  const ringGeometry = new THREE.RingGeometry(.94,1,8)
  const ringMaterial = new THREE.MeshBasicMaterial({color:0xd83240,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})
  const ring = new THREE.Mesh(ringGeometry,ringMaterial)
  ring.rotation.x = -Math.PI/2; ring.position.set(to.x,ground+.1,to.z)
  mesh.add(ring)
  const pose = new THREE.Object3D(), sourceColor = material.color.clone(), red = new THREE.Color(0xf34642)
  let age = 0
  return {mesh,done:true,update(){},updateVisual(dt){
    age += dt
    for(let i=0;i<6;i++){
      const p = Math.max(0,Math.min(1,(age-i*.045)/.6)),k=p*p*(3-2*p)
      pose.position.lerpVectors(from,to,k);pose.position.y+=Math.sin(p*Math.PI)*.55
      pose.scale.setScalar(p>0&&p<1 ? .09+Math.sin(p*Math.PI)*.055 : 0)
      pose.rotation.set(0,p*.8,0);pose.updateMatrix();cubes.setMatrixAt(i,pose.matrix)
    }
    cubes.instanceMatrix.needsUpdate=true
    material.color.copy(sourceColor).lerp(red,Math.min(1,age/.65))
    const wake=Math.max(0,Math.min(1,(age-.5)/.55))
    ring.scale.setScalar(.7+wake*.55);ringMaterial.opacity=Math.sin(wake*Math.PI)*.35
    return age<1.1
  },dispose(){geometry.dispose();material.dispose();ringGeometry.dispose();ringMaterial.dispose()}}
}
