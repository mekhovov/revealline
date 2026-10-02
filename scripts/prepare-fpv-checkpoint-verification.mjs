#!/usr/bin/env node
/** Generate an ignored production-host frame; no browser or hardware qualification. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const suffix = process.argv[2] ?? '';
if (suffix && !/^[a-z0-9-]{1,40}$/.test(suffix))
  throw Error('Use an optional lowercase fixture suffix.');
const destination = path.join(
  root,
  'dist/fpv-checkpoint-verification' + (suffix ? '-' + suffix : ''),
);
await mkdir(destination, { recursive: false });
const html = await readFile(path.join(root, 'optional-practice/fpv-worlds/index.html'), 'utf8');
const hash = createHash('sha256').update(html).digest('hex');
const script = `<base href="/optional-practice/fpv-worlds/"><script>
const fixtureMemory=new Map([['revealline.fpv.world-settings.v1',JSON.stringify({'world-language':'en','flight-source':'keyboard','flight-mode':'self-level','flight-camera':'chase','sim-motion':'reduced','flight-quality':'low'})]]);
Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureMemory.get(k)??null,setItem:(k,v)=>fixtureMemory.set(k,String(v)),removeItem:k=>fixtureMemory.delete(k)}});
const fixtureNativeIndexedDB=window.indexedDB;
Object.defineProperty(window,'indexedDB',{value:{open(name,version){const full=parent.__checkpointFixture.prefix+name;parent.__checkpointFixture.names.add(full);return fixtureNativeIndexedDB.open(full,version);}}});
window.fixturePads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.fixturePads});
addEventListener('error',e=>parent.__checkpointFixture.errors.push(e.message));addEventListener('unhandledrejection',e=>parent.__checkpointFixture.errors.push(String(e.reason)));
</script><meta name="fixture-source-sha256" content="${hash}">`;
await writeFile(
  path.join(destination, 'simulator.html'),
  html.replace('<head>', '<head>' + script),
);
await writeFile(
  path.join(destination, 'index.html'),
  await readFile(path.join(root, 'docs/evidence/fpv-checkpoint-browser-harness.html')),
);
console.log(JSON.stringify({ destination, productionHtmlSha256: hash }));
