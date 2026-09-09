/** Real 60 Hz combat, driven in an isolated browser. No cloud account or production writes.
 * Run: node scripts/gameplay-audit.mjs --out reviews/gameplay-after.json
 * Optional --maps greenhollow,sunderfall --builds combined,storm --difficulties normal --seeds 71,193
 * --active enables adaptive purchases, a campaign-earned Armory budget and abilities; --hero liora changes champion.
 * This is a repeatable bot comparison, never a player win-rate estimate.
 */
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const arg = (key, fallback) => process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback
const config = {
  maps: arg('--maps', '').split(',').filter(Boolean),
  builds: arg('--builds', 'combined,storm,siege,precision,support,seraph').split(','),
  difficulties: arg('--difficulties', 'casual,normal,veteran').split(','),
  hero: arg('--hero', 'aldric'),
  active: process.argv.includes('--active'),
  seeds: arg('--seeds', '71').split(',').map(Number),
}
const server = await createServer({server:{port:0,host:'127.0.0.1'},logLevel:'error'})
await server.listen()
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
  const page = await browser.newPage({viewport:{width:1280,height:800}})
  await page.goto(server.resolvedUrls.local[0])
  await page.waitForFunction(() => window.vg?.game)
  const metadata = await page.evaluate(async () => {
    const {levels}=await import('/src/game/levels.ts')
    const {buildPaths}=await import('/src/game/path.ts')
    const {judgeLevel}=await import('/src/game/balanceModel.ts')
    return levels.map(l=>({...l, laneLengths:buildPaths(l).lanes.map(p=>p.length), staticPressure:judgeLevel(l,'normal')}))
  })
  const results=[]
  for(const level of metadata.filter(l=>!config.maps.length||config.maps.includes(l.id))) {
    for(const difficulty of config.difficulties) for(const build of config.builds) for(const seed of config.seeds) {
      const result=await page.evaluate(async ({id,difficulty,build,seed,active,hero})=>{
        const {levelById,levels}=await import('/src/game/levels.ts')
        const {towerTrees,investedGold}=await import('/src/game/towerDefs.ts')
        const {enemyDefs,enemyDef}=await import('/src/game/enemyDefs.ts')
        const {ARMORY_TRACKS}=await import('/src/game/armory.ts')
        const {xpForLevel}=await import('/src/game/progress.ts')
        const g=window.vg.game
        const noop=()=>{}
        // Remove presentation work only. All combat, terrain, hazards, bounties,
        // legal prices/upgrades and wave scheduling use the production Game.
        for(const k of ['sfx','floater','impact','deferFx','ambientWeather','shatterUnit','selectTower','teachSightline','buildLanePreview'])g[k]=noop
        for(const k of ['showBanner','showToast','spawnFloater','xpTick','pulseLives','flashGold','setSpeed','closeBuildMenu','closeTowerPanel'])g.hud[k]=noop
        for(const k of ['addShake','cinematic'])g.engine[k]=noop
        for(const k of Object.getOwnPropertyNames(Object.getPrototypeOf(g.particles)))if(k!=='constructor'&&typeof g.particles[k]==='function')g.particles[k]=noop
        for(const pool of Object.values(g.particles))if(pool&&typeof pool.emit==='function')pool.emit=noop
        g.endGame=won=>{g.phase=won?'victory':'defeat'}
        const profiles={
          combined:{roster:['arrow','mage','barracks','cannon'],branch:0,level:1},
          storm:{roster:['mage','arrow','barracks','mage'],branch:1,level:1},
          siege:{roster:['mage','cannon','barracks','arrow','cannon'],branch:1,level:1},
          precision:{roster:['arrow','mage','ballista','arrow'],branch:0,level:15},
          support:{roster:['arrow','mage','ballista','cannon'],branch:1,level:20,beacon:true},
          seraph:{roster:['arrow','mage','barracks','cannon'],branch:0,level:25,beacon:true,seraph:true},
        }
        const profile=profiles[build]
        g.save.armory={};
        let stars=levels.findIndex(l=>l.id===id)*3;const starBudget=stars
        if(active)for(const [track,maxTier] of [['coffers',3],['comet',1],['musterroll',1],['drill',3],['bulwark',1],['secondwind',1]]){
          const costs=ARMORY_TRACKS.find(t=>t.id===track).tierCosts;
          for(let i=0;i<maxTier&&stars>=costs[i];i++){g.save.armory[track]=i+1;stars-=costs[i]}
        }
        g.save.xp=xpForLevel(Math.max(profile.level,hero==='zephyra'?10:hero==='liora'?5:1));g.save.seenEnemies=[...enemyDefs.keys()];g.save.taughtBasics=true
        g.startLevel(levelById(id),difficulty,hero,'campaign',{seed})
        g.paused=true // suppress the normal animation frame loop between evaluations
        const lvl=g.level
        const samples=g.lanes.map(l=>Array.from({length:Math.ceil(l.length*2)},(_,i)=>l.sample(i*.5)))
        const plans=[];const snapshots=[];let nextBuy=0;let lastWave=-1
        const cover=(plot,range)=>samples.map(l=>l.reduce((n,p)=>n+(Math.hypot(plot.pos.x-p.x,plot.pos.z-p.z)<=range&&!g.sightBlocked(plot.pos.x,plot.pos.z,g.terrain.cellTop(...plot.cell),p.x,p.z)?0.5:0),0))
        const bestPlot=(kind)=>{
          const def=towerTrees[kind].levels[0]
          const coverage=g.towers.filter(t=>!t.isBeacon).map(t=>cover(t.plot,t.range))
          const demands=g.lanes.map((_,li)=>lvl.waves.slice(0,Math.max(4,(g.waves.waveIndex+4))).reduce((n,w)=>n+w.groups.filter(x=>(x.lane??0)===li).reduce((a,x)=>a+enemyDef(x.enemy).hp*x.count,0),0))
          let best=null,score=-Infinity
          for(const p of g.terrain.plots.filter(p=>!p.occupied)){
            const reach=def.range*(g.terrain.isOnHill(...p.cell)?1.15:1)
            let s
            if(kind==='beacon')s=g.towers.reduce((n,t)=>n+(Math.hypot(p.pos.x-t.pos.x,p.pos.z-t.pos.z)<=reach?investedGold(t.kind,t.level,t.branch):0),0)
            else s=cover(p,reach).reduce((n,c,i)=>n+c*Math.sqrt(demands[i]+1)/(2+coverage.reduce((a,x)=>a+x[i],0)),0)
            // Distinct seeds break ties/near-ties among reasonable foundations.
            s*=1+0.035*Math.sin(seed+p.index*7)
            if(s>score){score=s;best=p}
          }
          return best
        }
        const buy=()=>{
          g.paused=false
          if(active){
            const groups=lvl.waves.slice(Math.max(0,g.waves.waveIndex),g.waves.waveIndex+4).flatMap(w=>w.groups)
            const foes=groups.map(x=>({d:enemyDef(x.enemy),weight:x.count*enemyDef(x.enemy).hp}))
            const sum=foes.reduce((n,x)=>n+x.weight,0)||1
            const power=def=>{
              const effectiveness=foes.reduce((n,{d,weight})=>n+weight*(d.flying&&!def.flying?0:def.damageType==='magic'?1-d.magicResist:1-d.armor),0)/sum
              if(def.soldier){const d=def.soldier;return (def.soldierCount*(d.damage[0]+d.damage[1])/2/d.attackInterval*.65+d.hp*.025)*foes.reduce((n,x)=>n+(x.d.flying?0:x.weight),0)/sum}
              if(def.aura)return 0
              let output=(def.damage[0]+def.damage[1])/2/def.attackInterval*effectiveness
              if(def.special?.kind==='crit')output*=1+def.special.chance*(def.special.mult-1)
              if(def.special?.kind==='chain')output*=Array.from({length:def.special.targets},(_,i)=>def.special.falloff**i).reduce((a,b)=>a+b,0)
              if(def.chainTargets)output*=Math.min(3,def.chainTargets)
              if(def.splash)output*=2.5
              if(def.special?.kind==='poison')output+=def.special.dps*.65
              if(def.special?.kind==='burnGround')output+=def.special.dps*2
              if(def.special?.kind==='cluster')output+=def.special.count*(def.special.damage[0]+def.special.damage[1])/2/def.attackInterval*.65
              return output
            }
            const options=[]
            for(const t of g.towers.filter(t=>t.level<5)){
              const branch=t.level===3?profile.branch:0,def=t.upgradeOptions[branch]
              const reach=cover(t.plot,t.range).reduce((a,b)=>a+b,0)
              const gain=t.isBeacon?g.towers.filter(x=>!x.isBeacon&&x.pos.distanceTo(t.pos)<t.auraReach).reduce((n,x)=>n+power(x.def),0)*((1+def.aura.damage)*(1+def.aura.rate)-(1+t.def.aura.damage)*(1+t.def.aura.rate)):power(def)-power(t.def)
              options.push({cost:def.cost,score:gain*Math.max(2,reach)/def.cost,run:()=>g.upgradeTower(t,branch)})
            }
            const roster=[...new Set(profile.roster)]
            if(profile.beacon&&g.towers.length>=5&&!g.towers.some(t=>t.isBeacon))roster.push('beacon')
            if(profile.seraph&&g.towers.length>=6&&!g.towers.some(t=>t.isSeraph))roster.push('seraph')
            const required=profile.roster.find(k=>!g.towers.some(t=>t.kind===k))
            for(const kind of roster){
              if(g.towers.filter(t=>t.kind===kind).length>=(kind==='barracks'?2:kind==='cannon'?3:7))continue
              const p=bestPlot(kind);if(!p)continue
              const def=towerTrees[kind].levels[0]
              const reach=cover(p,def.range).reduce((a,b)=>a+b,0)
              const gain=kind==='beacon'?g.towers.filter(t=>!t.isBeacon&&t.pos.distanceTo(p.pos)<def.range).reduce((n,t)=>n+power(t.def)*.1,0):power(def)
              const requiredBoost=kind===required&&g.towers.length<4?4:1
              const spread=g.towers.length<g.lanes.length*2?1.5:.78
              options.push({cost:def.cost,score:gain*Math.max(2,reach)/def.cost*requiredBoost*spread,run:()=>g.buildTower(kind,p)})
            }
            options.sort((a,b)=>b.score-a.score)
            const choice=options[0]
            if(choice&&g.gold>=choice.cost)choice.run()
            g.paused=true
            return
          }
          const count=g.towers.length
          // Small, recognisable mixed builds; add support only after attackers exist.
          let kind=profile.roster[count%profile.roster.length]
          if(profile.beacon&&count===6)kind='beacon'
          if(profile.seraph&&count===8)kind='seraph'
          const expand=count<Math.min(lvl.plots.length,10)
          // Get six defenders first, then alternate growth with upgrades.
          if(expand&&(count<6||g.towers.every(t=>t.level>=Math.min(3,1+Math.floor((count-5)/2))))){
            const p=bestPlot(kind)
            if(p&&g.gold>=towerTrees[kind].levels[0].cost){g.buildTower(kind,p);plans.push({wave:g.waves.waveIndex+1,kind,plot:p.index,tier:1});}
          } else {
            const candidates=g.towers.filter(t=>t.level<5).map(t=>({t,d:t.upgradeOptions[t.level===3?profile.branch:0]})).filter(x=>x.d)
            // Prefer the largest affordable relative gain; utility families get
            // a comparable tier budget rather than pretending their raw DPS is zero.
            candidates.sort((a,b)=>{
              const score=x=>(x.d.range/x.t.def.range)*(1+(5-x.t.level)*.18)/(x.d.cost)* (x.t.isBeacon?.8:1)
              return score(b)-score(a)
            })
            const choice=candidates.find(x=>x.d.cost<=g.gold)
            if(choice){g.upgradeTower(choice.t,choice.t.level===3?profile.branch:0);plans.push({wave:g.waves.waveIndex+1,kind:choice.t.kind,plot:choice.t.plot.index,tier:choice.t.level});}
            else if(expand&&candidates.length===0){const p=bestPlot(kind);if(p&&g.gold>=towerTrees[kind].levels[0].cost)g.buildTower(kind,p)}
          }
          g.paused=true
        }
        // Keep a fixed defensive rally. Active runs cast abilities below;
        // neither mode uses early calls, ascension or consumables.
        for(let tick=0;tick<60*2400&&g.phase==='playing';tick++){
          if(tick>=nextBuy){buy();nextBuy=tick+30}
          if(active&&tick%120===0){
            const foes=g.enemies.filter(e=>e.targetable)
            const threat=foes.slice().sort((a,b)=>{
              const pressure=e=>foes.reduce((n,f)=>n+(Math.hypot(e.pos.x-f.pos.x,e.pos.z-f.pos.z)<1.8?Math.min(160,f.hp):0),0)+(e.def.boss?180:0)
              return pressure(b)-pressure(a)
            })[0]
            g.paused=false
            if(threat){
              if(g.abilities.meteor.cooldown<=0&&(foes.length>=5||threat.def.boss))g.performTarget('meteor',threat.pos.x,threat.pos.z,null)
              if(g.hero?.signatureReady)g.castHeroSignature()
              const front=foes.filter(e=>!e.def.flying).sort((a,b)=>(a.lane.length-a.dist)-(b.lane.length-b.dist))[0]
              if(front&&g.abilities.reinforce.cooldown<=0)g.performTarget('reinforce',front.pos.x,front.pos.z,null)
            }
            g.paused=true
          }
          g.simStep(1/60)
          if(g.waves.waveIndex!==lastWave){lastWave=g.waves.waveIndex;snapshots.push({wave:lastWave+1,lives:g.lives,gold:Math.round(g.gold),towers:g.towers.length,spent:Math.round(g.towers.reduce((n,t)=>n+investedGold(t.kind,t.level,t.branch),0))})}
        }
        const result={active,hero,armory:{...g.save.armory},starBudget,starsSpent:starBudget-stars,map:id,difficulty,build,seed,won:g.phase==='victory',wave:g.waves.waveIndex+1,lives:g.lives,leaks:g.leaks,seconds:Math.round(g.time),gold:Math.round(g.gold),towers:g.towers.map(t=>({kind:t.kind,tier:t.level,branch:t.branch,plot:t.plot.index,damage:Math.round(t.damage)})),snapshots,plans}
        g.disposeLevel();return result
      },{id:level.id,difficulty,build,seed,active:config.active,hero:config.hero})
      results.push(result)
      console.log(`${level.id} ${difficulty} ${build} ${seed}: ${result.won?'WIN':'LOSS'} w${result.wave} lives${result.lives}`)
      const out=arg('--out','/tmp/blockhold-gameplay-audit.json')
      const method = `Production Game.simStep at 60 Hz. ${config.active ? 'Adaptive mixed-build bot, Armory budget of three stars per prior map, meteor/reinforcements/hero signature.' : 'Fixed mixed-build bot, no Armory or active abilities.'} Hero: ${config.hero}. No traps, early calls, hero movement, ascensions or hero rank purchases. Outcome is not human win probability.`
      writeFileSync(out,JSON.stringify({config,method,maps:metadata,results},null,2)+'\n')
    }
  }
}finally{await browser.close();await server.close()}
