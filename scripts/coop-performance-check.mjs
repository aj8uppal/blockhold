import {chromium} from '@playwright/test'
import {writeFileSync} from 'node:fs'
// Two real lobby seats, 80ms simulated network latency, 1×/2× orders.
// BLOCKHOLD_CHECK_URL must point to a frontend connected to a running sync service.
// Reports go to /tmp; software-rendered frame times are not device FPS benchmarks.
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const pages=[];const errors=[]
try{
for(let i=0;i<2;i++){
 const context=await browser.newContext({viewport:{width:960,height:600}})
 await context.addInitScript(()=>{localStorage.setItem('blockhold.save.v1',JSON.stringify({xp:6000,taughtBasics:true,unlocked:4,sfxMuted:true,musicMuted:true}));localStorage.setItem('blockhold.quality','low')})
 const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.BLOCKHOLD_CHECK_URL || 'http://127.0.0.1:5178/');await page.waitForFunction(()=>window.vg?.game)
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:-1,uploadThroughput:-1})

}
const [host,guest]=pages
await host.getByRole('button',{name:'Co-op',exact:true}).click()
await host.getByRole('button',{name:'Open a room',exact:false}).click()
await host.locator('.coop-code').waitFor()
const code=await host.locator('.coop-code').textContent()
await host.getByLabel('Co-op battlefield').selectOption('frostmere')
const base=(process.env.BLOCKHOLD_CHECK_URL || 'http://127.0.0.1:5178/').replace(/\/?$/, '/')
await guest.goto(`${base}?coop=${code}`)
await guest.locator('.coop-code').waitFor()
// The invite navigation replaces the instrumentation installed above.
await guest.evaluate(()=>{window.samples=[];window.delays=[];window.startMs=0})
await host.locator('.coop-who').filter({hasText:'2 of 2'}).waitFor()
await host.getByRole('button',{name:'Start the battle',exact:false}).click()
await Promise.all(pages.map(p=>p.waitForFunction(()=>window.vg.game.coop&&!window.vg.game.isRecovering&&!window.vg.game.paused)))
for(const page of pages){
 await page.evaluate(()=>{
  const g=window.vg.game;window.samples=[];window.delays=[];window.sent=new Map();window.startMs=0
  const update=g.update.bind(g);g.update=dt=>{const before=g.sessionTick,start=performance.now();update(dt);if(g.coop&&!g.paused)window.samples.push({at:start-window.startMs,dt:dt*1000,work:performance.now()-start,ticks:g.sessionTick-before,available:g.coopBudget+g.coopMarkers.reduce((s,m)=>s+m.ticks,0),speed:g.speed})}
  const apply=g.applyCoopCommand.bind(g);g.applyCoopCommand=(cmd,seat)=>{const sent=window.sent.get(JSON.stringify(cmd));if(sent){window.delays.push(performance.now()-sent);window.sent.delete(JSON.stringify(cmd))}return apply(cmd,seat)}
 })
}
await Promise.all(pages.map(p=>p.evaluate(()=>{window.startMs=performance.now();window.samples=[]})))
await host.evaluate(()=>{const g=window.vg.game;g.buildTower('arrow',g.terrain.plots.find(p=>!p.occupied));g.callWave()})
for(const speed of [1,2]){
 if(speed===2)await host.evaluate(()=>window.vg.game.toggleSpeed())
 for(let n=0;n<10;n++){
  await host.waitForTimeout(650)
  await host.evaluate(({n,speed})=>{const cmd={kind:'heroMove',x:3+n*.02,z:3+speed*.01};window.sent.set(JSON.stringify(cmd),performance.now());void window.vg.game.coop.send('cmd',cmd)},{n,speed})
 }
}
await host.waitForTimeout(500)
await host.evaluate(()=>window.vg.game.togglePause())
await Promise.all(pages.map(p=>p.waitForFunction(()=>{const g=window.vg.game;return g.paused&&g.coopBudget===0&&g.coopMarkers.every(m=>m.ticks===0)})))
const results=await Promise.all(pages.map(p=>p.evaluate(()=>({samples:window.samples,delays:window.delays,hash:window.vg.game.sessionStateHash(),tick:window.vg.game.sessionTick}))))
const pct=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)]
const summaries=results.map(r=>({hash:r.hash,tick:r.tick,inputMs:{p50:pct(r.delays,.5),p95:pct(r.delays,.95)},windows:[0,3000].map(min=>{const f=r.samples.filter(s=>s.at>=min&&(min!==0||s.at<3000));return {window:min===0?'startup':'steady',frames:f.length,frameP95:pct(f.map(s=>s.dt),.95),workP95:pct(f.map(s=>s.work),.95),noSimFrames:f.filter(s=>!s.ticks).length,burstFrames:f.filter(s=>s.ticks>s.speed*2).length,maxQueue:Math.max(...f.map(s=>s.available))}})}))
writeFileSync(process.env.BLOCKHOLD_PERF_REPORT || '/tmp/blockhold-coop-performance.json',JSON.stringify({summaries,errors,results},null,2));console.warn(JSON.stringify({summaries,errors},null,2))
if(errors.length||results[0].hash!==results[1].hash)throw Error('Browser errors or divergence')
}finally{await browser.close()}
