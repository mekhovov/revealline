#!/usr/bin/env node
/** Generate an ignored production-host frame; no browser or hardware qualification. */
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
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
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = digest(html);
// Every module keeps its original bytes. A per-file hash in its request URL
// prevents a previous localhost response from supplying an older module graph.
const selectedRoot = await realpath(runtimeDirectory);
const files = {
  'optional-practice/fpv-worlds/index.html': { sha256: hash, bytes: Buffer.byteLength(html) },
};
const imports = {},
  pending = ['optional-practice/civilian-fpv/world-app.mjs'];
let total = Buffer.byteLength(html);
while (pending.length) {
  const relative = pending.pop();
  if (files[relative]) continue;
  if (
    !/^(?:game|optional-practice)\/[a-zA-Z0-9_./-]+\.(?:mjs|js)$/.test(relative) ||
    relative.includes('..')
  )
    throw Error('Unsupported module path: ' + relative);
  if (Object.keys(files).length >= 192) throw Error('Fixture dependency graph exceeds its bound.');
  const target = await realpath(path.join(selectedRoot, relative));
  if (!target.startsWith(selectedRoot + path.sep))
    throw Error('Dependency leaves selected runtime: ' + relative);
  const info = await stat(target);
  if (!info.isFile() || info.size > 8 * 1024 * 1024) throw Error('Oversized module: ' + relative);
  const bytes = await readFile(target);
  if ((total += bytes.length) > 32 * 1024 * 1024)
    throw Error('Fixture closure exceeds byte bound.');
  files[relative] = { sha256: digest(bytes), bytes: bytes.length };
  const moduleURL = runtimeRoot + relative;
  const freshURL = moduleURL + '?fpv-fixture-sha256=' + files[relative].sha256;
  imports[moduleURL] = freshURL;
  // The harness's proof generators use the same bound bytes in another realm.
  imports['/' + relative] = freshURL;
  const nodes = [parse(bytes.toString('utf8'), { ecmaVersion: 'latest', sourceType: 'module' })];
  while (nodes.length) {
    const node = nodes.pop();
    if (!node || typeof node !== 'object') continue;
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(node.type) &&
      node.source?.value?.startsWith('.')
    )
      pending.push(
        path.posix.normalize(path.posix.join(path.posix.dirname(relative), node.source.value)),
      );
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) nodes.push(...value);
      else if (value && typeof value === 'object') nodes.push(value);
    }
  }
}
const binding = { format: 'FPVCheckpointFixtureSource.v1', runtimeRoot, files };
const safeJSON = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const importMap = '<script type="importmap">' + safeJSON({ imports }) + '</script>';
const bindingTag =
  '<script type="application/json" id="fixture-source-binding">' + safeJSON(binding) + '</script>';
for (const [relative, expected] of Object.entries(files))
  if (digest(await readFile(path.join(runtimeDirectory, relative))) !== expected.sha256)
    throw Error('Runtime changed during preparation: ' + relative);
await mkdir(destination, { recursive: false });
const script = `<base href="${runtimeRoot}optional-practice/fpv-worlds/">${importMap}<script>
const fixtureMemory=new Map([['revealline.fpv.world-settings.v1',JSON.stringify({'world-language':'en','flight-source':'keyboard','flight-mode':'self-level','flight-camera':'chase','sim-motion':'reduced','flight-quality':'low'})]]);
Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureMemory.get(k)??null,setItem:(k,v)=>fixtureMemory.set(k,String(v)),removeItem:k=>fixtureMemory.delete(k)}});
const fixtureNativeIndexedDB=window.indexedDB;
Object.defineProperty(window,'indexedDB',{value:{open(name,version){const full=parent.__checkpointFixture.prefix+name;parent.__checkpointFixture.names.add(full);return fixtureNativeIndexedDB.open(full,version);}}});
window.fixturePads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.fixturePads});
addEventListener('error',e=>parent.__checkpointFixture.errors.push(e.message));addEventListener('unhandledrejection',e=>parent.__checkpointFixture.errors.push(String(e.reason)));
</script><meta name="fixture-source-sha256" content="${hash}">`;
await writeFile(
  path.join(destination, 'simulator.html'),
  html
    .replace('<head>', '<head>' + script)
    .replace(
      'src="../civilian-fpv/world-app.mjs"',
      'src="' + imports[runtimeRoot + 'optional-practice/civilian-fpv/world-app.mjs'] + '"',
    ),
);
await writeFile(
  path.join(destination, 'index.html'),
  (
    await readFile(path.join(root, 'docs/evidence/fpv-checkpoint-browser-harness.html'), 'utf8')
  ).replace(
    '<meta charset="utf-8" />',
    '<meta charset="utf-8" /><meta name="fixture-runtime-root" content="' +
      runtimeRoot +
      '" />' +
      importMap +
      bindingTag,
  ),
);
await writeFile(path.join(destination, 'source.json'), JSON.stringify(binding, null, 2) + '\n');
console.log(
  JSON.stringify({
    destination,
    runtimeRoot,
    productionHtmlSha256: hash,
    boundFiles: Object.keys(files).length,
    boundBytes: total,
  }),
);
