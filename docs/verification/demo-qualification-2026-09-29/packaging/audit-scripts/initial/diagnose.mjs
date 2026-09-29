import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
const root=process.cwd(), evidence=path.join(root,'docs/verification/demo-qualification-2026-09-29/packaging');
const target=pathToFileURL(path.join(root,'scripts/edition-offline.mjs')).href;
let replacements=0;
registerHooks({load(url,context,nextLoad){
 const result=nextLoad(url,context);
 if(url!==target) return result;
 const source=String(result.source),needle="throw new Error('Edition offline core exceeds 2000 files or 64 MiB.');";
 if(!source.includes(needle)) throw new Error('Budget diagnostic anchor changed');
 replacements++;
 return {...result,source:source.replace(needle,"throw Object.assign(new Error('Edition offline core exceeds 2000 files or 64 MiB.'), {totalBytes, inventory});")};
}});
const { collectEditionEngineFiles,collectEditionSelectedFiles,compileEdition }=await import(pathToFileURL(path.join(root,'scripts/compile-edition.mjs')));
const catalog=JSON.parse(await fs.readFile(path.join(root,'game/editions/catalog.json')));
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'))).version;
const engine=await collectEditionEngineFiles({root});
const id='droneaid-nl-community';
const files=new Map(engine);
for(const [name,bytes] of await collectEditionSelectedFiles({catalog,editionIds:[id],read:name=>fs.readFile(path.join(root,name))})) files.set(name,bytes);
try {await compileEdition({catalog,editionIds:[id],files,enginePaths:[...engine.keys()],version,sourceRevision:'development',offline:{basePath:'/'}});throw new Error('Expected current budget failure did not recur');}
catch(error){
 if(!Array.isArray(error.inventory)) throw error;
 const report={kind:'read-only budget diagnostic; production limit unchanged; only thrown Error enriched in memory',id,version,replacements,budget:67108864,totalBytes:error.totalBytes,overage:error.totalBytes-67108864,fileCount:error.inventory.length,inventory:error.inventory};
 await fs.writeFile(path.join(evidence,'dutch-budget-failure.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,inventory:report.inventory.toSorted((a,b)=>b.bytes-a.bytes).slice(0,25)},null,2));
}
