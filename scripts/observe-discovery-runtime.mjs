import { readFile, writeFile, mkdir, stat, open } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectEditionZip } from '../publishing/edition-zip.mjs';
import { runDiscoveryCycles } from './observe-discovery-cycles.mjs';
import { PREVIEW_SECURITY_HEADERS } from './game-cli.mjs';

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40,64}$/;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new Error(message);
};
const text = (value, limit = 256) =>
  typeof value === 'string' && value.trim() && value.length <= limit;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OBSERVER = 'docs/verification/discovery-observer.mjs';
const REVIEW_MODEL = 'docs/verification/company-review-model.mjs';
const TIMELINE =
  'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing';
const CPU = `${TIMELINE},disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.stack,v8.execute,disabled-by-default-v8.cpu_profiler,disabled-by-default-v8.cpu_profiler.hires,disabled-by-default-v8.runtime_stats,blink,latencyInfo,renderer.scheduler`;
const MODES = ['timings', 'timeline', 'cpu'];
const PROTOCOL = Object.freeze({
  id: 'fpv-frame-first-win.v1',
  editionId: 'fpv-learning',
  missionId: 'fpv-meet-aircraft-01',
  gameplayId: '7feffc97157784af',
  rewardPath: 'game/content/company-campaigns/fpv-meet-aircraft.rewards.json',
  route: [
    ['ArrowDown', 1800],
    ['ArrowDown', 3200],
    ['ArrowRight', 1400],
    ['ArrowUp', 6000],
  ],
});

function keys(value, allowed, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    fail(`Invalid ${label}.`);
}
export function validateDiscoveryRuntimePlan(input) {
  const encoded = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 65536)
    fail('Plan exceeds 64 KiB.');
  const plan = JSON.parse(encoded);
  keys(
    plan,
    [
      'format',
      'caseId',
      'protocol',
      'deviceLabel',
      'quietWindow',
      'mode',
      'cycles',
      'serverPort',
      'headerPolicy',
      'artifact',
    ],
    'observation plan',
  );
  if (
    plan.format !== 'revealline-discovery-runtime-plan.v1' ||
    !/^[a-z0-9-]{1,64}$/.test(plan.caseId ?? '') ||
    plan.protocol !== PROTOCOL.id ||
    !text(plan.deviceLabel) ||
    !text(plan.quietWindow, 2048) ||
    !MODES.includes(plan.mode) ||
    ![0, 20].includes(plan.cycles) ||
    (plan.headerPolicy !== undefined &&
      !['minimal', 'packaged-preview'].includes(plan.headerPolicy)) ||
    (plan.serverPort !== undefined &&
      (!Number.isInteger(plan.serverPort) || plan.serverPort < 0 || plan.serverPort > 65535))
  )
    fail('Use an explicit reviewed protocol, mode, quiet-window statement and zero or 20 cycles.');
  keys(
    plan.artifact,
    [
      'archive',
      'archiveSha256',
      'manifest',
      'manifestSha256',
      'sourceRevision',
      'sourceTree',
      'editionId',
    ],
    'artifact',
  );
  for (const field of ['archive', 'manifest'])
    if (!text(plan.artifact[field], 4096)) fail(`Missing ${field} path.`);
  for (const field of ['archiveSha256', 'manifestSha256'])
    if (!SHA.test(plan.artifact[field])) fail(`Missing exact ${field}.`);
  if (
    !COMMIT.test(plan.artifact.sourceRevision) ||
    !COMMIT.test(plan.artifact.sourceTree) ||
    plan.artifact.editionId !== PROTOCOL.editionId
  )
    fail('Missing exact supported edition/source binding.');
  return plan;
}

