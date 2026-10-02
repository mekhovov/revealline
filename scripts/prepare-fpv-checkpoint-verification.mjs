#!/usr/bin/env node
/** Generate an ignored production-host frame; no browser or hardware qualification. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const suffix = args[0] ?? '';
const packageDirectory = args[1] === '--package' ? args[2] : null;
if (args.length > 1 && (args.length !== 3 || !packageDirectory))
  throw Error(
    'Usage: node scripts/prepare-fpv-checkpoint-verification.mjs [suffix] [--package dist/fpv-NAME]',
  );
if (packageDirectory && !/^dist\/fpv-[a-z0-9-]{1,80}$/.test(packageDirectory))
  throw Error('Choose an existing explicit FPV package directory beneath dist.');
const runtimeRoot = packageDirectory ? '/' + packageDirectory + '/' : '/';
const runtimeDirectory = packageDirectory ? path.join(root, packageDirectory) : root;
if (suffix && !/^[a-z0-9-]{1,40}$/.test(suffix))
  throw Error('Use an optional lowercase fixture suffix.');
const destination = path.join(
  root,
  'dist/fpv-checkpoint-verification' + (suffix ? '-' + suffix : ''),
);
const html = await readFile(
  path.join(runtimeDirectory, 'optional-practice/fpv-worlds/index.html'),
  'utf8',
);
await mkdir(destination, { recursive: false });
const hash = createHash('sha256').update(html).digest('hex');
const script = `<base href="${runtimeRoot}optional-practice/fpv-worlds/"><script>
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
  (
    await readFile(path.join(root, 'docs/evidence/fpv-checkpoint-browser-harness.html'), 'utf8')
  ).replace(
    '<meta charset="utf-8" />',
    '<meta charset="utf-8" /><meta name="fixture-runtime-root" content="' + runtimeRoot + '" />',
  ),
);
console.log(JSON.stringify({ destination, runtimeRoot, productionHtmlSha256: hash }));
