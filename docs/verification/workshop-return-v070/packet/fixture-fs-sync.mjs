export * from 'node:fs';
import {readFileSync as actualReadFile} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative,resolve} from 'node:path';
import {sourceFor} from './patch-source.mjs';
const candidate=fileURLToPath(new URL('./candidate/',import.meta.url));
export function readFileSync(file,options){
 const path=file instanceof URL?fileURLToPath(file):resolve(String(file)),name=relative(candidate,path);
 if(name.startsWith('..'))return actualReadFile(file,options);
 const bytes=sourceFor(name),encoding=typeof options==='string'?options:options?.encoding;
 return encoding?bytes.toString(encoding):bytes;
}
