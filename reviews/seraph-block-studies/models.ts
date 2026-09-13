import { box, type VoxBox, type VoxModel } from '../../src/voxel/builder.ts'

/** Review geometry only. Deliberately uses the broad, solid cuboids of the
 * archer, barracks and beacon. No sampled curves, sliver facets or particle trim. */
export type Direction = 'guardian' | 'sanctum' | 'relic'
export const directions = [
  { id: 'guardian', name: 'Stone Seraphs', subtitle: 'A guardian carved from the same stone as the kingdom.', solar: 'Uplifted stone wings and a golden sun crown.', void: 'A hooded sentinel, heavy folded wings and an eclipse crown.' },
  { id: 'sanctum', name: 'Sanctum Spires', subtitle: 'A sacred tower that belongs among the other buildings.', solar: 'Ivory chapels become a golden, open sun temple.', void: 'Dark gatehouses become an imposing shrine to the abyss.' },
  { id: 'relic', name: 'Crowned Relics', subtitle: 'A bold magical monument built from a few powerful shapes.', solar: 'A suspended sunstone held by broad gilded arms.', void: 'A black relic cradled in a heavy, broken stone crown.' },
] as const
export const forms = [
  { tier: 1, branch: 0, name: 'Seraph Idol', label: 'T1' },
  { tier: 2, branch: 0, name: 'Seraph Ascendant', label: 'T2' },
  { tier: 3, branch: 0, name: 'Seraph Sovereign', label: 'T3' },
  { tier: 4, branch: 0, name: 'Solar Seraph', label: 'Solar · T4' },
  { tier: 5, branch: 0, name: 'The Dawnbringer', label: 'Solar · T5' },
  { tier: 6, branch: 0, name: 'Helios Engine', label: 'Solar · T6' },
  { tier: 4, branch: 1, name: 'Void Seraph', label: 'Void · T4' },
  { tier: 5, branch: 1, name: 'The Eventide', label: 'Void · T5' },
  { tier: 6, branch: 1, name: 'Event Horizon', label: 'Void · T6' },
] as const

function palette(tier: number, branch: number) {
  const dark = tier >= 4 && branch === 1, solar = tier >= 4 && !dark
  return { dark, solar, stone: dark ? 0x30303e : 0xd5d2be,
    shade: dark ? 0x1c1d28 : 0x939b9b, face: dark ? 0x55515f : 0xe8e4d4,
    trim: dark ? 0x6d6283 : solar ? 0xd8b64a : 0x8b9daf,
    glow: dark ? 0xb492df : solar ? 0xffebac : 0xc7e8f1,
    black: 0x11131e, roof: dark ? 0x22232e : solar ? 0xc19b3e : 0x4b637a }
}
type Palette = ReturnType<typeof palette>
function foundation(p: Palette, tier: number): VoxBox[] {
  const a = [box(0,.5,0,7.6,1,7.6,0x707886),box(0,1.35,0,6.7,.7,6.7,p.face),box(0,2.2,0,5.6,1,5.6,p.stone)]
  if(tier >= 3) a.push(box(0,2.85,0,6.2,.7,6.2,p.trim))
  return a
}
/** Eight coarse masonry blocks, with a real open center. */
function squareHalo(a: VoxBox[], y: number, z: number, radius: number, c: number, width = .8) {
  a.push(box(0,y+radius,z,radius*1.3,width,1,c),box(0,y-radius,z,radius*1.3,width,1,c))
  a.push(box(-radius,y,z,width,radius*1.3,1,c),box(radius,y,z,width,radius*1.3,1,c))
  for(const x of [-1,1])for(const h of [-1,1])a.push(box(x*radius*.75,y+h*radius*.75,z,width*1.4,width*1.4,1,c))
}
function sun(a: VoxBox[], y: number, z: number, p: Palette, size: number) {
  a.push(box(0,y,z,size,size,1.2,p.trim),box(0,y,z+.72,size*.55,size*.55,.7,p.glow,true))
  for(const side of [-1,1]) {
    a.push(box(side*(size*.5+.65),y,z,1.0,.8,1,p.trim))
    a.push(box(0,y+side*(size*.5+.65),z,.8,1.0,1,p.trim))
  }
}
function finish(parts: VoxModel['parts'], cy: number, muzzleZ: number, pivots: VoxModel['pivots'] = {}): VoxModel {
  return { parts, scale: .1, pivots: {heart:[0,cy,muzzleZ-.4],...pivots}, sockets: {muzzle:{part:'heart',at:[0,cy,muzzleZ]}} }
}

