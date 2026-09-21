export * from 'node:fs';
import * as actual from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative, resolve } from 'node:path';
import { sourceFor } from './source.mjs';
const candidate = fileURLToPath(new URL('./candidate/', import.meta.url));
export function readFileSync(file, options) {
 const value=file instanceof URL?fileURLToPath(file):resolve(String(file)),name=relative(candidate,value);
 if (name.startsWith('..')) return actual.readFileSync(file,options);
 const data=sourceFor(name), encoding=typeof options==='string'?options:options?.encoding;
 return encoding?data.toString(encoding):data;
}
export default {...actual,readFileSync};
