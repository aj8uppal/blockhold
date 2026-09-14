import * as THREE from 'three'

// Broad bodies, varied shoulders and open foreground gaps at compact heights.
// A twin-shell impact creates two of these patches.
export const fireBases = [
  [-.31,-.23,.44,.40],[.04,-.32,.48,.42],[.32,-.16,.42,.40],
  [-.37,.12,.34,.36],[.33,.14,.35,.36],[-.21,.32,.18,.30],
  [.18,.35,.16,.29],[-.03,.045,.25,.34],
]

// Clockwise, hand-shaped outlines: a bent crown, a split shoulder, a low curl.
// Each is a closed volume with bulging, faceted front and back surfaces.
const outlines = [
  [-.18,0,-.34,.10,-.38,.28,-.28,.43,-.31,.59,-.17,.55,-.16,.76,-.05,.93,-.08,1.08,.07,.99,.15,.77,.13,.58,.29,.63,.24,.40,.37,.26,.30,.09,.13,0],
  [-.17,0,-.33,.12,-.35,.32,-.22,.47,-.26,.68,-.10,.61,-.08,.81,.07,.91,.14,1.04,.19,.83,.14,.69,.25,.51,.34,.60,.30,.35,.38,.20,.26,.06,.10,0],
  [-.16,0,-.34,.11,-.39,.26,-.28,.41,-.37,.54,-.18,.51,-.20,.73,-.10,.83,-.14,.98,.05,.88,.14,.65,.12,.47,.28,.52,.25,.32,.34,.21,.27,.08,.12,0],
]
const palette=[0xf65b0b,0xffa017,0xffd43b,0xfff2b0].map(hex=>new THREE.Color(hex))
const positions:number[]=[],colors:number[]=[],bases:number[]=[],seeds:number[]=[]
for(let n=0;n<fireBases.length;n++){
  const outline=outlines[n%3],count=outline.length/2,seed=n*2.39996
  // Heat contours have different offsets, heights and depths. They are actual
  // stitched facets, so there is no pixel-grid mask or floating inner sprite.
  const point=(ring:number,i:number,side:number)=>{
    const x=outline[(i%count)*2],y=outline[(i%count)*2+1]
    const sx=[1,.84,.55,.27][ring],sy=[1,.88,.67,.43][ring]
    return [x*sx+Math.sin(y*5+n)*ring*.011,y*sy+ring*.022,
      side*Math.sin(ring*.43)*.33*(1-y*.5)]
  }
  const triangle=(a:number[],b:number[],c:number[],ring:number,i:number)=>{
    const color=palette[ring].clone().multiplyScalar(1-(i%3)*(ring===3?.015:.055))
    for(const p of[a,b,c]){positions.push(...p);colors.push(color.r,color.g,color.b);bases.push(...fireBases[n]);seeds.push(seed)}
  }
  for(const side of[-1,1])for(let i=0;i<count;i++){
    for(let ring=0;ring<3;ring++){
      const a=point(ring,i,side),b=point(ring,i+1,side),c=point(ring+1,i,side),d=point(ring+1,i+1,side)
      triangle(a,b,c,ring,i);triangle(b,d,c,ring,i+1)
    }
    triangle(point(3,i,side),point(3,i+1,side),[.012,.20,side*.33],3,i)
  }
}
export const fireGeometry=new THREE.BufferGeometry()
fireGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
fireGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
fireGeometry.setAttribute('aBase',new THREE.Float32BufferAttribute(bases,4))
fireGeometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1))
