import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { cpus, loadavg, tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { aircraftQualificationSources } from './qualify-fpv-aircraft.mjs';

const [playwrightModule, output] = process.argv.slice(2),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const playwright = await import(pathToFileURL(playwrightModule));
const executable = playwright.firefox.executablePath();
const executableVersion = execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim();
const files = await aircraftQualificationSources();
for (const name of [
  'game/test/helpers/fpv-aircraft-profile.mjs',
  'game/test/helpers/fpv-aircraft-solver-profile.mjs',
  'game/test/helpers/fpv-aircraft-solver-control.mjs',
  'scripts/profile-fpv-firefox-control.mjs',
])
  files.set(name, await readFile(new URL('../' + name, import.meta.url)));
for (const native of [false, true])
  files.set(
    `control-${native}-worker.mjs`,
    Buffer.from(
      `import { installAircraftSolverProfile } from '/game/test/helpers/fpv-aircraft-solver-profile.mjs';\nimport { installAircraftContactObservation } from '/game/test/helpers/fpv-aircraft-solver-control.mjs';\nimport { installAdvancedWorker } from '/optional-practice/civilian-fpv/advanced-worker.mjs';\nconst pending=[];const buffer=e=>{e.stopImmediatePropagation();pending.push(e.data);};self.addEventListener('message',buffer);\nconst p=await installAircraftSolverProfile({native:${native}});const c=installAircraftContactObservation();\nself.removeEventListener('message',buffer);self.addEventListener('message',e=>{if(e.data?.type==='qualification-profile'){e.stopImmediatePropagation();if(e.data.reset)p.reset();self.postMessage({type:'qualification-profile',token:e.data.token,profile:{...p.read(),contactObservation:c.read()}});}});\ninstallAdvancedWorker(self);for(const data of pending)self.dispatchEvent(new MessageEvent('message',{data}));`,
    ),
  );
const html = `<!doctype html><title>Disposable autonomous physics diagnostic</title><script type="module">
import {runAircraftSolverControl} from '/game/test/helpers/fpv-aircraft-solver-control.mjs';
try {
  for(const scenario of ['cetus-floor','meteor-worker']) for(const native of [false,true]) for(let repeat=0;repeat<2;repeat++) {
    await fetch('/begin',{method:'POST'});
    const result=await runAircraftSolverControl({scenario,native,workerURL:location.origin+'/control-'+native+'-worker.mjs'});
    await fetch('/result',{method:'POST',body:JSON.stringify({...result,repeat})});
  }
  await fetch('/complete',{method:'POST'});
} catch(error) { await fetch('/error',{method:'POST',body:String(error.stack??error)}); }
</script>`;
files.set('control.html', Buffer.from(html));
const report = {
  format: 'AircraftFirefoxAutomationControl.v1',
  startedAt: new Date().toISOString(),
  executable,
  executableVersion,
  executableSha256: hash(await readFile(executable)),
  sources: [...files].map(([path, bytes]) => ({ path, sha256: hash(bytes), bytes: bytes.length })),
  results: [],
  limitations: [
    'Same installed headless Firefox binary and autonomous page; no page.evaluate invocation in either treatment.',
    'Unattached uses a new disposable Firefox profile with no preference edits; Playwright uses its standard fresh context and launch defaults.',
    'An observed difference would implicate combined automation launch/context conditions, not isolate an individual preference or JIT tier.',
    'All physics inputs/settings remain unchanged; timers and read-only contact observations introduce diagnostic overhead.',
    'Original failed qualification remains authoritative; this is a mechanism investigation, not a replacement matrix.',
  ],
};
let current, resolveDone, rejectDone, cpuBefore, loadBefore;
const busy = (a, b) => {
  let idle = 0,
    total = 0;
  for (let i = 0; i < a.length; i++)
    for (const key of Object.keys(a[i].times)) {
      const v = b[i].times[key] - a[i].times[key];
      total += v;
      if (key === 'idle') idle += v;
    }
  return 100 * (1 - idle / total);
};
const server = createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (req.method === 'POST') {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 2 * 1024 * 1024) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    if (name === 'begin') {
      cpuBefore = cpus();
      loadBefore = loadavg();
    }
    if (name === 'result') {
      const row = {
        ...JSON.parse(body),
        loadBefore,
        loadAfter: loadavg(),
        meanHostBusyPercent: busy(cpuBefore, cpus()),
      };
      current.cases.push(row);
      await writeFile(output, JSON.stringify(report, null, 2) + '\n');
      console.log(
        JSON.stringify({
          treatment: current.treatment,
          scenario: row.scenario,
          native: row.native,
          repeat: row.repeat,
          capacity: row.capacity,
          hash: row.finalHash,
          busy: row.meanHostBusyPercent,
        }),
      );
    }
    res.writeHead(200);
    res.end('ok');
    if (name === 'complete') resolveDone();
    if (name === 'error') rejectDone(new Error(body));
  } else if (files.has(name)) {
    res.writeHead(200, {
      'Content-Type': name.endsWith('.html') ? 'text/html' : 'text/javascript',
      'Cache-Control': 'no-store',
    });
    res.end(files.get(name));
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  for (const treatment of ['unattached', 'playwright-attached']) {
    current = { treatment, cases: [] };
    report.results.push(current);
    const done = new Promise((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    const timer = setTimeout(
      () => rejectDone(new Error('Autonomous diagnostic exceeded 90 seconds')),
      90000,
    );
    let browser, child, profile, exit;
    try {
      const url = `http://127.0.0.1:${server.address().port}/control.html`;
      if (treatment === 'unattached') {
        profile = await mkdtemp(tmpdir() + '/fpv-firefox-control-');
        current.arguments = ['-headless', '-no-remote', '-profile', profile, url];
        child = spawn(executable, current.arguments, { stdio: ['ignore', 'ignore', 'pipe'] });
        current.stderr = '';
        child.stderr.on('data', (chunk) => {
          current.stderr = (current.stderr + chunk.toString()).slice(-8000);
        });
        child.on('error', rejectDone);
        exit = new Promise((resolve) =>
          child.once('exit', (code, signal) => resolve({ code, signal })),
        );
      } else {
        browser = await playwright.firefox.launch({ headless: true });
        current.version = browser.version();
        const page = await browser.newPage();
        await page.goto(url);
      }
      await done;
    } catch (error) {
      current.error = String(error.stack ?? error);
    } finally {
      clearTimeout(timer);
      if (browser) await browser.close();
      if (child) {
        child.kill('SIGTERM');
        current.exit = await exit;
      }
      if (profile) await rm(profile, { recursive: true, force: true });
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
report.finishedAt = new Date().toISOString();
report.sourcesUnchanged = true;
for (const [name, bytes] of files)
  if (
    !name.startsWith('control') &&
    hash(await readFile(new URL('../' + name, import.meta.url))) !== hash(bytes)
  )
    report.sourcesUnchanged = false;
report.trajectoriesUnchanged = report.results.every(
  (r) =>
    !r.error &&
    r.cases.length === 8 &&
    r.cases.every((row) => {
      const reference = report.results[0].cases.find((c) => c.scenario === row.scenario);
      return (
        row.finalHash === reference?.finalHash &&
        JSON.stringify(row.finalTelemetry) === JSON.stringify(reference?.finalTelemetry)
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
