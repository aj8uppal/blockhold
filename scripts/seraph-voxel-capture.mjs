/** Capture review-only voxel variants with the real game scene and renderer. */
import {chromium} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
const base=process.env.BLOCKHOLD_VOXEL_PREVIEW_URL??'http://127.0.0.1:5184/reviews/seraph-suites/voxel-preview.html'
const out='reviews/seraph-suites/voxel-renders'
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const captures=[]
try{
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(base);await page.waitForFunction(()=>window.previewReady,{}, {timeout:60000})
  for(const suite of ['stone','machine','crystal','current']){
    for(let index=0;index<9;index++){
      const info=await page.evaluate(async({suite,index})=>{
        const api=document.querySelector('iframe').contentWindow.seraphPreview
        api.freeze();await api.show(suite,index);api.frame('close');api.freeze()
        return api.info()
      },{suite,index})
      await page.waitForTimeout(90)
      const bounds=await page.locator('iframe').boundingBox()
      const side=Math.min(680,bounds.height),x=bounds.x+(bounds.width-side)/2,y=bounds.y+(bounds.height-side)/2
      await page.screenshot({path:`${out}/${suite}-${index}.jpg`,type:'jpeg',quality:90,clip:{x,y,width:side,height:side}})
      captures.push(info)
    }
    // The same final form at real gameplay zoom; existing towers give scale.
    await page.evaluate(()=>document.querySelector('iframe').contentWindow.seraphPreview.frame('context'))
    await page.locator('iframe').screenshot({path:`${out}/${suite}-context.jpg`,type:'jpeg',quality:90})
    await page.setViewportSize({width:844,height:520})
    await page.evaluate(()=>document.querySelector('iframe').contentWindow.seraphPreview.frame('context'))
    await page.locator('iframe').screenshot({path:`${out}/${suite}-mobile.jpg`,type:'jpeg',quality:90})
    await page.setViewportSize({width:1200,height:900})
  }
  if(errors.length)throw Error(errors.join('\n'))
  writeFileSync(`${out}/render-metrics.json`,JSON.stringify(captures,null,2))
  console.log(`Captured ${captures.length} real voxel models plus desktop/mobile context views; no browser errors.`)
}finally{await browser.close()}
