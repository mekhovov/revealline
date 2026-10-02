import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readEditionZip } from '../publishing/edition-zip.mjs';
import { validateOptionalPackageAdmission } from '../publishing/optional-package-admission.mjs';
import { startServer, PREVIEW_SECURITY_HEADERS } from './game-cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'optional-practice/civilian-fpv/';
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: digest(bytes) });
const failure = (error) => String(error?.stack ?? error);
const ARTIFACT_FIELDS = [
  'bundle',
  'envelopeSha256',
  'sourceRevision',
  'sourceTree',
  'packageRevision',
];
export const FPV_OBSERVATION_PROTOCOLS = Object.freeze({
  runtime: 'civilian-fpv-runtime.v1',
  retention: 'civilian-fpv-retention.v1',
});
export const FPV_OBSERVATION_LIMITS = Object.freeze({ runtime: 180_000, retention: 600_000 });

/** Artifact identity is shared; each observation still declares its own procedure. */
export function validateFPVArtifactBinding(value) {
  if (
    !value ||
    !['envelopeSha256', 'packageRevision', 'sourceRevision', 'sourceTree'].every(
      (name) => typeof value[name] === 'string',
    ) ||
    !SHA.test(value.envelopeSha256) ||
    !SHA.test(value.packageRevision) ||
    !COMMIT.test(value.sourceRevision) ||
    !COMMIT.test(value.sourceTree) ||
    typeof value.bundle !== 'string' ||
    !value.bundle.trim() ||
    value.bundle.length > 4096
  )
    throw new Error('An exact optional artifact binding is required.');
  return Object.fromEntries(ARTIFACT_FIELDS.map((name) => [name, value[name]]));
}

export function validateFPVObservationPlan(input, kind) {
  if (!Object.hasOwn(FPV_OBSERVATION_PROTOCOLS, kind))
    throw new Error('Unknown FPV observation procedure.');
  const encoded = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 65536)
    throw new Error('Observation plan exceeds 64 KiB.');
  const plan = JSON.parse(encoded),
    fields = ['format', 'caseId', 'protocol', 'deviceLabel', 'quietWindow', ...ARTIFACT_FIELDS];
  if (
    !plan ||
    typeof plan !== 'object' ||
    Array.isArray(plan) ||
    Object.keys(plan).some((key) => !fields.includes(key)) ||
    fields.some((key) => !Object.hasOwn(plan, key)) ||
    plan.format !== `revealline-fpv-${kind}-plan.v1` ||
    plan.protocol !== FPV_OBSERVATION_PROTOCOLS[kind] ||
    typeof plan.caseId !== 'string' ||
    !/^[a-z0-9-]{1,64}$/.test(plan.caseId)
  )
    throw new Error(`Invalid ${kind} observation plan.`);
  validateFPVArtifactBinding(plan);
  for (const [name, limit] of [
    ['deviceLabel', 256],
    ['quietWindow', 2048],
  ])
    if (typeof plan[name] !== 'string' || !plan[name].trim() || plan[name].length > limit)
      throw new Error(`Invalid ${name}.`);
  return plan;
}

/** Reuse release admission for every original envelope member, including source
 * archives and inventories. Extract only the selected runtime; this never grants publication. */
