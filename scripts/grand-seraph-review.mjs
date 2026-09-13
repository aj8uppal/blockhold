/** Render the three grand stone suites and their shared fusion with the game renderer. */
import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import {mkdirSync,writeFileSync} from 'node:fs'
const root=process.cwd(),out=`${root}/reviews/seraph-grand-studies/renders`
mkdirSync(out,{recursive:true})
const server=await createServer({root,server:{port:0,host:'127.0.0.1'},logLevel:'error'});await server.listen()
const browser=await chromium.launch({headless:true}),errors=[],metrics=[]
try{
  const page=await browser.newPage({viewport:{width:640,height:640}})
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(server.resolvedUrls.local[0]+'reviews/seraph-grand-studies/viewer.html');await page.waitForFunction(()=>window.previewReady)
  for(const direction of ['crowned','throne','cathedral']){
    for(let form=0;form<10;form++){
      const info=await page.evaluate(({direction,form})=>{const a=window.artStudy;a.autoAttack(false);a.show(direction,form);a.setView('studio');a.freeze();a.capture();return a.info()},{direction,form})
      await page.screenshot({path:`${out}/${direction}-${form}.png`});metrics.push(info)
    }
    await page.setViewportSize({width:1100,height:680})
    await page.evaluate(d=>{window.artStudy.pair(d);window.artStudy.freeze()},direction)
    await page.screenshot({path:`${out}/${direction}-pair.png`})
    await page.evaluate(d=>{window.artStudy.show(d,5);window.artStudy.setView('context');window.artStudy.freeze()},direction)
    await page.screenshot({path:`${out}/${direction}-context.png`})
    for(const form of [5,8]){
      await page.setViewportSize({width:800,height:680})
      await page.evaluate(({direction,form})=>{window.artStudy.show(direction,form);window.artStudy.setView('studio');window.artStudy.capture();window.artStudy.autoAttack()},{direction,form})
      await record(page,`${out}/${direction}-${form}.webm`)
    }
    await page.setViewportSize({width:640,height:640})
  }
  await page.setViewportSize({width:1000,height:720})
  await page.evaluate(()=>{window.artStudy.show('crowned',9);window.artStudy.setView('context');window.artStudy.autoAttack();window.artStudy.capture()})
  await record(page,`${out}/crimson.webm`)
  await page.evaluate(()=>{window.artStudy.autoAttack(false);window.artStudy.freeze()})
  await page.screenshot({path:`${out}/crimson-context.png`})
  await page.setViewportSize({width:640,height:640})
  for(const [name,age,yaw] of [['front',1,0],['quarter',1,.65],['back',1,3.14],['release',.12,.36],['open',.24,.36],['settle',.42,.36]]){
    await page.evaluate(({age,yaw})=>{window.artStudy.show('crowned',9);window.artStudy.setView('studio');window.artStudy.pose(age,yaw)}, {age,yaw})
    await page.screenshot({path:`${out}/crimson-${name}.png`})
  }
  if(errors.length)throw Error(errors.join('\n'))
  writeFileSync(`${out}/metrics.json`,JSON.stringify(metrics,null,2))
  console.log('Rendered 30 forms, seven firing loops and all battlefield references without browser errors.')
}finally{await browser.close();await server.close()}
async function record(page,path){
  const video=await page.evaluate(async()=>{
    const stream=document.querySelector('canvas').captureStream(30),chunks=[]
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:1800000})
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
    const stop=new Promise(resolve=>recorder.onstop=resolve);recorder.start()
    await new Promise(resolve=>setTimeout(resolve,4500));recorder.stop();await stop;stream.getTracks().forEach(t=>t.stop())
    const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192))
    return btoa(result)
  })
  writeFileSync(path,Buffer.from(video,'base64'))
}
