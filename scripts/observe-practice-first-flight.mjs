import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readEditionZip } from '../publishing/edition-zip.mjs';
import { startServer } from './game-cli.mjs';
import {
  validateFPVArtifactBinding,
  loadFPVObservationArtifact,
  fpvObservationDeadline as deadline,
  closeFPVObservationResources,
} from './fpv-observation-artifact.mjs';
import { acquirePointerResource } from './observe-practice-pointer.mjs';
import {
  unlockObservedPage,
  matchesLaunchedAppURL,
} from './optional-installation-observer-helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) });
export const FIRST_FLIGHT_PROTOCOL = Object.freeze({
  id: 'practice-first-flight-public-ui.v1',
  caseMs: 90_000,
  overallMs: 600_000,
  actionMs: 8000,
  motionMs: 12_000,
  heightIncreaseMetres: 0.2,
  pauseSamples: 4,
  pauseSampleIntervalMs: 200,
  resetToleranceMetres: 0.1,
  viewport: Object.freeze({ width: 1440, height: 900 }),
});
export const FIRST_FLIGHT_CASES = Object.freeze([
  {
    id: 'en-gym',
    package: 'civilian-flight',
    shell: 'gym-shell',
    mode: null,
    viewport: '#arena',
    throttle: 'r',
  },
  {
    id: 'en-academy-self-level',
    package: 'civilian-fpv',
    shell: 'academy-shell',
    mode: 'self-level',
    viewport: '#viewport',
    throttle: 'w',
  },
  {
    id: 'en-academy-acro',
    package: 'civilian-fpv',
    shell: 'academy-shell',
    mode: 'acro',
    viewport: '#viewport',
    throttle: 'w',
  },
  {
    id: 'en-worlds',
    package: 'fpv-worlds',
    shell: 'worlds-shell',
    mode: 'self-level',
    viewport: '#world-viewport',
    throttle: 'w',
  },
]);
const AUTHORITY = [
  'scripts/observe-practice-first-flight.mjs',
  'scripts/observe-practice-pointer.mjs',
  'scripts/fpv-observation-artifact.mjs',
  'scripts/optional-installation-observer-helpers.mjs',
  'scripts/game-cli.mjs',
  'publishing/optional-package-admission.mjs',
  'publishing/optional-package-policy.mjs',
  'publishing/edition-zip.mjs',
];

export function validateFirstFlightPlan(input) {
  const encoded = typeof input === 'string' ? input : JSON.stringify(input);
  if (!encoded || Buffer.byteLength(encoded) > 65536)
    throw new Error('First-flight plan exceeds 64 KiB.');
  const plan = JSON.parse(encoded);
  const fields = [
    'format',
    'protocol',
    'caseId',
    'deviceLabel',
    'quietWindow',
    'cases',
    'bundle',
    'envelopeSha256',
    'sourceRevision',
    'sourceTree',
    'packageRevision',
  ];
  assert(plan && !Array.isArray(plan) && typeof plan === 'object');
  assert(
    fields.every((key) => Object.hasOwn(plan, key)) &&
      Object.keys(plan).every((key) => fields.includes(key)),
    'Unexpected plan fields.',
  );
  assert.equal(plan.format, 'revealline-practice-first-flight-plan.v1');
  assert.equal(plan.protocol, FIRST_FLIGHT_PROTOCOL.id);
  assert.match(plan.caseId, /^[a-z0-9-]{1,64}$/);
  assert.deepEqual(
    plan.cases,
    FIRST_FLIGHT_CASES.map((row) => row.id),
    'Declare the complete four-case EN matrix.',
  );
  validateFPVArtifactBinding(plan);
  for (const [name, limit] of [
    ['deviceLabel', 256],
    ['quietWindow', 2048],
  ])
    assert(
      typeof plan[name] === 'string' && plan[name].trim() && plan[name].length <= limit,
      `Invalid ${name}.`,
    );
  return plan;
}

