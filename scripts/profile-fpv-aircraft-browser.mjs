import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, loadavg } from 'node:os';
import { pathToFileURL } from 'node:url';
import { aircraftQualificationSources } from './qualify-fpv-aircraft.mjs';
const [playwrightModule, output] = process.argv.slice(2);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = await aircraftQualificationSources();
for (const name of [
  'game/test/helpers/fpv-aircraft-profile.mjs',
  'scripts/profile-fpv-aircraft-browser.mjs',
])
  files.set(name, await readFile(new URL('../' + name, import.meta.url)));
const entry = (instrumented) =>
  `import { installAircraftProfile } from '/game/test/helpers/fpv-aircraft-profile.mjs';\nimport { installAdvancedWorker } from '/optional-practice/civilian-fpv/advanced-worker.mjs';\nconst p = ${instrumented ? 'installAircraftProfile()' : 'null'};\nself.addEventListener('message', event => { if (event.data?.type === 'qualification-profile') { event.stopImmediatePropagation(); if (event.data.reset) p?.reset(); self.postMessage({type:'qualification-profile', token:event.data.token, profile:p?.read()??{}}); }});\ninstallAdvancedWorker(self);`;
files.set('qualification-baseline-worker.mjs', Buffer.from(entry(false)));
files.set('qualification-profile-worker.mjs', Buffer.from(entry(true)));
const cpuStart = cpus(),
  loadBefore = loadavg();
const report = {
  format: 'AircraftBrowserProfile.v1',
  startedAt: new Date().toISOString(),
  sources: [...files].map(([path, bytes]) => ({ path, sha256: hash(bytes), bytes: bytes.length })),
  results: [],
  loadBefore,
  limitations: [
    'Diagnostic wrappers add timer/counter overhead; inclusive method timings overlap and are not exclusive CPU.',
    'Same original arguments/results; verify final hashes and exact final telemetry match uninstrumented case.',
    'Two fixtures only; no threshold qualification or replacement for preserved failed matrix.',
    'No runtime files modified; test-owned worker bootstraps and isolated headless contexts.',
  ],
};
const server = createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (name === 'qualification.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Aircraft profile</title>');
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
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/qualification.html`);
      const cases = await page.evaluate(async () => {
        const { runAircraftRepresentativeProfile: run } = await import(
          '/game/test/helpers/fpv-aircraft-profile.mjs'
        );
        const rows = [];
        for (const scenario of ['cetus-floor', 'meteor-worker'])
          for (const instrumented of [false, true])
            for (let repeat = 0; repeat < 2; repeat++)
              rows.push({
                ...(await run({
                  scenario,
                  instrumented,
                  workerURL:
                    globalThis.location.origin +
                    (instrumented
                      ? '/qualification-profile-worker.mjs'
                      : '/qualification-baseline-worker.mjs'),
                })),
                repeat,
              });
        return rows;
      });
      report.results.push({ runtime, version: browser.version(), cases });
    } catch (error) {
      report.results.push({ runtime, status: 'failed', reason: String(error.stack ?? error) });
    } finally {
      await browser.close();
    }
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
const cpuEnd = cpus();
let idle = 0,
  total = 0;
for (let i = 0; i < cpuStart.length; i++)
  for (const key of Object.keys(cpuStart[i].times)) {
    const n = cpuEnd[i].times[key] - cpuStart[i].times[key];
    total += n;
    if (key === 'idle') idle += n;
  }
report.meanHostBusyPercent = 100 * (1 - idle / total);
report.loadAfter = loadavg();
report.finishedAt = new Date().toISOString();
report.sourcesUnchanged = true;
for (const [name, bytes] of files) {
  if (name.startsWith('qualification-')) continue;
  if (hash(await readFile(new URL('../' + name, import.meta.url))) !== hash(bytes))
    report.sourcesUnchanged = false;
}
report.trajectoriesUnchanged = report.results.every(
  (r) =>
    r.cases &&
    ['cetus-floor', 'meteor-worker'].every((s) => {
      const rows = r.cases.filter((c) => c.scenario === s);
      return rows.every(
        (c) =>
          c.finalHash === rows[0].finalHash &&
          JSON.stringify(c.finalTelemetry) === JSON.stringify(rows[0].finalTelemetry),
      );
    }),
);
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      sourcesUnchanged: report.sourcesUnchanged,
      trajectoriesUnchanged: report.trajectoriesUnchanged,
      meanHostBusyPercent: report.meanHostBusyPercent,
      results: report.results.map((r) => ({
        runtime: r.runtime,
        status: r.status,
        cases: r.cases?.map((c) => ({
          scenario: c.scenario,
          instrumented: c.instrumented,
          repeat: c.repeat,
          capacity: c.capacity,
          initializationMs: c.initializationMs,
          finalHash: c.finalHash,
          counters: c.counters,
        })),
        reason: r.reason,
      })),
    },
    null,
    2,
  ),
);
