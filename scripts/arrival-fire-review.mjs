/** Record actual sandbox effects without touching the user's browser profile. */
import {chromium} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
const base=(process.env.BLOCKHOLD_CHECK_URL??'http://127.0.0.1:5197').replace(/\/$/,''),dir='reviews/arrival-and-fire'
mkdirSync(`${dir}/renders`,{recursive:true})
const browser=await chromium.launch(),errors=[],metrics={}
async function record(page,kind){
 const video=await page.evaluate(async kind=>{
  const source=document.querySelector('canvas'),opaque=document.createElement('canvas');opaque.width=source.width;opaque.height=source.height
  const ctx=opaque.getContext('2d',{alpha:false});let copying=true
  function copy(){ctx.drawImage(source,0,0);if(copying)requestAnimationFrame(copy)}copy()
  const stream=opaque.captureStream(30),chunks=[],r=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2600000})
  r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const stopped=new Promise(resolve=>r.onstop=resolve);r.start()
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));await delay(600)
  const g=window.vg.game
  if(kind==='arrival'){g.fuseSeraph(g.towers[0],g.towers[1]);g.clearSelection();await delay(3700)}
  else{g.towers[0].fire(g.enemies[0],g);g.towers[0].cooldown=100;await delay(7900)}
  r.stop();await stopped;copying=false;stream.getTracks().forEach(t=>t.stop())
  const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str)
 },kind)
 writeFileSync(`${dir}/renders/${kind}.webm`,Buffer.from(video,'base64'))
}
try{
 for(const kind of['arrival','fire']){
  const context=await browser.newContext({viewport:{width:1200,height:840}})
  await context.addInitScript(()=>localStorage.setItem('blockhold.save.v1',JSON.stringify({xp:20000,taughtBasics:true,sfxMuted:true,musicMuted:true})))
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.goto(base);await page.waitForFunction(()=>window.vg?.game)
  await page.evaluate(()=>window.vg.screens.onPlayLevel('greenhollow','normal','aldric','sandbox'))
  await page.waitForFunction(()=>window.vg.game.sessionTick>60)
  await page.evaluate(kind=>{
   const g=window.vg.game,e=g.engine,at=g.lanes[0].sample(5),land=g.terrain.plots.filter(p=>!p.water)
   const first=[...land].sort((a,b)=>a.pos.distanceTo(at)-b.pos.distanceTo(at))[0]
   if(kind==='arrival'){
    const second=land.filter(p=>p!==first).sort((a,b)=>a.pos.distanceTo(first.pos)-b.pos.distanceTo(first.pos))[0]
    for(const branch of[0,1]){g.buildTower('seraph',[first,second][branch]);for(let i=0;i<5;i++)g.upgradeTower(g.towers[branch],i===2?branch:0)}
    e.camTarget.copy(first.pos).lerp(second.pos,.5);e.camTarget.y+=1.05;e.dist=e.distGoal=12.5;e.yaw=e.yawGoal=.25
   }else{
    g.buildTower('cannon',first);for(let i=1;i<5;i++)g.upgradeTower(g.towers[0],0);g.towers[0].cooldown=100
    g.spawnEnemyAt('husk',0,5,{hpMult:1000});g.enemies[0].def={...g.enemies[0].def,speed:0}
    e.camTarget.copy(at);e.camTarget.y=.5;e.dist=e.distGoal=7;e.yaw=e.yawGoal=.75
   }
   g.clearSelection();e.cancelCinematic();e.camTargetGoal.copy(e.camTarget);e.pitch=e.pitchGoal=.65;e.updateCamera(0)
   document.querySelectorAll('#hud,#screens,#build-menu,#tower-panel').forEach(x=>x.style.display='none')
  },kind)
  await page.waitForTimeout(700)
  await record(page,kind)
  metrics[kind]=await page.evaluate(()=>({effects:window.vg.game.dynamic.children.filter(o=>o.name==='mortar-fire'||o.name==='seraph-awakening').length,drawCalls:window.vg.game.engine.renderer.info.render.calls}))
  if(metrics[kind].effects!==0)throw Error('Effect did not clear: '+kind)
  await context.close()
 }
 // Pull review stills from the recorded gameplay, using the same browser decoder.
 const page=await browser.newPage({viewport:{width:1200,height:840}})
 for(const [kind,frames]of[['arrival',[['transfer',1.03],['arrival',1.74],['settled',3.9]]],['fire',[['flames',2.2],['coals',6.1]]]]){
  await page.setContent(`<style>body{margin:0;background:#0e171c}video{width:1200px;height:840px;display:block}</style><video muted playsinline preload="auto" src="${base}/${dir}/renders/${kind}.webm"></video>`)
  const v=page.locator('video');await v.evaluate(v=>new Promise(resolve=>{if(v.readyState>=2)resolve();else v.onloadeddata=resolve}))
  for(const [name,time]of frames){
   await v.evaluate((v,t)=>new Promise(resolve=>{v.onseeked=resolve;v.currentTime=t}),time)
   await v.evaluate(async v=>{await v.play();await new Promise(r=>setTimeout(r,60));v.pause()});await page.waitForTimeout(150)
   await v.screenshot({path:`${dir}/renders/${name}.png`})
  }
 }
 if(errors.length)throw Error(errors.join('\n'))
 writeFileSync(`${dir}/renders/metrics.json`,JSON.stringify({metrics,errors},null,2))
 console.log('Captured arrival and fire lifecycle from actual gameplay; effects clear and no browser errors.',metrics)
}finally{await browser.close()}
