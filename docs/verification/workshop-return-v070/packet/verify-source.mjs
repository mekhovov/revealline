import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {sourceFor} from './patch-source.mjs';
const manifest=JSON.parse(readFileSync(new URL('./source-manifest.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(gunzipSync(readFileSync(new URL('./source.patch.gz',import.meta.url))))!==manifest.patchSHA256)throw Error('Patch identity mismatch');
for(const name of Object.keys(manifest.files)){
 const bytes=sourceFor(name);
 if(name.endsWith('.mjs')){const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:bytes,encoding:'utf8'});if(r.status)throw Error(r.stderr);}
 console.log(name+' exact postimage and applicable syntax PASS');
}
const generator='authoring/video-poster/generate-fixture.mjs';
if(existsSync(new URL('./candidate/'+generator,import.meta.url)) && !readFileSync(new URL('./candidate/'+generator,import.meta.url)).equals(sourceFor(generator)))throw Error('Subprocess fixture differs from base');
const config=JSON.parse(sourceFor('game/build-config.json'));
for(const name of Object.keys(manifest.files).filter(n=>n.startsWith('game/ui/') && !n.includes('/test/')))
 if(!config.include.some(p=>name===p||name.startsWith(p+'/')))throw Error('Build excludes '+name);
console.log('Runtime modules included by exact-base build configuration.');
