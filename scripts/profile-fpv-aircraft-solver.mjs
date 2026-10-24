import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, loadavg, arch, platform, release } from 'node:os';
import { pathToFileURL } from 'node:url';
import { aircraftQualificationSources } from './qualify-fpv-aircraft.mjs';

const [playwrightModule, output] = process.argv.slice(2);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = await aircraftQualificationSources();
for (const name of [
  'game/test/helpers/fpv-aircraft-profile.mjs',
  'game/test/helpers/fpv-aircraft-solver-profile.mjs',
  'scripts/profile-fpv-aircraft-solver.mjs',
])
  files.set(name, await readFile(new URL('../' + name, import.meta.url)));
for (const native of [false, true])
  files.set(
    `solver-${native}-worker.mjs`,
    Buffer.from(
      `import { installAircraftSolverProfile } from '/game/test/helpers/fpv-aircraft-solver-profile.mjs';\nimport { installAdvancedWorker } from '/optional-practice/civilian-fpv/advanced-worker.mjs';\nconst pending=[]; const buffer=event=>{event.stopImmediatePropagation();pending.push(event.data);};self.addEventListener('message',buffer);\nconst p=await installAircraftSolverProfile({native:${native}});\nself.removeEventListener('message',buffer);self.addEventListener('message',event=>{if(event.data?.type==='qualification-profile'){event.stopImmediatePropagation();if(event.data.reset)p.reset();self.postMessage({type:'qualification-profile',token:event.data.token,profile:p.read()});}});\ninstallAdvancedWorker(self);for(const data of pending)self.dispatchEvent(new MessageEvent('message',{data}));`,
    ),
  );
const report = {
  format: 'AircraftSolverDiagnostic.v1',
  startedAt: new Date().toISOString(),
  host: {
    architecture: arch(),
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
  },
  sources: [...files].map(([path, bytes]) => ({ path, sha256: hash(bytes), bytes: bytes.length })),
  results: [],
  limitations: [
    'Diagnostic test wrappers only; the pinned runtime and all physics settings remain unchanged.',
    'Native profiler enabled only in labeled diagnostic cases. Hash/telemetry equality required; no qualification claims.',
    'Inclusive wall-clock timing includes scheduling and instrumentation. Subphases overlap; do not sum them as exclusive CPU.',
    'Each engine uses one fresh isolated page; repeat 0/1 are ordered fresh-world repetitions, not a JIT cold/warm guarantee.',
    'No browser protections changed, no downloads, public tabs or persisted user state.',
  ],
};
function busy(before, after) {
  let idle = 0,
    total = 0;
  for (let i = 0; i < before.length; i++)
    for (const key of Object.keys(before[i].times)) {
      const value = after[i].times[key] - before[i].times[key];
      total += value;
      if (key === 'idle') idle += value;
    }
  return 100 * (1 - idle / total);
}
const server = createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (name === 'solver.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Isolated solver diagnostics</title>');
  } else if (files.has(name)) {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    res.end(files.get(name));
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const playwright = await import(pathToFileURL(playwrightModule));
try {
  for (const [runtime, engine, options] of [
    ['firefox', playwright.firefox, {}],
    ['chrome', playwright.chromium, { channel: 'chrome' }],
  ]) {
    const browser = await engine.launch({ headless: true, ...options });
    const result = { runtime, version: browser.version(), cases: [] };
    report.results.push(result);
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/solver.html`);
      for (const scenario of ['cetus-floor', 'meteor-worker'])
        for (const native of [false, true])
          for (let repeat = 0; repeat < 2; repeat++) {
            const before = cpus(),
              loadBefore = loadavg();
            const measured = await page.evaluate(
              async ({ scenario, native }) => {
                const { runAircraftSolverProfile } = await import(
                  '/game/test/helpers/fpv-aircraft-solver-profile.mjs'
                );
                return runAircraftSolverProfile({
                  scenario,
                  native,
                  workerURL: globalThis.location.origin + `/solver-${native}-worker.mjs`,
                });
              },
              { scenario, native },
            );
            const row = {
              ...measured,
              repeat,
              loadBefore,
              loadAfter: loadavg(),
              meanHostBusyPercent: busy(before, cpus()),
            };
            result.cases.push(row);
            console.log(
              JSON.stringify({
                runtime,
                scenario,
                native,
                repeat,
                capacity: row.capacity,
                finalHash: row.finalHash,
                meanHostBusyPercent: row.meanHostBusyPercent,
              }),
            );
            await writeFile(output, JSON.stringify(report, null, 2) + '\n');
          }
    } catch (error) {
      result.error = String(error.stack ?? error);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
report.finishedAt = new Date().toISOString();
report.sourcesUnchanged = true;
for (const [name, bytes] of files)
  if (
    !name.startsWith('solver-') &&
    hash(await readFile(new URL('../' + name, import.meta.url))) !== hash(bytes)
  )
    report.sourcesUnchanged = false;
report.trajectoriesUnchanged = report.results.every(
  (result) =>
    !result.error &&
    result.cases.length === 8 &&
    ['cetus-floor', 'meteor-worker'].every((scenario) => {
      const rows = result.cases.filter((row) => row.scenario === scenario);
      return rows.every(
        (row) =>
          row.finalHash === rows[0].finalHash &&
          JSON.stringify(row.finalTelemetry) === JSON.stringify(rows[0].finalTelemetry),
      );
    }),
);
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    sourcesUnchanged: report.sourcesUnchanged,
    trajectoriesUnchanged: report.trajectoriesUnchanged,
  }),
);
process.exitCode = report.sourcesUnchanged && report.trajectoriesUnchanged ? 0 : 1;
