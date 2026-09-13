import * as THREE from 'three'
import {Engine} from '../../src/core/engine.ts'
import {THEMES} from '../../src/game/terrain.ts'
import {buildModel,box,type VoxModel} from '../../src/voxel/builder.ts'
import {towerModel,type TowerModelId} from '../../src/voxel/models_towers.ts'
import {pineTree,rock} from '../../src/voxel/models_env.ts'
import {huskModel,veilRegentModel} from '../../src/voxel/models_units.ts'
import {GroundFire} from '../../src/game/effects/groundFire.ts'
import {studyModel,directions,type Direction} from './models.ts'
import {FireStudy,fireDirections,type FireDirection} from '../seraph-block-studies/fire.ts'
import {forms as baseForms} from './models.ts'
import {poseStoneSeraph} from '../../src/voxel/models_seraph_crimson.ts'

const forms=[...baseForms,{tier:6,branch:1,name:'Crimson Sovereign',label:'Fusion'}]
const params=new URLSearchParams((window as any).__studyQuery??location.search),mode=params.get('mode')==='fire'?'fire':'seraph'
const canvas=document.querySelector('canvas')!,engine=new Engine(canvas)
engine.applyTheme(THEMES.forest,18,16)
// This review never instantiates Game, reads an account, or writes a quality preference.
engine.renderer.setPixelRatio(Math.min(devicePixelRatio,2));engine.renderer.shadowMap.enabled=true;engine.sun.castShadow=true
const stage=new THREE.Group(),context=new THREE.Group(),dynamic=new THREE.Group(),subjects=new THREE.Group(),effects=new THREE.Group()
engine.scene.add(stage,context,dynamic,subjects,effects)
const options=mode==='fire'?fireDirections:directions,sel=document.querySelector<HTMLSelectElement>('#direction')!,formSel=document.querySelector<HTMLSelectElement>('#form')!
for(const d of options)sel.add(new Option(d.name,d.id))
sel.add(new Option('Current live art','current'))
for(const f of forms)formSel.add(new Option(`${f.label} · ${f.name}`,String(forms.indexOf(f))))
formSel.hidden=mode==='fire';document.querySelector<HTMLButtonElement>('#attack')!.hidden=mode==='fire'
let selected=params.get('direction')??options[0].id,index=Math.min(9,Math.max(0,Number(params.get('form')??5))),view=params.get('view')??'studio',pairModels:THREE.Group[]=[]
let autoAttack=false
let moving=!matchMedia('(prefers-reduced-motion: reduce)').matches,model:THREE.Group|null=null,fire:FireStudy|GroundFire|null=null,time=1.7,last=performance.now(),attackAt=-100
const levelScale=[.9,1,1.1,1.2,1.3,1.38],pose=new THREE.Vector3()
const floor=[box(0,-.31,0,14,.6,10,THEMES.forest.dirt)]
for(let x=-6.5;x<=6.5;x++)for(let z=-4.5;z<=4.5;z++)floor.push(box(x,-.015,z,1,.09,1,(mode==='fire'?Math.abs(z)===.5:z===1.5||z===2.5)?THEMES.forest.road:(Math.round(x+z)%2?THEMES.forest.grass:THEMES.forest.grassAlt)))
const land=buildModel({parts:{ground:floor},scale:1},'block-studies:land',{receiveShadow:true});stage.add(land)
const plot=buildModel({parts:{base:[box(0,0,0,.96,.09,.96,0xaaa991),box(0,.055,0,.84,.05,.84,0xc3c0a7)]},scale:1},'block-studies:plot',{receiveShadow:true});stage.add(plot)
const refPositions:[TowerModelId,number,number][]=[['arrow3',-3.4,-.6],['mage3',3.3,-.5],['cannon5a',-3.4,3.6],['barracks3',3.4,3.4]]
for(const [id,x,z]of refPositions){const g=buildModel(towerModel(id),`block-studies:ref:${id}`);g.position.set(x,.055,z);g.scale.setScalar(id.includes('5')?1.3:1.1);context.add(g)}
for(const [x,z]of[[-5.4,-2.8],[4.8,-3.0],[-1.9,-3.4]]){const g=buildModel(pineTree(()=>.4),'block-studies:pine');g.position.set(x,0,z);context.add(g)}
for(const [x,z]of[[-4.4,1.7],[4.8,1.7]]){const g=buildModel(rock(()=>.35),'block-studies:rock');g.position.set(x,0,z);context.add(g)}
const targets=new THREE.Group();subjects.add(targets)
for(let i=0;i<3;i++){const g=buildModel(huskModel(),'block-studies:husk');g.position.set((i-1)*.62,0,1.95);g.rotation.y=Math.PI;targets.add(g)}
const giant=buildModel(veilRegentModel(),'block-studies:regent');giant.position.set(0,.03,0);giant.scale.setScalar(.94);subjects.add(giant)
const beamMat=new THREE.MeshBasicMaterial({color:0xffe4a0,transparent:true,opacity:.8,depthWrite:false}),beamGeo=new THREE.BoxGeometry(1,1,1)
for(let i=0;i<3;i++){const b=new THREE.Mesh(beamGeo,beamMat);b.visible=false;effects.add(b)}