// Parse only visible public measurements; time, status and throttle never prove motion.
export function parseFirstFlightHUD(id, text) {
  const numbers =
    String(text)
      .match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number) ?? [];
  if (id === 'civilian-flight') {
    assert(numbers.length >= 4, 'Gym position/height/heading HUD is missing.');
    return { x: numbers[0], z: numbers[1], height: numbers[2], heading: numbers[3] };
  }
  assert(numbers.length >= 2, 'FPV height/speed HUD is missing.');
  return { height: numbers[0], speed: numbers[1] };
}
export const hasFirstFlightMotion = (before, after) =>
  after.height - before.height >= FIRST_FLIGHT_PROTOCOL.heightIncreaseMetres - 1e-9;
export function assertFirstFlightReset(before, after) {
  assert(
    Math.abs(before.height - after.height) <= FIRST_FLIGHT_PROTOCOL.resetToleranceMetres,
    'Retry did not restore launch height.',
  );
  if (Object.hasOwn(before, 'x')) {
    assert.equal(after.x, before.x);
    assert.equal(after.z, before.z);
  } else assert.equal(after.speed, 0, 'Retry retained movement.');
}

async function hud(page, spec) {
  let text;
  if (spec.package === 'civilian-flight') text = await page.locator('#readout').innerText();
  else if (spec.package === 'civilian-fpv')
    text = `${await page.locator('#height').innerText()} · ${await page.locator('#speed').innerText()}`;
  else text = await page.locator('#flight-instruments').innerText();
  return { text, values: parseFirstFlightHUD(spec.package, text), at: Date.now() };
}
async function phase(page, spec) {
  if (spec.package === 'civilian-flight')
    return page.locator(`[data-mode-play-shell="${spec.shell}"]`).getAttribute('data-phase');
  return page
    .locator(spec.package === 'civilian-fpv' ? '#flight-app' : '#flight-dialog')
    .getAttribute('data-flight-state');
}
async function waitPhase(page, spec, accepted) {
  await page.waitForFunction(
    ({ spec, accepted }) => {
      const node = globalThis.document.querySelector(
        spec.package === 'civilian-flight'
          ? `[data-mode-play-shell="${spec.shell}"]`
          : spec.package === 'civilian-fpv'
            ? '#flight-app'
            : '#flight-dialog',
      );
      return accepted.includes(
        spec.package === 'civilian-flight' ? node?.dataset.phase : node?.dataset.flightState,
      );
    },
    { spec, accepted },
  );
}
async function activate(page, selector, result) {
  const target = page.locator(selector);
  await target.waitFor({ state: 'visible' });
  await page.waitForFunction((selector) => {
    const node = globalThis.document.querySelector(selector);
    return node && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
  }, selector);
  result.actions.push({ selector, action: 'public-control Enter', at: Date.now() });
  await target.press('Enter');
}
async function fly(page, spec, baseline, result, name) {
  await waitPhase(page, spec, ['active', 'playing']);
  await page.locator(spec.viewport).click();
  const samples = [];
  result[name] = samples;
  const until = Date.now() + FIRST_FLIGHT_PROTOCOL.motionMs;
  await page.keyboard.down(spec.throttle);
  try {
    while (Date.now() < until) {
      const sample = await hud(page, spec);
      samples.push(sample);
      if (hasFirstFlightMotion(baseline.values, sample.values)) return;
      assert(
        ['active', 'playing'].includes(await phase(page, spec)),
        'Flight stopped before the declared movement threshold.',
      );
      await page.waitForTimeout(100);
    }
    throw new Error('No public HUD height increase of at least 0.2 m within 12 seconds.');
  } finally {
    await page.keyboard.up(spec.throttle);
  }
}
async function pause(page, spec, result, name) {
  await activate(page, `#${spec.shell}-action-pause`, result);
  await waitPhase(page, spec, ['paused']);
  const samples = [];
  result[name] = samples;
  for (let i = 0; i < FIRST_FLIGHT_PROTOCOL.pauseSamples; i++) {
    if (i) await page.waitForTimeout(FIRST_FLIGHT_PROTOCOL.pauseSampleIntervalMs);
    samples.push(await hud(page, spec));
    assert.equal(await phase(page, spec), 'paused');
  }
  for (const sample of samples)
    assert.deepEqual(sample.values, samples[0].values, 'Public telemetry changed while paused.');
}

