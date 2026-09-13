import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const [name, viewport, mobile] of [['desktop', {width:1200,height:800}, false], ['mobile', {width:740,height:390}, true], ['portrait', {width:390,height:844}, true]]) {
    const page = await browser.newPage({ viewport, hasTouch: mobile, isMobile: mobile })
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp:30000,taughtBasics:true,sfxMuted:true,musicMuted:true })))
    await page.goto(process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5195/')
    await page.waitForFunction(() => window.vg?.game)
    await page.evaluate(() => {
      const g=window.vg.game
      window.vg.screens.onPlayLevel('greenhollow','normal','aldric','sandbox')
      g.buildTower('arrow',g.terrain.plots.find(p=>!p.occupied)); g.paused=true
      g.towers[0].update(2,g);g.selectTower(g.towers[0])
    })
    await page.locator('.u-model').evaluate(img=>img.decode())
    await page.locator('.has-preview').scrollIntoViewIfNeeded()
    await page.screenshot({path:`/tmp/blockhold-upgrade-${name}.png`})
    if (name === 'portrait') {
      if (!(await page.locator('#rotate-overlay').isVisible())) throw new Error('Missing portrait rotation guidance')
      await page.setViewportSize({width:844,height:390})
    }
    await page.evaluate(()=>{window.vg.game.paused=false})
    const initial=await page.evaluate(()=>window.vg.game.towers[0].level)
    const btn=page.locator('.has-preview').first()
    if (mobile) {await btn.tap(); if(await btn.evaluate(el=>el.classList.contains('armed'))) await btn.tap()}
    else await btn.click()
    await page.waitForFunction(level=>window.vg.game.towers[0].level===level+1, initial)
    if (await page.evaluate(()=>window.vg.game.towers[0].level)!==initial+1) throw new Error(`${name}: preview blocked purchase`)
    if(errors.length)throw new Error(errors.join('\n'))
    await page.close()
  }
} finally {await browser.close()}
