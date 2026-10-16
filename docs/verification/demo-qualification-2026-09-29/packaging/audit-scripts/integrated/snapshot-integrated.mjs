import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=process.cwd();
const {collectEditionEngineFiles,collectEditionSelectedFiles}=await import(pathToFileURL(path.join(root,'scripts/compile-edition.mjs')));
const catalog=JSON.parse(await fs.readFile(path.join(root,'game/editions/catalog.json')));
const engine=await collectEditionEngineFiles({root});
const selected=await collectEditionSelectedFiles({catalog,editionIds:catalog.editions.filter(e=>e.publication==='public').map(e=>e.id),read:name=>fs.readFile(path.join(root,name))});
const paths=new Set([...engine.keys(),...selected.keys(),'package.json','game/build-config.json','game/editions/catalog.json','scripts/prepare-menu-scenes.py','authoring/library/droneaid-brand-kit-2026-09-29/background-original.png','game/ui/art/menu-scenes/droneaid-main-background.png']);
for(const directory of ['scripts','publishing'])for(const name of await fs.readdir(path.join(root,directory)))if(name.endsWith('.mjs')||name.endsWith('.json'))paths.add(directory+'/'+name);
const {collectBuildFiles}=await import(pathToFileURL(path.join(root,'scripts/game-cli.mjs')));
for(const name of await collectBuildFiles(root))paths.add(name);
for(const name of ['package-lock.json','platforms/desktop/package.json','platforms/desktop/package-lock.json','platforms/ios/package.json','platforms/ios/package-lock.json','platforms/ios/bridge/bridge-entry.mjs','platforms/ios/scripts/build-bridge.mjs','platforms/ios/diagnostics/index.html','platforms/ios/diagnostics/page.js','platforms/ios/diagnostics/probe.mjs','platforms/ios/diagnostics/style.css'])paths.add(name);
const files=[];
for(const name of [...paths].sort()){const bytes=await fs.readFile(path.join(root,name));files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await fs.writeFile(process.argv[2],JSON.stringify({capturedAt:new Date().toISOString(),version:JSON.parse(await fs.readFile('package.json')).version,files},null,2)+'\n');
console.log(JSON.stringify({files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0)}));
