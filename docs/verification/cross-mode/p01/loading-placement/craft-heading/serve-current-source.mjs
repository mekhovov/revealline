/** Existing source server only; refuses until every applied rail body matches r3. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startServer } from '../../../../../scripts/game-cli.mjs';
const prepared=path.dirname(new URL(import.meta.url).pathname);
const config=JSON.parse(await fs.readFile(path.join(prepared,'config.json'),'utf8'));
if(!process.argv.includes('--go'))throw new Error('Prepared only. Root GO is required before --go.');
for(const file of config.files){const bytes=await fs.readFile(path.join(config.sourceRoot,file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.candidateSha256)throw new Error('Applied source does not match reviewed r3: '+file.path);}
const run=path.join(prepared,'run');await fs.mkdir(run);
const {server,url,root}=await startServer({root:config.sourceRoot,port:0,host:'127.0.0.1'});
const receipt={pid:process.pid,url:url.replace(/\/$/,''),port:server.address().port,source:root,candidate:config.candidateRoot,files:config.files,scope:'Actual applied candidate source through existing game-cli startServer; not an ordinary/frozen/public build.'};
await fs.writeFile(path.join(run,'server.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(receipt));