function guardian(tier: number, branch: number): VoxModel {
  const p=palette(tier,branch),rank=Math.max(0,tier-4),early=tier<4
  const feet=3, shoulder=early?6.5+tier*.9:10+rank*.6, head=shoulder+2.15
  const parts:VoxModel['parts']={base:foundation(p,tier),figure:[],heart:[],wingL:[],wingR:[],halo:[]}
  const f=parts.figure
  // Feet, robe, shoulders and a cuboid head. Silhouette follows the game's units.
  f.push(box(0,feet+.6,0,3.8,1.2,2.9,p.shade),box(0,(feet+shoulder)/2,0,2.9,shoulder-feet,2.3,p.stone),box(0,shoulder,0,3.9,1.4,2.6,p.face))
  f.push(box(0,head,0,1.9,2,1.8,p.face),box(0,head+1.1,0,2.2,.7,2.1,p.trim))
  if(p.dark){
    // The hood is solid masonry around one shadowed face; no glowing eyes confetti.
    f.push(box(0,head,1.0,1.4,1.6,.7,p.black),box(0,head+.05,1.4,1.1,.55,.65,p.glow,true))
    f.push(box(-1.2,head+.45,.1,.75,2.5,2.2,p.stone),box(1.2,head+.45,.1,.75,2.5,2.2,p.stone))
  } else f.push(box(0,head-.5,1,1.0,.6,.65,p.shade))
  // Broad outstretched arms hold the light in front of the chest.
  for(const side of [-1,1]) {
    f.push(box(side*2.1,shoulder-1,.35,1.1,2.8,1.1,p.stone),box(side*1.6,shoulder-2.25,1.25,1.8,1,2.5,p.face))
    f.push(box(side*1.05,feet+2.2,1.35,.7,3.5,.7,p.shade))
    const wing=parts[side<0?'wingL':'wingR']
    const count=tier===1?2:tier===6?4:3
    for(let i=0;i<count;i++) {
      const x=2.65+i*1.1, y=p.dark?shoulder-1-i*1.25:shoulder-.3+i*(tier===1?-.7:.85)
      wing.push(box(side*x,y,-1.05,1.7,p.dark?4.0:3.0+(i===0?1:0),1.4,i%2?p.stone:p.face))
    }
    if(tier>=5) {
      // A second, short folded pair reads as a new rank, not a scaled copy.
      wing.push(box(side*3.05,shoulder-3.6,-1.15,2.7,1.7,1.5,p.stone),box(side*4.1,shoulder-4.3,-1.15,1.6,1.7,1.5,p.shade))
    }
  }
  const cy=shoulder-1.75
  parts.heart.push(box(0,cy,1.95,1.8,1.8,1.6,p.dark?p.black:p.trim),box(0,cy,2.95,1.1,1.1,.7,p.glow,true))
  if(tier===3)squareHalo(parts.halo,head+.15,-1.7,2.45,p.trim)
  if(p.solar){
    squareHalo(parts.halo,head+.2,-1.8,tier===4?2.7:3.1,p.trim,1)
    if(tier>=5)parts.halo.push(box(0,head+4.15,-1.8,1,1.3,1,p.trim),box(-4,head+.3,-1.8,1.2,1,1,p.trim),box(4,head+.3,-1.8,1.2,1,1,p.trim))
    if(tier===6)sun(parts.halo,head+.2,-2.0,p,2.6)
  }
  if(p.dark){
    for(const s of [-1,1])parts.halo.push(box(s*2.7,head+1,-1.5,1.4,3.8,1.6,p.shade),box(s*2.1,head+3.2,-1.5,1.4,1.3,1.6,p.stone))
    if(tier>=5)parts.halo.push(box(0,head+3.55,-1.5,2.5,1,1.5,p.shade))
    if(tier===6){squareHalo(parts.halo,head+.5,-2.05,3.15,p.trim,1);parts.halo.push(box(0,head+.5,-2.15,4.3,4.3,1,p.black))}
  }
  return finish(parts,cy,3.35,{wingL:[-1.8,shoulder,-1],wingR:[1.8,shoulder,-1]})
}

