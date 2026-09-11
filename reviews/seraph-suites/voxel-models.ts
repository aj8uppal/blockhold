import { box, type VoxBox, type VoxModel } from '../../src/voxel/builder.ts'

export type Suite = 'stone' | 'machine' | 'crystal'
export const forms = [
  { tier: 1, branch: 0, name: 'Seraph Idol' },
  { tier: 2, branch: 0, name: 'Seraph Ascendant' },
  { tier: 3, branch: 0, name: 'Seraph Sovereign' },
  { tier: 4, branch: 0, name: 'Solar Seraph' },
  { tier: 5, branch: 0, name: 'The Dawnbringer' },
  { tier: 6, branch: 0, name: 'Helios Engine' },
  { tier: 4, branch: 1, name: 'Void Seraph' },
  { tier: 5, branch: 1, name: 'The Eventide' },
  { tier: 6, branch: 1, name: 'Event Horizon' },
] as const

// Review-only geometry. Uses exactly the production voxel builder and materials.
// Curves are sampled into joined boxes; no image planes, custom shaders or glass.
function stroke(out: VoxBox[], ax: number, ay: number, bx: number, by: number, z: number, width: number, depth: number, color: number, glow = false) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / .45))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    out.push(box(ax + (bx - ax) * t, ay + (by - ay) * t, z, width, width, depth, color, glow))
  }
}
function ring(out: VoxBox[], x: number, y: number, z: number, radius: number, color: number, width = .3, glow = false, start = 0, end = Math.PI * 2) {
  const n = Math.ceil(Math.abs(end - start) * radius / .5)
  for (let i = 0; i < n; i++) {
    const a = start + (end - start) * i / n, b = start + (end - start) * (i + 1) / n
    const x1 = x + Math.cos(a) * radius, x2 = x + Math.cos(b) * radius
    const y1 = y + Math.sin(a) * radius, y2 = y + Math.sin(b) * radius
    out.push(box((x1 + x2) / 2, (y1 + y2) / 2, z, Math.abs(x2 - x1) + width, Math.abs(y2 - y1) + width, .35, color, glow))
  }
}
function gem(out: VoxBox[], x: number, y: number, z: number, radius: number, height: number, color: number, face: number, glow = false) {
  const n = 9
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, r = Math.max(.15, 1 - Math.abs(t - .5) * 2) * radius
    out.push(box(x, y + (t - .5) * height, z, r * 2, height / n + .015, r * 1.15, color, glow))
    out.push(box(x + r * .22, y + (t - .5) * height, z + r * .56, r * .72, height / n + .015, .12, face, glow))
  }
}
function disk(out: VoxBox[], y: number, z: number, radius: number, color: number, glow = false) {
  const steps = Math.ceil(radius * 4)
  for (let i = 0; i < steps; i++) {
    const x = -radius + (i + .5) * radius * 2 / steps
    out.push(box(x, y, z, radius * 2 / steps + .015, 2 * Math.sqrt(radius * radius - x * x), .55, color, glow))
  }
}
function foundation(dark: boolean, ornate = false): VoxBox[] {
  const stone = dark ? 0x353447 : 0xc9c2ad, face = dark ? 0x555065 : 0xe0d9c4
  const out = [box(0,.5,0,7.4,1,7.4,0x747988),box(0,1.25,0,6.4,.5,6.4,face),box(0,2,0,5.5,1,5.5,stone),box(0,2.65,0,6,.3,6,face)]
  for (const side of [-1,1]) {
    out.push(box(side * 2.5,2,2.8,.55,.8,.22,face),box(side * 2.5,2,-2.8,.55,.8,.22,face))
    if (ornate) out.push(box(side * 2.8,2,0,.2,.5,1.8,dark?0x9b7bd1:0xc5a34a))
  }
  out.push(box(0,2,2.82,1.5,.5,.15,dark?0x9b7bd1:0xc5a34a))
  return out
}

