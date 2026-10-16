import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=process.cwd(), evidence=path.join(root,'docs/verification/demo-qualification-2026-09-29/packaging/final');
const locations=JSON.parse(await fs.readFile(path.join(evidence,'native-locations.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJSON=async name=>JSON.parse(await fs.readFile(name));
const web=await readJSON(path.join(locations.webSite,'manifest.json'));
const desktop=await readJSON(path.join(locations.desktopStage,'manifest.json'));
const ios=await readJSON(path.join(locations.iosStage,'manifest.json'));
const rawWeb=await fs.readFile(path.join(locations.webSite,'manifest.json'));
assert.deepEqual(await fs.readFile(path.join(locations.desktopStage,'manifest.json')),rawWeb);
const webFiles=new Map(web.files.map(f=>[f.path,f])), iosFiles=new Map(ios.files.map(f=>[f.path,f]));
const {iosHTMLPolicy}=await import(pathToFileURL(path.join(root,'scripts/native-cli.mjs')));
const html=[];
for(const row of web.files){
 const next=iosFiles.get(row.path);assert.ok(next,row.path);
 if(/\.html?$/i.test(row.path)){
  const source=await fs.readFile(path.join(locations.webSite,row.path));
  const output=await fs.readFile(path.join(locations.iosStage,row.path));
  assert.deepEqual(output,iosHTMLPolicy(source,row.path));
  html.push({path:row.path,bytes:output.length,sha256:sha(output)});
 }else assert.deepEqual(next,row);
}
const added=ios.files.filter(f=>!webFiles.has(f.path));
assert.deepEqual(added.map(f=>f.path).sort(),['diagnostics/index.html','diagnostics/page.js','diagnostics/probe.mjs','diagnostics/style.css','native/bridge.mjs']);
const snapshot=await readJSON(path.join(evidence,'source-after.json'));
const source=new Map(snapshot.files.map(f=>[f.path,f]));
const edition=await readJSON(path.join(evidence,'edition-audit.json'));
const required=edition.editions.find(e=>e.id==='droneaid-nl-community').requiredExactChecks.map(f=>f.path);
const offline=await readJSON(path.join(locations.webSite,'offline-cache.json'));
const offlineFiles=new Map(offline.files.map(f=>[f.path,f]));
const exact=[];
for(const name of required){
 const w=webFiles.get(name),d=desktop.files.find(f=>f.path===name),i=iosFiles.get(name),o=offlineFiles.get(name);
 assert.ok(w&&d&&i,name);assert.deepEqual(w,d);assert.deepEqual(w,i);
 assert.equal(w.bytes,source.get(name).bytes);assert.equal(w.sha256,source.get(name).sha256);
 // Attribution-only variant provenance is packaged but not requested by playback.
 if(name.endsWith('/variant-provenance.json')) { if(o) assert.deepEqual(o,w); }
 else {assert.ok(o,'Offline source '+name);assert.deepEqual(o,w);}
 exact.push({...w,offline:!!o});
}
const {loadNativeSite}=await import(pathToFileURL(path.join(root,'platforms/desktop/resources.mjs')));
const loaded=await loadNativeSite(locations.desktopStage);
const requests=[];
for(const name of required){
 const response=await loaded.handle(new Request('revealline://app/'+name));
 assert.equal(response.status,200,name);const raw=Buffer.from(await response.arrayBuffer());
 assert.equal(sha(raw),webFiles.get(name).sha256);assert.equal(raw.length,webFiles.get(name).bytes);
 requests.push({path:name,status:response.status,mime:response.headers.get('content-type'),sha256:sha(raw)});
}
assert.equal(loaded.isNavigationAllowed('https://example.com/'),false);
assert.equal((await loaded.handle(new Request('revealline://app/not-in-inventory.mjs'))).status,404);
for(const name of ['manifest.json','offline-cache.json'])assert.equal(sha(await fs.readFile(path.join(locations.webSite,name))),sha(await fs.readFile(path.join(evidence,'web-'+name))));
for(const [kind,folder] of [['desktop',locations.desktopStage],['ios',locations.iosStage]])for(const name of ['manifest.json','.revealline-native.json'])await fs.copyFile(path.join(folder,name),path.join(evidence,kind+'-'+name.replace(/^\./,'')));
const report={scope:'qualification-before-confirm-integration',kind:'Exact web and native static payload validation; no executable/device test',version:web.version,sourceRevision:web.sourceRevision??null,sourceManifestSha256:sha(rawWeb),web:{files:web.files.length,bytes:web.totalBytes},desktop:{files:desktop.files.length,bytes:desktop.totalBytes,manifestIdentical:true,protocolInventoryAccepted:loaded.fileCount,origin:loaded.entryURL,requests},ios:{files:ios.files.length,bytes:ios.totalBytes,htmlPoliciesVerified:html,addedFiles:added,nonHtmlWebBytesUnchanged:true},requiredWebDesktopIOSSourceChecks:exact,sourceSnapshotSha256:sha(await fs.readFile(path.join(evidence,'source-after.json'))),limits:{executablesBuilt:false,applicationsLaunched:false,physicalDevicesTested:false,signingPerformed:false,published:false,newerConfirmIntegrationQualified:false}};
await fs.writeFile(path.join(evidence,'web-native-static-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scope:report.scope,web:report.web,desktopFiles:desktop.files.length,desktopBytes:desktop.totalBytes,desktopProtocolRequests:requests.length,iosFiles:ios.files.length,iosBytes:ios.totalBytes,iosHTMLPolicies:html.length,exactPaths:exact.length,sourceManifestSha256:report.sourceManifestSha256}));