/** Exact playable-byte verification only; this does not replace release/source admission. */
export function verifyDiscoveryRuntimeArtifact(planInput, { archive, manifest: manifestBytes }) {
  const plan = validateDiscoveryRuntimePlan(planInput),
    wanted = plan.artifact;
  if (
    !(archive instanceof Uint8Array) ||
    archive.byteLength > 256 * 1024 * 1024 ||
    !(manifestBytes instanceof Uint8Array) ||
    manifestBytes.byteLength > 8 * 1024 * 1024 ||
    digest(archive) !== wanted.archiveSha256 ||
    digest(manifestBytes) !== wanted.manifestSha256
  )
    fail('Artifact original bytes differ or exceed the observation budget.');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  if (
    manifest.format !== 'revealline-edition-manifest.v1' ||
    manifest.editionId !== wanted.editionId ||
    manifest.sourceRevision !== wanted.sourceRevision ||
    manifest.sourceTree !== wanted.sourceTree ||
    manifest.entry !== 'game/company.html' ||
    !SHA.test(manifest.contentSha256) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length < 1 ||
    manifest.files.length > 2000 ||
    !Number.isSafeInteger(manifest.totalBytes) ||
    manifest.totalBytes < 1 ||
    manifest.files.reduce((sum, item) => sum + item.bytes, 0) !== manifest.totalBytes
  )
    fail('Manifest source or inventory differs.');
  const files = inspectEditionZip(archive, [
    ...manifest.files,
    {
      path: 'manifest.json',
      bytes: manifestBytes.byteLength,
      sha256: wanted.manifestSha256,
    },
  ]);
  if (
    digest(files.get('edition-catalog.json') ?? new Uint8Array()) !== manifest.contentSha256 ||
    !files.has('game/index.html') ||
    !files.has('game/app.mjs')
  )
    fail('Missing selected playable closure.');
  const rewards = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(files.get(PROTOCOL.rewardPath)),
  );
  const definition = rewards.find(
    (item) => item.scope?.kind === 'mission' && item.scope.id === PROTOCOL.missionId,
  );
  if (
    !definition?.requirements?.missions?.some(
      (mission) =>
        mission.missionId === PROTOCOL.missionId &&
        mission.bindings?.some(
          (binding) =>
            binding.gameplayId === PROTOCOL.gameplayId && binding.difficulty === 'standard',
        ),
    )
  )
    fail(
      'The reviewed gameplay binding is absent; review a new protocol instead of relabelling it.',
    );
  return {
    plan,
    files,
    manifest,
    identity: {
      sourceRevision: wanted.sourceRevision,
      sourceTree: wanted.sourceTree,
      editionId: wanted.editionId,
      distribution: { sha256: wanted.archiveSha256, bytes: archive.byteLength },
      manifest: { sha256: wanted.manifestSha256, bytes: manifestBytes.byteLength },
      runtimeFiles: files.size,
      runtimeBytes: [...files.values()].reduce((sum, item) => sum + item.byteLength, 0),
      contentSha256: manifest.contentSha256,
      gameplayId: PROTOCOL.gameplayId,
      gameplayBindingAuthority:
        'Exact admitted authored reward requirement, not an independent engine recomputation.',
    },
  };
}

