#!/usr/bin/env node
// Manual authoring fixture only; never imported by a player.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [playerArg, outArg, scenario] = process.argv.slice(2);
if (!playerArg || !outArg || (scenario && scenario !== '--readiness'))
  throw Error('Use ADMITTED_PLAYER NEW_OUTPUT_DIRECTORY [--readiness]');
const root = fileURLToPath(new URL('..', import.meta.url));
const player = await fs.realpath(playerArg),
  out = path.resolve(outArg);
const hash = (v) => createHash('sha256').update(v).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const source = git('rev-parse', 'HEAD').toString().trim();
const inventory = JSON.parse(
  await fs.readFile(
    path.join(root, 'authoring/fpv-worlds/mode-editor/evidence/combined-source-inventory.json'),
  ),
);
const descriptor = await fs.readFile(path.join(player, 'optional-package.json'));
const manifest = JSON.parse(descriptor);
if (
  manifest.engineCommit !== inventory.sourceRevision ||
  manifest.revision !== inventory.packageRevision
)
  throw Error('Player must match retained d41 admission inventory');
const allowed = new Set(['optional-practice/civilian-fpv/world-app.mjs']);
const overlays = new Map(),
  inputs = [];
for (const row of inventory.inputs) {
  const bytes = git('show', `${source}:${row.path}`),
    sha256 = hash(bytes);
  const changed = sha256 !== row.sha256 || bytes.length !== row.bytes;
  if (changed && !allowed.has(row.path))
    throw Error('Unexpected changed baseline input: ' + row.path);
  if (changed) overlays.set(row.path, bytes);
  inputs.push({ path: row.path, bytes: bytes.length, sha256, baselineSha256: row.sha256, changed });
}
const records = [
  ...manifest.files,
  { path: 'optional-package.json', bytes: descriptor.length, sha256: hash(descriptor) },
];
for (const row of records) {
  const file = await fs.realpath(path.join(player, row.path));
  if (!file.startsWith(player + path.sep)) throw Error('Member escaped player: ' + row.path);
  const bytes = await fs.readFile(file);
  if (bytes.length !== row.bytes || hash(bytes) !== row.sha256)
    throw Error('Admitted member changed: ' + row.path);
}
await fs.mkdir(out);
let newBytes = 0;
const files = [];
for (const row of records) {
  const dest = path.join(out, 'player', row.path);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const overlay = overlays.get(row.path);
  if (overlay) {
    await fs.writeFile(dest, overlay, { flag: 'wx' });
    newBytes += overlay.length;
  } else await fs.link(path.join(player, row.path), dest);
  files.push({
    ...row,
    ...(overlay ? { bytes: overlay.length, sha256: hash(overlay), overlay: true } : {}),
    baselineSha256: row.sha256,
  });
}
const html = await fs.readFile(path.join(player, manifest.entry), 'utf8');
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error('Unknown player entry');
const host = html
  .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
  .replace('<head>', '<head><base href="./player/optional-practice/fpv-worlds/">')
  .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../probe-host.mjs"');
const index = `<!doctype html><meta charset="utf-8"><title>Current FPV player ${scenario ? 'readiness checks' : 'transition profile'}</title>
<style>body{margin:0;background:#101b20;color:#eee;font:14px system-ui}header{padding:8px;display:flex;gap:12px;align-items:center}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:calc(100vh - 66px)}textarea{width:98%;height:220px}body[data-running=true] textarea{display:none}</style>
<header><button id="run" disabled>${scenario ? 'Run readiness checks' : 'Run short player profile'}</button><button id="continue" hidden>Continue readiness checks</button><span id="status">Loading frozen host…</span></header>
<iframe id="sim" title="Actual current-main FPV host" src="host.html${scenario ? '?initial-loss=1' : ''}"></iframe>
<label>Complete receipt, populated after measurement<textarea id="receipt" readonly></textarea></label>
<script type="module" src="profile.mjs"></script>`;
const probe = await fs.readFile(new URL('./fpv-current-performance-host.mjs', import.meta.url));
const fault = `// Functional fixture only: a genuine native context loss during the first renderer creation.
if (new URL(location.href).searchParams.has('initial-loss')) {
  const canvas = document.getElementById('world-canvas'), original = canvas.getContext;
  const fault = window.fpvInitialGraphicsFault = { requested: false, lost: false, restored: false };
  canvas.addEventListener('webglcontextlost', () => { fault.lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { fault.restored = true; });
  canvas.getContext = function (...args) {
    const gl = original.apply(this, args);
    if (args[0] === 'webgl2' && gl && !fault.requested) {
      fault.requested = true;
      const extension = gl.getExtension('WEBGL_lose_context');
      fault.supported = Boolean(extension);
      fault.restore = () => extension.restoreContext();
      queueMicrotask(() => extension?.loseContext());
    }
    return gl;
  };
}
`;
for (const [name, bytes] of [
  ['host.html', host],
  ['index.html', index],
  ['probe-host.mjs', scenario ? Buffer.concat([Buffer.from(fault), probe]) : probe],
  [
    'profile.mjs',
    await fs.readFile(
      new URL(
        scenario ? './fpv-current-readiness-browser.mjs' : './fpv-current-performance-browser.mjs',
        import.meta.url,
      ),
    ),
  ],
]) {
  await fs.writeFile(path.join(out, name), bytes, { flag: 'wx' });
  files.push({ path: name, fixture: true, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) });
}
const receipt = {
  format: 'FPVCurrentPlayerProfileFixture.v1',
  sourceRevision: source,
  scenario: scenario ? 'native-first-scene-context-loss-and-readiness' : 'short-transition-profile',
  sourceTree: git('rev-parse', 'HEAD^{tree}').toString().trim(),
  qualificationKind: overlays.size
    ? 'committed-source overlay on complete admitted player'
    : 'byte-identical admitted player inputs',
  baselineSource: manifest.engineCommit,
  baselinePackageRevision: manifest.revision,
  sourceInputCount: inputs.length,
  inputs,
  files,
  newPlayerBytes: newBytes,
  immutablePlayerMembers: records.length - overlays.size,
  limits: [
    'No fresh package admission is claimed.',
    'Native clock, pause guards and all runtime files retained; explicit source overlays are listed.',
    'Separate host HTML disables only automatic mount so the unchanged mountWorldApp can receive a transparent renderer observer.',
    'Native per-origin storage; no imported records, hidden gameplay state or artificial animation timestamps.',
    'First renderer/document load is not a flushed OS/GPU/network cold benchmark. Byte rehashing happens after measurement.',
  ],
};
await fs.writeFile(path.join(out, 'fixture.json'), JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
process.stdout.write(
  JSON.stringify({ out, source, overlays: [...overlays.keys()], newBytes, files: records.length }) +
    '\n',
);
