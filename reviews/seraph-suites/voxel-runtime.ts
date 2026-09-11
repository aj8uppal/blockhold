import * as THREE from 'three'
import { buildModel } from '../../src/voxel/builder.ts'
import { towerModel, type TowerModelId } from '../../src/voxel/models_towers.ts'
import { levelById } from '../../src/game/levels.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'
import { audio } from '../../src/core/audio.ts'
import { conceptModel, forms, type Suite } from './voxel-models.ts'

const win=window as unknown as {vg:{game:Game,screens:Screens},seraphPreview:any}
while(!win.vg?.game)await new Promise(resolve=>setTimeout(resolve,30))
const {game:g,screens}=win.vg
g.save.xp=20000;g.save.taughtBasics=true;g.save.sfxMuted=true;g.save.musicMuted=true
audio.setMuted(true);audio.setMusicMuted(true)
g.startLevel(levelById('greenhollow')!,'normal','aldric','sandbox',{seed:91})
g.engine.setQuality('high')
screens.show('none');g.gold=100000;g.paused=false
const plots=[...g.terrain!.plots].sort((a,b)=>a.pos.lengthSq()-b.pos.lengthSq())
const plot=plots[0]
g.buildTower('seraph',plot)
g.towers[0].group.visible=false
const near=plots.slice(1).sort((a,b)=>a.pos.distanceTo(plot.pos)-b.pos.distanceTo(plot.pos))
g.buildTower('arrow',near[0]);g.buildTower('mage',near[1]);g.buildTower('beacon',near[2])
for(const t of g.towers.slice(1)){t.update(1,g);t.update(1,g)}
g.clearSelection();g.paused=true
if(g.hero)g.hero.group.visible=false
document.querySelectorAll<HTMLElement>('#hud,#screens,#rotate-overlay').forEach(el=>el.style.display='none')
let model:THREE.Group|null=null,selected:Suite|'current'='stone',index=8,clock=0
let moving=true,close=false,last=performance.now()
const tierScale=[.9,1,1.1,1.2,1.3,1.38]

function frame(mode:'context'|'close'){
  close=mode==='close'
  g.engine.cancelCinematic();g.engine.camTargetGoal.copy(plot.pos);g.engine.camTargetGoal.y=close?1.1:.45
  g.engine.distGoal=close?8.6:16;g.engine.pitchGoal=.78;g.engine.yawGoal=.24
  g.engine.updateCamera(5);g.engine.render()
}
function pose(time:number){
  if(!model)return
  const {tier,branch}=forms[index]
  for(const child of model.children){
    const y=child.userData.baseY??=child.position.y
    child.position.y=y+(child.name!=='base' && tier>=2?Math.sin(time*1.1)*.015:0)
    if(child.name.startsWith('wing'))child.rotation.z=Math.sin(time*.85)*.035*(child.name.endsWith('L')?-1:1)
    if(child.name==='heart')child.scale.setScalar(1+Math.sin(time*1.6)*.018)
    if(child.name==='halo'){
      child.rotation.z=tier>=4?time*.1:0
      if(selected==='machine'&&tier===6&&branch===1)child.rotation.x=.35
    }
  }
}
function info(){
  const bounds=new THREE.Box3().setFromObject(model!),size=bounds.getSize(new THREE.Vector3())
  return{suite:selected,form:forms[index],size:size.toArray(),drawCalls:g.engine.renderer.info.render.calls,triangles:g.engine.renderer.info.render.triangles}
}
async function show(suite:Suite|'current',formIndex:number){
  if(model)g.dynamic.remove(model)
  selected=suite;index=formIndex
  const {tier,branch}=forms[index]
  const spec=suite==='current'?towerModel(`seraph${tier}${tier>=4?branch===0?'a':'b':''}` as TowerModelId):conceptModel(suite,index)
  for(const boxes of Object.values(spec.parts))for(const b of boxes){
    if(![b.x,b.y,b.z,b.sx,b.sy,b.sz].every(Number.isFinite)||Math.min(b.sx,b.sy,b.sz)<=0)throw Error('Invalid voxel geometry')
  }
  model=buildModel(spec,`seraph-concept:${suite}:${index}`,{receiveShadow:false})
  model.position.copy(plot.pos);model.scale.setScalar(tierScale[tier-1]);g.dynamic.add(model)
  pose(0);g.engine.render()
  return info()
}
function animate(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now
  if(moving){clock+=dt;pose(clock)}
  requestAnimationFrame(animate)
}
win.seraphPreview={show,frame,pose,info,freeze:()=>{moving=false;pose(0);g.engine.render()},play:()=>{moving=true},forms}
await show('stone',8);frame('context');requestAnimationFrame(animate)
window.parent.postMessage({type:'seraph-preview-ready'},location.origin)