function sacredStone(tier: number, branch: number): VoxModel {
  const dark = tier >= 4 && branch === 1, solar = tier >= 4 && !dark
  const stone = dark ? 0x353347 : 0xe3dcc8, shade = dark ? 0x212032 : 0xb9b19d
  const trim = dark ? 0x8e849f : 0xc3a14c, light = dark ? 0xb995ff : 0xffe49e
  const h = tier === 1 ? 5.3 : tier === 2 ? 7.2 : tier === 3 ? 8.2 : tier === 6 ? 8.6 : 8.1
  const feet = tier === 6 && dark ? 4.2 : 2.9, shoulder = feet + h * .74
  const parts: VoxModel['parts'] = { base:foundation(dark,true), figure:[],heart:[],wingL:[],wingR:[],halo:[] }
  parts.figure.push(box(0,feet+.4,0,3.6,.8,2.8,shade),box(0,feet+h*.35,0,2.8,h*.7,2.1,stone),box(0,shoulder,0,3.3,2.0,2.3,stone),box(0,feet+h+.4,0,1.65,1.65,1.7,stone))
  for (const side of [-1,1]) {
    parts.figure.push(box(side*1.8,shoulder-1.4,.2,.85,3.2,1.0,stone),box(side*.95,feet+h*.36,1.2,.35,h*.63,.22,shade))
    // Three deliberate crown prongs, rather than a dense filigree crown.
    parts.figure.push(box(side*.65,feet+h+1.65,0,.45,.75,1.45,trim))
  }
  parts.figure.push(box(0,feet+h+1.8,0,.55,1,1.45,trim),box(0,feet+h*.45,1.35,.25,h*.75,.25,trim))
  gem(parts.heart,0,shoulder,1.4,.65,1.4,light,dark?0xe2d4ff:0xfff5d0,true)
  for (const side of [-1,1]) {
    const wing=parts[side<0?'wingL':'wingR']
    const count=tier===1?3:tier===2?4:5
    for(let i=0;i<count;i++){
      const x=2.25+i*(tier===1?.65:solar?1.12:dark?.8:.95)
      const rise=tier===1?-i*.65:tier===2?i*.55:tier===3?i*1.1:dark?i*1.0:i*.75
      const y=shoulder+rise
      wing.push(box(side*x,y,-.9,1.25,tier===1?2.1:2.9-i*.15,.9,stone),box(side*x,y-.65,-.35,.6,1.7,.18,shade))
      if(solar && tier>=5) wing.push(box(side*(x+.15),y-2.6,-1.2,1.0,2.0,.75,stone))
    }
    if(tier===6 && dark){
      const low:VoxBox[]=[]
      parts[side<0?'wingLowL':'wingLowR']=low
      for(let i=0;i<4;i++)low.push(box(side*(2.3+i*.8),shoulder-2.1-i*.65,-.8,1.2,2.4,.75,stone))
    }
  }
  const crownY=feet+h+.9
  if(tier===3){
    stroke(parts.halo,-2.2,crownY-1, -2.2,crownY+3,-1.6,.35,.35,trim)
    stroke(parts.halo,2.2,crownY-1,2.2,crownY+3,-1.6,.35,.35,trim)
    stroke(parts.halo,-2.2,crownY+3,2.2,crownY+3,-1.6,.35,.35,trim)
  }
  if(solar){
    ring(parts.halo,0,crownY,-1.6,tier===6?3.6:2.6,trim,.7)
    if(tier>=5) for(let i=0;i<9;i++){
      const a=i/8*Math.PI
      stroke(parts.halo,Math.cos(a)*3.0,crownY+Math.sin(a)*3,Math.cos(a)*4.0,crownY+Math.sin(a)*4,-1.65,.65,.55,trim)
    }
    if(tier===6){disk(parts.halo,crownY,-1.7,2.7,0xe2ba5f);ring(parts.halo,0,crownY,-1.2,2.3,light,.25,true);gem(parts.halo,0,crownY,-.9,.7,1.5,0xfff3bd,0xffffff,true)}
  }
  if(dark){
    const r=tier===4?1.6:tier===5?2.3:2.8
    if(tier<6)ring(parts.halo,0,crownY,-1.3,r,trim,.5,false,.05,Math.PI-.05)
    else {disk(parts.halo,crownY,-1.6,r-.2,0x151321);ring(parts.halo,0,crownY,-1.23,r,light,.2,true)}
  }
  return {parts,pivots:{heart:[0,shoulder,1.4],halo:[0,crownY,-1.4],wingL:[-1.7,shoulder,-1],wingR:[1.7,shoulder,-1],wingLowL:[-1.7,shoulder-2,-1],wingLowR:[1.7,shoulder-2,-1]},scale:.12}
}

