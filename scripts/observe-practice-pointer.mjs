import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, PREVIEW_SECURITY_HEADERS } from './game-cli.mjs';
import {
  validateFPVArtifactBinding,
  loadFPVObservationArtifact,
  fpvObservationDeadline as deadline,
  closeFPVObservationResources,
} from './fpv-observation-artifact.mjs';
import { unlockObservedPage } from './optional-installation-observer-helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'optional-practice/civilian-fpv/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) });
export const PRACTICE_POINTER_PROTOCOL = Object.freeze({
  id: 'civilian-fpv-first-pointer.v1',
  limitMs: 600_000,
  actionMs: 8000,
  viewport: Object.freeze({ width: 1440, height: 900 }),
  targets: Object.freeze(['workshop', 'profile', 'proof']),
});
const AUTHORITY = [
  'scripts/observe-practice-pointer.mjs',
  'scripts/fpv-observation-artifact.mjs',
  'scripts/optional-installation-observer-helpers.mjs',
  'scripts/game-cli.mjs',
  'publishing/optional-package-admission.mjs',
  'publishing/optional-package-policy.mjs',
  'publishing/edition-zip.mjs',
];

// A timeout does not cancel an allocation promise. Close late arrivals and keep
// pending ownership explicit rather than claiming a timed-out resource vanished.
export async function acquirePointerResource(records, name, create, close, timeoutMs = 10_000) {
  const record = { name, pending: true, timedOut: false, lateClosed: false };
  records.push(record);
  let abandoned = false;
  const operation = Promise.resolve()
    .then(create)
    .then(async (resource) => {
      if (abandoned) {
        try {
          await close(resource);
          record.lateClosed = true;
        } catch (error) {
          record.lateCloseError = String(error.message).slice(0, 1000);
        }
        throw new Error(`Late ${name} allocation was not adopted; see cleanup evidence.`);
      }
      return resource;
    })
    .finally(() => {
      record.pending = false;
    });
  try {
    return await deadline(operation, timeoutMs, name);
  } catch (error) {
    abandoned = true;
    record.timedOut = record.pending;
    throw error;
  }
}

const closeServer = (served) =>
  new Promise((resolve, reject) => {
    served.server.close((error) => (error ? reject(error) : resolve()));
    served.server.closeAllConnections?.();
  });

export function validatePracticePointerPlan(input) {
  const encoded = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 65536)
    throw new Error('Pointer plan exceeds 64 KiB.');
  const plan = JSON.parse(encoded);
  const fields = [
    'format',
    'protocol',
    'caseId',
    'deviceLabel',
    'quietWindow',
    'locales',
    'bundle',
    'envelopeSha256',
    'sourceRevision',
    'sourceTree',
    'packageRevision',
  ];
  if (
    !plan ||
    Array.isArray(plan) ||
    typeof plan !== 'object' ||
    Object.keys(plan).some((key) => !fields.includes(key)) ||
    fields.some((key) => !Object.hasOwn(plan, key)) ||
    plan.format !== 'revealline-practice-pointer-plan.v1' ||
    plan.protocol !== PRACTICE_POINTER_PROTOCOL.id ||
    typeof plan.caseId !== 'string' ||
    !/^[a-z0-9-]{1,64}$/.test(plan.caseId) ||
    !Array.isArray(plan.locales) ||
    !plan.locales.length ||
    plan.locales.length > 2 ||
    new Set(plan.locales).size !== plan.locales.length ||
    plan.locales.some((locale) => !['en', 'uk'].includes(locale))
  )
    throw new Error('Invalid pointer observation plan.');
  validateFPVArtifactBinding(plan);
  for (const [name, limit] of [
    ['deviceLabel', 256],
    ['quietWindow', 2048],
  ])
    if (typeof plan[name] !== 'string' || !plan[name].trim() || plan[name].length > limit)
      throw new Error(`Invalid ${name}.`);
  return plan;
}

export function practicePointerCases(locales) {
  return locales.flatMap((locale) =>
    ['pointer', 'keyboard'].flatMap((modality) =>
      ['fresh', 'reload'].flatMap((visit) =>
        PRACTICE_POINTER_PROTOCOL.targets.map((target) => ({
          id: `${locale}-${modality}-${visit}-${target}`,
          locale,
          modality,
          visit,
          target,
        })),
      ),
    ),
  );
}