function framing(reset=true){
  engine.camera.clearViewOffset();engine.renderer.setSize(innerWidth,innerHeight);engine.camera.aspect=innerWidth/innerHeight;engine.camera.updateProjectionMatrix()
  context.visible=view==='context';land.visible=true;plot.visible=mode==='seraph';giant.visible=mode==='fire';targets.visible=mode==='seraph'&&view==='context'
  const portrait=innerHeight>innerWidth,close=view==='studio'
  engine.camTarget.set(0,mode==='fire'?.55:close?1.20:.55,0)
  let closeDistance=mode==='fire'?5.0:7.9
  if(close&&model){
    model.updateMatrixWorld(true)
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3())
    engine.camTarget.y=(bounds.min.y+bounds.max.y)*.48
    closeDistance=Math.max(size.y*.96,size.x*.86,size.z)*2.3
  }
  engine.camTargetGoal.copy(engine.camTarget)
  engine.dist=engine.distGoal=close?closeDistance*(portrait?1.3:1):portrait?22:17
  if(reset){engine.yaw=engine.yawGoal=.36;engine.pitch=engine.pitchGoal=close?.60:.83}
  engine.updateCamera(0);engine.render(true)
  document.querySelector('#studio')!.setAttribute('aria-pressed',String(close));document.querySelector('#context')!.setAttribute('aria-pressed',String(!close))
}
function geometryInfo(spec:VoxModel){
  const boxes=Object.values(spec.parts).flat()
  for(const b of boxes)if(![b.x,b.y,b.z,b.sx,b.sy,b.sz].every(Number.isFinite)||Math.min(b.sx,b.sy,b.sz)<=0)throw Error('Invalid voxel geometry')
  return {boxes:boxes.length,smallestBlock:Math.min(...boxes.map(b=>Math.min(b.sx,b.sy,b.sz)))}
}
let metrics={boxes:0,smallestBlock:0}
function show(direction=selected,form=index){
  selected=options.some(d=>d.id===direction)||direction==='current'?direction:options[0].id;index=Math.min(9,Math.max(0,Math.floor(form)))
  for(const g of pairModels)g.removeFromParent();pairModels=[]
  if(model){dynamic.remove(model);model=null}if(fire){fire.dispose();fire=null}
  if(mode==='seraph'){
    const f=forms[index],id=(index===9?'seraphCrimson':`seraph${f.tier}${f.tier>=4?f.branch===0?'a':'b':''}`) as TowerModelId
    const spec=selected==='current'?towerModel(id):studyModel(selected as Direction,index);metrics=geometryInfo(spec)
    model=buildModel(spec,`block-study:${selected}:${index}`);model.scale.setScalar(levelScale[f.tier-1]);model.position.y=.055;dynamic.add(model)
  } else{
    fire=selected==='current'?new GroundFire(new THREE.Vector3(),1.25,0,1e9):new FireStudy(selected as FireDirection,new THREE.Vector3(),1.25)
    dynamic.add(fire.group)
  }
  sel.value=selected;formSel.value=String(index)
  const name=selected==='current'?'Current live art':options.find(d=>d.id===selected)!.name
  document.querySelector('#name')!.replaceChildren(Object.assign(document.createElement('b'),{textContent:mode==='fire'?name:`${name} · ${forms[index].label}`}),Object.assign(document.createElement('small'),{textContent:'Actual Blockhold lighting & models · drag to orbit · scroll to zoom'}))
  attackAt=-100;animatePose(time);framing();return info()
}
function animatePose(t:number){
  if(model){
    if(autoAttack&&t-attackAt>1.25)attackAt=t
    if(selected!=='current'||index===9)poseStoneSeraph(model,t,t-attackAt)
  }
  fire?.update(t)
  const pulse=t-attackAt,active=pulse>=0&&pulse<.7&&!!model
  effects.visible=active
  if(active&&model){
    model.updateMatrixWorld(true);const source=model.getObjectByName('muzzle')??model.getObjectByName('heart')??model
    source.getWorldPosition(pose)
    const dark=forms[index].branch===1&&forms[index].tier>=4
    beamMat.color.set(index===9?0xf34d40:dark?0x9972d6:0xffe4a0)
    effects.children.forEach((o,i)=>{
      const b=o as THREE.Mesh;b.visible=!dark||i===0
      const end=new THREE.Vector3(dark?0:(i-1)*.62,.4,1.95),delta=end.clone().sub(pose),len=delta.length(),start=dark?Math.min(1,pulse/.55):0,tail=dark?Math.max(0,start-.30):0
      b.position.copy(pose).addScaledVector(delta,(tail+(dark?start:1))*.5);b.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize())
      b.scale.set(dark?.09:.024,dark?.09:.024,len*(dark?start-tail:1));beamMat.opacity=Math.min(1,pulse/.08,(.7-pulse)/.15)*.85
    })
  }
}
function info(){return {mode,direction:selected,form:forms[index],view,...metrics,drawCalls:engine.renderer.info.render.calls,triangles:engine.renderer.info.render.triangles}}
function pair(direction=selected){
  show(direction,4);model!.position.x=-1.25
  const spec=direction==='current'?towerModel('seraph5b'):studyModel(direction as Direction,7)
  const other=buildModel(spec,`block-study:${direction}:7`);other.position.set(1.25,.055,0);other.scale.setScalar(levelScale[4]);dynamic.add(other);pairModels.push(other)
  context.visible=false;targets.visible=false;plot.visible=false
  engine.camTarget.set(0,1.3,0);engine.camTargetGoal.copy(engine.camTarget);engine.yaw=engine.yawGoal=.12;engine.pitch=engine.pitchGoal=.58;engine.dist=engine.distGoal=9.0;engine.updateCamera(0);engine.render(true)
}
sel.onchange=()=>show(sel.value,index);formSel.onchange=()=>show(selected,Number(formSel.value))
for(const v of ['studio','context'])document.querySelector<HTMLButtonElement>('#'+v)!.onclick=()=>{view=v;framing()}
document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>framing()
function motion(value:boolean){moving=value;document.querySelector('#motion')!.setAttribute('aria-pressed',String(moving));document.querySelector('#motion')!.textContent=moving?'Pause motion':'Play motion'}
document.querySelector<HTMLButtonElement>('#motion')!.onclick=()=>motion(!moving)
document.querySelector<HTMLButtonElement>('#attack')!.onclick=()=>{view='context';framing();motion(true);attackAt=time}
let drag:{x:number,y:number}|null=null
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY}}
canvas.onpointermove=e=>{if(!drag)return;engine.yawGoal-=(e.clientX-drag.x)*.008;engine.pitchGoal=Math.max(.25,Math.min(1.25,engine.pitchGoal+(e.clientY-drag.y)*.006));drag={x:e.clientX,y:e.clientY}}
canvas.onpointerup=canvas.onpointercancel=()=>{drag=null}
canvas.addEventListener('wheel',e=>{e.preventDefault();engine.distGoal=Math.max(4,Math.min(28,engine.distGoal+e.deltaY*.01))},{passive:false})
window.addEventListener('resize',()=>framing(false))
function loop(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(moving)time+=dt;animatePose(time);engine.updateCamera(dt);engine.render(true);requestAnimationFrame(loop)}
;(window as any).artStudy={pose:(age:number,yaw=.36)=>{autoAttack=false;motion(false);attackAt=0;time=age;animatePose(age);engine.yaw=engine.yawGoal=yaw;engine.updateCamera(0);engine.render(true)},autoAttack:(on=true)=>{autoAttack=on;motion(on)},show,pair,info,setView:(v:string)=>{view=v;framing()},freeze:(t=1.7)=>{motion(false);time=t;animatePose(t);engine.render(true)},play:()=>motion(true),attack:()=>{attackAt=time;motion(true)},capture:(on=true)=>document.body.classList.toggle('capture',on),engine}
show();motion(moving);requestAnimationFrame(loop);(window as any).previewReady=true
// The portable review embeds this viewer with srcdoc (an about: URL). This
// message contains only a readiness marker, never profile or battle data.
window.parent.postMessage({type:'blockhold-art-ready'},'*')

window.addEventListener('keydown',event=>{if(event.key==='Escape'&&window.parent!==window){event.preventDefault();window.parent.postMessage({type:'blockhold-art-close'},'*')}})
