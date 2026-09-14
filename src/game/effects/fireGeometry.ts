import * as THREE from 'three'

export const fireBases = [
  [-.45,-.35, .85,.72],[.05,-.46,.96,.72],[.47,-.26,.79,.71],
  [-.55,.16,.63,.66],[.46,.23,.66,.68],[-.29,.46,.55,.50],
  [.24,.52,.50,.48],[-.04,.06,.58,.55],
  [-.24,-.06,.28,.40],[.24,-.05,.32,.40],[-.05,.31,.26,.40],
].map(([x,z,h,w])=>[x*.70,z*.70,h*.70,w*.70])
// Lofted, irregular octagonal sections form a continuous solid. Offsets and
// one extended shoulder break the symmetry; faces share edges throughout.
const profile=[
  [0,0,.27,.24],[.015,.13,.36,.29],[-.035,.30,.32,.27],
  [.035,.43,.29,.22],[-.055,.58,.21,.19],[-.045,.72,.14,.13],
  [.045,.87,.09,.075],[.075,1.03,.022,.02],
]
const positions:number[]=[],colors:number[]=[],bases:number[]=[],seeds:number[]=[]
for(let n=0;n<fireBases.length;n++){
  const seed=n*2.39996,variant=n%3
  const point=(ring:number,side:number)=>{
    const [x,y,rx,rz]=profile[ring],angle=side*Math.PI/4
    const shoulder=variant!==0&&ring===4&&side%8===(variant===1?0:4) ? .13 : 0
    return [x+Math.cos(angle)*(rx+shoulder),y+shoulder,Math.sin(angle)*rz]
  }
  const triangle=(a:number[],b:number[],c:number[],facet:number)=>{
    const shade=1-(facet%3)*.025
    for(const v of[a,b,c]){positions.push(v[0]+Math.sin(v[1]*4+variant*2)*v[1]*.065,v[1],v[2]);colors.push(shade,shade,shade);bases.push(...fireBases[n]);seeds.push(seed)}
  }
  for(let ring=0;ring<profile.length-1;ring++)for(let i=0;i<8;i++){
    const a=point(ring,i),b=point(ring,i+1),c=point(ring+1,i),d=point(ring+1,i+1)
    triangle(a,b,c,i*2);triangle(b,d,c,i*2+1)
  }
  for(let i=0;i<8;i++){
    triangle(point(0,i),[0,0,0],point(0,i+1),i*2)
    triangle(point(7,i),point(7,i+1),[.075,1.04,0],i*2)
  }
}
export const fireGeometry=new THREE.BufferGeometry()
fireGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
fireGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
fireGeometry.setAttribute('aBase',new THREE.Float32BufferAttribute(bases,4))
fireGeometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1))
