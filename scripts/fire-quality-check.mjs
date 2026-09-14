import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
const dir='reviews/arrival-and-fire/renders',errors=[]
mkdirSync(dir,{recursive:true})
const browser=await chromium.launch()
try{
 const page=await browser.newPage({viewport:{width:1200,height:840}})
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.addInitScript(()=>localStorage.setItem('blockhold.save.v1',JSON.stringify({xp:20000,taughtBasics:true,sfxMuted:true,musicMuted:true})))
 await page.goto(process.env.BLOCKHOLD_CHECK_URL??'http://127.0.0.1:5197')
 await page.waitForFunction(()=>window.vg?.game)
 await page.evaluate(()=>window.vg.screens.onPlayLevel('greenhollow','normal','aldric','sandbox'))
 await page.waitForFunction(()=>window.vg.game.sessionTick>30)
 await page.evaluate(()=>{
  const g=window.vg.game,e=g.engine,at=g.lanes[0].sample(5)
  const plot=g.terrain.plots.filter(p=>!p.water).sort((a,b)=>a.pos.distanceTo(at)-b.pos.distanceTo(at))[0]
  g.buildTower('cannon',plot);for(let i=1;i<5;i++)g.upgradeTower(g.towers[0],0)
  g.spawnEnemyAt('husk',0,5,{hpMult:1000});g.enemies[0].def={...g.enemies[0].def,speed:0}
  g.towers[0].fire(g.enemies[0],g);g.towers[0].cooldown=100
  g.clearSelection();e.cancelCinematic();e.camTarget.copy(at);e.camTarget.y=.5;e.camTargetGoal.copy(e.camTarget)
  e.dist=e.distGoal=7;e.yaw=e.yawGoal=.75;e.pitch=e.pitchGoal=.65;e.updateCamera(0)
  document.querySelectorAll('#hud,#screens,#build-menu,#tower-panel').forEach(x=>x.style.display='none')
 })
 await page.waitForFunction(()=>window.vg.game.dynamic.getObjectByName('mortar-fire')?.children[1].material.uniforms.uTime.value>1.4)
 await page.evaluate(()=>window.vg.game.paused=true)
 await page.locator('canvas').screenshot({path:`${dir}/fire-detail.png`})
 const state=await page.evaluate(()=>{
  const g=window.vg.game,fire=g.dynamic.getObjectByName('mortar-fire')
  return {exposure:g.engine.renderer.toneMappingExposure,heat:fire.children[1].material.uniforms.uHeat.value,drawCalls:g.engine.renderer.info.render.calls,triangles:g.engine.renderer.info.render.triangles,lights:g.engine.scene.children.filter(o=>o.isPointLight).length,time:fire.children[1].material.uniforms.uTime.value}
 })
 assert.equal(state.lights,2);assert.equal(state.exposure,1.12)
 await page.evaluate(()=>window.vg.game.dynamic.getObjectByName('mortar-fire').getObjectByName('fire-glow-and-embers').material.uniforms.uGlow.value=0)
 await page.waitForTimeout(120)
 await page.locator('canvas').screenshot({path:`${dir}/fire-no-glow.png`})
 await page.evaluate(()=>{
  const g=window.vg.game;g.dynamic.getObjectByName('mortar-fire').getObjectByName('fire-glow-and-embers').material.uniforms.uGlow.value=1
  g.engine.dist=g.engine.distGoal=11;g.engine.updateCamera(0)
 })
 await page.waitForTimeout(150)
 await page.locator('canvas').screenshot({path:`${dir}/fire-gameplay.png`})
 await page.evaluate(()=>{const e=window.vg.game.engine;e.yaw=e.yawGoal+=1.8;e.updateCamera(0)})
 await page.waitForTimeout(150)
 await page.locator('canvas').screenshot({path:`${dir}/fire-orbit.png`})
 const frozen=await page.evaluate(()=>window.vg.game.dynamic.getObjectByName('mortar-fire').children[1].material.uniforms.uTime.value)
 assert.equal(frozen,state.time)
 await page.evaluate(()=>{
  const g=window.vg.game;g.engine.setQuality('battery');g.engine.yaw=g.engine.yawGoal=.75;g.engine.dist=g.engine.distGoal=7;g.engine.updateCamera(0)
 })
 await page.setViewportSize({width:740,height:390});await page.waitForTimeout(200)
 await page.locator('canvas').screenshot({path:`${dir}/fire-phone.png`})
 await page.evaluate(()=>{const g=window.vg.game;g.paused=false;g.sellTower(g.towers[0])})
 await page.waitForTimeout(100)
 assert.deepEqual(await page.evaluate(()=>({patches:window.vg.game.dynamic.children.filter(o=>o.name==='mortar-fire').length,lights:window.vg.game.engine.scene.children.filter(o=>o.isPointLight&&o.intensity>0).length})),{patches:0,lights:0})
 const stress=await page.evaluate(async()=>{
  const g=window.vg.game,{addBurnZone,updateBurnVisuals}=await import('/src/game/projectiles.ts')
  g.paused=true
  const place=i=>{const p=g.lanes[0].sample(4+i*.2);addBurnZone(g,g.enemies[0].pos.clone().set(p.x,0,p.z),.9,1,4)}
  place(0);g.time+=.3;updateBurnVisuals(g);g.engine.render(true)
  const before=g.engine.renderer.info.render.calls,programs=g.engine.renderer.info.programs.length
  for(let i=1;i<12;i++)place(i)
  g.time+=.3;updateBurnVisuals(g);g.engine.render(true)
  return {before,programs}
 })
 await page.waitForTimeout(200)
 const after=await page.evaluate(()=>({calls:window.vg.game.engine.renderer.info.render.calls,programs:window.vg.game.engine.renderer.info.programs.length,lights:window.vg.game.engine.scene.children.filter(o=>o.isPointLight).length,flames:window.vg.game.dynamic.children.filter(o=>o.name==='mortar-fire'&&o.children[1].visible).length}))
 assert.equal(after.flames,12);assert.equal(after.lights,2);assert.ok(after.calls<=stress.before+44);assert.ok(after.programs<=stress.programs+1)
 await page.evaluate(async()=>{const {clearBurnZones}=await import('/src/game/projectiles.ts');clearBurnZones(window.vg.game)})
 assert.deepEqual(errors,[])
 writeFileSync(`${dir}/fire-checks.json`,JSON.stringify({state,stress:{before:stress,after},errors,checks:['glow on/off','normal zoom','orbit','pause','battery phone','sale clears lighting','12-patch draw and shader bounds']},null,2))
 console.log('PASS: raw WebGL views, glow on/off, normal zoom, orbit, pause, battery phone and lighting cleanup.',state)
}finally{await browser.close()}