// Installed only after normal authentication. Event listeners observe targets and
// geometry; they neither cancel events nor change focus, DOM, styles or app state.
export function installPointerWitness() {
  const doc = globalThis.document;
  const identify = (node) => {
    const element = node?.closest?.('button,summary,a,input,textarea,select') ?? node;
    if (!element?.getBoundingClientRect) return null;
    const r = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      id: element.id || null,
      copy: element.getAttribute('data-sim-copy'),
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  };
  const state = () => ({
    documentFocused: doc.hasFocus(),
    visibility: doc.visibilityState,
    hint: identify(doc.querySelector('#academy-menu-hint')),
    hintTextLength: doc.querySelector('#academy-menu-hint')?.textContent.length ?? 0,
  });
  const witness = { events: [], dropped: 0, intended: null, identify, state };
  witness.listener = (event) => {
    if (witness.events.length >= 32) {
      witness.dropped++;
      return;
    }
    witness.events.push({
      type: event.type,
      target: identify(event.target),
      intended: identify(witness.intended),
      focused: identify(doc.activeElement),
      x: event.clientX ?? null,
      y: event.clientY ?? null,
      trusted: event.isTrusted,
      ...state(),
    });
  };
  for (const type of ['pointerdown', 'pointerup', 'click', 'focusin'])
    doc.addEventListener(type, witness.listener, { capture: true, passive: true });
  globalThis.__practicePointerWitness = witness;
}

export async function activatePracticeTarget(
  page,
  locator,
  modality,
  action,
  beforePress = () => {},
) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((node) => {
    const w = globalThis.__practicePointerWitness;
    w.intended = node;
    w.events = [];
    w.dropped = 0;
  });
  action.before = await locator.evaluate((node) => {
    const w = globalThis.__practicePointerWitness;
    return {
      target: w.identify(node),
      focused: w.identify(globalThis.document.activeElement),
      ...w.state(),
    };
  });
  if (modality === 'pointer') {
    const rect = await locator.boundingBox();
    assert(rect && rect.width > 0 && rect.height > 0, 'Target has no pointer area.');
    action.coordinate = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    // One ordinary pointer press. Never focus first, force a locator click,
    // reposition between down/up, or silently retry after a missed first click.
    await page.mouse.move(action.coordinate.x, action.coordinate.y);
    beforePress();
    await page.mouse.down();
    await page.mouse.up();
  } else {
    assert.equal(modality, 'keyboard');
    let tabs = 0;
    while (!(await locator.evaluate((node) => node === globalThis.document.activeElement))) {
      if (tabs++ >= 160) throw new Error('Target not reachable within 160 Tab presses.');
      await page.keyboard.press('Tab');
    }
    action.tabs = tabs;
    beforePress();
    await page.keyboard.press('Enter');
  }
}

async function collectWitness(page, locator, action) {
  action.after = await locator.evaluate((node) => {
    const w = globalThis.__practicePointerWitness;
    return {
      target: w.identify(node),
      focused: w.identify(globalThis.document.activeElement),
      ...w.state(),
    };
  });
  Object.assign(
    action,
    await page.evaluate(() => {
      const w = globalThis.__practicePointerWitness;
      return { events: w.events, droppedEvents: w.dropped };
    }),
  );
}

export function validatePointerExport(bytes, kind) {
  const limit = kind === 'profile' ? 65536 : 1024 * 1024 + 2048;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > limit)
    throw new Error('Export is empty or exceeds its byte bound.');
  const parsed = JSON.parse(bytes);
  if (kind === 'profile')
    assert(
      ['FlightProfiles.v1', 'FlightProfiles.v2'].includes(parsed.format),
      'Unexpected profile export.',
    );
  else {
    assert.equal(kind, 'proof');
    assert.equal(parsed.format, 'FlightProofBackup.v1', 'Unexpected proof backup.');
    assert.deepEqual(parsed.attempts, [], 'A pristine context must export an empty proof backup.');
  }
  return { bytes: bytes.length, sha256: hash(bytes), format: parsed.format };
}

