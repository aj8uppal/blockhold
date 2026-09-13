import { box, type VoxBox, type VoxModel } from './builder.ts'

/** Approved Cathedral Sentinels suite: solid masonry wings, open crowns and a
 * planted figure. Heart and forearms are separate so each volley can articulate. */
export function cathedralSentinel(tier:number,branch:number):VoxModel {
  const dark=branch===1&&tier>=4,solar=branch===0&&tier>=4,rank=Math.max(0,tier-3)
  const p={stone:dark?0x30303d:0xd6d3c0,light:dark?0x585361:0xeee9d6,shade:dark?0x1b1d29:0x959c9e,
    trim:dark?0x776584:solar?0xd6b354:0x8c9eab,glow:dark?0xad85cc:solar?0xffe6a0:0xc2e4ed,black:0x11141d}
  const a:VoxModel['parts']={base:[],figure:[],heart:[],wingL:[],wingR:[],armL:[],armR:[],halo:[]}
  const f=a.figure
  a.base.push(box(0,.5,0,8,1,8,0x727985),box(0,1.35,0,7.2,.7,7.2,p.light),box(0,2.2,0,6.2,1,6.2,p.stone))
  if(tier>=3)a.base.push(box(0,2.85,0,6.8,.7,6.8,p.trim))
  const h=tier<4?9.4+tier*.65:12.2+rank*.55,cy=h-1.5
  // Broad head, neck, shoulders, a long robe and two visibly separate feet.
  f.push(box(0,h,0,4.2,1.3,2.8,p.light),box(0,h+1.6,0,2.05,2.1,2,p.stone),box(0,h+2.8,0,2.6,.7,2.4,p.trim))

  f.push(box(0,(h+3.5)/2,0,3.0,h-3.5,2.6,p.stone))
  for(const s of[-1,1])f.push(box(s*1.05,3.5,.6,1.7,1.3,3.4,p.light),box(s*.95,(h+4)/2,1.55,.75,h-5,.7,p.shade))
  if(dark){
    f.push(box(0,h+1.55,1.1,1.65,1.6,.7,p.black),box(0,h+1.5,1.55,1.15,.55,.55,p.glow,true))
    for(const s of[-1,1])f.push(box(s*1.3,h+1.9,.1,.8,2.9,2.3,p.stone))
  }else f.push(box(0,h+1,1.1,1.25,.7,.6,p.shade))
  const armsY=h-1.1
  for(const s of[-1,1]){
    a[s<0?'armL':'armR'].push(box(s*2.35,armsY,.3,1.3,3,1.3,p.stone),box(s*1.85,h-2.4,1.6,2.1,1.15,2.8,p.light))
    const wing=a[s<0?'wingL':'wingR']
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
    const y=h+2.2+(tier===6?1.5:0),r=3.2
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
