import {mkdirSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFor} from './patch-source.mjs';
const target=new URL('./candidate/authoring/video-poster/generate-fixture.mjs',import.meta.url);
if(existsSync(target))throw Error('Temporary fixture target already exists; use a fresh packet copy.');
mkdirSync(new URL('./candidate/authoring/video-poster/',import.meta.url),{recursive:true});
writeFileSync(target,sourceFor('authoring/video-poster/generate-fixture.mjs'),{flag:'wx'});
try {
 const result=spawnSync(process.execPath,['--experimental-loader',fileURLToPath(new URL('./loader.mjs',import.meta.url)),'--test',fileURLToPath(new URL('./protocols.test.mjs',import.meta.url))],{stdio:'inherit'});
 process.exitCode=result.status??1;
} finally {unlinkSync(target);}