function sanctum(tier: number, branch: number): VoxModel {
  const p=palette(tier,branch),early=tier<4,rank=Math.max(0,tier-4)
  const h=early?5.1+tier*.95:9.2+rank*.9,cy=h-.5
  const parts:VoxModel['parts']={base:foundation(p,tier),figure:[],heart:[],halo:[]},f=parts.figure
  // Open chamber and four substantial piers, like a barracks/beacon silhouette.
  f.push(box(0,3.4,0,5.8,1.0,5.8,p.shade),box(0,5.6,-1.85,3.6,4.2,1.0,p.stone))
  for(const x of [-2.1,2.1])for(const z of [-1.8,1.8]) {
    f.push(box(x,(3.8+h)/2,z,1.15,h-3.8,1.15,p.stone),box(x,h,z,1.65,.8,1.65,p.face))
  }
  f.push(box(0,h+.7,0,6.4,.9,5.8,p.face))
  if(early) {
    for(let i=0;i<3;i++)f.push(box(0,h+1.5+i*.8,0,6.8-i*1.9,.8,6.2,p.roof))
    f.push(box(0,h+4.2,0,.85,1.3,1.1,p.trim))
    if(tier>=2)for(const side of [-1,1]) {
      f.push(box(side*3.3,4.7,0,1.3,3.3,3.2,p.stone),box(side*3.5,6.8,0,1.7,.9,3.6,p.face))
    }
    if(tier===3)squareHalo(parts.halo,h+2.1,-.5,2.45,p.trim)
  } else if(p.solar) {
    // Low stepped roof, then a readable sun crown. Architectural wings are solid.
    f.push(box(0,h+1.55,0,5.7,.9,5.1,p.trim),box(0,h+2.35,0,4.0,.7,3.8,p.trim))
    for(const side of [-1,1]){
      f.push(box(side*3.8,5.1,0,1.65,4.5,3.3,p.stone),box(side*4.35,7.45,0,2.6,1.1,3.7,p.face))
      if(tier>=5)f.push(box(side*4.8,8.8,0,1.4,1.6,2.6,p.face),box(side*4.8,9.8,0,1.8,.7,2.9,p.trim))
    }
    sun(parts.halo,h+4.2,0,p,tier===6?3.2:2.2)
    if(tier===6){
      squareHalo(parts.halo,h+4.2,-.7,3.25,p.trim,1)
      f.push(box(-3.3,h+1.8,-1.1,1.3,3.3,1.7,p.face),box(3.3,h+1.8,-1.1,1.3,3.3,1.7,p.face))
    }
  } else {
    // A split roof and a deep black portal. The open roof replaces the solar crown.
    for(const side of [-1,1]){
      f.push(box(side*2.35,h+1.65,0,2.35,1.5,5.4,p.shade),box(side*2.65,h+3.1,0,1.4,1.4,4.6,p.stone))
      f.push(box(side*3.7,5.9,0,1.5,5.5,3.2,p.shade),box(side*3.7,8.9,0,2.0,.8,3.5,p.stone))
      if(tier>=5)f.push(box(side*2.65,h+4.25,0,1.05,1.05,3,p.shade))
    }
    f.push(box(0,cy,.1,2.8,4.4,1.2,p.black))
    if(tier===6){
      f.push(box(-4.35,h+1.2,-1,1.45,4.0,1.5,p.stone),box(4.35,h+1.2,-1,1.45,4.0,1.5,p.stone),box(0,h+3.5,-1,8.7,1.1,1.5,p.trim))
      parts.halo.push(box(0,h+4.5,-1,3,1,1.7,p.shade))
    }
  }
  // The firing window is visibly on the front of the chamber.
  parts.heart.push(box(0,cy,1.65,2.5,2.6,1.0,p.trim),box(0,cy,2.35,1.4,1.6,.7,p.glow,true))
  return finish(parts,cy,2.85)
}

