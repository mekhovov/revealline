import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, release, loadavg } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aircraftQualificationSources } from './qualify-fpv-aircraft.mjs';
import { captureContactTape } from '../game/test/helpers/fpv-contact-tape-capture.mjs';
import { replayContactTape } from '../game/test/helpers/fpv-contact-tape.mjs';

const [playwrightModule, output, tapeOutput] = process.argv.slice(2);
if (!playwrightModule || !output || !tapeOutput || process.argv.length !== 5)
  throw new Error(
    'Usage: node scripts/profile-fpv-contact-tape.mjs <installed-playwright> <new-report.json> <new-tape.json.gz>',
  );
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  root = fileURLToPath(new URL('../', import.meta.url)),
  helper = 'game/test/helpers/fpv-contact-tape.mjs',
  vendor = 'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
  files = await aircraftQualificationSources();
for (const name of [
  helper,
  'game/test/helpers/fpv-aircraft-profile.mjs',
  'game/test/helpers/fpv-contact-tape-capture.mjs',
  'scripts/profile-fpv-contact-tape.mjs',
  'optional-practice/civilian-fpv/vendor/rapier/provenance.json',
])
  files.set(name, await readFile(path.join(root, name)));
const pin = JSON.parse(files.get('optional-practice/civilian-fpv/vendor/rapier/provenance.json'));
if (hash(files.get(vendor)) !== pin.files[0].sha256) throw new Error('Pinned Rapier bytes changed');
const report = {
  format: 'RapierContactTapeDiagnostic.v1',
  startedAt: new Date().toISOString(),
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  sources: [...files].map(([name, bytes]) => ({
    path: name,
    bytes: bytes.length,
    sha256: hash(bytes),
  })),
  machine: {
    architecture: arch(),
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
  },
  results: [],
  limitations: [
    'One static Cetus floor contact interval, substeps 501–1500. This frozen force tape is not a controller or flight simulation.',
    'Only World.step wall-clock intervals are timed. Input application, per-step snapshots/digests and contact inspection are outside those intervals but may affect scheduling/cache behavior.',
    'Per-step SHA-256 world digests and unrounded body observations are compared with the original source fixture. Snapshot bytes are discarded immediately after hashing.',
    'The only retained full snapshot is the initial checkpoint; its byte count is recorded. Original fixture and controller are used for capture only, never served to browser replay.',
    'Two ordered fresh-world repetitions per installed engine are not proof of JIT tier, exclusive CPU use, hardware fidelity or full-flight performance.',
    'No browser protections, solver settings, dependencies, production source, package limits or qualification gates changed.',
  ],
};
for (const destination of [output, tapeOutput])
  await mkdir(path.dirname(path.resolve(destination)), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const save = () => writeFile(output, JSON.stringify(report, null, 2) + '\n');
const Worker = globalThis.Worker;
globalThis.Worker = class {
  constructor() {
    throw new Error('Contact capture must not create a worker');
  }
};
let captured;
try {
  captured = await captureContactTape({ sha256: hash });
} finally {
  if (Worker === undefined) delete globalThis.Worker;
  else globalThis.Worker = Worker;
}
const tapeBytes = Buffer.from(JSON.stringify(captured.tape) + '\n'),
  compressed = gzipSync(tapeBytes, { level: 9 });
await writeFile(tapeOutput, compressed, { flag: 'wx' });
report.capture = {
  finalSimulatorHash: captured.finalSimulatorHash,
  initialContact: captured.tape.initialContact,
  integration: captured.tape.integration,
  steps: captured.tape.steps.length,
  snapshotBytes: Buffer.from(captured.tape.snapshot, 'base64').length,
  tapePath: tapeOutput,
  tapeBytes: tapeBytes.length,
  tapeSha256: hash(tapeBytes),
  compressedBytes: compressed.length,
  compressedSha256: hash(compressed),
};
const node = await replayContactTape(captured.tape, { sha256: hash });
report.results.push({ runtime: 'node', version: process.version, cases: [node] });
await save();
if (!node.matched) throw new Error('Node contact-tape equivalence failed; browser run prohibited');
const page =
  Buffer.from(`<!doctype html><title>Autonomous local contact-tape diagnostic</title><script type="module">
import {replayContactTape} from '/${helper}';
try {
 const tape=await (await fetch('/contact-tape.json')).json();
 for(let repeat=0;repeat<2;repeat++) {
  await fetch('/begin',{method:'POST'});
  const result=await replayContactTape(tape);
  await fetch('/result',{method:'POST',body:JSON.stringify({...result,repeat})});
  if(!result.matched)throw new Error('Contact tape diverged');
 }
 await fetch('/complete',{method:'POST'});
} catch(error) {await fetch('/error',{method:'POST',body:String(error.stack??error)});}
</script>`);
const served = new Map([
  [helper, files.get(helper)],
  [vendor, files.get(vendor)],
  ['contact-tape.json', tapeBytes],
  ['contact.html', page],
]);
report.browserInputs = [...served].map(([name, bytes]) => ({
  path: name,
  bytes: bytes.length,
  sha256: hash(bytes),
}));
let current, resolveDone, rejectDone, cpuBefore, loadBefore;
const busy = (before, after) => {
  let idle = 0,
    total = 0;
  for (let i = 0; i < before.length; i++)
    for (const key of Object.keys(before[i].times)) {
      const delta = after[i].times[key] - before[i].times[key];
      total += delta;
      if (key === 'idle') idle += delta;
    }
  return total ? 100 * (1 - idle / total) : null;
};
const server = createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://localhost').pathname.slice(1);
    if (req.method === 'POST') {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 256000) throw new Error('Oversized diagnostic response');
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();
      if (name === 'begin') {
        cpuBefore = cpus();
        loadBefore = loadavg();
      }
      if (name === 'result') {
        current.cases.push({
          ...JSON.parse(body),
          loadBefore,
          loadAfter: loadavg(),
          meanHostBusyPercent: busy(cpuBefore, cpus()),
        });
        await save();
      }
      res.writeHead(200);
      res.end('ok');
      if (name === 'complete') resolveDone();
      if (name === 'error') rejectDone(new Error(body));
    } else if (served.has(name)) {
      res.writeHead(200, {
        'Content-Type': name.endsWith('.html')
          ? 'text/html'
          : name.endsWith('.json')
            ? 'application/json'
            : 'text/javascript',
        'Cache-Control': 'no-store',
      });
      res.end(served.get(name));
    } else {
      res.writeHead(404);
      res.end();
    }
  } catch (error) {
    res.writeHead(500);
    res.end('Diagnostic failure');
    rejectDone?.(error);
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const playwright = await import(pathToFileURL(playwrightModule));
  for (const [runtime, engine, options] of [
    ['chrome', playwright.chromium, { channel: 'chrome' }],
    ['firefox', playwright.firefox, {}],
  ]) {
    current = { runtime, cases: [] };
    report.results.push(current);
    const done = new Promise((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    // Attach a rejection handler before launch; the same promise is awaited below.
    done.catch(() => {});
    const timer = setTimeout(
      () => rejectDone(new Error('Contact diagnostic exceeded 45 seconds')),
      45000,
    );
    let browser;
    try {
      browser = await engine.launch({ headless: true, ...options });
      current.version = browser.version();
      const context = await browser.newContext();
      const tab = await context.newPage();
      await tab.goto(`http://127.0.0.1:${server.address().port}/contact.html`);
      await done;
    } catch (error) {
      current.error = String(error.stack ?? error);
    } finally {
      clearTimeout(timer);
      await browser?.close();
    }
    await save();
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
report.finishedAt = new Date().toISOString();
report.sourcesUnchanged = (
  await Promise.all(
    [...files].map(
      async ([name, bytes]) => hash(await readFile(path.join(root, name))) === hash(bytes),
    ),
  )
).every(Boolean);
report.allStepsMatch =
  report.results.length === 3 &&
  report.results.every(
    (result) =>
      !result.error &&
      result.cases.length === (result.runtime === 'node' ? 1 : 2) &&
      result.cases.every((row) => row.matched && row.completedSteps === 1000),
  );
await save();
console.log(
  JSON.stringify({
    allStepsMatch: report.allStepsMatch,
    sourcesUnchanged: report.sourcesUnchanged,
    results: report.results.map((result) => ({
      runtime: result.runtime,
      cases: result.cases.map((row) => ({ worldStepMs: row.worldStepMs, matched: row.matched })),
      error: result.error,
    })),
  }),
);
process.exitCode = report.allStepsMatch && report.sourcesUnchanged ? 0 : 1;