async function navigateSettings(page, target) {
  // Setup uses public keyboard activation, independently of the measured action.
  // This protocol qualifies target activation, not full-menu keyboard navigation.
  await page.locator('#academy-shell-action-settings').press('Enter');
  const category = target === 'profile' ? 'controls' : target === 'proof' ? 'data' : 'extras';
  const button =
    target === 'profile' ? '#setup' : target === 'proof' ? '#notebook-button' : '#help';
  const dialog =
    target === 'profile'
      ? '#setup-dialog'
      : target === 'proof'
        ? '#notebook-dialog'
        : '#help-dialog';
  await page.locator(`#academy-settings-tab-${category}`).press('Enter');
  await page.locator(button).press('Enter');
  await page.locator(dialog).waitFor({ state: 'visible' });
}

export async function runPracticePointerCase(
  page,
  spec,
  { url, password, output, result = { ...spec, passed: false, actions: [], errors: [] } },
) {
  const onError = (error) => result.errors.push(String(error.message).slice(0, 1000));
  page.on('pageerror', onError);
  let unlocked = false;
  try {
    const response = await page.goto(`${url}?lang=${spec.locale}`);
    assert(response?.ok(), 'Original package entry failed to load.');
    await unlockObservedPage(page, password);
    unlocked = true;
    await page.locator('#academy-shell-action-settings').waitFor({ state: 'visible' });
    if (spec.visit === 'reload') {
      await page.reload();
      await unlockObservedPage(page, password);
      await page.locator('#academy-shell-action-settings').waitFor({ state: 'visible' });
    }
    assert.equal(await page.locator('html').getAttribute('lang'), spec.locale);
    await navigateSettings(page, spec.target);
    await page.evaluate(installPointerWitness);
    const action = async (name, locator, verify, beforePress) => {
      const row = { name, passed: false };
      result.actions.push(row);
      try {
        await activatePracticeTarget(page, locator, spec.modality, row, beforePress);
        await verify(row);
        row.passed = true;
      } finally {
        await collectWitness(page, locator, row);
      }
    };
    const disclosure = async (name, locator, visible) => {
      assert.equal(
        await locator.locator('..').getAttribute('open'),
        null,
        'Disclosure must start closed.',
      );
      await action(name, locator, async () => {
        await page.waitForFunction(
          (selector) => globalThis.document.querySelector(selector)?.parentElement.open,
          name === 'workshop-summary'
            ? 'summary[data-sim-copy="workshopAndOffline"]'
            : '.radio-extra-transfer > summary',
          { timeout: PRACTICE_POINTER_PROTOCOL.actionMs },
        );
        await visible.waitFor({ state: 'visible' });
      });
    };
    if (spec.target === 'workshop') {
      await disclosure(
        'workshop-summary',
        page.locator('summary[data-sim-copy="workshopAndOffline"]'),
        page.locator('#install-offline'),
      );
    } else if (spec.target === 'profile') {
      const textarea = page.locator('#setup-dialog .radio-extra-transfer textarea');
      await disclosure(
        'profile-summary',
        page.locator('#setup-dialog .radio-extra-transfer > summary'),
        textarea,
      );
      assert.equal(
        await textarea.inputValue(),
        '',
        'Profile export must begin with an empty textarea.',
      );
      await action(
        'profile-export',
        page.getByRole('button', {
          name: spec.locale === 'uk' ? 'Експорт профілів' : 'Export profiles',
          exact: true,
        }),
        async (row) => {
          await page.waitForFunction(
            () =>
              !!globalThis.document.querySelector('#setup-dialog .radio-extra-transfer textarea')
                ?.value,
            null,
            { timeout: PRACTICE_POINTER_PROTOCOL.actionMs },
          );
          row.export = validatePointerExport(Buffer.from(await textarea.inputValue()), 'profile');
        },
      );
    } else {
      const textarea = page.getByRole('textbox', {
        name: spec.locale === 'uk' ? 'Резервна копія спроб у JSON' : 'Flight proof backup JSON',
        exact: true,
      });
      assert.equal(await textarea.inputValue(), '', 'Proof backup must begin empty.');
      await action(
        'proof-export',
        page.getByRole('button', {
          name:
            spec.locale === 'uk'
              ? 'Експортувати перевірені спроби'
              : 'Export verified flight proofs',
          exact: true,
        }),
        async (row) => {
          await page.waitForFunction(
            () => !!globalThis.document.querySelector('#notebook-dialog textarea')?.value,
            null,
            { timeout: PRACTICE_POINTER_PROTOCOL.actionMs },
          );
          row.export = validatePointerExport(Buffer.from(await textarea.inputValue()), 'proof');
        },
      );
    }
    result.passed = result.errors.length === 0;
  } catch (error) {
    result.failure = String(error.message).slice(0, 2000);
    if (unlocked) {
      try {
        const filename = `${spec.id}-failure.png`;
        const bytes = await page.screenshot({ timeout: 5000, animations: 'allow' });
        await writeFile(path.join(output, filename), bytes, { flag: 'wx' });
        result.screenshot = pin(filename, bytes);
      } catch {
        result.screenshotFailure = 'Failure screenshot unavailable.';
      }
    }
  } finally {
    page.off('pageerror', onError);
  }
  return result;
}

