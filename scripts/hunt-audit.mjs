/** Production combat at fixed 60Hz, isolated localhost/browser and no account writes.
 * node scripts/hunt-audit.mjs --seeds 71,193 --difficulties casual,normal,veteran
 * Optional --hunts ossuary,empress --builds mixed,precision,barracks,seraph --out /tmp/report.json
 * Scripted purchase plans plus aimed meteor/reinforcements; no Armory, Mythics,
 * specializations, traps, early calls, ascensions, premium currency, or god mode.
 */
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const arg = (key, fallback) => process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback
const config = {
  hunts: arg('--hunts', 'ossuary,empress').split(','),
  builds: arg('--builds', 'mixed,precision,barracks,seraph').split(','),
  difficulties: arg('--difficulties', 'casual,normal,veteran').split(','),
  seeds: arg('--seeds', '71,193').split(',').map(Number),
  focusBoss: process.argv.includes('--focus-boss'),
}
const out = arg('--out', 'reviews/hunt-balance.json')
const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false},logLevel:'error'})
await server.listen()
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
  const page = await browser.newPage({viewport:{width:1280,height:800}})
  await page.goto(server.resolvedUrls.local[0])
  await page.waitForFunction(() => window.vg?.game)
  const results = []
  for (const id of config.hunts) for (const difficulty of config.difficulties) for (const build of config.builds) for (const seed of config.seeds) {
    const result = await page.evaluate(async ({id,difficulty,build,seed,focusBoss}) => {
      const {huntLevel}=await import('/src/game/hunts.ts')
      const {towerTrees,investedGold}=await import('/src/game/towerDefs.ts')
      const {enemyDefs,enemyDef}=await import('/src/game/enemyDefs.ts')
      const {xpForLevel}=await import('/src/game/progress.ts')
      const g=window.vg.game, noop=()=>{}
      for(const k of ['sfx','floater','impact','deferFx','ambientWeather','shatterUnit','selectTower','teachSightline','buildLanePreview'])g[k]=noop
      for(const k of ['showBanner','showToast','spawnFloater','xpTick','pulseLives','flashGold','setSpeed','closeBuildMenu','closeTowerPanel'])g.hud[k]=noop
      for(const k of ['addShake','cinematic'])g.engine[k]=noop
      for(const k of Object.getOwnPropertyNames(Object.getPrototypeOf(g.particles)))if(k!=='constructor'&&typeof g.particles[k]==='function')g.particles[k]=noop
      for(const pool of Object.values(g.particles))if(pool&&typeof pool.emit==='function')pool.emit=noop
      g.endGame=won=>{g.phase=won?'victory':'defeat'}
      g.save.armory={};g.save.honors=[];g.save.heroPaths={}
      g.save.xp=xpForLevel(25);g.save.seenEnemies=[...enemyDefs.keys()];g.save.taughtBasics=true
      g.startLevel(huntLevel(id),difficulty,'aldric','campaign',{seed,hunt:id})
      g.paused=true
      // Plans name the branch and capstone role. Every purchase uses Game's
      // affordability/unlock path. A Seraph plan saves rather than spending its
      // transformation fund on cheap tower spam.
      const profiles={
        mixed:[['mage',0],['arrow',1],['barracks',0],['cannon',1],['beacon',0],['ballista',0],['mage',1],['arrow',0]],
        precision:[['arrow',0],['ballista',0],['mage',0],['barracks',1],['beacon',0],['arrow',0],['ballista',1],['mage',1]],
        barracks:[['barracks',0],['mage',1],['arrow',0],['beacon',0],['barracks',0],['ballista',0],['mage',0],['arrow',1]],
        seraph:[['seraph',0],['barracks',0],['mage',0],['arrow',0],['beacon',0]],
      }
      const roster=profiles[build]
      const samples=g.lanes.map(l=>Array.from({length:Math.ceil(l.length*2)},(_,i)=>l.sample(i*.5)))
      const covers=(p,range)=>samples.map(l=>l.reduce((n,q)=>n+(Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<=range&&!g.sightBlocked(p.pos.x,p.pos.z,g.terrain.cellTop(...p.cell),q.x,q.z)?0.5:0),0))
      const demand=g.lanes.map((_,li)=>g.level.waves.reduce((n,w)=>n+w.groups.filter(x=>(x.lane??0)===li).reduce((a,x)=>a+enemyDef(x.enemy).hp*x.count*(x.hpMult??1),0),0))
      const bestPlot=(kind)=>{
        let best=null,score=-Infinity
        for(const p of g.terrain.plots.filter(p=>!p.occupied)){
          const range=towerTrees[kind].branches[0].range*(g.terrain.isOnHill(...p.cell)?1.15:1)
          const coverage=g.towers.filter(t=>!t.isBeacon).map(t=>covers(t.plot,t.range))
          let s=kind==='beacon'?g.towers.reduce((n,t)=>n+(p.pos.distanceTo(t.pos)<range?investedGold(t.kind,t.level,t.branch):0),0)
            :covers(p,range).reduce((n,c,li)=>n+c*Math.sqrt(demand[li]+1)/(3+coverage.reduce((a,x)=>a+x[li],0)),0)
          s*=1+0.025*Math.sin(seed+p.index*7)
          if(s>score){best=p;score=s}
        }
        return best
      }
      const orders=[]
      const initial=build==='seraph'?4:5
      // First establish the whole mixed defense, then invest into tiers.
      for(let i=0;i<initial;i++)orders.push({i,tier:1})
      for(let tier=2;tier<=3;tier++)for(let i=0;i<initial;i++)orders.push({i,tier})
      if(build==='seraph'){
        orders.push({i:0,tier:4},{i:1,tier:4},{i:2,tier:4},{i:3,tier:4},{i:0,tier:5})
        orders.push({i:4,tier:1},{i:4,tier:2},{i:4,tier:3},{i:4,tier:4},{i:1,tier:5})
      } else {
        for(let tier=4;tier<=5;tier++)for(let i=0;i<initial;i++)orders.push({i,tier})
        for(let i=initial;i<roster.length;i++)for(let tier=1;tier<=5;tier++)orders.push({i,tier})
      }
      const placed=[],purchases=[],snapshots=[],bosses=[];let nextOrder=0,lastWave=-1
      const buy=()=>{
        g.paused=false
        for(let limit=0;limit<50&&nextOrder<orders.length;limit++){
          const o=orders[nextOrder], [kind,branch]=roster[o.i]
          const t=placed[o.i]
          const cost=o.tier===1?towerTrees[kind].levels[0].cost:t.upgradeOptions[t.level===3?branch:0]?.cost
          if(cost===undefined||g.gold<cost)break
          if(o.tier===1){const p=bestPlot(kind);if(!p)break;g.buildTower(kind,p);placed[o.i]=g.towers.at(-1)}
          else g.upgradeTower(t,t.level===3?branch:0)
          purchases.push({time:Math.round(g.time),wave:g.waves.waveIndex+1,kind,tier:o.tier,plot:placed[o.i].plot.index,gold:Math.round(g.gold)})
          nextOrder++
        }
        g.paused=true
      }
      const seenBoss=new Map()
      for(let tick=0;tick<60*1800&&g.phase==='playing';tick++){
        if(tick%30===0)buy()
        if(tick%120===0){
          const foes=g.enemies.filter(e=>e.targetable)
          const threat=foes.slice().sort((a,b)=>{
            const pressure=e=>foes.reduce((n,f)=>n+(Math.hypot(e.pos.x-f.pos.x,e.pos.z-f.pos.z)<1.8?Math.min(300,f.hp):0),0)+(e.def.boss?500:0)
            return pressure(b)-pressure(a)
          })[0]
          g.paused=false
          if(focusBoss){
            const policy=foes.some(e=>e.def.boss)?'strong':'first'
            for(const tower of g.towers.filter(t=>!t.isBeacon&&!t.isBarracks))for(let n=0;n<4&&tower.targetPolicy!==policy;n++)g.cycleTargetPolicy(tower)
          }
          if(threat){
            if(g.abilities.meteor.cooldown<=0&&(foes.length>=5||threat.def.boss))g.performTarget('meteor',threat.pos.x,threat.pos.z,null)
            if(g.hero?.signatureReady)g.castHeroSignature()
            const front=foes.filter(e=>!e.def.flying).sort((a,b)=>a.remaining-b.remaining)[0]
            if(front&&g.abilities.reinforce.cooldown<=0)g.performTarget('reinforce',front.pos.x,front.pos.z,null)
          }
          g.paused=true
        }
        g.simStep(1/60)
        for(const e of g.enemies)if(e.def.boss&&!seenBoss.has(e)){
          const record={id:e.def.id,hp:e.maxHp,at:Math.round(g.time),wave:g.waves.waveIndex+1}
          seenBoss.set(e,record);bosses.push(record)
        }
        for(const [e,record] of seenBoss)if(!e.alive&&record.endedAt===undefined){record.endedAt=Math.round(g.time);record.outcome=e.hp<=0?(e.def.phaseInto?'landed':'defeated'):'escaped';record.remaining=Math.round(e.remaining);record.hpLeft=Math.max(0,Math.round(e.hp))}
        if(g.waves.waveIndex!==lastWave){lastWave=g.waves.waveIndex;snapshots.push({wave:lastWave+1,lives:g.lives,gold:Math.round(g.gold),spent:g.towers.reduce((n,t)=>n+investedGold(t.kind,t.level,t.branch),0)})}
      }
      const towers=g.towers.map(t=>({kind:t.kind,tier:t.level,branch:t.branch,plot:t.plot.index,damage:Math.round(t.damage)}))
      const contribution=Object.fromEntries(['seraph','barracks'].map(kind=>[kind,towers.some(t=>t.kind===kind&&t.tier>=5&&t.damage>=4000)]))
      const mastery=Object.fromEntries(Object.entries(contribution).map(([family,qualified])=>[family,qualified&&difficulty!=='casual'&&g.phase==='victory']))
      const result={id,difficulty,build,seed,focusBoss,won:g.phase==='victory',wave:g.waves.waveIndex+1,lives:g.lives,leaks:g.leaks,seconds:Math.round(g.time),gold:Math.round(g.gold),earned:g.goldEarned,contribution,mastery,towers,bosses,snapshots,purchases,remaining:g.enemies.filter(e=>e.alive).map(e=>({id:e.def.id,hp:Math.round(e.hp),remaining:Math.round(e.remaining)}))}
      g.disposeLevel();return result
    },{id,difficulty,build,seed,focusBoss:config.focusBoss})
    results.push(result)
    console.log(`${id} ${difficulty} ${build} ${seed}: ${result.won?'WIN':'LOSS'} w${result.wave} lives${result.lives} ${result.seconds}s mastery=${JSON.stringify(result.mastery)}`)
    writeFileSync(out,JSON.stringify({config,method:'Production Game.simStep at fixed60Hz. Account25, Aldric base path, no Armory. Scripted mixed purchases and aimed meteor/reinforcements/base hero signature every2s when available. No early calls, hero movement, traps, ascension, Mythics or specializations. Boss focus uses the normal target-policy command when enabled. Mastery requires a win above Casual and a standing tier5 family with4000 actualdamage. No player win-rate inference.',results},null,2)+'\n')
  }
} finally { await browser.close();await server.close() }