async function runCase(page, spec, { origin, version, password, result, output }) {
  const base = `revealline/practice/${spec.package}/`;
  const launcher = new URL(base + 'app/?action=play&lang=en', origin).href;
  const expected = new URL(
    base + `releases/${version}/site/optional-practice/${spec.package}/index.html`,
    origin,
  ).href;
  result.launcher = launcher;
  result.expectedEntry = expected;
  await page.goto(launcher, { waitUntil: 'domcontentloaded' });
  await unlockObservedPage(page, password);
  await page.waitForURL((url) => matchesLaunchedAppURL(url.href, expected));
  await unlockObservedPage(page, password);
  result.unlocked = true;
  result.entry = page.url();
  await page.locator(`#${spec.shell}-action-primary`).waitFor({ state: 'visible' });
  if (spec.package === 'civilian-fpv') {
    await activate(page, '#academy-shell-action-settings', result);
    await activate(page, '#academy-settings-tab-gameplay', result);
    await page.locator('#mode').selectOption(spec.mode);
    assert.equal(await page.locator('#mode').inputValue(), spec.mode);
    await activate(page, '#academy-shell-action-settings-back', result);
    await activate(page, '#academy-shell-action-settings-back', result);
  }
  await activate(page, `#${spec.shell}-action-primary`, result);
  await waitPhase(page, spec, ['active', 'playing']);
  result.startPhase = await phase(page, spec);
  result.initial = await hud(page, spec);
  if (spec.package !== 'civilian-flight') {
    const prefix = spec.package === 'civilian-fpv' ? '' : 'flight-';
    assert.equal(
      await page
        .locator(spec.package === 'civilian-fpv' ? '#input-source' : '#flight-source')
        .inputValue(),
      'keyboard',
    );
    assert.equal(await page.locator(`#${prefix}keyboard-preset`).inputValue(), 'two-stick');
    assert.equal(
      await page.locator(spec.package === 'civilian-fpv' ? '#mode' : '#flight-mode').inputValue(),
      spec.mode,
    );
  }
  await fly(page, spec, result.initial, result, 'movement');
  await pause(page, spec, result, 'paused');
  await activate(page, `#${spec.shell}-action-pause-restart`, result);
  await waitPhase(page, spec, ['ready', 'disarmed', 'paused', 'active', 'playing']);
  // World scene preparation is asynchronous. Require the public reset witness,
  // not merely the previous paused state that can survive until it finishes.
  const resetEnd = Date.now() + FIRST_FLIGHT_PROTOCOL.actionMs;
  do {
    result.retry = await hud(page, spec);
    if (
      Math.abs(result.retry.values.height - result.initial.values.height) <=
        FIRST_FLIGHT_PROTOCOL.resetToleranceMetres &&
      (spec.package === 'civilian-flight' || result.retry.values.speed === 0)
    )
      break;
    assert(Date.now() < resetEnd, 'Retry did not produce a public reset witness.');
    await page.waitForTimeout(100);
  } while (true);
  result.retryPhase = await phase(page, spec);
  assertFirstFlightReset(result.initial.values, result.retry.values);
  // Retry is an explicit start action in these shared shells. Record the actual
  // phase; never assert that an auto-starting Retry secretly stayed disarmed.
  if (['ready', 'disarmed', 'paused'].includes(result.retryPhase)) {
    const selector =
      spec.package === 'fpv-worlds'
        ? '#world-arm'
        : spec.package === 'civilian-fpv'
          ? '#arm'
          : '#start';
    await activate(page, selector, result);
  }
  await fly(page, spec, result.retry, result, 'retryMovement');
  await pause(page, spec, result, 'retryPaused');
  const image = await page.screenshot({ timeout: 5000 });
  const imageName = spec.id + '-retry-paused.png';
  await writeFile(path.join(output, imageName), image, { flag: 'wx' });
  result.screenshot = pin(imageName, image);
  result.passed = result.errors.length === 0;
}

