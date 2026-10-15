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
export const FIRST_FLIGHT_V2_PROTOCOL = Object.freeze({
  ...FIRST_FLIGHT_PROTOCOL,
  id: 'practice-first-flight-public-ui.v2',
});
export const FIRST_FLIGHT_V2_CASES = Object.freeze(
  ['en', 'uk'].flatMap((locale) =>
    [...FIRST_FLIGHT_CASES, { ...FIRST_FLIGHT_CASES[3], mode: 'acro' }].map((spec) =>
      Object.freeze({
        ...spec,
        id: `${locale}-${spec.package === 'fpv-worlds' ? `worlds-${spec.mode}` : spec.id.slice(3)}`,
        locale,
      }),
    ),
  ),
);
export const GYM_EXERCISE_PROTOCOL = Object.freeze({
  ...FIRST_FLIGHT_PROTOCOL,
  id: 'practice-exercise-public-ui.gym.v1',
});
export const GYM_EXERCISE_CASES = Object.freeze(
  ['en', 'uk'].map((locale) =>
    Object.freeze({
      ...FIRST_FLIGHT_CASES[0],
      id: `${locale}-gym-lift-and-land`,
      locale,
      mode: 'assisted',
      exercise: 'lift-and-land',
    }),
  ),
);
export function firstFlightProtocol(plan) {
  assert(
    [FIRST_FLIGHT_PROTOCOL.id, FIRST_FLIGHT_V2_PROTOCOL.id, GYM_EXERCISE_PROTOCOL.id].includes(
      plan.protocol,
    ),
    'Unknown first-flight protocol.',
  );
  if (plan.protocol === GYM_EXERCISE_PROTOCOL.id) return GYM_EXERCISE_PROTOCOL;
  return plan.protocol === FIRST_FLIGHT_V2_PROTOCOL.id
    ? FIRST_FLIGHT_V2_PROTOCOL
    : FIRST_FLIGHT_PROTOCOL;
}
export function firstFlightCases(plan) {
  if (firstFlightProtocol(plan).id === GYM_EXERCISE_PROTOCOL.id) return GYM_EXERCISE_CASES;
  return firstFlightProtocol(plan).id === FIRST_FLIGHT_V2_PROTOCOL.id
    ? FIRST_FLIGHT_V2_CASES
    : FIRST_FLIGHT_CASES;
}
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
export function firstFlightArtifactPackage(plan) {
  return firstFlightProtocol(plan).id === GYM_EXERCISE_PROTOCOL.id
    ? 'civilian-flight'
    : 'civilian-fpv';
}
export function firstFlightAuthority(plan) {
  return [
    ...AUTHORITY,
    ...(firstFlightProtocol(plan).id === GYM_EXERCISE_PROTOCOL.id
      ? ['scripts/practice-exercise-ui.mjs', 'scripts/practice-exercise-replay.mjs']
      : []),
  ];
}

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
  const formats = {
    'revealline-practice-first-flight-plan.v1': FIRST_FLIGHT_PROTOCOL.id,
    'revealline-practice-first-flight-plan.v2': FIRST_FLIGHT_V2_PROTOCOL.id,
    'revealline-practice-gym-exercise-plan.v1': GYM_EXERCISE_PROTOCOL.id,
  };
  assert(Object.hasOwn(formats, plan.format), 'Unsupported observation plan format.');
  assert.equal(plan.protocol, formats[plan.format]);
  assert.match(plan.caseId, /^[a-z0-9-]{1,64}$/);
  assert.deepEqual(
    plan.cases,
    firstFlightCases(plan).map((row) => row.id),
    'Declare the exact complete case matrix for this registered protocol.',
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
export function parseFirstFlightHUD(id, text, locale) {
  if (locale !== undefined) {
    assert(['en', 'uk'].includes(locale), 'Unsupported HUD locale.');
    assert(typeof text === 'string' && text.length <= 1024, 'Unbounded HUD text.');
    const n = '(-?\\d+(?:\\.\\d+)?)';
    const pattern =
      id === 'civilian-flight'
        ? `${locale === 'uk' ? 'Положення' : 'Position'} ${n}, ${n} m · ${locale === 'uk' ? 'Висота' : 'Height'} ${n} m · ${locale === 'uk' ? 'Курс' : 'Heading'} ${n}°`
        : id === 'civilian-fpv'
          ? `${locale === 'uk' ? 'Висота' : 'Height'} ${n} m · ${locale === 'uk' ? 'Швидкість' : 'Speed'} ${n} m/s`
          : id === 'fpv-worlds'
            ? `${n} m · ${n} m/s · ${n} s(?: · ♥ \\d+)?`
            : null;
    assert(pattern, 'Unknown HUD package.');
    const match = text.match(new RegExp(`^${pattern}$`));
    assert(match, 'Visible HUD does not match the declared locale/package measurements.');
    const values = match.slice(1).map(Number);
    assert(values.every(Number.isFinite), 'Nonfinite HUD measurement.');
    return id === 'civilian-flight'
      ? { x: values[0], z: values[1], height: values[2], heading: values[3] }
      : { height: values[0], speed: values[1] };
  }
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
  return { text, values: parseFirstFlightHUD(spec.package, text, spec.locale), at: Date.now() };
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
export async function activateFirstFlightControl(page, selector, result, modality = 'keyboard') {
  const target = page.locator(selector);
  await target.waitFor({ state: 'visible' });
  await page.waitForFunction((selector) => {
    const node = globalThis.document.querySelector(selector);
    return node && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
  }, selector);
  result.actions.push({
    selector,
    action: modality === 'pointer' ? 'public-control pointer click' : 'public-control Enter',
    at: Date.now(),
  });
  if (modality === 'pointer') await target.click();
  else await target.press('Enter');
}
const activate = activateFirstFlightControl;

export async function returnFirstFlightHome(page, spec, result) {
  const primary = page.locator(`#${spec.shell}-action-primary`);
  const back = `#${spec.shell}-action-settings-back`;
  const settings = page.locator(`#${spec.shell}-settings-dialog`);
  // A mode change can reset the settings panel stack. Observe the public
  // dialog's open state: Home can remain laid out behind this modal, so its
  // isVisible() is not evidence that Settings has closed or Home is actionable.
  for (let i = 0; i < 2 && (await settings.getAttribute('open')) !== null; i++) {
    if (!(await page.locator(back).isVisible())) break;
    await activate(page, back, result);
  }
  assert.equal(
    await settings.getAttribute('open'),
    null,
    'Settings did not close after public Back.',
  );
  assert.notEqual(
    await page.locator(`#${spec.shell}-home-dialog`).getAttribute('open'),
    null,
    'Home did not reopen after Settings.',
  );
  await primary.waitFor({ state: 'visible' });
}

export async function retryFirstFlight(page, spec, result) {
  if (spec.package === 'civilian-flight')
    return activate(page, `#${spec.shell}-action-pause-restart`, result);
  const dialog = `#${spec.shell}-pause-dialog[open]`;
  const selector = spec.locale ? dialog + ' [data-practice-action="retry"]' : null;
  const retry = selector
    ? page.locator(selector)
    : page.locator(dialog).getByRole('button', { name: 'Retry', exact: true });
  await retry.waitFor({ state: 'visible' });
  assert(await retry.isEnabled(), 'Public Retry is disabled.');
  if (spec.locale)
    assert.equal((await retry.innerText()).trim(), spec.locale === 'uk' ? 'Ще раз' : 'Retry');
  result.actions.push({
    selector: selector ?? dialog + ' role=button[name=Retry]',
    id: await retry.getAttribute('id'),
    practiceAction: await retry.getAttribute('data-practice-action'),
    action: 'public-control Enter',
    at: Date.now(),
  });
  await retry.press('Enter');
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
  // Gym pauses on focus leaving its arena. A keyboard-focus+Enter on this
  // toggle would resume it. Ordinary pointer activation preserves the button's
  // press-time Pause intent using the shell's existing pointerdown handling.
  await activate(page, `#${spec.shell}-action-pause`, result, 'pointer');
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

export function firstFlightRoute(spec, { origin, version }) {
  const locale = spec.locale ?? 'en';
  assert(['en', 'uk'].includes(locale));
  assert(FIRST_FLIGHT_CASES.some((row) => row.package === spec.package));
  assert.match(version, /^v\d+\.\d+\.\d+$/);
  const base = `revealline/practice/${spec.package}/`;
  const launcher = new URL(base + `app/?action=play&lang=${locale}`, origin).href;
  const expected = new URL(
    base + `releases/${version}/site/optional-practice/${spec.package}/index.html`,
    origin,
  ).href;
  return { launcher, expected, locale };
}
export async function observeFirstFlightLocale(page, spec) {
  assert(['en', 'uk'].includes(spec.locale));
  const locale = await page.locator('html').getAttribute('lang');
  const settings = page.locator(`#${spec.shell}-action-settings`);
  await settings.waitFor({ state: 'visible' });
  const label = (await settings.innerText()).trim();
  assert.equal(locale, spec.locale, 'App document locale did not follow launcher selection.');
  assert.equal(
    label,
    spec.locale === 'uk' ? 'Налаштування' : 'Settings',
    'Public Settings label has the wrong locale.',
  );
  return { documentLanguage: locale, settingsLabel: label };
}
export async function selectFirstFlightMode(page, spec, result) {
  assert(['civilian-fpv', 'fpv-worlds'].includes(spec.package));
  assert(['self-level', 'acro'].includes(spec.mode));
  const prefix = spec.package === 'civilian-fpv' ? 'academy' : 'worlds';
  const selector = spec.package === 'civilian-fpv' ? '#mode' : '#flight-mode';
  await activate(page, `#${spec.shell}-action-settings`, result);
  await activate(page, `#${prefix}-settings-tab-gameplay`, result);
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.locator(selector).selectOption(spec.mode);
  assert.equal(await page.locator(selector).inputValue(), spec.mode);
  result.actions.push({
    selector,
    action: 'public gameplay mode selection',
    value: spec.mode,
    at: Date.now(),
  });
  await returnFirstFlightHome(page, spec, result);
}
export async function completeFirstFlightGymExercise(page, spec, result, output, files, signal) {
  assert(GYM_EXERCISE_CASES.some((row) => row.id === spec.id && row.locale === spec.locale));
  assert.equal(spec.package, 'civilian-flight');
  assert.equal(spec.mode, 'assisted');
  assert.equal(spec.exercise, 'lift-and-land');
  assert(files instanceof Map, 'Admitted Gym runtime files are required.');
  result.independentReplayVerified = false;
  // Only this registered protocol loads the public-input controller. The plan
  // cannot supply a module path, arbitrary script, callback or alternate drill.
  const { completePublicGymExercise } = await import('./practice-exercise-ui.mjs');
  await page.locator(spec.viewport).click();
  result.exercise = await completePublicGymExercise(page, {
    locale: spec.locale,
    mode: spec.mode,
    signal,
    onComplete: async () => {
      const bytes = await page.screenshot({ timeout: 5000 });
      const name = spec.id + '-completed.png';
      await writeFile(path.join(output, name), bytes, { flag: 'wx' });
      result.screenshot = pin(name, bytes);
      result.completionScreenshot = result.screenshot;
    },
  });
  const exercise = result.exercise;
  assert(exercise.completed, exercise.error ?? 'Public Gym exercise did not complete.');
  assert(
    exercise.cleanup.released && !exercise.cleanup.errors.length,
    'Exercise key cleanup failed.',
  );
  assert(result.screenshot, 'Completion screenshot is missing.');
  assert.equal(exercise.transcript?.independentReplayVerified, false);
  const { json, ...metadata } = exercise.transcript;
  assert(
    typeof json === 'string' && Buffer.byteLength(json) <= 131072,
    'Bounded public transcript is missing.',
  );
  const name = spec.id + '-transcript.json',
    bytes = Buffer.from(json);
  await writeFile(path.join(output, name), bytes, { flag: 'wx' });
  exercise.transcript = { ...metadata, exportedFile: pin(name, bytes) };
  const { verifyFrozenGymTranscript } = await import('./practice-exercise-replay.mjs');
  exercise.independentReplay = await verifyFrozenGymTranscript(files, json);
  assert.equal(exercise.independentReplay.verified, true);
  assert.equal(
    exercise.independentReplay.transcriptSha256,
    exercise.transcript.exportedFile.sha256,
  );
  exercise.transcript.independentReplayVerified = true;
  result.independentReplayVerified = true;
  result.passed = result.errors.length === 0;
}

async function runCase(page, spec, { origin, version, password, result, output, files, signal }) {
  const { launcher, expected, locale } = firstFlightRoute(spec, { origin, version });
  result.launcher = launcher;
  result.expectedEntry = expected;
  await page.goto(launcher, { waitUntil: 'domcontentloaded' });
  await unlockObservedPage(page, password);
  await page.waitForURL((url) => matchesLaunchedAppURL(url.href, expected, locale));
  await unlockObservedPage(page, password);
  result.unlocked = true;
  result.entry = page.url();
  await page.locator(`#${spec.shell}-action-primary`).waitFor({ state: 'visible' });
  if (spec.locale) result.localeWitness = await observeFirstFlightLocale(page, spec);
  if (spec.package === 'civilian-fpv' || (spec.locale && spec.package === 'fpv-worlds'))
    await selectFirstFlightMode(page, spec, result);
  await activate(page, `#${spec.shell}-action-primary`, result);
  await waitPhase(page, spec, ['active', 'playing']);
  result.startPhase = await phase(page, spec);
  result.initial = await hud(page, spec);
  if (spec.exercise) {
    await completeFirstFlightGymExercise(page, spec, result, output, files, signal);
    return;
  }
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
  await retryFirstFlight(page, spec, result);
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
  // Gym's generic Retry auto-starts. FPV's visible tutorial Retry leaves a new
  // disarmed/paused attempt. Record the real phase and arm explicitly via the
  // documented two-stick Space shortcut after scene readiness.
  if (['ready', 'disarmed', 'paused'].includes(result.retryPhase)) {
    const arm = spec.package === 'fpv-worlds' ? '#world-arm' : '#arm';
    await page.waitForFunction((selector) => {
      const node = globalThis.document.querySelector(selector);
      return node && !node.disabled;
    }, arm);
    await page.locator(spec.viewport).click();
    result.actions.push({
      selector: spec.viewport,
      action: 'documented Space arm/resume',
      at: Date.now(),
    });
    await page.keyboard.press('Space');
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
  const protocol = firstFlightProtocol(plan),
    cases = firstFlightCases(plan);
  const exercise = protocol.id === GYM_EXERCISE_PROTOCOL.id;
  await mkdir(output);
  const scrub = (value) =>
    password ? String(value).split(password).join('[REDACTED]') : String(value);
  const report = {
    format: exercise
      ? 'PracticeGymExerciseObservation.v1'
      : protocol.id === FIRST_FLIGHT_PROTOCOL.id
        ? 'PracticeFirstFlightObservation.v1'
        : 'PracticeFirstFlightObservation.v2',
    plan,
    protocol,
    createdAt: new Date().toISOString(),
    completed: false,
    qualified: false,
    procedureComplete: false,
    cases: [],
    authority: [],
    resourceAcquisitions: [],
    limitations: exercise
      ? [
          'Automated EN/UK assisted Gym lift-and-land exercise through public HUD feedback and R/F keys; no FPV exercise, physical controller, human learning or campaign-win qualification.',
          'Native completion/checkmark and actual public transcript export are observed; independentReplayVerified becomes true only after off-browser replay with the complete fixed model/catalogue dependency closure byte-matched to admitted Gym files. This is not human qualification.',
          'Completion screenshot is captured before Settings/Data transcript export. No recorded-input injection, runtime hook or fabricated completion state.',
          'Starts from the stable Gym launcher, not the main-game directory. Locally staged admitted bytes and current.json fixture are not public hosting or installation/offline qualification.',
        ]
      : [
          `Automated ${protocol.id === FIRST_FLIGHT_PROTOCOL.id ? 'EN' : 'EN/UK'} mixed keyboard/pointer workflow only; no human learning, completed exercise, verified proof, physical controller, touch or accessibility qualification.`,
          'Mixed input: public Enter activation, ordinary pointer Pause/viewport clicks and documented Space arming; not a full Tab-navigation or first-pointer test.',
          'Unchanged admitted package bytes served locally at release-shaped paths; current.json is a declared local selector fixture, not a published release.',
          'Starts from each stable launcher, not the main-game directory. No installation/offline or public-host claim.',
          'Motion uses visible rounded HUD values; paused stability is a 600ms observation, not internal physics instrumentation.',
        ],
  };
  let work, served, browser;
  try {
    await writeFile(path.join(output, 'plan.json'), planBytes, { flag: 'wx' });
    await mkdir(path.join(output, 'authority'));
    for (const name of firstFlightAuthority(plan)) {
      const bytes = await readFile(path.join(ROOT, name));
      report.authority.push(pin(name, bytes));
      await writeFile(path.join(output, 'authority', path.basename(name)), bytes, { flag: 'wx' });
    }
    const loaded = await deadline(
      loadFPVObservationArtifact(plan, {
        base: path.dirname(path.resolve(planFile)),
        packageId: firstFlightArtifactPackage(plan),
      }),
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
    for (const id of new Set(cases.map((row) => row.package))) {
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
    const end = Date.now() + protocol.overallMs;
    for (const spec of cases) {
      assert(Date.now() < end, 'First-flight overall deadline exceeded.');
      const result = { ...spec, actions: [], errors: [], passed: false };
      report.cases.push(result);
      let context, page, pending;
      const controller = new AbortController();
      try {
        context = await acquirePointerResource(
          report.resourceAcquisitions,
          spec.id + '-context',
          () =>
            browser.newContext({
              viewport: protocol.viewport,
              locale: spec.locale === 'uk' ? 'uk-UA' : 'en-US',
            }),
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
          signal: controller.signal,
          files: loaded.files,
        });
        await deadline(pending, Math.min(protocol.caseMs, end - Date.now()), spec.id);
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
        controller.abort();
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
    ]);
    if (report.resourceAcquisitions.some((row) => row.pending || (row.timedOut && !row.lateClosed)))
      report.cleanup.completed = false;
    if (work && report.cleanup.completed) {
      const removal = await closeFPVObservationResources([
        ['temporary-site', () => rm(work, { recursive: true, force: true })],
      ]);
      report.cleanup.operations.push(...removal.operations);
      report.cleanup.completed &&= removal.completed;
    }
    if (work && !report.cleanup.completed) report.retainedDirectory = work;
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
