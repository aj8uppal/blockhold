/** Capture the approved production models plus an actual solo sacrifice. */
import {chromium} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
const base=(process.env.BLOCKHOLD_CHECK_URL??'http://127.0.0.1:5197').replace(/\/$/,''),out='reviews/seraph-cathedral-release/renders'
mkdirSync(out,{recursive:true})
const browser=await chromium.launch(),errors=[]
async function record(page,path,gameplay=false){
 const video=await page.evaluate(async gameplay=>{
  // Drop the WebGL canvas's alpha plane before recording. Chromium can emit
  // malformed VP8 alpha packets when recording its WebGL surface directly.
  const source=document.querySelector('canvas'),opaque=document.createElement('canvas')
  opaque.width=source.width;opaque.height=source.height
  const context=opaque.getContext('2d',{alpha:false});let copying=true
  function copy(){context.drawImage(source,0,0);if(copying)requestAnimationFrame(copy)}copy()
  const stream=opaque.captureStream(30),chunks=[]
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2400000})
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
  const stop=new Promise(resolve=>recorder.onstop=resolve);recorder.start()
  const delay=ms=>new Promise(r=>setTimeout(r,ms))
  if(gameplay){await delay(800);const g=window.vg.game;g.fuseSeraph(g.towers[0],g.towers[1]);await delay(1900);g.sandboxOrder({kind:'sandboxSpawn',enemy:'juggernaut',count:12,hp:100,lane:0});await delay(8000)}else await delay(4000)
  recorder.stop();await stop;copying=false;stream.getTracks().forEach(t=>t.stop())
  const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result)
 },gameplay)
 writeFileSync(path,Buffer.from(video,'base64'))
}
try{
 const page=await browser.newPage({viewport:{width:640,height:640}})
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/reviews/seraph-grand-studies/viewer.html?direction=current');await page.waitForFunction(()=>window.previewReady)
 for(let form=0;form<9;form++){
  await page.evaluate(form=>{const a=window.artStudy;a.autoAttack(false);a.show('current',form);a.setView('studio');a.freeze();a.capture()},form)
  await page.screenshot({path:`${out}/cathedral-${form}.png`})
 }
 for(const [name,age,yaw] of [['front',1,0],['quarter',1,.65],['back',1,3.14],['release',.12,.36],['open',.24,.36],['settle',.42,.36]]){
  await page.evaluate(({age,yaw})=>{const a=window.artStudy;a.show('current',9);a.setView('studio');a.pose(age,yaw)},{age,yaw})
  await page.screenshot({path:`${out}/crimson-${name}.png`})
 }
 await page.setViewportSize({width:1100,height:760})
 await page.evaluate(()=>{const a=window.artStudy;a.show('current',9);a.setView('context');a.freeze()})
 await page.screenshot({path:`${out}/crimson-context.png`})
 for(const form of[5,8]){
  await page.setViewportSize({width:800,height:680})
  await page.evaluate(form=>{const a=window.artStudy;a.show('current',form);a.setView('studio');a.autoAttack(true)},form)
  await record(page,`${out}/cathedral-${form}.webm`)
 }
 await page.close()
 const context=await browser.newContext({viewport:{width:1200,height:840}})
 await context.addInitScript(()=>localStorage.setItem('blockhold.save.v1',JSON.stringify({xp:20000,taughtBasics:true,sfxMuted:true,musicMuted:true})))
 const game=await context.newPage();game.on('pageerror',e=>errors.push(e.message))
 await game.goto(base);await game.waitForFunction(()=>window.vg?.game)
 await game.evaluate(()=>window.vg.screens.onPlayLevel('greenhollow','normal','aldric','sandbox'))
 await game.waitForFunction(()=>window.vg.game.sessionTick>60)
 const info=await game.evaluate(()=>{
  const g=window.vg.game,e=g.engine,point=g.lanes[0].sample(5)
  const land=g.terrain.plots.filter(p=>!p.water)
  const first=[...land].sort((a,b)=>a.pos.distanceTo(point)-b.pos.distanceTo(point))[0]
  const second=land.filter(p=>p!==first).sort((a,b)=>a.pos.distanceTo(first.pos)-b.pos.distanceTo(first.pos))[0]
  for(const branch of[0,1]){g.buildTower('seraph',[first,second][branch]);for(let i=0;i<5;i++)g.upgradeTower(g.towers[branch],i===2?branch:0)}
  e.cancelCinematic();e.camTarget.copy(first.pos).lerp(second.pos,.5);e.camTarget.y+=1.1;e.camTargetGoal.copy(e.camTarget)
  e.dist=e.distGoal=12;e.pitch=e.pitchGoal=.58;e.yaw=e.yawGoal=2.7;e.updateCamera(0)
  document.querySelectorAll('#hud,#screens,#build-menu,#tower-panel').forEach(x=>x.style.display='none')
  return {plots:g.towers.map(t=>({index:t.plot.index,x:t.pos.x,z:t.pos.z})),point:{x:point.x,z:point.z}}
 })
 await game.waitForTimeout(1200)
 await game.locator('canvas').screenshot({path:`${out}/game-before.png`})
 await record(game,`${out}/game-sacrifice.webm`,true)
 const result=await game.evaluate(()=>{const g=window.vg.game,t=g.towers[0];return {towers:g.towers.length,fused:t.isFused,damage:t.damage,gaze:t.model.getObjectByName('gaze').rotation.y,effects:g.lingeringProjectiles.filter(p=>p.mesh.name==='seraph-awakening').length}})
 await game.locator('canvas').screenshot({path:`${out}/game-after.png`})
 if(result.towers!==1||!result.fused||result.damage<=0||result.effects!==0)throw Error(JSON.stringify(result))
 if(errors.length)throw Error(errors.join('\n'))
 writeFileSync(`${out}/capture.json`,JSON.stringify({info,result,errors},null,2))
 console.log('Captured all nine approved forms, six fusion poses, two firing studies and actual sacrifice/combat.',result)
}finally{await browser.close()}
