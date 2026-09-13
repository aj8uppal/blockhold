/** Reproduce the review-only art captures without opening or changing a game save. */
import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import {mkdirSync,writeFileSync} from 'node:fs'
const root=process.cwd(),out=`${root}/reviews/seraph-block-studies/renders`
mkdirSync(out,{recursive:true})
const server=await createServer({root,server:{port:0,host:'127.0.0.1'},logLevel:'error'});await server.listen()
const browser=await chromium.launch({headless:true}),metrics=[],errors=[]
try{
  const page=await browser.newPage({viewport:{width:640,height:640},deviceScaleFactor:1})
  page.on('pageerror',e=>errors.push(e.message))
  const base=server.resolvedUrls.local[0]+'reviews/seraph-block-studies/viewer.html'
  await page.goto(base);await page.waitForFunction(()=>window.previewReady)
  for(const direction of ['guardian','sanctum','relic','current']){
    for(let form=0;form<9;form++){
      const info=await page.evaluate(({direction,form})=>{const a=window.artStudy;a.show(direction,form);a.setView('studio');a.freeze();a.capture();return a.info()},{direction,form})
      await page.screenshot({path:`${out}/${direction}-${form}.png`,type:'png'})
      metrics.push(info)
    }
    await page.setViewportSize({width:1000,height:650})
    await page.evaluate(d=>{window.artStudy.pair(d);window.artStudy.freeze()},direction)
    await page.screenshot({path:`${out}/${direction}-pair.png`})
    await page.evaluate(d=>{window.artStudy.show(d,5);window.artStudy.setView('context');window.artStudy.freeze()},direction)
    await page.screenshot({path:`${out}/${direction}-context.png`})
    await page.setViewportSize({width:640,height:640})
  }
  for(const direction of ['hearth','torch','cinder','current']){
    await page.setViewportSize({width:800,height:650})
    await page.goto(`${base}?mode=fire&direction=${direction}`);await page.waitForFunction(()=>window.previewReady)
    await page.evaluate(()=>{window.artStudy.freeze(2.7);window.artStudy.capture()})
    await page.screenshot({path:`${out}/fire-${direction}.png`})
    const motion=await page.evaluate(async()=>{
      window.artStudy.play()
      const canvas=document.querySelector('canvas'),stream=canvas.captureStream(30)
      const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'
      const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000}),chunks=[]
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
      const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start()
      await new Promise(resolve=>setTimeout(resolve,5500));recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop())
      const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192))
      window.artStudy.freeze();return btoa(value)
    })
    writeFileSync(`${out}/fire-${direction}.webm`,Buffer.from(motion,'base64'))
    metrics.push(await page.evaluate(()=>window.artStudy.info()))
    await page.setViewportSize({width:1000,height:650});await page.evaluate(()=>{window.artStudy.setView('context');window.artStudy.freeze(2.7)})
    await page.screenshot({path:`${out}/fire-${direction}-context.png`})
  }
  // Actual touch viewport: controls remain reachable; review state is independent of account saves.
  await page.setViewportSize({width:390,height:844})
  await page.goto(`${base}?direction=guardian&form=8`);await page.waitForFunction(()=>window.previewReady)
  await page.getByRole('button',{name:'Battlefield',exact:true}).click();await page.getByRole('button',{name:'Close-up',exact:true}).click()
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Viewer overflows phone viewport')
  await page.screenshot({path:`${out}/mobile-viewer.png`})
  if(errors.length)throw Error(errors.join('\n'))
  writeFileSync(`${out}/metrics.json`,JSON.stringify(metrics,null,2))
  console.log('Rendered all 27 candidate Seraph models, 9 current references, 4 fire loops and context views; mobile viewer passed with no browser errors.')
}finally{await browser.close();await server.close()}
