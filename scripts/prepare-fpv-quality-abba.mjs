#!/usr/bin/env node
// Reuse two immutable, completely pinned player fixtures; write no runtime bytes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [baselineArg, candidateArg, outputArg] = process.argv.slice(2);
if (!outputArg) throw Error('Use BASELINE_FIXTURE CANDIDATE_FIXTURE NEW_OUTPUT');
const hash = (b) => createHash('sha256').update(b).digest('hex'),
  output = path.resolve(outputArg);
const variants = {};
for (const [name, directory] of [
  ['A', baselineArg],
  ['B', candidateArg],
]) {
  const root = await fs.realpath(directory),
    bytes = await fs.readFile(path.join(root, 'fixture.json'));
  const fixture = JSON.parse(bytes);
  for (const row of fixture.files) {
    const file = await fs.realpath(path.join(root, row.fixture ? '' : 'player', row.path));
    if (!file.startsWith(root + path.sep)) throw Error('Member escaped frozen fixture');
    const data = await fs.readFile(file);
    if (data.length !== row.bytes || hash(data) !== row.sha256)
      throw Error('Changed frozen member: ' + row.path);
  }
  if (fixture.files.filter((r) => !r.fixture).length !== 102)
    throw Error('Complete102-member player required');
  variants[name] = {
    root,
    fixtureSHA256: hash(bytes),
    sourceRevision: fixture.sourceRevision,
    baselineSource: fixture.baselineSource,
    qualificationKind: fixture.qualificationKind,
    files: fixture.files.filter(
      (r) => !r.fixture || ['host.html', 'probe-host.mjs'].includes(r.path),
    ),
  };
}
for (const row of variants.A.files) {
  const other = variants.B.files.find((r) => r.path === row.path);
  if (
    !other ||
    (row.sha256 !== other.sha256 && row.path !== 'optional-practice/civilian-fpv/world-app.mjs')
  )
    throw Error('Comparison differs beyond the owned host: ' + row.path);
}
await fs.mkdir(output);
for (const [name, variant] of Object.entries(variants))
  for (const row of variant.files) {
    const relative = path.join(row.fixture ? '' : 'player', row.path),
      to = path.join(output, name, relative);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.link(path.join(variant.root, relative), to);
  }
const index = `<!doctype html><meta charset="utf-8"><title>FPV warm quality ABBA</title>
<style>body{margin:0;background:#101b20;color:white;font:14px system-ui}header{display:flex;gap:12px;padding:8px;align-items:center}button{padding:8px}iframe{width:100%;height:calc(100vh - 66px);border:0;display:block}textarea{width:98%;height:240px}body[data-running=true] textarea{display:none}</style>
<header><button id="run">Run warm quality ABBA</button><span id="status">One visible host at a time; four native-clock blocks.</span></header><iframe id="sim" title="Visible current player"></iframe><textarea id="receipt" readonly aria-label="Complete ABBA receipt"></textarea><script type="module" src="run.mjs"></script>`;
const harness = [];
for (const [name, bytes] of [
  ['index.html', Buffer.from(index)],
  ['run.mjs', await fs.readFile(new URL('./fpv-quality-abba-browser.mjs', import.meta.url))],
]) {
  await fs.writeFile(path.join(output, name), bytes, { flag: 'wx' });
  harness.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
}
const manifest = {
  format: 'FPVWarmQualityABBAFixture.v1',
  variants,
  harness,
  order: ['A', 'B', 'B', 'A'],
  targets: ['container-yard-08', 'woodland-08'],
  cycles: 4,
  qualities: ['low', 'balanced', 'high'],
  scope:
    'Both variants are source overlays on the identical102-file admitted closure. No fresh admission or sustained performance acceptance. Each block starts one fresh visible host; each course warms all qualities before12measured changes. Native RAF/clock and production lifecycle guards are retained.',
};
await fs.writeFile(path.join(output, 'fixture.json'), JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
});
process.stdout.write(
  JSON.stringify({
    output,
    variants: Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, v.sourceRevision])),
    expectedSamples: 96,
  }) + '\n',
);
