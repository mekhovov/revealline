// Read-only source-byte inventory, not network timing or compressed bundle size.
// Run: node --experimental-vm-modules scripts/measure-journey-modules.mjs [40-char commit]
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const revision = process.argv[2];
if (process.argv.length > 3 || (revision && !/^[a-f0-9]{40}$/.test(revision)))
  throw new Error('Provide no argument (working tree), or one exact 40-character commit.');
if (typeof vm.SourceTextModule !== 'function')
  throw new Error('Run with --experimental-vm-modules; source is parsed, never evaluated.');
const files = new Map();
async function metadata(name) {
  if (!files.has(name)) {
    const source = revision
      ? execFileSync('git', ['show', `${revision}:${name}`], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 8 * 1024 ** 2,
        })
      : await readFile(path.join(root, name), 'utf8');
    const parsed = new vm.SourceTextModule(source, { identifier: name });
    files.set(name, { bytes: Buffer.byteLength(source), imports: parsed.dependencySpecifiers });
  }
  return files.get(name);
}
const profiles = {
  eager: [],
  opening: ['horizon-candidates.mjs'],
  authored: ['horizon-candidates.mjs', 'border-candidates.mjs'],
  originals: ['whole-journey-candidates.mjs'],
  spatial: ['whole-spatial-candidates.mjs'],
};
const results = [];
for (const entry of ['game/app.mjs', 'game/couch/couch.mjs']) {
  for (const [profile, selected] of Object.entries(profiles)) {
    const seen = new Map();
    async function visit(name) {
      if (seen.has(name)) return;
      const module = await metadata(name);
      seen.set(name, module.bytes);
      for (const dependency of module.imports) {
        if (!dependency.startsWith('.'))
          throw new Error(`Unexpected nonlocal import: ${name} → ${dependency}`);
        await visit(path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency)));
      }
    }
    await visit(entry);
    for (const name of selected) await visit(`game/content-design/${name}`);
    results.push({
      entry,
      profile,
      modules: seen.size,
      sourceBytes: [...seen.values()].reduce((a, b) => a + b, 0),
    });
  }
}
console.log(JSON.stringify({ revision: revision ?? 'working-tree', results }, null, 2));