const closeServer = (served) =>
  new Promise((resolve, reject) => {
    served.server.close((error) => (error ? reject(error) : resolve()));
    served.server.closeAllConnections?.();
  });

export async function observePracticeFirstFlight({
  planFile,
  playwrightModule,
  output,
  password = process.env.OPTIONAL_INSTALLATION_PASSWORD,
} = {}) {
  assert(
    planFile && playwrightModule && output,
    'Plan, external Playwright and new output are required.',
  );
  assert((await stat(planFile)).size <= 65536);
  const planBytes = await readFile(planFile),
    plan = validateFirstFlightPlan(planBytes.toString());
  await mkdir(output);
  const scrub = (value) =>
    password ? String(value).split(password).join('[REDACTED]') : String(value);
  const report = {
    format: 'PracticeFirstFlightObservation.v1',
    plan,
    protocol: FIRST_FLIGHT_PROTOCOL,
    createdAt: new Date().toISOString(),
    completed: false,
    qualified: false,
    procedureComplete: false,
    cases: [],
    authority: [],
    resourceAcquisitions: [],
    limitations: [
      'Automated EN keyboard workflow only; no human learning, completed exercise, verified proof, physical controller, touch or accessibility qualification.',
      'Controls use public Enter activation and a public viewport click, not a full Tab-navigation or first-pointer test.',
      'Unchanged admitted package bytes served locally at release-shaped paths; current.json is a declared local selector fixture, not a published release.',
      'Starts from each stable launcher, not the main-game directory. No installation/offline or public-host claim.',
      'Motion uses visible rounded HUD values; paused stability is a 600ms observation, not internal physics instrumentation.',
    ],
  };
  let work, served, browser;
  try {
    await writeFile(path.join(output, 'plan.json'), planBytes, { flag: 'wx' });
    for (const name of AUTHORITY)
      report.authority.push(pin(name, await readFile(path.join(ROOT, name))));
    const loaded = await deadline(
      loadFPVObservationArtifact(plan, { base: path.dirname(path.resolve(planFile)) }),
      60_000,
      'All-package admission',
    );
    report.artifact = loaded.binding;
    report.admission = loaded.admission;
    const bundle = path.resolve(path.dirname(path.resolve(planFile)), plan.bundle);
    const envelopeBytes = await readFile(path.join(bundle, 'optional-packages.json'));
    assert.equal(sha(envelopeBytes), plan.envelopeSha256);
    const envelope = JSON.parse(envelopeBytes);
    report.packages = envelope.packages;
    work = await mkdtemp(path.join(tmpdir(), 'practice-first-flight-'));
    const put = async (name, bytes) => {
      const file = path.resolve(work, name);
      assert(file.startsWith(work + path.sep));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: 'wx' });
    };
    report.staged = [];
    for (const id of new Set(FIRST_FLIGHT_CASES.map((row) => row.package))) {
      const item = envelope.packages.find((row) => row.id === id);
      assert(item, `Missing ${id}.`);
      const archive = await readFile(path.join(bundle, item.distribution.path));
      assert.equal(archive.length, item.distribution.bytes);
      assert.equal(sha(archive), item.distribution.sha256);
      const base = `revealline/practice/${id}/`,
        version = envelope.version;
      for (const [name, bytes] of readEditionZip(archive)) {
        const runtimePath = base + `releases/${version}/site/` + name;
        await put(runtimePath, bytes);
        report.staged.push(pin(runtimePath, bytes));
        if (name.startsWith('launcher/')) {
          const launcherPath = base + 'app/' + name.slice(9);
          await put(launcherPath, bytes);
          report.staged.push(pin(launcherPath, bytes));
        }
      }
      const selector = Buffer.from(
        JSON.stringify({ id, version, scope: `../releases/${version}/site/`, entry: item.entry }),
      );
      await put(base + 'app/current.json', selector);
      (report.localSelectors ??= []).push(pin(base + 'app/current.json', selector));
    }
    await put('.xonix-build.json', JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }));
    served = await acquirePointerResource(
      report.resourceAcquisitions,
      'server',
      () => startServer({ root: work, port: 0 }),
      closeServer,
    );
    const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
    browser = await acquirePointerResource(
      report.resourceAcquisitions,
      'browser',
      () => chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000 }),
      (value) => value.close(),
      35_000,
    );
    report.browser = browser.version();
    const end = Date.now() + FIRST_FLIGHT_PROTOCOL.overallMs;
    for (const spec of FIRST_FLIGHT_CASES) {
      assert(Date.now() < end, 'First-flight overall deadline exceeded.');
      const result = { ...spec, actions: [], errors: [], passed: false };
      report.cases.push(result);
      let context, page, pending;
      try {
        context = await acquirePointerResource(
          report.resourceAcquisitions,
          spec.id + '-context',
          () => browser.newContext({ viewport: FIRST_FLIGHT_PROTOCOL.viewport, locale: 'en-US' }),
          (value) => value.close(),
        );
        page = await acquirePointerResource(
          report.resourceAcquisitions,
          spec.id + '-page',
          () => context.newPage(),
          (value) => value.close(),
        );
        page.setDefaultTimeout(FIRST_FLIGHT_PROTOCOL.actionMs);
        page.setDefaultNavigationTimeout(30_000);
        page.on('pageerror', (error) => {
          if (result.errors.length < 20) result.errors.push(scrub(error.message));
        });
        pending = runCase(page, spec, {
          origin: served.url,
          version: envelope.version,
          password,
          result,
          output,
        });
        await deadline(pending, Math.min(FIRST_FLIGHT_PROTOCOL.caseMs, end - Date.now()), spec.id);
      } catch (error) {
        result.failure = scrub(error.message);
        result.passed = false;
        if (page && result.unlocked) {
          try {
            result.lastHUD = await deadline(hud(page, spec), 2000, 'Failure HUD').catch(() => null);
            const bytes = await page.screenshot({ timeout: 5000 });
            const name = spec.id + '-failure.png';
            await writeFile(path.join(output, name), bytes, { flag: 'wx' });
            result.screenshot = pin(name, bytes);
          } catch {
            result.screenshotUnavailable = true;
          }
        }
      } finally {
        if (context) await deadline(context.close(), 10_000, 'Case cleanup');
        if (pending)
          await deadline(
            pending.catch(() => {}),
            10_000,
            'Case termination',
          );
        // A deadline does not cancel its promise. Late success must not replace
        // the retained failure once the owned context has been closed.
        if (result.failure) result.passed = false;
        await writeFile(
          path.join(output, spec.id + '.json'),
          scrub(JSON.stringify(result, null, 2)) + '\n',
          { flag: 'wx' },
        );
      }
      if (/requires a password|access form/.test(result.failure ?? ''))
        throw new Error('Normal access failed; remaining cases not attempted.');
    }
    report.procedureComplete = true;
    for (const item of report.authority)
      assert.equal(
        sha(await readFile(path.join(ROOT, item.path))),
        item.sha256,
        'Observer authority changed.',
      );
  } catch (error) {
    report.failure = scrub(error.message);
  } finally {
    report.cleanup = await closeFPVObservationResources([
      ...(browser ? [['browser', () => browser.close()]] : []),
      ...(served ? [['server', () => closeServer(served)]] : []),
      ...(work ? [['temporary-site', () => rm(work, { recursive: true, force: true })]] : []),
    ]);
    if (report.resourceAcquisitions.some((row) => row.pending || (row.timedOut && !row.lateClosed)))
      report.cleanup.completed = false;
    report.completed =
      report.procedureComplete &&
      !report.failure &&
      report.cleanup.completed &&
      report.cases.every((row) => row.passed && !row.failure);
    await writeFile(
      path.join(output, 'observation.json'),
      scrub(JSON.stringify(report, null, 2)) + '\n',
      { flag: 'wx' },
    );
  }
  return JSON.parse(scrub(JSON.stringify(report)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [planFile, playwrightModule, output, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  const report = await observePracticeFirstFlight({ planFile, playwrightModule, output });
  console.log(
    JSON.stringify({ completed: report.completed, cases: report.cases.length, qualified: false }),
  );
  if (!report.completed) process.exitCode = 1;
}
