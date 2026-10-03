// Manual functional qualification: isolated localhost origin; no release or player storage.
// Close the fixture tab after staging to permit normal activation; reopen its URL to verify.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const template = await readFile(root + '/game/offline/service-worker.template.js', 'utf8');
const bytes = 72 * 1024 * 1024,
  chunk = Buffer.alloc(64 * 1024, 17),
  hash = createHash('sha256');
for (let i = 0; i < bytes / chunk.length; i++) hash.update(chunk);
const config = {
  format: 'revealline-offline.v1',
  version: 'boundary',
  buildId: 'b'.repeat(64),
  files: [{ path: 'payload.bin', bytes, sha256: hash.digest('hex') }],
  downloadFiles: [],
};
const page = `<!doctype html><meta charset="utf-8"><title>72 MiB offline boundary</title><h1>72 MiB offline boundary</h1><button id="install">Install and verify</button><button id="update">Stage update</button><button id="broken">Reject broken update</button><button id="stageold">Stage original version</button><button id="active">Verify active</button><button id="rollback">Keep original version</button><button id="cleanup">Remove verification cache</button><pre id="result">Ready</pre><script>
const result=document.querySelector('#result');
document.querySelector('#install').onclick=async()=>{try{result.textContent='Installing 72 MiB…';const r=await navigator.serviceWorker.register('./worker.js');const w=r.installing||r.waiting||r.active;if(w.state!=='activated')await new Promise((resolve,reject)=>{w.addEventListener('statechange',()=>{if(w.state==='activated')resolve();if(w.state==='redundant')reject(Error('Install rejected'));});});const c=new MessageChannel();const report=await new Promise(resolve=>{c.port1.onmessage=e=>{if(e.data.status)resolve(e.data)};w.postMessage({type:'revealline.offline-check'},[c.port2]);});result.textContent=(report.status==='ready'&&report.bytes===75497472?'PASS':'FAIL')+' '+JSON.stringify(report);}catch(e){result.textContent='FAIL '+e.message;}};
document.querySelector('#cleanup').onclick=async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const key of await caches.keys())if(key.startsWith('revealline-offline:'))await caches.delete(key);result.textContent='Verification cache removed';};async function stage(version, broken=false){const r=await navigator.serviceWorker.register('./worker.js?v='+version);const w=r.installing||r.waiting; if(!w)throw Error('No staged worker');if(!['installed','redundant'].includes(w.state))await new Promise(resolve=>w.addEventListener('statechange',()=>{if(['installed','redundant'].includes(w.state))resolve();}));if(broken){if(w.state!=='redundant')throw Error('Corrupt version accepted');result.textContent='PASS corrupt update rejected; original active '+r.active.scriptURL;return;}const c=new MessageChannel();const report=await new Promise(resolve=>{c.port1.onmessage=e=>{if(e.data.status)resolve(e.data)};w.postMessage({type:'revealline.offline-check'},[c.port2]);});result.textContent=(report.status==='ready'?'PASS':'FAIL')+' update staged '+JSON.stringify(report)+'; original remains active '+r.active.scriptURL;}
document.querySelector('#update').onclick=()=>{result.textContent='Staging update…';stage('2').catch(e=>result.textContent='FAIL '+e.message);};document.querySelector('#broken').onclick=()=>{result.textContent='Trying corrupt update…';stage('broken',true).catch(e=>result.textContent='FAIL '+e.message);};document.querySelector('#rollback').onclick=async()=>{const r=await navigator.serviceWorker.getRegistration();const c=new MessageChannel();const report=await new Promise(resolve=>{c.port1.onmessage=e=>{if(e.data.status)resolve(e.data)};r.active.postMessage({type:'revealline.offline-check'},[c.port2]);});result.textContent=(report.status==='ready'&&report.buildId==='b'.repeat(64)?'PASS':'FAIL')+' original version retained '+JSON.stringify(report);};document.querySelector('#stageold').onclick=()=>{result.textContent='Staging original…';stage('1').catch(e=>result.textContent='FAIL '+e.message);};document.querySelector('#active').onclick=async()=>{const r=await navigator.serviceWorker.ready;const c=new MessageChannel();const report=await new Promise(resolve=>{c.port1.onmessage=e=>{if(e.data.status)resolve(e.data)};r.active.postMessage({type:'revealline.offline-check'},[c.port2]);});result.textContent=(report.status==='ready'?'PASS':'FAIL')+' active version '+JSON.stringify(report);};</script>`;
createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url.startsWith('/worker.js')) {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(
      template.replace(
        '__XONIX_OFFLINE_CONFIG__',
        JSON.stringify(
          req.url.includes('broken')
            ? {
                ...config,
                buildId: 'd'.repeat(64),
                files: [{ ...config.files[0], sha256: '0'.repeat(64) }],
              }
            : req.url.includes('v=2')
              ? { ...config, buildId: 'c'.repeat(64) }
              : config,
        ),
      ),
    );
  } else if (req.url === '/payload.bin') {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', bytes);
    let sent = 0;
    const pump = () => {
      while (sent < bytes) {
        sent += chunk.length;
        if (!res.write(chunk)) {
          res.once('drain', pump);
          return;
        }
      }
      res.end();
    };
    pump();
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(page);
  }
}).listen(0, '127.0.0.1', function () {
  console.log('Boundary verification: http://127.0.0.1:' + this.address().port + '/');
});
