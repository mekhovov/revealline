const {chromium}=require('/Users/oleksandr.mekhovov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),zlib=require('node:zlib'),crypto=require('node:crypto');
const out=process.cwd()+'/docs/evidence/fpv-combat',report={started:new Date().toISOString(),scope:'Actual7.18MB recovery imported through the host, automatically saved on pause with real browser localStorage quota, then page reloaded and Continue saved combat invoked without importing again. Functional test, outside performance timing.',errors:[]};
(async()=>{
 const buffer=zlib.gunzipSync(await fs.readFile(out+'/overhaul-128-recovery.json.gz'));
 const saved=JSON.parse(buffer.toString());report.importBytes=buffer.length;report.expectedTicks=saved.gameplay.encounter.state.ticks;
 report.hostSha256=crypto.createHash('sha256').update(await fs.readFile('optional-practice/civilian-fpv/world-app.mjs')).digest('hex');
 report.harnessSha256=crypto.createHash('sha256').update(await fs.readFile(__filename)).digest('hex');
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-component-update','--disable-background-networking','--disk-cache-size=1048576','--media-cache-size=1048576']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',error=>report.errors.push(error.stack));
  await page.addInitScript(()=>localStorage.setItem('revealline.access.revealline.v1','fD62nYJ5uj8yGLsEBEAn2Blq8lcesFrR_gdebUswlxg'));
  const ready=async()=>{await page.waitForFunction(()=>globalThis.fpvWorldStudio);await page.evaluate(()=>fpvWorldStudio.ready);await page.evaluate(async()=>{const{WORLD_CATALOGUE}=await import('/optional-practice/civilian-fpv/world-catalogue.mjs');await fpvWorldStudio.startFlight(WORLD_CATALOGUE.find(e=>e.id==='stadium-01'),{mode:'self-level',paused:true,encounter:{version:2,activity:'original'}});});};
  await page.goto('http://127.0.0.1:8768/optional-practice/fpv-worlds/index.html?lang=en',{waitUntil:'networkidle'});await ready();
  await page.locator('[data-encounter-controls] input[type=file]').first().setInputFiles({name:'large-combat-recovery.json',mimeType:'application/json',buffer});
  await page.waitForFunction(t=>fpvWorldStudio.snapshot().state?.encounter?.ticks===t,report.expectedTicks,{timeout:120000});
  await page.evaluate(()=>fpvWorldStudio.pause());
  await page.waitForFunction(async expected=>{const request=indexedDB.open('revealline.fpv.combat-autosave.v1',1);return await new Promise(resolve=>{request.onerror=()=>resolve(false);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('recovery')){db.close();resolve(false);return;}const tx=db.transaction('recovery','readonly'),get=tx.objectStore('recovery').get('latest');get.onsuccess=()=>resolve(get.result?.recovery?.gameplay?.encounter?.state?.ticks===expected);get.onerror=()=>resolve(false);tx.oncomplete=()=>db.close();}})},report.expectedTicks,{timeout:120000,polling:500});
  report.stored=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('revealline.fpv.combat-autosave.v1',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});const record=await new Promise((resolve,reject)=>{const tx=db.transaction('recovery','readonly'),q=tx.objectStore('recovery').get('latest');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);tx.oncomplete=()=>db.close()});const s=fpvWorldStudio.snapshot();return{format:record.format,bytes:new TextEncoder().encode(JSON.stringify(record)).byteLength,localPointer:JSON.parse(localStorage.getItem('revealline.fpv.combat-recovery.v1')),tick:record.recovery.gameplay.encounter.state.ticks,presentationRecords:record.recovery.presentation.records.length,presentationImpacts:record.recovery.presentation.impactRecords.length,counts:{kills:s.state.encounter.kills,shots:s.state.encounter.shots},status:document.getElementById('flight-status').textContent}});
  console.log('AUTOSAVE STORED',JSON.stringify(report.stored));
  await page.reload({waitUntil:'networkidle'});await ready();
  await page.evaluate(()=>{const button=[...document.querySelectorAll('[data-encounter-controls] button')].find(b=>b.textContent==='Continue saved combat');if(!button)throw Error('Continue button missing');button.click()});
  await page.waitForFunction(t=>{const s=fpvWorldStudio.snapshot();return s.state?.status==='paused'&&s.state?.encounter?.ticks===t},report.expectedTicks,{timeout:120000});
  await page.waitForFunction(()=>!document.getElementById('world-arm').disabled,null,{timeout:120000});
  await page.waitForTimeout(1000);
  report.restored=await page.evaluate(()=>{const s=fpvWorldStudio.snapshot();return{status:s.state.status,ticks:s.state.ticks,encounterTicks:s.state.encounter.ticks,kills:s.state.encounter.kills,shots:s.state.encounter.shots,recording:s.state.combatRecording,effects:s.ghost.resources.combat,statusText:document.getElementById('flight-status').textContent}});
  if(report.restored.kills!==report.stored.counts.kills||report.restored.shots!==report.stored.counts.shots)throw Error('Restored counters changed');
  report.passed=true;await page.screenshot({path:out+'/overhaul-large-autosave-restored.png'});console.log('AUTOSAVE RESTORED',JSON.stringify(report.restored));
 }catch(error){report.failure=error.stack;throw error;}finally{await browser.close();report.finished=new Date().toISOString();await fs.writeFile(out+'/overhaul-large-autosave.json',JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1});
