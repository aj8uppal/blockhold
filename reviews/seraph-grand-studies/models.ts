import { box, type VoxBox, type VoxModel } from '../../src/voxel/builder.ts'
import { crimsonSovereign } from '../../src/voxel/models_seraph_crimson.ts'
export { forms } from '../seraph-block-studies/models.ts'
import { forms } from '../seraph-block-studies/models.ts'
export type Direction = 'crowned' | 'throne' | 'cathedral'
export const directions = [
  { id:'crowned', name:'Crowned Guardians', subtitle:'The stone guardian, given a ceremonial silhouette.', solar:'Broad lifted wings, a sun crown and a second pair at Mythic.', void:'A hooded colossus with descending wings and a broken eclipse crown.' },
  { id:'throne', name:'Thrones of Light', subtitle:'A seated deity, monumental without becoming taller and busier.', solar:'A serene sovereign between sweeping throne wings.', void:'An armored judge seated in a dark, split throne.' },
  { id:'cathedral', name:'Cathedral Sentinels', subtitle:'A standing guardian framed by the architecture of a great hall.', solar:'An ivory sentinel beneath an open golden arch.', void:'A black guardian beneath a jagged, open gate.' },
] as const
function model(style:Direction,tier:number,branch:number):VoxModel {
  const dark=branch===1&&tier>=4,solar=branch===0&&tier>=4,rank=Math.max(0,tier-3)
  const p={stone:dark?0x30303d:0xd6d3c0,light:dark?0x585361:0xeee9d6,shade:dark?0x1b1d29:0x959c9e,
    trim:dark?0x776584:solar?0xd6b354:0x8c9eab,glow:dark?0xad85cc:solar?0xffe6a0:0xc2e4ed,black:0x11141d}
  const a:VoxModel['parts']={base:[],figure:[],heart:[],wingL:[],wingR:[],armL:[],armR:[],halo:[]}
  const f=a.figure
  a.base.push(box(0,.5,0,8,1,8,0x727985),box(0,1.35,0,7.2,.7,7.2,p.light),box(0,2.2,0,6.2,1,6.2,p.stone))
  if(tier>=3)a.base.push(box(0,2.85,0,6.8,.7,6.8,p.trim))
  const seated=style==='throne',h=(tier<4?9.4+tier*.65:12.2+rank*.55)-(seated?1.1:0),cy=h-1.5
  // Broad head, neck, shoulders, a long robe and two visibly separate feet.
  f.push(box(0,h,0,4.2,1.3,2.8,p.light),box(0,h+1.6,0,2.05,2.1,2,p.stone),box(0,h+2.8,0,2.6,.7,2.4,p.trim))
  if(seated){
    f.push(box(0,5.2,-.3,4.5,2.8,4.4,p.shade),box(0,7.7,0,3.2,4.6,2.5,p.stone))
    for(const s of[-1,1])f.push(box(s*1.1,6,1.4,1.7,1.5,3.7,p.light),box(s*1.1,4.6,2.4,1.5,2,1.8,p.stone),box(s*1.1,3.5,2.6,1.9,.9,2.6,p.light))
  }else{
    f.push(box(0,(h+3.5)/2,0,3.0,h-3.5,2.6,p.stone))
    for(const s of[-1,1])f.push(box(s*1.05,3.5,.6,1.7,1.3,3.4,p.light),box(s*.95,(h+4)/2,1.55,.75,h-5,.7,p.shade))
  }
  if(dark){
    f.push(box(0,h+1.55,1.1,1.65,1.6,.7,p.black),box(0,h+1.5,1.55,1.15,.55,.55,p.glow,true))
    for(const s of[-1,1])f.push(box(s*1.3,h+1.9,.1,.8,2.9,2.3,p.stone))
  }else f.push(box(0,h+1,1.1,1.25,.7,.6,p.shade))
  const armsY=h-1.1
  for(const s of[-1,1]){
    a[s<0?'armL':'armR'].push(box(s*2.35,armsY,.3,1.3,3,1.3,p.stone),box(s*1.85,h-2.4,1.6,2.1,1.15,2.8,p.light))
    const wing=a[s<0?'wingL':'wingR']
    if(style==='crowned'){
      const count=tier===1?2:tier===6?4:3
      for(let i=0;i<count;i++)wing.push(box(s*(2.8+i*1.35),h+(dark?-i*.95:i*1.25),-1.3,1.9,4.5-i*.55,1.7,i%2?p.stone:p.light))
      if(tier>=5){for(let i=0;i<2;i++)wing.push(box(s*(3.4+i*1.7),h-3-i*.9,-1.4,2.4,2.0,1.8,p.stone))}
      if(tier===6)wing.push(box(s*3.6,h-5.5,-1.3,2.3,1.4,1.7,p.trim))
    }else if(style==='throne'){
      // Seated shape stays low and wide; lifted armrests frame the figure.
      a.base.push(box(s*2.7,5,-.8,1.5,4,5,p.stone),box(s*2.7,7.35,-.1,2.1,.8,5.3,p.light))
      for(let i=0;i<(tier>=5?4:tier===1?2:3);i++)wing.push(box(s*(2.8+i*1.35),h-1+i*.5,-1.9,1.85,5.7+i*.4,1.8,i%2?p.stone:p.light))
      if(tier>=4)f.push(box(0,h-1,-2,5.3,6.8,1.3,p.shade))
      if(tier===6)for(let i=0;i<2;i++)wing.push(box(s*(4.0+i*1.7),h-4-i*.7,-1.8,2.2,1.3,1.9,p.trim))
    }else{
      // Heavy buttresses become upright wings, with generous negative space.
      const x=tier<3?3.5:4.3
      wing.push(box(s*x,(h+4.5)/2,-1.8,1.6,h-3,2.1,p.stone),box(s*x,h+1,-1.8,2.3,1.2,2.5,p.light))
      if(tier>=2)wing.push(box(s*(x+1),h-3,-1.8,1.5,5,2.0,p.shade))
      if(tier>=4){
        wing.push(box(s*(x-.75),h+2.3,-1.8,1.6,1.5,2.0,p.stone),box(s*(x-1.8),h+3.6,-1.8,1.6,1.5,1.8,p.trim))
        if(tier>=5)wing.push(box(s*(x+1.1),h+1.4,-1.8,1.2,3.3,1.8,p.stone))
        if(tier===6)wing.push(box(s*(x+1.1),h+3.7,-1.8,1.2,1.4,1.6,p.trim),box(s*(x+2.1),h-3.5,-1.8,1.5,4.3,2,p.light))
      }
    }
  }
  a.heart.push(box(0,cy,2.1,1.9,1.9,1.7,dark?p.black:p.trim),box(0,cy,3.15,1.2,1.2,.65,p.glow,true))
  function crown(out:VoxBox[],y:number,r:number,c:number){
    // Connected stair-step masonry, broad enough to read at gameplay distance.
    out.push(box(0,y+r,-1.9,r*1.1,1,1.1,c),box(0,y-r,-1.9,r*1.1,1,1.1,c))
    for(const s of[-1,1]){
      out.push(box(s*r,y,-1.9,1,r*1.15,1.1,c))
      for(const u of[-1,1])out.push(box(s*r*.72,y+u*r*.72,-1.9,1.45,1.45,1.1,c))
    }
  }
  if(tier===2)a.halo.push(box(0,h+3.8,-1.8,2.7,.8,1.1,p.trim))
  if(tier===3)crown(a.halo,h+1.8,2.9,p.trim)
  if(solar){
    const y=h+2.2+(tier===6?1.5:0),r=style==='throne'?3.7:3.2
    crown(a.halo,y,r,p.trim)
    if(tier>=5){for(const s of[-1,1])a.halo.push(box(s*(r+1.1),y,-1.9,1.3,1,1.1,p.trim));a.halo.push(box(0,y+r+1.1,-1.9,1,1.4,1.1,p.trim))}
    if(tier===6){a.halo.push(box(0,y,-2.05,2.2,2.2,1.1,p.light),box(0,y,-1.25,1.25,1.25,.6,p.glow,true));f.push(box(0,4.1,1.9,2.2,1.2,1,p.trim))}
  }
  if(dark){
    const y=h+2.1
    for(const s of[-1,1]){
      a.halo.push(box(s*2.75,y+1.1,-1.9,1.4,4.1,1.7,p.shade),box(s*2.2,y+3.45,-1.9,1.4,1.3,1.7,p.stone))
      if(tier>=5)a.halo.push(box(s*1.4,y+4.4,-1.9,1.4,1.1,1.7,p.trim))
    }
    if(tier===6){a.halo.push(box(0,y+1,-2.2,3.7,3.7,1.3,p.black),box(0,y+1,-1.3,.85,2.15,.6,p.glow,true));f.push(box(0,4.1,1.9,2.2,1.2,1,p.trim))}
  }
  // Each broad wing slab steps back in depth, avoiding coplanar faces.
  for(const wing of[a.wingL,a.wingR])wing.forEach((b,i)=>{b.z-=i*.12})
  return {parts:a,scale:.1,pivots:{heart:[0,cy,2.1],wingL:[-2,h-1,-1.5],wingR:[2,h-1,-1.5],armL:[-1.8,h,.3],armR:[1.8,h,.3]},sockets:{muzzle:{part:'heart',at:[0,cy,3.55]}}}
}
export function studyModel(direction:Direction,index:number):VoxModel {
  if(index===9)return crimsonSovereign()
  const f=forms[index];if(!f)throw Error('Unknown Seraph form')
  return model(direction,f.tier,f.branch)
}