/** Straight, tapering facets: a blade, never a rounded leaf. */
function blade(out: VoxBox[], ax: number, ay: number, bx: number, by: number, width: number, z: number, color: number, edge: number) {
  const length=Math.hypot(bx-ax,by-ay),nx=-(by-ay)/length,ny=(bx-ax)/length
  const steps=Math.ceil(length/.32)
  for(let i=0;i<steps;i++){
    const t=(i+.5)/steps,half=width*(1-t)*.5+.08
    out.push(box(ax+(bx-ax)*t,ay+(by-ay)*t,z,Math.abs(nx)*half*2+Math.abs(bx-ax)/steps+.08,Math.abs(ny)*half*2+Math.abs(by-ay)/steps+.08,.6,color))
  }
  stroke(out,ax,ay,bx,by,z+.34,.18,.14,edge)
}

function celestialMachine(tier: number,branch: number):VoxModel{
  const dark=tier>=4&&branch===1,solar=tier>=4&&!dark
  const brass=dark?0xaaa0a4:0xba9950,ivory=dark?0x4e4b58:0xe4decc,frame=0x343545
  const light=dark?0xb491ff:solar?0xffe5a2:0xb9e5ff
  const cy=tier===1?7:tier===2?9:10.1
  const parts:VoxModel['parts']={base:foundation(false),figure:[],heart:[],halo:[]}
  parts.base.push(box(0,3.2,0,4.2,.6,4.2,brass),box(0,4.4,0,2.2,2.2,2.2,frame),box(0,4.6,1.15,1.0,2,.2,brass))
  if(tier===1||tier===2){
    for(const side of [-1,1]){
      const pts=tier===1?[[side*1.3,4],[side*2.8,7],[side*2.6,10]]:[[side*.9,4],[side*3.2,8],[side*2.8,11],[side*1.4,13]]
      for(let i=0;i<pts.length-1;i++){
        stroke(parts.figure,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],0,1.3,1.0,ivory)
        stroke(parts.figure,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],.6,.35,.3,brass)
      }
    }
    gem(parts.heart,0,cy,.3,tier===2?1.1:.85,tier===2?3.2:1.8,light,0xf0f6ff,true)
    if(tier===1)ring(parts.halo,0,cy,.55,1.55,brass,.4)
  }else if(tier===3||solar){
    // A suspended reactor in a rigid gantry, with rectangular condenser banks.
    const w=tier===3?2.9:tier===4?3.4:4.0, top=cy+3.6, bottom=cy-3.2
    for(const side of [-1,1]){
      parts.figure.push(box(side*w,cy,0,1.1,6.8,1.8,ivory),box(side*w,cy,.96,.25,5.2,.2,brass))
      parts.figure.push(box(side*(w+.8),cy-1.1,-.2,.6,4.1,2.2,frame))
      if(tier>=5)for(let i=0;i<3;i++)parts.figure.push(box(side*(w+1),cy-2+i*1.4,.95,.9,.6,.3,brass))
      if(tier===6){
        stroke(parts.figure,side*w,top,side*1.4,top+1.6,0,.8,1.0,ivory)
        parts.figure.push(box(side*(w+1.5),cy-2.5,0,1,1,2.1,ivory))
      }
    }
    parts.figure.push(box(0,top,0,w*2+.7,.7,2,ivory),box(0,bottom,0,w*2+.7,.7,2,ivory))
    parts.figure.push(box(0,top+.45,0,2.3,.25,1.8,brass))
    ring(parts.halo,0,cy,.3,tier===6?2.6:2.0,brass,.35)
    disk(parts.heart,cy,.45,tier===6?1.85:1.3,light,true)
    parts.heart.push(box(0,cy,.8,.5,2.4,.35,0xfff7db,true))
  }else{
    const radius=tier===4?3.2:tier===5?4.3:5.3
    if(tier<6){
      for(const side of [-1,1]){
        const pts=[[side*.9,4.3],[side*radius,cy],[side*(radius-.5),cy+2.9],[side*1.2,cy+5.0]]
        for(let i=0;i<pts.length-1;i++){
          stroke(parts.figure,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],-.5,1.0,1,ivory)
          stroke(parts.figure,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],.12,.25,.25,brass)
        }
      }
    }else{
      ring(parts.figure,0,cy,-.5,radius,ivory,1.35,false,.55,Math.PI*1.65)
      ring(parts.figure,0,cy,.24,radius,brass,.25,false,.55,Math.PI*1.65)
      stroke(parts.figure,-1,4,2.3,6.9,-.1,1.3,1.4,ivory)
      stroke(parts.figure,2.3,6.9,3.5,7.9,-.1,1.3,1.4,ivory)
    }
    disk(parts.heart,cy,.45,tier===6?2:1.4,0x151322)
    ring(parts.heart,0,cy,.8,tier===6?2.15:1.55,light,.23,true)
    if(tier===6)ring(parts.halo,0,cy,.55,3.2,light,.18,true)
  }
  return{parts,pivots:{heart:[0,cy,.6],halo:[0,cy,0]},scale:.12}
}

