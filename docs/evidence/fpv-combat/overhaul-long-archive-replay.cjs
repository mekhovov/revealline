const { chromium } = require('/Users/oleksandr.mekhovov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), zlib = require('node:zlib'), crypto = require('node:crypto');
const out = process.cwd() + '/docs/evidence/fpv-combat', report = { started: new Date().toISOString(), scope: 'Outside performance timing. Import the complete 42,134-tick archive through Watch combat file, choose the visible supported 4x speed control, and verify the entire accepted chain.', errors: [], progress: [] };
(async () => {
  const archive = zlib.gunzipSync(await fs.readFile(out + '/overhaul-app-stress-final-128-complete-archive.json.gz'));
  report.archiveSha256 = crypto.createHash('sha256').update(archive).digest('hex');
  report.sources = {};
  for (const file of ['world-app.mjs','style.css','world-reaction-runtime.mjs']) report.sources[file] = crypto.createHash('sha256').update(await fs.readFile('optional-practice/civilian-fpv/' + file)).digest('hex');
  report.harnessSha256 = crypto.createHash('sha256').update(await fs.readFile(__filename)).digest('hex');
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-component-update','--disable-background-networking','--disk-cache-size=1048576','--media-cache-size=1048576']});
  try {
    const page = await browser.newPage({viewport:{width:1920,height:1080}});
    page.on('pageerror',error=>report.errors.push(error.stack));
    await page.addInitScript(()=>localStorage.setItem('revealline.access.revealline.v1','fD62nYJ5uj8yGLsEBEAn2Blq8lcesFrR_gdebUswlxg'));
    await page.goto('http://127.0.0.1:8768/optional-practice/fpv-worlds/index.html?lang=en',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>globalThis.fpvWorldStudio);
    await page.evaluate(()=>fpvWorldStudio.ready);
    await page.evaluate(async()=>{const {WORLD_CATALOGUE}=await import('/optional-practice/civilian-fpv/world-catalogue.mjs');await fpvWorldStudio.startFlight(WORLD_CATALOGUE.find(e=>e.id==='stadium-01'),{mode:'self-level',paused:true});});
    await page.locator('[data-encounter-controls] input[type=file]').nth(1).setInputFiles({name:'complete-combat-archive.json',mimeType:'application/json',buffer:archive});
    await page.waitForFunction(()=>Boolean(fpvWorldStudio.snapshot().combatPlayback),null,{timeout:120000});
    const rate = page.locator('#world-replay-rate');
    report.controls = await rate.evaluate(node=>({resultPanelHidden:document.getElementById('result-panel').hidden,styleSheets:[...document.styleSheets].map(s=>({href:s.href,count:(()=>{try{return s.cssRules.length}catch{return null}})()})),ancestors:(()=>{const result=[];for(let p=node;p;p=p.parentElement)result.push({tag:p.tagName,id:p.id,class:p.className,hidden:p.hidden,display:getComputedStyle(p).display,visibility:getComputedStyle(p).visibility});return result})(),rules:(()=>{const result=[];const bar=node.closest('#world-replay-controls');const walk=rules=>{for(const rule of rules){try{if(rule.selectorText&&bar.matches(rule.selectorText))result.push(rule.cssText)}catch{};if(rule.cssRules)walk(rule.cssRules)}};for(const sheet of document.styleSheets)try{walk(sheet.cssRules)}catch{}return result})(),visible:node.checkVisibility(),display:getComputedStyle(node).display,rect:node.getBoundingClientRect().toJSON(),options:[...node.options].map(option=>({value:option.value,disabled:option.disabled,hidden:option.hidden})),combatClass:document.getElementById('flight-dialog').classList.contains('combat-playback')}));
    console.log('CONTROL DIAGNOSTIC',JSON.stringify(report.controls));
    if(!report.controls.visible)throw Error('Playback speed control is hidden');
    await rate.selectOption('4');
    await page.waitForFunction(()=>fpvWorldStudio.snapshot().combatPlayback?.rate===4);
    if(!await page.evaluate(()=>fpvWorldStudio.snapshot().combatPlayback.playing))await page.getByRole('button',{name:'Resume playback',exact:true}).click();
    await page.waitForFunction(()=>fpvWorldStudio.snapshot().combatPlayback?.playing===true); 
    await page.screenshot({path:out+'/overhaul-long-archive-controls.png'});
    console.log('ARCHIVE REPLAY START',JSON.stringify(report.controls));
    const start=Date.now();
    for(;;){
      await page.waitForTimeout(30000);
      const state=await page.evaluate(()=>{const s=fpvWorldStudio.snapshot();return{playback:s.combatPlayback,status:s.state?.status,ticks:s.state?.ticks,encounterTicks:s.state?.encounter?.ticks,message:document.getElementById('flight-status')?.textContent}});
      report.progress.push({wallSeconds:(Date.now()-start)/1000,...state});
      console.log('ARCHIVE REPLAY',JSON.stringify(report.progress.at(-1)));
      await fs.writeFile(out+'/overhaul-long-archive-replay.json',JSON.stringify(report,null,2));
      if(state.playback?.error)throw Error(state.playback.error);
      if(state.playback?.verified){report.verified=true;report.verification=state.playback.verification;report.playbackWallSeconds=(Date.now()-start)/1000;break;}
      if(!state.playback)throw Error('Playback disappeared');
      if(Date.now()-start>1200000)throw Error('Playback exceeded20minute wall timeout');
    }
    await page.screenshot({path:out+'/overhaul-long-archive-verified.png'});
    console.log('ARCHIVE VERIFIED',JSON.stringify(report.verification));
  }catch(error){report.failure=error.stack;throw error;}finally{await browser.close();report.finished=new Date().toISOString();await fs.writeFile(out+'/overhaul-long-archive-replay.json',JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1});
