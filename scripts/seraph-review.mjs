/** Capture every Seraph model and beam fan in a staged, isolated local battle.
 * node scripts/seraph-review.mjs [repo root] [before|after]
 */
import {createServer} from 'vite'
import {chromium} from '@playwright/test'
import {mkdirSync,realpathSync,writeFileSync} from 'node:fs'
const root=realpathSync(process.argv[2]??process.cwd()),tag=process.argv[3]??'after'
const out=`${process.cwd()}/reviews/seraph`
mkdirSync(out,{recursive:true})
const server=await createServer({root,server:{port:0,host:'127.0.0.1'},logLevel:'error'});await server.listen()
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{
  const page=await browser.newPage({viewport:{width:1200,height:800}})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.vg?.game)
  for(const [tier,branch] of [[1,0],[2,0],[3,0],[4,0],[4,1],[5,0],[5,1]]){
    const result=await page.evaluate(async({tier,branch})=>{
      const {game:g,screens}=window.vg
      const {levelById}=await import('/src/game/levels.ts')
      const {enemyDefs}=await import('/src/game/enemyDefs.ts')
      g.save.xp=10000;g.save.seenEnemies=[...enemyDefs.keys()];g.save.taughtBasics=true
      g.startLevel(levelById('greenhollow'),'normal','aldric','campaign',{seed:91})
      screens.show('none');g.paused=false;g.gold=100000
      const plot=g.terrain.plots.slice().sort((a,b)=>a.pos.lengthSq()-b.pos.lengthSq())[0]
      g.buildTower('seraph',plot);g.paused=true
      const tower=g.towers[0]
      for(let i=1;i<tier;i++){tower.upgrade(i===3?branch:0,g);tower.update(0.2,g)}
      tower.update(1,g);tower.update(1,g)
      for(let i=0;i<7;i++){
        g.spawnEnemyAt(i%3===0?'gargoyle':'husk',0,0)
        const e=g.enemies.at(-1),angle=.3+i*Math.PI*2/7
        e.pos.set(tower.pos.x+Math.cos(angle)*2.2,i%3===0?1:0,tower.pos.z+Math.sin(angle)*2.2)
        e.hp=e.maxHp=10000;e.group.rotation.y=angle+Math.PI/2
      }
      g.hero.group.visible=false
      tower.cooldown=0;tower.update(1/60,g)
      g.engine.cancelCinematic();g.engine.camTargetGoal.copy(tower.pos);g.engine.camTargetGoal.y=0.7
      g.engine.distGoal=10;g.engine.pitchGoal=.8;g.engine.yawGoal=.2;g.engine.updateCamera(5)
      document.querySelectorAll('#hud,#screens,#build-menu,#tower-panel').forEach(x=>x.style.display='none')
      g.engine.render()
      return{model:tower.def.model,hit:g.enemies.filter(e=>e.hp<e.maxHp).length,draws:g.engine.renderer.info.render.calls}
    },{tier,branch})
    await page.screenshot({path:`${out}/${result.model}-${tag}.jpg`,type:'jpeg',quality:88})
    console.log(result)
    if(tag==='after'&&tier===5&&process.argv.includes('--motion')){
      const bytes=await page.evaluate(async()=>{
        const g=window.vg.game,t=g.towers[0],canvas=document.querySelector('canvas')
        const stream=canvas.captureStream(30),chunks=[]
        const recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:1800000})
        recorder.ondataavailable=e=>chunks.push(e.data)
        const stopped=new Promise(resolve=>recorder.onstop=resolve)
        recorder.start()
        t.seraphAt=g.time+0.7
        const timer=setInterval(()=>{
          const dt=1/60;g.time+=dt;t.update(dt,g)
          for(const e of g.enemies){e.state='gone';e.update(dt,g);e.state='walking';e.animWalk(dt,0.2)}
          for(const p of g.projectiles){p.update(dt);if(p.done){g.dynamic.remove(p.mesh);p.dispose?.()}}
          g.projectiles=g.projectiles.filter(p=>!p.done)
          g.particles.update(dt);g.engine.render()
        },1000/60)
        await new Promise(resolve=>setTimeout(resolve,4000))
        clearInterval(timer);recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop())
        return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))
      })
      writeFileSync(`${out}/${result.model}-motion.webm`,new Uint8Array(bytes))
    }
  }
  await page.evaluate(async()=>{
    const {game:g,screens}=window.vg
    const {levelById}=await import('/src/game/levels.ts')
    g.startLevel(levelById('sunderfall'),'normal','aldric','campaign',{seed:91})
    screens.show('none');g.gold=100000;g.paused=false
    const plot=g.terrain.plots.find(p=>p.cell[0]===19&&p.cell[1]===6)
    g.buildTower('beacon',plot);g.paused=true;g.towers[0].update(1,g)
    g.engine.cancelCinematic();g.engine.camTargetGoal.copy(plot.pos);g.engine.camTargetGoal.y=0.6
    g.engine.distGoal=13;g.engine.pitchGoal=.65;g.engine.yawGoal=.2;g.engine.updateCamera(5)
    document.querySelectorAll('#hud,#screens,#build-menu,#tower-panel').forEach(x=>x.style.display='none')
    g.engine.render()
  })
  await page.screenshot({path:`${out}/range-${tag}.jpg`,type:'jpeg',quality:88})
  if(errors.length)throw Error(errors.join('\n'))
}finally{await browser.close();await server.close()}