function crystalWings(tier:number,branch:number):VoxModel{
  const dark=tier>=4&&branch===1,solar=tier>=4&&!dark
  const core=dark?0x8a72c5:solar?0xe7b552:0xa7b6df
  const face=dark?0xc2a9ec:solar?0xffe3a1:0xe0e8fa
  const edge=dark?0xddd0ec:0xe6d5ad,shade=dark?0x4b3e76:solar?0xc79641:0x838caf
  const cy=tier===1?6.5:tier===2?8.7:10
  const parts:VoxModel['parts']={base:foundation(false),figure:[],heart:[],wingL:[],wingR:[],halo:[]}
  gem(parts.figure,0,cy,0,tier===1?2:1.3,tier===1?6.4:8,core,face)
  if(tier===1){gem(parts.heart,0,cy,.95,.75,2.4,0xc2d8ff,0xf0f4ff,true)}
  else{
    for(const side of [-1,1]){
      const wing=parts[side<0?'wingL':'wingR']
      // A shoulder, an angular elbow, and swept flight feathers. Roots follow
      // the wing spar instead of radiating around a flower-like center.
      const span=tier===2?4.2:tier===3?5.1:tier===6?6.4:5.6
      const elbowY=cy+(dark?-1.0:2.4),tipY=cy+(dark?-4.8:4.5)
      blade(wing,side*1.0,cy+.5,side*(span*.6),elbowY,2.0,-.55,core,face)
      blade(wing,side*(span*.55),elbowY,side*span,tipY,1.7,-.55,core,edge)
      const count=tier===2?2:tier>=5?4:3
      for(let i=0;i<count;i++){
        const rootX=side*(1.9+i*.67),rootY=elbowY-.3-i*.3
        const tipX=side*(span-.65-i*.45),featherY=tipY-(dark?-1:1)*(1.4+i*1.4)
        blade(wing,rootX,rootY,tipX,featherY,1.05,-.8-i*.05,i%2?shade:core,face)
      }
    }
    gem(parts.heart,0,cy,1.0,.85,2.4,solar?0xffedb9:dark?0x262238:0xc4deff,solar?0xffffff:dark?0x594282:0xeef5ff,!dark)
    if(dark){disk(parts.heart,cy,1.6,1.15,0x161425);ring(parts.heart,0,cy,1.95,1.25,0xb78ef8,.17,true)}
    // A bird crest for Solar and an upward lunar fork for Void.
    const crownY=cy+3.1
    gem(parts.figure,0,crownY,.1,.75,2.9,core,face)
    if(tier>=3)for(const side of [-1,1]){
      stroke(parts.figure,side*.4,crownY,side*1.3,crownY+2,.1,.55,.5,edge)
      if(solar)stroke(parts.figure,side*.2,crownY+.1,side*1.8,crownY+.5,.1,.5,.5,edge)
    }
    parts.figure.push(box(0,4.1,0,1.7,1.1,1.5,shade))
  }
  return{parts,pivots:{heart:[0,cy,1.1],wingL:[-1,cy,-.5],wingR:[1,cy,-.5],halo:[0,cy,0]},scale:.12}
}

export function conceptModel(suite:Suite,index:number):VoxModel{
  const {tier,branch}=forms[index]
  return suite==='stone'?sacredStone(tier,branch):suite==='machine'?celestialMachine(tier,branch):crystalWings(tier,branch)
}