export async function observePracticePointer({
  planFile,
  playwrightModule,
  output,
  password = process.env.OPTIONAL_INSTALLATION_PASSWORD,
} = {}) {
  if (!planFile || !playwrightModule || !output)
    throw new Error('Plan, Playwright module and new output required.');
  if ((await stat(planFile)).size > 65536) throw new Error('Pointer plan exceeds 64 KiB.');
  const planBytes = await readFile(planFile),
    plan = validatePracticePointerPlan(planBytes.toString());
  await mkdir(output);
  const report = {
    format: 'PracticePointerObservation.v1',
    createdAt: new Date().toISOString(),
    plan,
    qualified: false,
    qualification: false,
    completed: false,
    procedureComplete: false,
    protocol: PRACTICE_POINTER_PROTOCOL,
    cases: [],
    authority: [],
    resourceAcquisitions: [],
    limitations: [
      'Automation-generated mouse/keyboard events are not human or physical-device qualification.',
      'Setup navigation uses public keyboard activation; target keyboard cases use Tab then Enter.',
      'Each case gets a fresh browser context; reload cases reload once before any target action.',
      'No flight is completed or proof imported; export checks only confirm an ordinary bounded export.',
      'Local original-package serving is not public hosting, installation or offline qualification.',
      'Fresh/reload cases do not deliberately blur the window; focus and hint geometry are observed, not forced.',
    ],
  };
  let work, served, browser;
  const scrub = (value) =>
    password ? String(value).split(password).join('[REDACTED]') : String(value);
  try {
    await writeFile(path.join(output, 'plan.json'), planBytes, { flag: 'wx' });
    await mkdir(path.join(output, 'authority'));
    for (const name of AUTHORITY) {
      const bytes = await readFile(path.join(ROOT, name));
      report.authority.push(pin(name, bytes));
      await writeFile(path.join(output, 'authority', path.basename(name)), bytes, { flag: 'wx' });
    }
    const { files, binding, admission } = await deadline(
      loadFPVObservationArtifact(plan, { base: path.dirname(path.resolve(planFile)) }),
      60_000,
      'Artifact admission',
    );
    report.artifact = binding;
    report.admission = admission;
    work = await mkdtemp(path.join(tmpdir(), 'practice-pointer-'));
    for (const [name, bytes] of files) {
      const target = path.resolve(work, name);
      assert(target.startsWith(work + path.sep));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
    }
    await writeFile(
      path.join(work, '.xonix-build.json'),
      JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }),
      { flag: 'wx' },
    );
    served = await acquirePointerResource(
      report.resourceAcquisitions,
      'server',
      () => startServer({ root: work, port: 0 }),
      closeServer,
    );
    report.servedMembers = [];
    for (const [name, bytes] of files) {
      const response = await fetch(new URL(name, served.url), {
        signal: AbortSignal.timeout(10_000),
      });
      assert(response.ok);
      for (const [key, value] of Object.entries(PREVIEW_SECURITY_HEADERS))
        assert.equal(response.headers.get(key), value);
      const actual = Buffer.from(await response.arrayBuffer());
      assert.equal(hash(actual), hash(bytes), `Served bytes differ: ${name}`);
      report.servedMembers.push(pin(name, actual));
    }
    const modulePath = path.resolve(playwrightModule);
    report.playwrightModule = pin('external-playwright-module', await readFile(modulePath));
    const { chromium } = await import(pathToFileURL(modulePath).href);
    browser = await acquirePointerResource(
      report.resourceAcquisitions,
      'browser',
      () => chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000 }),
      (owned) => owned.close(),
      35_000,
    );
    report.browser = browser.version();
    const end = Date.now() + PRACTICE_POINTER_PROTOCOL.limitMs;
    for (const spec of practicePointerCases(plan.locales)) {
      assert(Date.now() < end, 'Pointer procedure overall deadline exceeded.');
      const context = await acquirePointerResource(
        report.resourceAcquisitions,
        `${spec.id}-context`,
        () =>
          browser.newContext({
            viewport: PRACTICE_POINTER_PROTOCOL.viewport,
            deviceScaleFactor: 1,
            locale: spec.locale === 'uk' ? 'uk-UA' : 'en-US',
            acceptDownloads: true,
          }),
        (owned) => owned.close(),
      );
      const result = { ...spec, passed: false, actions: [], errors: [] };
      report.cases.push(result);
      let caseWork;
      try {
        const page = await acquirePointerResource(
          report.resourceAcquisitions,
          `${spec.id}-page`,
          () => context.newPage(),
          (owned) => owned.close(),
        );
        page.setDefaultTimeout(PRACTICE_POINTER_PROTOCOL.actionMs);
        page.setDefaultNavigationTimeout(30_000);
        caseWork = runPracticePointerCase(page, spec, {
          url: new URL(PREFIX + 'index.html', served.url).href,
          password,
          output,
          result,
        });
        await deadline(
          caseWork,
          Math.min(60_000, Math.max(1, end - Date.now())),
          `Case ${spec.id}`,
        );
        if (
          result.failure?.includes('requires a password') ||
          result.failure?.includes('access form')
        )
          throw new Error('Normal authorized access failed; remaining cases were not attempted.');
      } catch (error) {
        result.passed = false;
        result.procedureFailure = scrub(error.message);
        throw error;
      } finally {
        await deadline(context.close(), 10_000, 'Case context cleanup');
        if (caseWork) await deadline(caseWork, 10_000, 'Case termination');
        await writeFile(
          path.join(output, `${spec.id}.json`),
          scrub(JSON.stringify(result, null, 2)) + '\n',
          { flag: 'wx' },
        );
      }
    }
    report.procedureComplete = true;
    for (const item of report.authority)
      assert.equal(
        hash(await readFile(path.join(ROOT, item.path))),
        item.sha256,
        'Observer authority changed during observation.',
      );
  } catch (error) {
    report.failure = scrub(error.message);
  } finally {
    report.cleanup = await closeFPVObservationResources([
      ...(browser ? [['browser', () => browser.close()]] : []),
      ...(served ? [['server', () => closeServer(served)]] : []),
      ...(work ? [['temporary-site', () => rm(work, { recursive: true, force: true })]] : []),
    ]);
    if (
      report.resourceAcquisitions.some((row) => row.pending || (row.timedOut && !row.lateClosed))
    ) {
      report.cleanup.completed = false;
      report.cleanup.pendingAcquisitions = report.resourceAcquisitions
        .filter((row) => row.pending || (row.timedOut && !row.lateClosed))
        .map((row) => row.name);
    }
    report.completed =
      report.procedureComplete &&
      !report.failure &&
      report.cleanup.completed &&
      report.cases.every((row) => row.passed);
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
  if (extra.length)
    throw new Error(
      'Usage: node scripts/observe-practice-pointer.mjs PLAN PLAYWRIGHT_MODULE NEW_OUTPUT',
    );
  const report = await observePracticePointer({ planFile, playwrightModule, output });
  console.log(
    JSON.stringify({ completed: report.completed, cases: report.cases.length, qualified: false }),
  );
  if (!report.completed) process.exitCode = 1;
}
