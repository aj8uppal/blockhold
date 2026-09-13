// Four actual browser clients: shared Hold, readiness reset, reload and battle start.
// Run against matching frontend/service builds with BLOCKHOLD_CHECK_URL.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({headless:true});const clients=[];const errors=[]
try{
 for(let i=0;i<4;i++){
  const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage();clients.push({context,page})
  page.on('pageerror',e=>errors.push(`${i}: ${e.message}`))
  await page.goto((process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5196/'));await page.waitForFunction(()=>window.vg)
  await page.evaluate(i=>{window.vg.game.save.hold={version:1,name:i?'Guest Hold':'Cedar Watch',theme:'forest',color:'jade',keep:'stone',placements:[],stored:[],seen:[],updatedAt:Date.now(),dailyWon:false};window.vg.screens.show('coop')},i)
 }
 const host=clients[0].page
 await host.getByRole('button',{name:'Open a room'}).click();await host.waitForSelector('.coop-code')
 const code=await host.locator('.coop-code').textContent();console.log('ROOM',code)
 for(let i=1;i<4;i++){const p=clients[i].page;await p.getByLabel('Room code').fill(code);await p.getByRole('button',{name:'Join',exact:true}).click();await p.waitForSelector('.coop-code')}
 for(const {page:p}of clients){await p.waitForFunction(()=>window.vg.game.engine.scene.getObjectByName('your-hold')?.userData.holdName==='Cedar Watch');await p.getByRole('button',{name:'Ready',exact:true}).click()}
 await host.getByRole('button',{name:'Start the battle'}).waitFor({state:'visible'})
 await host.locator('summary',{hasText:'Battle settings'}).click();await host.getByLabel('Co-op difficulty').selectOption('casual')
 await host.getByRole('button',{name:'Ready',exact:true}).waitFor()
 assert.equal(await host.getByRole('button',{name:'Start the battle'}).isDisabled(),true)
 for(const {page:p}of clients) await p.getByRole('button',{name:'Ready',exact:true}).click()
 // A transient outage disables local actions but preserves the authenticated ready state.
 await clients[2].context.setOffline(true)
 await clients[2].page.getByText('Reconnecting to the room…',{exact:true}).waitFor()
 assert.equal(await clients[2].page.getByRole('button',{name:/Ready ✓/}).isDisabled(),true)
 await clients[2].context.setOffline(false)
 await clients[2].page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.startsWith('Ready ✓')&&!b.disabled))
 // Reload a guest into its authenticated seat and retain the party/ready state.
 const guest=clients[1].page;await guest.reload();await guest.waitForFunction(()=>window.vg);await guest.evaluate(()=>window.vg.screens.show('coop'));await guest.getByRole('button',{name:'Rejoin your room'}).click();await guest.getByRole('button',{name:/Ready ✓/}).waitFor()
 await host.locator('summary',{hasText:'Battle settings'}).click()
 await host.locator('.gathering-screen').evaluate(e=>{e.scrollTop=0})
 await host.screenshot({path:(process.env.BLOCKHOLD_SCREENSHOT ?? '/tmp/blockhold-hold-gathering.png')})
 await host.getByRole('button',{name:'Start the battle'}).click()
 for(const{page:p}of clients) await p.waitForFunction(()=>window.vg.game.phase==='playing'&&!window.vg.game.paused,{},{timeout:30000})
 const hashes=[]
 for(const{page:p}of clients)hashes.push(await p.evaluate(()=>({code:window.vg.game.coop?.code,phase:window.vg.game.phase,holdScene:!!window.vg.game.engine.scene.getObjectByName('your-hold')})))
 assert(hashes.every(s=>s.code===code&&s.phase==='playing'&&!s.holdScene));console.log('4 CLIENTS STARTED',hashes)
 await host.evaluate(()=>window.vg.game.coop.send('end'));assert.deepEqual(errors,[])
}finally{await browser.close()}
