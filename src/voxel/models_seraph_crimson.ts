import { box, type VoxModel } from './builder.ts'
import type { Group } from 'three'

/** A single, readable eye in a crown of heavy masonry. The silhouette carries
 * the rank; no floating fragments or fine crystal lattice are needed. */
export function crimsonSovereign(): VoxModel {
  const stone = 0x292b34, shade = 0x151720, edge = 0x56515a, red = 0x9f2935, hot = 0xff493a
  const parts: VoxModel['parts'] = { base: [], figure: [], wingL: [], wingR: [], heart: [], lidL: [], lidR: [] }
  const { base, figure, heart } = parts
  base.push(box(0,.5,0,8.6,1,8.6,edge),box(0,1.4,0,7.5,.8,7.5,shade),box(0,2.2,0,6.8,.8,6.8,red),box(0,3,0,6.1,.8,6.1,stone))
  figure.push(box(0,7,0,4.3,7.3,3.7,stone),box(0,4,0,5.4,1.1,5.4,edge),box(0,10.2,0,5.6,1.1,4.2,edge))
  figure.push(box(0,7,2,1.1,4.7,.8,red),box(0,11,0,3.6,1.4,3.6,shade))
  // Two substantial prongs frame an open eye; a broken crown, not a closed box.
  for (const s of [-1,1]) {
    figure.push(box(s*2.45,14.5,0,1.6,7,2.4,stone),box(s*3.05,18.3,0,1.3,2.5,2,edge),box(s*3.45,20.1,0,1,1.4,1.6,stone))
    figure.push(box(s*1.65,12,1,1.8,1,1.7,red))
    const wing = parts[s < 0 ? 'wingL' : 'wingR']
    for (let i=0;i<3;i++) wing.push(box(s*(3.8+i*1.25),10.7+i*1.4,-1.2-i*.14,1.8,4.5-i*.5,2,i===1?edge:stone))
    wing.push(box(s*4.2,7.9,-1.2,3.3,1.1,2,red))
    // Stepped eyelids recoil outwards a few degrees with each shot.
    parts[s < 0 ? 'lidL' : 'lidR'].push(box(s*2,16.2,.85,1.3,2.4,1.1,red),box(s*1.15,17.5,.85,1.7,.8,1.1,edge),box(s*1.15,14.9,.85,1.7,.8,1.1,edge))
  }
  heart.push(box(0,16.2,.35,3,2.8,1.1,red),box(-1.85,16.2,.35,1.2,1.65,1.1,red),box(1.85,16.2,.35,1.2,1.65,1.1,red),box(0,16.2,1.05,2.2,2.1,.7,hot,true),box(-1.5,16.2,1.05,.8,1.35,.7,hot,true),box(1.5,16.2,1.05,.8,1.35,.7,hot,true),box(0,16.2,1.48,.85,2.35,.6,shade),box(0,16.2,1.85,.4,1.5,.3,0xffad64,true))
  return { parts, scale:.11, pivots:{heart:[0,16.2,.35],wingL:[-2.6,10,-1.2],wingR:[2.6,10,-1.2],lidL:[-2.6,16.2,.85],lidR:[2.6,16.2,.85]},
    sockets:{muzzle:{part:'heart',at:[0,16.2,2.05]}} }
}

/** Pure presentation: shot age is seconds since the last volley. Cuboid stone
 * stays rigid; only the hinged wings/lids/arms move, with a smooth return. */
export function poseStoneSeraph(model: Group, time: number, shotAge: number): void {
  const recoil = shotAge >= 0 && shotAge < .48 ? Math.sin(Math.PI * Math.min(1, shotAge / .48)) ** 2 : 0
  for (const [name, sign] of [['wingL',-1],['wingR',1],['lidL',-1],['lidR',1],['armL',-1],['armR',1]] as const) {
    const part = model.getObjectByName(name)
    if (!part) continue
    part.rotation.y = sign * recoil * (name.startsWith('lid') ? .13 : name.startsWith('arm') ? -.045 : .055)
    part.rotation.z = sign * recoil * (name.startsWith('wing') ? .035 : 0)
  }
  const heart = model.getObjectByName('heart')
  if (heart) heart.scale.setScalar(1 + Math.sin(time*1.8)*.008 + recoil*.035)
}
