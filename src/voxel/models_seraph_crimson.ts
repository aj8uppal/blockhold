import { box, type VoxModel } from './builder.ts'
import type { Group } from 'three'

/** The fusion outranks both cathedrals: a recessed, predatory eye inside an
 * inward-hooked black crown. Broad masonry carries the scale and silhouette. */
export function crimsonSovereign(): VoxModel {
  const stone = 0x23232c, shade = 0x101119, edge = 0x45404a, red = 0x811f30, hot = 0xff493a
  const parts: VoxModel['parts'] = { base: [], figure: [], wingL: [], wingR: [], gaze: [], crown: [], heart: [], lidL: [], lidR: [] }
  const { base, figure, crown, heart } = parts
  base.push(box(0,.5,0,9.2,1,9.2,edge),box(0,1.4,0,8.2,.8,8.2,shade),box(0,2.2,0,7.5,.8,7.5,red),box(0,3,0,6.7,.8,6.7,stone))
  figure.push(box(0,7.5,0,4.6,8.4,4,stone),box(0,4,0,5.8,1.1,5.8,edge),box(0,11.3,0,6.1,1.2,4.8,edge))
  figure.push(box(0,7.5,2.1,1.25,5.4,.75,red),box(0,12.4,0,4.4,1.2,3.8,shade))
  for (const s of [-1,1]) {
    // Clawed buttresses anchor the tower; the wings rake up behind the eye.
    figure.push(box(s*2.25,6.3,1.1,1.3,5.5,2.4,shade),box(s*2.45,3.8,1.65,1.7,1.25,3,stone))
    const wing = parts[s < 0 ? 'wingL' : 'wingR']
    wing.push(box(s*3.5,12.6,-1.6,2.6,5.2,2.7,stone),box(s*5.05,15.1,-1.85,2.1,5.6,2.3,edge),box(s*6.4,17.4,-2.1,1.6,5.5,1.9,stone))
    wing.push(box(s*4.45,10,-1.4,3.6,1.15,2.4,red),box(s*3.5,8.3,-1.35,2.35,2.1,2.1,shade))
    // The crown and eye turn together, without twisting the stone foundation.
    crown.push(box(s*2.95,17,0,1.9,8.2,2.8,stone),box(s*3.65,21.65,0,1.65,3.4,2.4,edge),box(s*3.25,24,0,1.55,1.5,2,stone),box(s*2.45,25,0,1.55,1.05,1.7,shade))
    crown.push(box(s*1.95,13.6,.1,2.35,1.15,2.9,red))
    // Heavy brows narrow towards the central slit; no rounded or petal shapes.
    parts[s < 0 ? 'lidL' : 'lidR'].push(box(s*2.05,20.05,1.35,1.9,1.15,1.35,shade),box(s*1,19.65,1.5,1.2,.85,1.05,edge),box(s*2.6,18.6,1.25,.9,2.0,1.4,red),box(s*1.6,17.1,1.35,2.3,.85,1.2,shade))
  }
  heart.push(box(0,18.5,.35,3.6,3.45,1.5,red),box(-2.2,18.5,.35,1.25,1.9,1.4,red),box(2.2,18.5,.35,1.25,1.9,1.4,red))
  heart.push(box(0,18.5,1.35,2.5,2.45,.75,hot,true),box(-1.65,18.5,1.4,1,1.6,.7,hot,true),box(1.65,18.5,1.4,1,1.6,.7,hot,true),box(0,18.5,1.85,.75,2.8,.5,shade))
  return { parts, scale:.11,
    pivots:{gaze:[0,12.4,0],crown:[0,12.4,0],heart:[0,18.5,.35],wingL:[-2.6,10,-1.2],wingR:[2.6,10,-1.2],lidL:[-2.9,18.5,1.25],lidR:[2.9,18.5,1.25]},
    parents:{crown:'gaze',heart:'gaze',lidL:'gaze',lidR:'gaze'},
    sockets:{muzzle:{part:'heart',at:[0,18.5,2.18]}} }
}

/** Articulation follows each actual volley, including rapid Solar shots.
 * The envelope starts and ends at rest with zero velocity. */
export function poseStoneSeraph(model: Group, time: number, shotAge: number, cycle = .48): void {
  const duration = Math.max(.045, cycle)
  const recoil = shotAge >= 0 && shotAge < duration ? Math.sin(Math.PI * shotAge / duration) ** 2 : 0
  for (const [name, sign] of [['wingL',-1],['wingR',1],['lidL',-1],['lidR',1],['armL',-1],['armR',1]] as const) {
    const part = model.getObjectByName(name)
    if (!part) continue
    part.rotation.y = sign * recoil * (name.startsWith('lid') ? .13 : name.startsWith('arm') ? -.045 : .055)
    part.rotation.z = sign * recoil * (name.startsWith('wing') ? .035 : 0)
  }
  const heart = model.getObjectByName('heart')
  if (heart) heart.scale.setScalar(1 + Math.sin(time*1.8)*.008 + recoil*.035)
}
