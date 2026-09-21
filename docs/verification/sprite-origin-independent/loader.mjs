import { fileURLToPath, pathToFileURL } from 'node:url';
import { relative } from 'node:path';
import { sourceFor } from './source.mjs';
const candidate = fileURLToPath(new URL('./candidate/', import.meta.url)), prefix = pathToFileURL(candidate).href;
export async function resolve(specifier, context, nextResolve) {
  if (['node:fs/promises','node:fs'].includes(specifier) && context.parentURL?.startsWith(prefix)) return {url:new URL(specifier.endsWith('/promises')?'./fixture-fs.mjs':'./fixture-fs-sync.mjs',import.meta.url).href,shortCircuit:true};
  if (specifier.startsWith(prefix)) return {url:specifier,shortCircuit:true};
  if (specifier.startsWith('.') && context.parentURL && new URL(specifier,context.parentURL).href.startsWith(prefix)) return {url:new URL(specifier,context.parentURL).href,shortCircuit:true};
  return nextResolve(specifier,context);
}
export async function load(url, context, nextLoad) {
  if (!url.startsWith(prefix)) return nextLoad(url,context);
  const name=relative(candidate,fileURLToPath(url));return {format:name.endsWith('.json')?'json':'module',source:sourceFor(name).toString(),shortCircuit:true};
}
