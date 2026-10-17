import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { observeFPVStartup } from '/Users/oleksandr.mekhovov/work/my_projects/go_test/scripts/smoke-fpv-public-fresh-install.mjs';
import { chromium } from '/Users/oleksandr.mekhovov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const password=process.env.FPV_LIVE_TEST_PASSWORD;delete process.env.FPV_LIVE_TEST_PASSWORD;assert(password);
const root='https://mekhovov.github.io/revealline/';const metadata=async()=>{const r=await fetch(root+'main-deployment.json?startup-observation='+Date.now(),{cache:'no-store'});assert(r.ok);return r.json();};
const report={format:'FpvPublicStartupObservation.v1',createdAt:new Date().toISOString(),scope:'Three independent fresh World password logins on the existing public baseline; startup observation only, not acceptance of the unpublished input-recovery change.',pass:false,attempts:[]};
report.deployment=await metadata();assert.equal(report.deployment.sourceRevision,'fb3caf12bd43743670f47c42dc21f7a406223379');
let context;
try{
 for(let i=0;i<3;i++){
  const profile=await mkdtemp('/tmp/fpv-public-startup-observation-');const attempt={number:i+1,profile,errors:[],pass:false};report.attempts.push(attempt);
  context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1440,height:1000},env:{...process.env}});report.browser=context.browser().version();const page=context.pages()[0];page.on('pageerror',e=>attempt.errors.push(String(e.message).split(password).join('[redacted]')));
  try{
   await observeFPVStartup(page,attempt,'fresh-world-password',async()=>{
    await page.goto(root+'optional-practice/fpv-worlds/index.html?lang=en');await page.locator('#access-gate').waitFor();assert.equal(await page.locator('html').getAttribute('data-access-state'),'locked');
    await page.locator('#access-gate input[type="password"]').fill(password);await page.locator('#access-gate').getByRole('button',{name:'Unlock',exact:true}).click();
    await page.waitForFunction(()=>document.documentElement.dataset.accessState==='unlocked'&&!document.documentElement.dataset.modeShellPending&&document.querySelector('[data-mode-action="settings"]'),null,{timeout:60000});
   },{redact:v=>String(v).split(password).join('[redacted]')});assert.deepEqual(attempt.errors,[]);attempt.pass=true;
  }catch(e){attempt.failure=String(e.stack??e).split(password).join('[redacted]');}
  await context.close();context=null;
 }
 report.finalDeployment=await metadata();assert.equal(report.finalDeployment.sourceRevision,report.deployment.sourceRevision);report.deploymentStable=true;report.pass=report.attempts.every(x=>x.pass);
}finally{await context?.close();report.completedAt=new Date().toISOString();report.runnerSha256=createHash('sha256').update(await readFile('/private/tmp/fpv-startup-public-observation.mjs')).digest('hex');report.observerSha256=createHash('sha256').update(await readFile('scripts/smoke-fpv-public-fresh-install.mjs')).digest('hex');await writeFile('docs/fpv-input-recovery-startup-public-baseline.json',JSON.stringify(report,null,2).split(password).join('[redacted]')+'\n',{mode:0o600});}
console.log(JSON.stringify({pass:report.pass,attempts:report.attempts.map(x=>({number:x.number,pass:x.pass,elapsedMs:x.startups[0].elapsedMs,pending:x.startups[0].pendingRequests}))}));