export async function loadFPVObservationArtifact(input, { base = process.cwd() } = {}) {
  const plan = validateFPVArtifactBinding(input);
  const root = await realpath(path.resolve(base, plan.bundle));
  const read = async (name, limit) => {
    const file = await realpath(path.join(root, name)),
      metadata = await stat(file);
    if (!file.startsWith(root + path.sep) || !metadata.isFile() || metadata.size > limit)
      throw new Error('Optional artifact escapes its root or exceeds its bound.');
    const bytes = await readFile(file);
    if (bytes.length > limit) throw new Error('Optional artifact exceeds its bound.');
    return bytes;
  };
  const envelopeBytes = await read('optional-packages.json', 1024 * 1024);
  if (digest(envelopeBytes) !== plan.envelopeSha256)
    throw new Error('Envelope differs from the observation plan.');
  const envelope = JSON.parse(envelopeBytes);
  if (envelope.sourceRevision !== plan.sourceRevision || envelope.sourceTree !== plan.sourceTree)
    throw new Error('Envelope source differs from the observation plan.');
  const originals = new Map();
  const admission = await validateOptionalPackageAdmission(envelope, {
    read: async (descriptor) => {
      if (!originals.has(descriptor.path))
        originals.set(descriptor.path, await read(descriptor.path, descriptor.bytes));
      return originals.get(descriptor.path);
    },
  });
  const selected = envelope.packages.find((item) => item.id === 'civilian-fpv');
  if (!selected || selected.revision !== plan.packageRevision)
    throw new Error('The exact civilian-fpv package is absent.');
  const files = readEditionZip(originals.get(selected.distribution.path));
  return {
    files,
    binding: {
      sourceRevision: envelope.sourceRevision,
      sourceTree: envelope.sourceTree,
      version: envelope.version,
      envelope: pin('optional-packages.json', envelopeBytes),
      package: selected,
      members: [...files].map(([name, bytes]) => pin(name, bytes)),
    },
    admission,
  };
}

