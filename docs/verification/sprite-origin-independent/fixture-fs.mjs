export * from 'node:fs/promises';
import * as actual from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative, resolve } from 'node:path';
import { sourceFor } from './source.mjs';
const candidate = fileURLToPath(new URL('./candidate/', import.meta.url));
export async function readFile(file, options) {
 const value=file instanceof URL?fileURLToPath(file):resolve(String(file)),name=relative(candidate,value);
 if (name.startsWith('..') || name.startsWith('.cache/')) return actual.readFile(file,options);
 const data=sourceFor(name), encoding=typeof options==='string'?options:options?.encoding;
 return encoding?data.toString(encoding):data;
}
export default {...actual,readFile};