/** Serves only verified members and separately pinned passive instrumentation. */
export async function serveDiscoveryRuntime(
  files,
  observer,
  { port = 0, reviewModel, headerPolicy = 'minimal' } = {},
) {
  if (!['minimal', 'packaged-preview'].includes(headerPolicy))
    fail('Unknown observation header policy.');
  const headers = Object.freeze(
    headerPolicy === 'packaged-preview'
      ? { ...PREVIEW_SECURITY_HEADERS }
      : { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  );
  const owned = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  if (owned.has(OBSERVER) || owned.has(REVIEW_MODEL))
    fail('Player archive collides with observation instrumentation.');
  if (!(reviewModel instanceof Uint8Array)) fail('Missing pinned passive observer dependency.');
  owned.set(OBSERVER, Buffer.from(observer));
  owned.set(REVIEW_MODEL, Buffer.from(reviewModel));
  const mime = {
    '.mjs': 'text/javascript',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.vtt': 'text/vtt',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
  };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost'),
      name = url.pathname.slice(1),
      bytes = owned.get(name);
    if (!['GET', 'HEAD'].includes(request.method) || !bytes) {
      response.writeHead(404, headers);
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[path.extname(name)] ?? 'application/octet-stream',
      'Content-Length': bytes.length,
      ...headers,
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    headers,
    headerPolicy,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function readBounded(file, limit) {
  const metadata = await stat(file);
  if (!metadata.isFile() || metadata.size > limit)
    fail('Input file exceeds its observation budget.');
  const bytes = await readFile(file);
  if (bytes.length > limit) fail('Input grew beyond its observation budget.');
  return bytes;
}

async function cleanupDeadline(action, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`Observation cleanup ${label} timed out after ${timeoutMs} ms.`);
          error.code = 'DISCOVERY_CLEANUP_TIMEOUT';
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Failure diagnostics are optional evidence, never a reason to skip owned
 * resource cleanup. Keep already-written or partial artifacts unchanged. */
export async function recordDiscoveryFailureEvidence({
  page,
  save,
  screenshot,
  stopTrace,
  failure,
  timeoutMs = 10_000,
}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
    throw new TypeError('Diagnostic timeout must be an integer from 1 to 60000 ms.');
  const failures = [];
  for (const [name, action] of [
    ['failure.json', () => save('failure.json', failure)],
    ...(page
      ? [
          [
            'security-policy-on-failure.json',
            async () =>
              save(
                'security-policy-on-failure.json',
                await page.evaluate(() => globalThis.__discoveryPolicy ?? null),
              ),
          ],
          ['failure.png', () => screenshot('failure')],
          [
            'observer-on-failure.json',
            async () =>
              save(
                'observer-on-failure.json',
                await page.evaluate(() => globalThis.discoveryObservation?.exportReport() ?? null),
              ),
          ],
          [
            'win-on-failure.json',
            async () =>
              save(
                'win-on-failure.json',
                await page.evaluate(() => globalThis.__discoveryFirstWin ?? null),
              ),
          ],
        ]
      : []),
    ['trace-on-failure', stopTrace],
  ]) {
    try {
      await cleanupDeadline(action, timeoutMs, `diagnostic ${name}`);
    } catch (error) {
      failures.push({
        name,
        timedOut: error.code === 'DISCOVERY_CLEANUP_TIMEOUT',
        error: error.stack ?? String(error),
      });
    }
  }
  return failures;
}

/** A timed-out close is not cancelled or presumed successful. Continue releasing
 * the other owners and preserve failure evidence before returning to the caller. */
export async function finishDiscoveryObservation({
  page,
  cdp,
  browser,
  server,
  save,
  complete,
  error,
  diagnosticFailures = [],
  cleanupTimeoutMs = 10_000,
}) {
  if (!Number.isInteger(cleanupTimeoutMs) || cleanupTimeoutMs < 1 || cleanupTimeoutMs > 60_000)
    throw new TypeError('Cleanup timeout must be an integer from 1 to 60000 ms.');
  const cleanup = {
    qualified: false,
    completed: false,
    primaryError: error?.stack ?? null,
    operations: [],
    journalFailures: [],
    diagnosticFailures: [...diagnosticFailures],
  };
  const failures = diagnosticFailures.map((failure) => new Error(failure.error));
  const record = async (name, value) => {
    try {
      await cleanupDeadline(() => save(name, value), cleanupTimeoutMs, `save ${name}`);
    } catch (failure) {
      failures.push(failure);
      cleanup.journalFailures.push({ name, error: failure.stack ?? String(failure) });
      cleanup.completed = false;
    }
  };
  for (const [name, owner, close] of [
    [
      'observer',
      page,
      () =>
        page.evaluate(() => {
          globalThis.discoveryObservation?.dispose();
          globalThis.__discoveryWinCleanup?.();
        }),
    ],
    ['cdp', cdp, () => cdp.detach()],
    ['browser', browser, () => browser.close()],
    ['server', server, () => server.close()],
  ]) {
    const outcome = {
      name,
      requested: Boolean(owner),
      closed: false,
      timedOut: false,
      error: null,
    };
    if (owner) {
      await record(`cleanup-${name}-start.json`, {
        qualified: false,
        phase: 'started',
        name,
        timeoutMs: cleanupTimeoutMs,
      });
      try {
        await cleanupDeadline(close, cleanupTimeoutMs, name);
        outcome.closed = true;
      } catch (failure) {
        outcome.timedOut = failure.code === 'DISCOVERY_CLEANUP_TIMEOUT';
        outcome.error = failure.stack ?? String(failure);
        failures.push(failure);
      }
      await record(`cleanup-${name}-outcome.json`, {
        qualified: false,
        phase: 'settled',
        ...outcome,
      });
    }
    cleanup.operations.push(Object.freeze(outcome));
  }
  cleanup.completed = failures.length === 0;
  await record('cleanup.json', {
    ...cleanup,
    operations: [...cleanup.operations],
    journalFailures: [...cleanup.journalFailures],
  });
  if (error) throw error; // Retain the original failure; cleanup has its own exact outcomes.
  if (failures.length) {
    let failure = new AggregateError(
      failures,
      'Observation cleanup failed; completion was not recorded.',
    );
    const recordedFailures = failures.length;
    await record('failure.json', { ...complete, completed: false, error: failure.stack, cleanup });
    if (failures.length !== recordedFailures)
      failure = new AggregateError(failures, failure.message);
    throw failure;
  }
  await save('complete.json', { ...complete, cleanup });
}

/** External Playwright is an explicit validation dependency, never a game dependency. */
export async function observeDiscoveryRuntime({
  planFile,
  playwrightModule,
  output,
  cleanupTimeoutMs = 10_000,
}) {
  if (!Number.isInteger(cleanupTimeoutMs) || cleanupTimeoutMs < 1 || cleanupTimeoutMs > 60_000)
    throw new TypeError('Cleanup timeout must be an integer from 1 to 60000 ms.');
  const plan = validateDiscoveryRuntimePlan(
    await readBounded(planFile, 65536).then((b) => b.toString('utf8')),
  );
  await mkdir(output, { recursive: false }); // Never overwrite an earlier attempt.
  const save = (name, value) =>
    writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const events = [],
    errors = [];
  let browser,
    page,
    server,
    cdp,
    tracing = false,
    identity = null,
    completion = null,
    primaryError = null,
    diagnosticFailures = [];
  const screenshot = (name) => page.screenshot({ path: path.join(output, `${name}.png`) });
  const record = async (label) => {
    const state = await page.evaluate(() => {
      const doc = globalThis.document,
        $ = (id) => doc.getElementById(id);
      return {
        body: { ...doc.body.dataset },
        boot: doc.documentElement.dataset.bootState,
        locale: doc.documentElement.lang,
        viewport: {
          width: globalThis.innerWidth,
          height: globalThis.innerHeight,
          dpr: globalThis.devicePixelRatio,
        },
        overlay: { kind: $('game-overlay')?.dataset.kind, hidden: $('game-overlay')?.hidden },
        openDialogs: [...doc.querySelectorAll('dialog[open]')].map((node) => node.id),
        coverage: $('coverage')?.textContent,
        time: $('time')?.textContent,
        selection: Object.fromEntries(
          [
            'difficulty-select',
            'turn-select',
            'class-select',
            'level-select',
            'campaign-select',
            'body-select',
            'theme-select',
            'terrain-select',
          ].map((id) => [
            id,
            { value: $(id)?.value, label: $(id)?.selectedOptions?.[0]?.textContent },
          ]),
        ),
        muted: $('shell-sound')?.getAttribute('aria-pressed'),
        grid: $('settings-grid')?.checked,
        reactions: $('journey-reactions-enabled')?.checked,
        focus: doc.hasFocus(),
        visibility: doc.visibilityState,
      };
    });
    const row = { label, at: new Date().toISOString(), state };
    events.push(row);
    await save(`state-${events.length}.json`, row);
    return state;
  };
  const running = () =>
    page.waitForFunction(
      () =>
        globalThis.document.getElementById('game-overlay')?.hidden === true &&
        globalThis.document.body.dataset.flightState === 'running',
      {},
      { timeout: 30000 },
    );
  const key = async (name, wait) => {
    const start = Date.now();
    await page.keyboard.press(name);
    await page.waitForTimeout(wait);
    events.push({ key: name, requestedWaitMs: wait, wallMs: Date.now() - start });
    await record(`after ${name}`);
  };
  async function stopTrace() {
    if (!tracing) return;
    tracing = false;
    let timer;
    const complete = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Trace stop timed out.')), 30000);
      cdp.once('Tracing.tracingComplete', resolve);
    });
    let stream;
    try {
      // Observe both promises immediately: a wedged Tracing.end must not leave
      // the completion timer's rejection unhandled during bounded cleanup.
      [, { stream }] = await Promise.all([cdp.send('Tracing.end'), complete]);
    } finally {
      clearTimeout(timer);
    }
    const handle = await open(path.join(output, 'first-win-trace.json'), 'wx');
    let bytes = 0;
    try {
      for (;;) {
        const part = await cdp.send('IO.read', { handle: stream, size: 1024 * 1024 });
        const buffer = Buffer.from(part.data, part.base64Encoded ? 'base64' : 'utf8');
        bytes += buffer.length;
        if (bytes > 128 * 1024 * 1024)
          fail(
            'Trace transport exceeds the unchanged 128 MiB analyzer limit; partial bytes are preserved.',
          );
        await handle.write(buffer);
        if (part.eof) break;
      }
    } finally {
      await handle.close();
      await cdp.send('IO.close', { handle: stream });
      tracing = false;
    }
  }
  try {
    await save('plan.json', plan);
    const base = path.dirname(path.resolve(planFile));
    const checked = verifyDiscoveryRuntimeArtifact(plan, {
      archive: await readBounded(path.resolve(base, plan.artifact.archive), 256 * 1024 * 1024),
      manifest: await readBounded(path.resolve(base, plan.artifact.manifest), 8 * 1024 * 1024),
    });
    identity = checked.identity;
    const instrumentationPaths = [
      OBSERVER,
      'docs/verification/discovery-comparison.mjs',
      'docs/verification/company-review-model.mjs',
      'scripts/observe-discovery-cycles.mjs',
      'publishing/edition-zip.mjs',
      'scripts/observe-discovery-runtime.mjs',
      'scripts/game-cli.mjs',
    ];
    const instrumentation = [];
    let observer, reviewModel;
    await mkdir(path.join(output, 'instrumentation'));
    for (const name of instrumentationPaths) {
      const bytes = await readFile(path.join(ROOT, name));
      instrumentation.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
      const target = path.join(output, 'instrumentation', name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
      if (name === OBSERVER) observer = bytes;
      if (name === REVIEW_MODEL) reviewModel = bytes;
    }
    server = await serveDiscoveryRuntime(checked.files, observer, {
      port: plan.serverPort ?? 0,
      reviewModel,
      headerPolicy: plan.headerPolicy ?? 'minimal',
    });
    for (const name of [
      'manifest.json',
      'game/index.html',
      'game/app.mjs',
      OBSERVER,
      REVIEW_MODEL,
    ]) {
      const response = await fetch(`${server.origin}/${name}`),
        bytes = Buffer.from(await response.arrayBuffer());
      if (
        !response.ok ||
        digest(bytes) !==
          digest(
            name === OBSERVER
              ? observer
              : name === REVIEW_MODEL
                ? reviewModel
                : checked.files.get(name),
          )
      )
        fail(`Served bytes differ: ${name}`);
      for (const [header, value] of Object.entries(server.headers))
        if (response.headers.get(header) !== value)
          fail(`Served header differs: ${name}: ${header}`);
    }
    const traced = plan.mode !== 'timings';
    const binding = {
      label: plan.caseId,
      deviceLabel: plan.deviceLabel,
      editionId: PROTOCOL.editionId,
      gameplayId: PROTOCOL.gameplayId,
      inputProtocol: traced
        ? 'Automated keyboard Frame01; normal restart; down1800/down3200/right1400/up6000; first-win trace; no engine/progress injection'
        : 'Automated keyboard Frame01;20s active stationary;normal restart;down1800/down3200/right1400/up6000;20s first-win result;no engine/progress injection',
      settingsIdentity: `en;standard;immediate;scout;full;muted;menu-neon;hybrid;fpv-learning-marker;fpv-meet-aircraft-theme;grid-off;reactions-on;1280x633@1;trace-${plan.mode}${server.headerPolicy === 'minimal' ? '' : ';headers-packaged-preview'}`,
      sourceKind: 'compiled-artifact',
      sourceIdentity: plan.artifact.archiveSha256,
    };
    await save('case.json', {
      format: 'revealline-matched-arcade-case.v1',
      qualified: false,
      plan,
      identity,
      binding,
      instrumentation,
      startedAt: new Date().toISOString(),
      origin: server.origin,
      serverHeaders: {
        policy: server.headerPolicy,
        values: server.headers,
        cacheControl: server.headers['Cache-Control'],
        contentType: 'explicit extension MIME mapping',
        xContentTypeOptions: 'nosniff',
        productionCSP: false,
        packagedPreviewCSP: server.headerPolicy === 'packaged-preview',
      },
      scope:
        server.headerPolicy === 'packaged-preview'
          ? 'Exact playable archive and explicit public controls under the existing packaged-preview security/cache headers. The loopback soundtrack exception is retained; this is not deployed public-origin/CSP or warm-cache qualification. Source-publication eligibility, human/device review and release qualification are separate.'
          : 'Exact playable archive and explicit public controls on a minimal loopback server; production CSP/cache-header behavior is not reproduced. Source-publication eligibility, human/device review and release qualification are separate.',
    });
    const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 633 },
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'Europe/Berlin',
    });
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      globalThis.__discoveryPolicy = { violations: [], overflow: false };
      globalThis.document.addEventListener('securitypolicyviolation', (event) => {
        const record = globalThis.__discoveryPolicy;
        if (record.violations.length >= 128) {
          record.overflow = true;
          return;
        }
        record.violations.push({
          at: globalThis.performance.now(),
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          disposition: event.disposition,
        });
      });
    });
    const attach = () =>
      page.evaluate(async (value) => {
        globalThis.discoveryObservation?.dispose();
        const { observeDiscovery } = await import('/docs/verification/discovery-observer.mjs');
        globalThis.discoveryObservation = observeDiscovery({ binding: value });
      }, binding);
    const sample = (kind) =>
      page.evaluate(
        ({ kind, durationMs }) => {
          globalThis.__discoverySample = null;
          globalThis.discoveryObservation.sample({ kind, durationMs }).then((result) => {
            globalThis.__discoverySample = result;
          });
        },
        { kind, durationMs: traced ? 3000 : 20000 },
      );
    const result = async () => {
      await page.waitForFunction(
        () => globalThis.__discoverySample !== null,
        {},
        { timeout: 65000 },
      );
      return page.evaluate(() => globalThis.__discoverySample);
    };
    const sampleReport = async (name) => {
      const observed = await result();
      await save(`${name}-sample.json`, observed);
      await save(
        `${name}-report.json`,
        await page.evaluate(() => globalThis.discoveryObservation.exportReport()),
      );
      if (observed.outcome !== 'observed') fail(`${name} sample rejected: ${observed.outcome}`);
      return observed;
    };
    await page.goto(`${server.origin}/game/index.html?edition=${PROTOCOL.editionId}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => globalThis.document.documentElement.dataset.bootState === 'ready',
      {},
      { timeout: 60000 },
    );
    await page.bringToFront();
    const initial = await record('fresh page');
    await screenshot('fresh-page');
    if (initial.muted === 'true') await page.locator('#shell-sound').click();
    await page.locator('#shell-featured').click();
    await running();
    await page.waitForTimeout(300);
    const settings = await record('active settings');
    if (
      settings.selection['difficulty-select'].value !== 'standard' ||
      settings.selection['turn-select'].value !== 'immediate' ||
      settings.selection['class-select'].value !== 'scout' ||
      settings.selection['level-select'].value !== PROTOCOL.missionId ||
      settings.selection['body-select'].value !== 'fpv-learning-marker' ||
      settings.selection['theme-select'].value !== 'fpv-meet-aircraft-theme' ||
      settings.selection['terrain-select'].value !== 'hybrid' ||
      settings.body.editionId !== PROTOCOL.editionId ||
      settings.body.menuPalette !== 'neon' ||
      settings.locale !== 'en' ||
      settings.viewport.width !== 1280 ||
      settings.viewport.height !== 633 ||
      settings.viewport.dpr !== 1 ||
      settings.body.effects !== 'full' ||
      settings.muted !== 'false' ||
      settings.grid !== false ||
      settings.reactions !== true
    )
      fail('Observed controls differ from the reviewed protocol.');
    if (!traced) {
      await attach();
      await sample('active-play');
      await sampleReport('active');
    }
    await page.locator('#pause-button').click();
    await page.locator('#overlay-restart').click();
    await page.locator('#restart-confirm').click();
    await running();
    for (const [name, wait] of PROTOCOL.route.slice(0, -1)) await key(name, wait);
    if ((await record('before final cut')).overlay.kind === 'won')
      fail('Won before the declared transition.');
    await attach();
    await sample('result-reveal');
    if (traced) {
      cdp = await context.newCDPSession(page);
      await cdp.send('Tracing.start', {
        categories: plan.mode === 'cpu' ? CPU : TIMELINE,
        transferMode: 'ReturnAsStream',
      });
      tracing = true;
    }
    await page.evaluate(() => {
      const doc = globalThis.document,
        overlay = doc.getElementById('game-overlay'),
        perf = globalThis.performance;
      const record = {
        started: perf.now(),
        visible: null,
        ended: null,
        keys: [],
        untrustedDOMInputs: 0,
      };
      const key = (event) => {
        record.keys.push({ key: event.key, time: perf.now(), trusted: event.isTrusted });
        if (!event.isTrusted) record.untrustedDOMInputs++;
      };
      const observer = new globalThis.MutationObserver(() => {
        if (record.visible !== null || !['won', 'campaign-complete'].includes(overlay.dataset.kind))
          return;
        record.visible = perf.now();
        record.kind = overlay.dataset.kind;
        perf.mark('discovery-first-win:visible');
        globalThis.setTimeout(() => {
          record.ended = perf.now();
          perf.mark('discovery-first-win:end');
          observer.disconnect();
          doc.removeEventListener('keydown', key, true);
        }, 2000);
      });
      doc.addEventListener('keydown', key, true);
      observer.observe(overlay, {
        attributes: true,
        attributeFilter: ['data-kind', 'hidden', 'class'],
      });
      globalThis.__discoveryFirstWin = record;
      globalThis.__discoveryWinCleanup = () => {
        observer.disconnect();
        doc.removeEventListener('keydown', key, true);
      };
      perf.mark('discovery-first-win:start');
    });
    await key(...PROTOCOL.route.at(-1));
    await sampleReport('result');
    const won = await page.evaluate(() => globalThis.__discoveryFirstWin);
    await save('first-win-record.json', won);
    if (!won.visible || !won.ended || won.kind !== 'won' || won.untrustedDOMInputs)
      fail('A normal first win and its complete measurement window were not observed.');
    await stopTrace();
    if (traced)
      await save('first-win-options.json', {
        sourceBinding: {
          sourceRevision: identity.sourceRevision,
          distributionSha256: identity.distribution.sha256,
          editionId: PROTOCOL.editionId,
        },
        window: { start: 'discovery-first-win:start', end: 'discovery-first-win:end' },
        checkpointMarkers: ['discovery-first-win:visible'],
      });
    await screenshot('first-result');
    if (plan.cycles)
      await runDiscoveryCycles({
        session: plan.caseId,
        binding,
        cycles: plan.cycles,
        output: path.join(output, 'cycles-20.json'),
        invoke: async (args) => {
          if (args[0] === 'eval') return page.evaluate(args[1]);
          if (args[0] === 'click') return page.locator(args[1]).click();
          if (args[0] === 'scrollintoview') return page.locator(args[1]).scrollIntoViewIfNeeded();
          fail('Unsupported public observer command.');
        },
      });
    const policy = await page.evaluate(() => globalThis.__discoveryPolicy);
    await save('security-policy.json', policy);
    if (policy.overflow || policy.violations.length)
      fail('Browser reported security-policy violations; retain the raw observation.');
    if (errors.length) fail('Browser reported application errors; retain the raw observation.');
    completion = {
      qualified: false,
      completed: true,
      finishedAt: new Date().toISOString(),
      identity,
      events,
      errors,
      limitations: [
        'One fixed reviewed mission/device protocol only.',
        'CPU profiling is separate from unprofiled p95 comparisons and adds overhead.',
        'Cycles count connected resources, not detached retainers or decoder memory.',
        'Automated browser keyboard controls are not human or physical-device evidence.',
      ],
    };
  } catch (error) {
    primaryError = error;
    diagnosticFailures = await recordDiscoveryFailureEvidence({
      page,
      save,
      screenshot,
      stopTrace,
      timeoutMs: cleanupTimeoutMs,
      failure: {
        qualified: false,
        error: error.stack,
        identity,
        events,
        errors,
        at: new Date().toISOString(),
      },
    });
  } finally {
    await finishDiscoveryObservation({
      page,
      cdp,
      browser,
      server,
      save,
      complete: completion,
      error: primaryError,
      diagnosticFailures,
      cleanupTimeoutMs,
    });
  }
  return { qualified: false, completed: true, output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [playwrightModule, planFile, output] = process.argv.slice(2);
  if (!playwrightModule || !planFile || !output)
    fail(
      'Usage: node scripts/observe-discovery-runtime.mjs <playwright-module> <plan.json> <new-output-directory>',
    );
  process.stdout.write(
    JSON.stringify(await observeDiscoveryRuntime({ playwrightModule, planFile, output }), null, 2) +
      '\n',
  );
}