export function fpvObservationDeadline(promise, milliseconds, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out.`)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function closeFPVObservationResources(operations) {
  const outcomes = [];
  for (const [name, close] of operations) {
    try {
      await fpvObservationDeadline(Promise.resolve().then(close), 10_000, `Cleanup ${name}`);
      outcomes.push({ name, closed: true });
    } catch (error) {
      outcomes.push({ name, closed: false, error: failure(error) });
    }
  }
  return { completed: outcomes.every((item) => item.closed), operations: outcomes };
}

/** Reserve a new evidence directory before admission. A failed procedure retains
 * its exact plan/authority and still attempts each owned cleanup. */
export async function observeFrozenFPV({
  kind,
  planFile,
  playwrightModule,
  output,
  observerPath,
  authorityPaths = [],
  observe,
}) {
  if (!planFile || !playwrightModule || !output)
    throw new Error('Plan, external Playwright module and new output directory are required.');
  if ((await stat(planFile)).size > 65536) throw new Error('Observation plan exceeds 64 KiB.');
  const planBytes = await readFile(planFile),
    plan = validateFPVObservationPlan(planBytes.toString(), kind);
  await mkdir(output);
  const save = (name, bytes) => writeFile(path.join(output, name), bytes, { flag: 'wx' });
  const json = (name, value) => save(name, JSON.stringify(value, null, 2) + '\n');
  const report = {
    format: kind === 'runtime' ? 'FlightRuntimeObservation.v2' : 'FlightRetentionObservation.v2',
    createdAt: new Date().toISOString(),
    qualification: false,
    qualified: false,
    plan,
    procedureLimitMs: FPV_OBSERVATION_LIMITS[kind],
    procedureComplete: false,
    errors: [],
  };
  const extraCleanup = [];
  let work, served, browser, page;
  const globalName = kind === 'runtime' ? 'flightObservation' : 'flightRetention';
  try {
    await save('plan.json', planBytes);
    await mkdir(path.join(output, 'authority'));
    report.instrumentation = [];
    for (const name of [
      observerPath,
      ...authorityPaths,
      'scripts/fpv-observation-artifact.mjs',
      'scripts/game-cli.mjs',
      'publishing/edition-zip.mjs',
      'publishing/optional-package-admission.mjs',
      'publishing/optional-package-policy.mjs',
      'publishing/edition-admission.mjs',
    ]) {
      const bytes = await readFile(path.join(ROOT, name));
      report.instrumentation.push(pin(name, bytes));
      await save(`authority/${path.basename(name)}`, bytes);
    }
    const { files, binding, admission } = await loadFPVObservationArtifact(plan, {
      base: path.dirname(path.resolve(planFile)),
    });
    report.artifact = binding;
    report.admission = admission;
    report.runtimeRevision = binding.package.revision;
    report.runtimeFiles = binding.members;
    await save('runtime-manifest.json', files.get('optional-package.json'));
    const html = files.get(PREFIX + 'index.html').toString();
    assert.equal((html.match(/data-civilian-fpv="true"/g) ?? []).length, 1);
    assert.equal((html.match(/src="app.mjs"/g) ?? []).length, 1);
    const host = html
      .replace('data-civilian-fpv="true"', 'data-civilian-fpv="false"')
      .replace('src="app.mjs"', `src="${kind}-observer.mjs"`);
    const wrapper = `import {mountFlightApp} from './app.mjs'; globalThis.${globalName}=mountFlightApp();`;
    const instrumentation = new Map([
      [PREFIX + `${kind}-observer.html`, Buffer.from(host)],
      [PREFIX + `${kind}-observer.mjs`, Buffer.from(wrapper)],
    ]);
    assert([...instrumentation.keys()].every((name) => !files.has(name)));
    await save('host.html', host);
    await save('wrapper.mjs', wrapper);
    report.instrumentation.push(
      pin('host.html', Buffer.from(host)),
      pin('wrapper.mjs', Buffer.from(wrapper)),
    );
    work = await mkdtemp(path.join(tmpdir(), `fpv-${kind}-observation-`));
    for (const [name, bytes] of [...files, ...instrumentation]) {
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
    served = await startServer({ root: work, port: 0 });
    report.servedMembers = [];
    for (const [name, bytes] of files) {
      const response = await fetch(new URL(name, served.url), {
        signal: AbortSignal.timeout(10_000),
      });
      const actual = Buffer.from(await response.arrayBuffer());
      assert(response.ok, `Served member unavailable: ${name}`);
      assert.equal(actual.length, bytes.length, `Served member length differs: ${name}`);
      assert.equal(digest(actual), digest(bytes), `Served member bytes differ: ${name}`);
      report.servedMembers.push(pin(name, actual));
    }
    const modulePath = path.resolve(playwrightModule),
      moduleBytes = await readFile(modulePath);
    report.playwrightModule = pin('external-playwright-module', moduleBytes);
    const { chromium } = await import(pathToFileURL(modulePath).href);
    browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000 });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    page.on('pageerror', (error) => report.errors.push(error.message));
    const response = await page.goto(new URL(PREFIX + `${kind}-observer.html`, served.url).href);
    report.headers = await response.allHeaders();
    for (const [key, value] of Object.entries(PREVIEW_SECURITY_HEADERS))
      assert.equal(report.headers[key.toLowerCase()], value);
    report.serverPolicy = 'Existing packaged-preview headers; not a deployed public origin.';
    report.browser = browser.version();
    report.viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
    await page.waitForFunction((name) => Boolean(globalThis[name]), globalName);
    await fpvObservationDeadline(
      page.evaluate((name) => globalThis[name].settled(), globalName),
      15_000,
      'Application mount',
    );
    await fpvObservationDeadline(
      Promise.resolve().then(() =>
        observe({ page, browser, output, report, save, json, extraCleanup }),
      ),
      FPV_OBSERVATION_LIMITS[kind],
      `${kind} observation procedure`,
    );
  } catch (error) {
    report.failure = failure(error);
  } finally {
    report.cleanup = await closeFPVObservationResources([
      ...extraCleanup,
      ...(page
        ? [['app', () => page.evaluate((name) => globalThis[name]?.dispose(), globalName)]]
        : []),
      ...(browser ? [['browser', () => browser.close()]] : []),
      ...(served
        ? [
            [
              'server',
              () =>
                new Promise((resolve, reject) => {
                  served.server.close((error) => (error ? reject(error) : resolve()));
                  served.server.closeAllConnections?.();
                }),
            ],
          ]
        : []),
      ...(work ? [['temporary-site', () => rm(work, { recursive: true, force: true })]] : []),
    ]);
    report.completed =
      report.procedureComplete &&
      !report.failure &&
      report.cleanup.completed &&
      report.errors.length === 0;
    if (kind === 'runtime') report.passed = report.completed;
    await json('observation.json', report);
  }
  return report;
}