function relic(tier: number, branch: number): VoxModel {
  const p=palette(tier,branch),early=tier<4,rank=Math.max(0,tier-4),cy=early?6+tier:10.1+rank*.65
  const parts:VoxModel['parts']={base:foundation(p,tier),figure:[],heart:[],halo:[]},f=parts.figure
  f.push(box(0,3.3,0,4.8,1.2,4.8,p.shade),box(0,4.25,0,3.2,.8,3.2,p.trim))
  // Solid knee-shaped supports and large end caps instead of long thin rails.
  for(const side of [-1,1]){
    f.push(box(side*2.2,5.15,0,1.4,2.1,2.3,p.stone),box(side*3.15,6.4,0,2.2,1.2,2.3,p.face))
    if(tier>=2)f.push(box(side*3.6,8.0,0,1.3,2.6,2.3,p.stone))
    if(tier>=3)f.push(box(side*3.6,9.75,0,1.9,.9,2.8,p.trim))
  }
  const core=early?1.9+tier*.4:3.1+rank*.45
  if(!p.dark){
    parts.heart.push(box(0,cy,0,core,core,core,p.trim),box(0,cy,core*.5+.35,core*.56,core*.56,.7,p.glow,true))
    // Three broad rectangular rays create a cross-like sun, no floating spark cloud.
    parts.heart.push(box(0,cy+core*.5+.6,0,1.1,1.2,1.1,p.face),box(0,cy-core*.5-.6,0,1.1,1.2,1.1,p.face))
    if(tier>=2)for(const side of [-1,1])parts.heart.push(box(side*(core*.5+.6),cy,0,1.2,1.1,1.1,p.face))
    if(tier===3)squareHalo(parts.halo,cy,-1.3,3.25,p.trim,1.0)
    if(p.solar){
      squareHalo(parts.halo,cy,-1.5,3.7+rank*.2,p.trim,1.25)
      if(tier>=5)for(const side of [-1,1]){
        f.push(box(side*4.6,7.4,0,1.6,3.0,2.3,p.face),box(side*5.3,9.5,0,2.2,1.2,2.6,p.trim))
      }
      if(tier===6){
        parts.halo.push(box(0,cy+5.1,-1.5,1.2,1.8,1.2,p.face),box(-5.0,cy,-1.5,1.2,1.2,1.2,p.face),box(5.0,cy,-1.5,1.2,1.2,1.2,p.face))
        f.push(box(0,5.2,0,4.3,1.0,3.5,p.trim))
      }
    }
  } else {
    // A dense dark center is held between raised jaws. Purple is confined to the opening.
    parts.heart.push(box(0,cy,0,core,core+1,core,p.black),box(0,cy,core*.5+.35,1.1,2.5,.7,p.glow,true))
    for(const side of [-1,1]) {
      f.push(box(side*3.7,cy+1.1,-.7,1.5,4.3,2.4,p.shade),box(side*2.8,cy+3.4,-.7,2.0,1.2,2.4,p.stone))
      f.push(box(side*2.8,cy+4.5,-.7,1.1,1.0,1.7,p.trim))
      if(tier>=5)f.push(box(side*4.6,cy-1.8,-.5,1.5,4.0,2.6,p.stone))
    }
    if(tier===6){
      squareHalo(parts.halo,cy,-2.5,4.4,p.trim,1.25)
      parts.halo.push(box(0,cy+5.15,-2.5,2.5,1.2,1.5,p.shade),box(0,cy-3.7,-1.5,4.5,1.2,2.4,p.shade))
    }
  }
  return finish(parts,cy,core*.5+.8)
}

export function studyModel(direction: Direction, index: number): VoxModel {
  const form=forms[index]
  if(!form)throw new Error('Unknown Seraph form')
  return direction==='guardian'?guardian(form.tier,form.branch):direction==='sanctum'?sanctum(form.tier,form.branch):relic(form.tier,form.branch)
}
