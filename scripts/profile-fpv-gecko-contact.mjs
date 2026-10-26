import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, release } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { replayContactTape } from '../game/test/helpers/fpv-contact-tape.mjs';
import {
  recordContactBaseline,
  closeContactCapture,
} from '../game/test/helpers/fpv-gecko-profile-lifecycle.mjs';

const [playwrightModule, executable, outputDirectory] = process.argv.slice(2);
if (!playwrightModule || !executable || !outputDirectory || process.argv.length !== 5)
  throw new Error(
    'Usage: node scripts/profile-fpv-gecko-contact.mjs <installed-playwright> <installed-firefox> <new-output-directory>',
  );
const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = path.resolve(outputDirectory),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  helper = 'game/test/helpers/fpv-contact-tape.mjs',
  vendor = 'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
  tapePath = 'docs/evidence/fpv-contact-tape-20261019.json.gz',
  originalReport = 'docs/fpv-contact-tape-diagnostic-20261019.json',
  runner = 'scripts/profile-fpv-gecko-contact.mjs',
  lifecycle = 'game/test/helpers/fpv-gecko-profile-lifecycle.mjs',
  pins = new Map();
await mkdir(directory);
for (const name of [helper, vendor, tapePath, originalReport, runner, lifecycle]) {
  const bytes = await readFile(path.join(root, name)),
    committed = execFileSync('git', ['show', `HEAD:${name}`], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    });
  if (!bytes.equals(committed)) throw new Error(`Uncommitted diagnostic input: ${name}`);
  pins.set(name, bytes);
}
const original = JSON.parse(pins.get(originalReport)),
  compressed = pins.get(tapePath),
  tapeBytes = gunzipSync(compressed),
  tape = JSON.parse(tapeBytes);
if (
  hash(compressed) !== original.capture.compressedSha256 ||
  hash(tapeBytes) !== original.capture.tapeSha256
)
  throw new Error('Frozen contact tape changed');
for (const name of [helper, vendor])
  if (hash(pins.get(name)) !== original.sources.find((source) => source.path === name)?.sha256)
    throw new Error(`Original replay source changed: ${name}`);
const reportPath = path.join(directory, 'report.json'),
  profilePath = path.join(directory, 'gecko-profile.json'),
  environment = {
    MOZ_PROFILER_STARTUP: '1',
    MOZ_PROFILER_STARTUP_ENTRIES: '16777216',
    MOZ_PROFILER_STARTUP_DURATION: '15',
    MOZ_PROFILER_STARTUP_INTERVAL: '1',
    MOZ_PROFILER_STARTUP_FEATURES: 'js,stackwalk,cpu,processcpu',
    MOZ_PROFILER_STARTUP_FILTERS: 'GeckoMain,DOM Worker',
    MOZ_PROFILER_SHUTDOWN: profilePath,
  },
  report = {
    format: 'FpvGeckoContactProfile.v1',
    startedAt: new Date().toISOString(),
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sources: [...pins].map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: hash(bytes),
    })),
    machine: {
      architecture: arch(),
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model,
    },
    environment,
    results: [],
    limitations: [
      'Diagnostic Gecko sampling changes overhead; timings do not qualify flight performance.',
      'Frozen force tape checks all 1000 post-step world digests and unrounded body states; controller and simulator hosts are absent.',
      '128 MiB circular buffer per process, maximum 15-second entry age, 1 ms requested interval. Output is retained locally, never uploaded.',
      'No browser security/JIT preference edits, native storage inspection, user profiles, or production dependency/configuration changes.',
      'Only the explicitly inventoried replay inputs are pinned; this is not whole-client attestation.',
    ],
  };
const save = () => writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
});
if (!(await recordContactBaseline(report, () => replayContactTape(tape, { sha256: hash }), save)))
  process.exit(1);
const html =
    Buffer.from(`<!doctype html><title>Local sampled contact diagnostic</title><script type="module">
import {replayContactTape} from '/${helper}';
try {
 const tape = await (await fetch('/tape.json')).json();
 for (let repeat=0; repeat<3; repeat++) {
  performance.mark('contact-start-'+repeat);
  const result = await replayContactTape(tape);
  performance.mark('contact-end-'+repeat);
  performance.measure('contact-replay-'+repeat, 'contact-start-'+repeat, 'contact-end-'+repeat);
  await fetch('/result',{method:'POST',body:JSON.stringify({...result,repeat})});
  if(!result.matched) throw new Error('Contact replay diverged');
 }
 await fetch('/complete',{method:'POST'});
} catch(error) {await fetch('/error',{method:'POST',body:String(error.stack??error)});}
</script>`),
  served = new Map([
    [helper, pins.get(helper)],
    [vendor, pins.get(vendor)],
    ['tape.json', tapeBytes],
    ['contact.html', html],
  ]);
report.browserInputs = [...served].map(([name, bytes]) => ({
  path: name,
  bytes: bytes.length,
  sha256: hash(bytes),
}));
let resolveDone, rejectDone;
const done = new Promise((resolve, reject) => {
  resolveDone = resolve;
  rejectDone = reject;
});
done.catch(() => {});
const server = createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://localhost').pathname.slice(1);
    if (req.method === 'POST' && ['result', 'complete', 'error'].includes(name)) {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 256000) throw new Error('Oversized diagnostic response');
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();
      if (name === 'result') {
        report.results.push(JSON.parse(body));
        await save();
      }
      res.writeHead(200);
      res.end('ok');
      if (name === 'complete') resolveDone();
      if (name === 'error') rejectDone(new Error(body));
    } else if (req.method === 'GET' && served.has(name)) {
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
    rejectDone(error);
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
const timer = setTimeout(
  () => rejectDone(new Error('Sampled contact capture exceeded 45 seconds')),
  45000,
);
try {
  const { firefox } = await import(pathToFileURL(playwrightModule));
  report.executable = {
    path: executable,
    sha256: hash(await readFile(executable)),
  };
  browser = await firefox.launch({
    executablePath: executable,
    headless: true,
    env: { ...process.env, ...environment },
  });
  report.browserVersion = browser.version();
  const context = await browser.newContext(),
    tab = await context.newPage();
  await tab.goto(`http://127.0.0.1:${server.address().port}/contact.html`);
  await done;
} catch (error) {
  report.error = String(error.stack ?? error);
} finally {
  clearTimeout(timer);
  await closeContactCapture(
    report,
    () => browser?.close(),
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
}
try {
  const info = await stat(profilePath);
  report.profile = { path: profilePath, bytes: info.size };
  if (info.size > 64 * 1024 * 1024)
    throw new Error('Profile exceeds 64 MiB analysis bound; not parsed');
  report.profile.sha256 = hash(await readFile(profilePath));
} catch (error) {
  report.profileError = String(error.stack ?? error);
}
report.sourcesUnchanged = true;
for (const [name, bytes] of pins)
  if (!(await readFile(path.join(root, name))).equals(bytes)) report.sourcesUnchanged = false;
report.completedAt = new Date().toISOString();
await save();
console.log(
  JSON.stringify(
    {
      reportPath,
      profile: report.profile,
      error: report.error,
      profileError: report.profileError,
      results: report.results.map(({ matched, completedSteps, worldStepMs }) => ({
        matched,
        completedSteps,
        worldStepMs,
      })),
    },
    null,
    2,
  ),
);
if (
  report.error ||
  report.cleanupError ||
  report.profileError ||
  !report.sourcesUnchanged ||
  report.results.length !== 3 ||
  report.results.some((result) => !result.matched)
)
  process.exitCode = 1;
