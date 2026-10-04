import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [root, player, inventoryPath, revision, out] = process.argv.slice(2);
if (![root, player, inventoryPath, out].every((p) => p && path.isAbsolute(p)) || !/^[a-f0-9]{40}$/.test(revision ?? '')) throw Error('ABS_ROOT ABS_PLAYER ABS_INVENTORY REVISION ABS_NEW_OUTPUT');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const stageBytes = await fs.readFile(player + '.json');
const inventoryBytes = await fs.readFile(inventoryPath);
const stage = JSON.parse(stageBytes), inventory = JSON.parse(inventoryBytes);
if (stage.files.length !== 102 || inventory.inputs.length !== 95 || stage.sourceRevision !== revision || inventory.sourceRevision !== revision || stage.sourceTree !== inventory.sourceTree || !stage.checks.every((c) => c.passed)) throw Error('Exact admitted 102-member/95-input candidate required');
for (const row of inventory.inputs) {
  const bytes = execFileSync('git', ['show', revision + ':' + row.path], { cwd: root, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, maxBuffer: 20 * 1024 * 1024 });
  if (bytes.length !== row.bytes || hash(bytes) !== row.sha256) throw Error('Committed input mismatch ' + row.path);
}
await fs.mkdir(out);
const files = [];
async function write(name, bytes, provenance = 'manual fixture') {
  const dest = path.join(out, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes, { flag: 'wx' });
  files.push({ path: name, bytes: Buffer.byteLength(bytes), sha256: hash(bytes), provenance });
}
for (const row of stage.files) {
  if (!/^[\w./-]+$/.test(row.path) || row.path.split('/').includes('..')) throw Error('Unsafe member');
  const src = path.join(player, row.path), bytes = await fs.readFile(src), dest = 'candidate/player/' + row.path;
  if (bytes.length !== row.bytes || hash(bytes) !== row.sha256) throw Error('Changed admitted member ' + row.path);
  await fs.mkdir(path.dirname(path.join(out, dest)), { recursive: true });
  await fs.link(src, path.join(out, dest));
  files.push({ ...row, path: dest, provenance: 'immutable admitted member; zero overlays' });
}
const tools = path.join(root, 'authoring/fpv-worlds/language-phase/source-r2');
await write('candidate/host.mjs', await fs.readFile(path.join(tools, 'host.mjs')));
const html = await fs.readFile(path.join(player, 'optional-practice/fpv-worlds/index.html'), 'utf8');
if (!html.includes('data-fpv-worlds="true"') || !html.includes('src="../civilian-fpv/world-app.mjs"')) throw Error('Native HTML changed');
await write('candidate/player/optional-practice/fpv-worlds/phase-host.html', html.replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"').replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../host.mjs"'));
let run = await fs.readFile(path.join(tools, 'run.mjs'), 'utf8');
const start = run.indexOf('    $("status").textContent =\n      "Baseline: retain the synchronous phase/action failure";');
const end = run.indexOf('    $("status").textContent =\n      "Candidate: same-event ownership across public flight states";');
if (start < 0 || end <= start || !run.includes('FPVLanguagePhaseOwnership.v2')) throw Error('Source r2 harness boundary changed');
run = run.slice(0, start) + run.slice(end);
run = run.replace('FPVLanguagePhaseOwnership.v2', 'FPVLanguagePhaseAdmitted.v1').replace('Baseline is an exact retained admitted host. Candidate changes only the committed +105-byte host ownership guard; no new package claim.', 'Candidate is the exact complete admitted distribution at the recorded revision, 102 members and zero runtime overlays. Baseline failure and source comparison remain separate historical evidence.').replace('PASS: original failure reproduced; candidate phase, action and recovery ownership retained', 'PASS: admitted candidate phase, immediate action and recovery ownership retained');
await write('run.mjs', run, 'source-r2 candidate lifecycle unchanged; historical baseline block omitted');
await write('diagnostic.rlpack', await fs.readFile(path.join(tools, 'diagnostic.rlpack')));
await write('index.html', '<!doctype html><meta charset="utf-8"><title>Admitted language phase lifecycle</title><style>body{margin:0;background:#142029;color:white;font:14px system-ui}header{padding:10px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:760px}textarea{width:98%;height:220px}pre{white-space:pre-wrap}</style><header><button id="run">Run admitted candidate lifecycle</button> <span id="status">One native candidate, plus ordinary saved-flight recovery. No runtime overlays.</span></header><iframe id="sim" title="Admitted phase ownership player" src="about:blank"></iframe><pre id="summary"></pre><label>Full receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>');
const manifest = { format: 'FPVLanguagePhaseAdmittedFixture.v1', candidate: { sourceRevision: revision, sourceTree: stage.sourceTree, stageSHA256: hash(stageBytes), inventorySHA256: hash(inventoryBytes), zip: stage.zip, files: 102, originalInputs: 95, overlays: [] }, files, limitations: ['Complete admitted candidate; no runtime overlays.', 'Source-r2 candidate lifecycle retained; baseline reproduction intentionally not repeated.', 'Own iframe native IndexedDB, real diagnostic practice, scripted public DOM controls. No clock, flight-state, guard or proof injection.', 'No hardware-performance, new offline or public-deployment qualification.'] };
const data = JSON.stringify(manifest, null, 2) + '\n';
await fs.writeFile(path.join(out, 'fixture.json'), data, { flag: 'wx' });
console.log(JSON.stringify({ out, revision, fixtureSHA256: hash(data), files: files.length, overlays: 0 }));
