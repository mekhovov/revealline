import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),evidence=path.join(root,'docs/verification/demo-qualification-2026-09-29/packaging/integrated-c5e3419ee');
const json=async name=>JSON.parse(await fs.readFile(name));
const locations=await json(path.join(evidence,'native-locations.json'));
const old=await json(path.join(evidence,'../final/edition-audit.json'));
const names=old.editions.find(e=>e.id==='droneaid-nl-community').requiredExactChecks.map(r=>r.path);
const {loadNativeSite}=await import(pathToFileURL(path.join(root,'platforms/desktop/resources.mjs')));
const loaded=await loadNativeSite(locations.desktopStage);
const raw=await fs.readFile(path.join(locations.desktopStage,'manifest.json'));
assert.deepEqual(raw,await fs.readFile(path.join(locations.webSite,'manifest.json')));
const manifest=JSON.parse(raw),files=new Map(manifest.files.map(r=>[r.path,r]));
const requests=[];
for(const name of names){
 const response=await loaded.handle(new Request('revealline://app/'+name));
 assert.equal(response.status,200,name);const body=Buffer.from(await response.arrayBuffer());
 const hash=createHash('sha256').update(body).digest('hex');assert.equal(hash,files.get(name).sha256);assert.equal(body.length,files.get(name).bytes);
 requests.push({path:name,status:response.status,mime:response.headers.get('content-type'),bytes:body.length,sha256:hash});
}
assert.equal(loaded.isNavigationAllowed('https://example.com/'),false);
assert.equal((await loaded.handle(new Request('revealline://app/not-in-inventory.mjs'))).status,404);
for(const name of ['manifest.json','.revealline-native.json'])await fs.copyFile(path.join(locations.desktopStage,name),path.join(evidence,'desktop-'+name.replace(/^\./,'')));
const report={scope:'integrated-c5e3419ee',fileCount:loaded.fileCount,entryURL:loaded.entryURL,manifestSha256:loaded.manifestSha256,externalNavigationDenied:true,outsideInventoryDenied:true,requests};
await fs.writeFile(path.join(evidence,'desktop-protocol-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:loaded.fileCount,requests:requests.length,manifestSha256:loaded.manifestSha256}));
