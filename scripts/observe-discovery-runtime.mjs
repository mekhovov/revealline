import { readFile, writeFile, mkdir, stat, open, access } from 'node:fs/promises';
import { constants, createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
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
const MODES = ['timings', 'timeline', 'cpu', 'showcase'];
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

// Offline route witnesses are candidates for public keyboard rehearsal, not
// guaranteed wall-clock wins. No runtime engine or player profile is imported.
export const DISCOVERY_SHOWCASE_PROTOCOLS = Object.freeze(
  Object.fromEntries(
    [
      {
        id: 'social-community-first-win.v1',
        editionId: 'social-drone-ua',
        campaignId: 'social-drone-community-connections',
        gameplayId: '8a95643f8c0683aa',
        missionName: 'One Shared Brief',
        missionNameUK: 'Спільний задум',
        nextNameEN: 'Count What Is Here',
        nextNameUK: 'Порахуйте наявне',
        routeRevision: 2,
        // Reach both outer safe borders before a wider interior cut. The first
        // browser candidate crossed a narrower enemy corridor and lost a life.
        ticks: [
          ['ArrowRight', 750],
          ['ArrowDown', 535],
          ['ArrowLeft', 300],
          ['ArrowUp', 600],
        ],
      },
      {
        id: 'victory-ideas-first-win.v1',
        editionId: 'victory-drones',
        campaignId: 'victory-drones-ideas-understanding',
        gameplayId: '8d8dce4d47fd5912',
        missionName: 'Observe Before Explaining',
        missionNameUK: 'Спостерігайте перед поясненням',
        nextNameEN: 'Forces Come in Pairs',
        nextNameUK: 'Сили взаємодії',
        ticks: [
          ['ArrowRight', 489],
          ['ArrowDown', 469],
          ['ArrowDown', 7],
          ['ArrowLeft', 150],
          ['ArrowUp', 469],
          ['ArrowDown', 468],
          ['ArrowLeft', 434],
          ['ArrowUp', 468],
        ],
      },
      {
        id: 'ukraine-threads-first-win.v1',
        editionId: 'ukraine-culture',
        campaignId: 'ukraine-threads',
        gameplayId: 'aae83c4cf5bee1df',
        missionName: 'Read the Cloth',
        missionNameUK: 'Прочитайте тканину',
        nextNameEN: 'Stitch Paths',
        nextNameUK: 'Шляхи стібків',
        routeRevision: 2,
        // Leave a fixed closing-leg margin before observing the result. A prior
        // immediate read preceded the genuine win visible in its failure capture.
        ticks: [
          ['ArrowRight', 163],
          ['ArrowDown', 600],
        ],
      },
    ].map(({ ticks, ...item }) => [
      item.id,
      Object.freeze({
        ...item,
        missionId: `${item.campaignId}-01`,
        nextMissionId: `${item.campaignId}-02`,
        rewardId: `${item.campaignId}-01-discovery`,
        rewardPath: `game/content/company-campaigns/${item.campaignId}.rewards.json`,
        actorSetId: `${item.editionId}-marker`,
        themeId: `${item.campaignId}-theme`,
        routeStatus: 'experimental-public-keyboard-candidate',
        route: Object.freeze(
          ticks.map(([key, count]) => Object.freeze([key, (count * 1000) / 120])),
        ),
      }),
    ]),
  ),
);
const runtimeProtocol = (plan) =>
  plan.mode === 'showcase' ? DISCOVERY_SHOWCASE_PROTOCOLS[plan.protocol] : PROTOCOL;

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
      'browser',
      'artifact',
    ],
    'observation plan',
  );
  if (
    plan.format !== 'revealline-discovery-runtime-plan.v1' ||
    !/^[a-z0-9-]{1,64}$/.test(plan.caseId ?? '') ||
    !(plan.mode === 'showcase'
      ? Object.hasOwn(DISCOVERY_SHOWCASE_PROTOCOLS, plan.protocol)
      : plan.protocol === PROTOCOL.id) ||
    !text(plan.deviceLabel) ||
    !text(plan.quietWindow, 2048) ||
    !MODES.includes(plan.mode) ||
    ![0, 20].includes(plan.cycles) ||
    (plan.mode === 'showcase' && (plan.cycles !== 0 || plan.headerPolicy !== 'packaged-preview')) ||
    (plan.headerPolicy !== undefined &&
      !['minimal', 'packaged-preview'].includes(plan.headerPolicy)) ||
    (plan.browser !== undefined && !['chrome', 'firefox'].includes(plan.browser)) ||
    (plan.browser === 'firefox' && plan.mode !== 'showcase') ||
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
    plan.artifact.editionId !== runtimeProtocol(plan).editionId
  )
    fail('Missing exact supported edition/source binding.');
  return plan;
}

/** Select only declared Playwright engines; never install, change flags or fall back. */
export async function prepareDiscoveryBrowser(planInput, playwrightModule) {
  const plan = validateDiscoveryRuntimePlan(planInput),
    selection = plan.browser ?? 'chrome',
    modulePath = path.resolve(playwrightModule),
    moduleBytes = await readBounded(modulePath, 8 * 1024 * 1024),
    engines = await import(pathToFileURL(modulePath).href),
    browserType = engines[selection === 'chrome' ? 'chromium' : 'firefox'],
    launchOptions =
      selection === 'chrome' ? { channel: 'chrome', headless: true } : { headless: true },
    evidence = {
      selection,
      engine: selection === 'chrome' ? 'chromium' : 'firefox',
      launchOptions,
      module: { bytes: moduleBytes.length, sha256: digest(moduleBytes) },
    };
  if (typeof browserType?.launch !== 'function') fail(`Missing declared ${selection} engine.`);
  if (selection === 'firefox') {
    const packagePath = createRequire(modulePath).resolve('playwright-core/package.json'),
      packageBytes = await readBounded(packagePath, 65536),
      packageData = JSON.parse(packageBytes),
      browsersBytes = await readBounded(
        path.join(path.dirname(packagePath), 'browsers.json'),
        65536,
      ),
      descriptor = JSON.parse(browsersBytes).browsers?.find((item) => item.name === 'firefox');
    if (
      packageData.name !== 'playwright-core' ||
      !text(packageData.version, 64) ||
      !/^\d{1,8}$/.test(descriptor?.revision ?? '') ||
      !text(descriptor?.browserVersion, 64) ||
      browserType.name?.() !== 'firefox' ||
      typeof browserType.executablePath !== 'function'
    )
      fail('The declared Firefox engine requires its matching Playwright browser manifest.');
    const executable = browserType.executablePath(),
      segments = path.resolve(executable).split(path.sep),
      revisionIndex = segments.lastIndexOf(`firefox-${descriptor.revision}`);
    if (revisionIndex < 0) fail('Firefox executable differs from the declared bundled revision.');
    await access(executable, constants.X_OK);
    await access(
      path.join(segments.slice(0, revisionIndex + 1).join(path.sep), 'INSTALLATION_COMPLETE'),
    );
    const before = await stat(executable);
    if (!before.isFile() || before.size < 1 || before.size > 512 * 1024 * 1024)
      fail('Firefox executable is unavailable or exceeds the evidence bound.');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(executable)) hash.update(chunk);
    const after = await stat(executable);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      fail('Firefox executable changed during inspection.');
    evidence.runtime = {
      playwrightCoreVersion: packageData.version,
      package: { bytes: packageBytes.length, sha256: digest(packageBytes) },
      browsers: { bytes: browsersBytes.length, sha256: digest(browsersBytes) },
      revision: descriptor.revision,
      expectedBrowserVersion: descriptor.browserVersion,
      executable: {
        name: path.basename(executable),
        bytes: before.size,
        sha256: hash.digest('hex'),
      },
      scope:
        'Primary executable and supplied Playwright metadata only; not a full browser bundle inventory.',
    };
  }
  return { browserType, launchOptions, evidence };
}

/** Exact playable-byte verification only; this does not replace release/source admission. */
export function verifyDiscoveryRuntimeArtifact(planInput, { archive, manifest: manifestBytes }) {
  const plan = validateDiscoveryRuntimePlan(planInput),
    wanted = plan.artifact,
    protocol = runtimeProtocol(plan);
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
    new TextDecoder('utf-8', { fatal: true }).decode(files.get(protocol.rewardPath)),
  );
  const definition = rewards.find(
    (item) => item.scope?.kind === 'mission' && item.scope.id === protocol.missionId,
  );
  if (
    (plan.mode === 'showcase' && definition?.id !== protocol.rewardId) ||
    !definition?.requirements?.missions?.some(
      (mission) =>
        mission.missionId === protocol.missionId &&
        mission.bindings?.some(
          (binding) =>
            binding.gameplayId === protocol.gameplayId && binding.difficulty === 'standard',
        ),
    )
  )
    fail(
      'The reviewed gameplay binding is absent; review a new protocol instead of relabelling it.',
    );
  const showcaseCopy =
    plan.mode === 'showcase'
      ? Object.fromEntries(
          ['en', 'uk'].map((locale) => {
            const title = definition.locales?.[locale]?.title;
            const paragraph = definition.payloads?.find((item) => item.type === 'knowledge')
              ?.locales?.[locale]?.paragraphs?.[0];
            if (!text(title, 256) || !text(paragraph, 4096))
              fail(
                'The exact showcase reward needs bounded English and Ukrainian title/knowledge copy.',
              );
            return [locale, { title, paragraph }];
          }),
        )
      : null;
  let showcaseSelection = null;
  if (plan.mode === 'showcase') {
    const project = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        files.get(protocol.rewardPath.replace('.rewards.json', '.json')),
      ),
    );
    const campaign = project.campaigns?.find((item) => item.id === protocol.campaignId);
    const mission = project.missions?.find((item) => item.id === protocol.missionId);
    const packs = project.packs?.filter(
      (item) => !item.archived && item.campaignIds?.includes(protocol.campaignId),
    );
    if (
      !campaign ||
      campaign.archived ||
      campaign.missionIds?.[0] !== protocol.missionId ||
      mission?.archived ||
      mission?.name !== protocol.missionName ||
      !packs?.length ||
      packs.length > 32
    )
      fail('The selected source does not expose the exact first showcase mission.');
    showcaseSelection = {
      editionId: protocol.editionId,
      name: protocol.missionName,
      aliases: packs.map((pack) => ({
        campaign: JSON.stringify(['candidate', pack.id, campaign.id]),
        mission: ['candidate', pack.id, campaign.id, mission.id].map(encodeURIComponent).join('/'),
      })),
    };
  }
  return {
    plan,
    files,
    manifest,
    ...(showcaseCopy ? { showcaseCopy, showcaseSelection } : {}),
    identity: {
      sourceRevision: wanted.sourceRevision,
      sourceTree: wanted.sourceTree,
      editionId: wanted.editionId,
      distribution: { sha256: wanted.archiveSha256, bytes: archive.byteLength },
      manifest: { sha256: wanted.manifestSha256, bytes: manifestBytes.byteLength },
      runtimeFiles: files.size,
      runtimeBytes: [...files.values()].reduce((sum, item) => sum + item.byteLength, 0),
      contentSha256: manifest.contentSha256,
      gameplayId: protocol.gameplayId,
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

/** Only public launch-screen state; never inspect profiles or engine internals. */
export function readDiscoveryBootState() {
  const doc = globalThis.document,
    value = (id, limit) => (doc.getElementById(id)?.textContent ?? '').slice(0, limit);
  return {
    state: (doc.documentElement.dataset.bootState ?? '').slice(0, 32),
    locale: (doc.documentElement.lang ?? '').slice(0, 64),
    title: value('boot-title', 256),
    status: value('boot-status', 2048),
    detail: value('boot-detail', 320),
    screenHidden: doc.getElementById('boot-screen')?.hidden ?? null,
    detailHidden: doc.getElementById('boot-detail')?.hidden ?? null,
  };
}

export async function waitForDiscoveryBoot({ page, save }) {
  let failure = null;
  try {
    await page.waitForFunction(
      () =>
        ['ready', 'failed', 'file'].includes(globalThis.document.documentElement.dataset.bootState),
      {},
      { timeout: 60000 },
    );
  } catch (error) {
    failure = error;
  }
  try {
    const boot = await cleanupDeadline(
      () => page.evaluate(readDiscoveryBootState),
      10000,
      'boot diagnostics',
    );
    if (!failure && boot.state !== 'ready')
      failure = new Error(
        `Game boot ${boot.state || 'unavailable'}: ${boot.detail || boot.status || boot.title}`,
      );
    if (failure) failure.boot = boot;
    await cleanupDeadline(
      () => save('boot.json', { qualified: false, ...boot }),
      10000,
      'boot evidence',
    );
  } catch (error) {
    if (!failure) failure = error;
    else failure.bootEvidenceError = String(error.message).slice(0, 1024);
  }
  if (failure) throw failure;
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
  context,
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
    // Release the explicitly created page/context before closing the browser.
    // Do not run page unload prompts, and never treat a later owner closing as
    // proof that an earlier timed-out operation completed within its deadline.
    ['page', page, () => page.close({ runBeforeUnload: false })],
    ['context', context, () => context.close()],
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

/** Each route is a bounded experimental public-input attempt. The caller must
 * retain its outcome even when the offline witness does not become a browser win. */
export async function executeDiscoveryShowcaseRoute({ protocolId, read, press, save, attempt }) {
  const protocol = DISCOVERY_SHOWCASE_PROTOCOLS[protocolId];
  if (!protocol || ![1, 2].includes(attempt))
    fail('Choose a registered showcase and attempt 1 or 2.');
  const states = [];
  const capture = async (label) => {
    const state = await read(label);
    states.push(state);
    return state;
  };
  let state = await capture(`showcase attempt ${attempt} start`);
  const isWon = () =>
    state.overlay.kind === 'won' &&
    state.overlay.hidden === false &&
    state.body.editionId === protocol.editionId &&
    state.selection['level-select'].value === protocol.missionId;
  try {
    if (state.overlay.hidden !== true || state.body.flightState !== 'running')
      fail('A showcase attempt must start in ordinary running gameplay.');
    for (const [key, wait] of protocol.route) {
      if (state.overlay.hidden !== true || state.body.flightState !== 'running') break;
      if (state.selection['level-select'].value !== protocol.missionId)
        fail('The showcase mission changed during its public-input attempt.');
      await press(key, wait);
      state = await capture(`showcase attempt ${attempt} ${key}`);
      if (isWon()) break;
    }
    if (!isWon()) fail('Experimental showcase route did not produce an ordinary win.');
    return state;
  } finally {
    await save(`showcase-attempt-${attempt}.json`, {
      protocolId,
      routeStatus: protocol.routeStatus,
      routeRevision: protocol.routeRevision ?? 1,
      declaredRoute: protocol.route,
      attempt,
      won: isWon(),
      states,
      inputSource:
        'Playwright browser keyboard press and wall-clock waits; no engine/progress calls',
    });
  }
}

export function validateDiscoveryShowcaseState(
  state,
  protocolId,
  { locale = 'en', next = false } = {},
) {
  const protocol = DISCOVERY_SHOWCASE_PROTOCOLS[protocolId];
  if (!protocol || !['en', 'uk'].includes(locale)) fail('Unknown showcase state binding.');
  const selected = state.selection;
  if (
    state.body.editionId !== protocol.editionId ||
    state.locale !== locale ||
    selected['difficulty-select'].value !== 'standard' ||
    selected['turn-select'].value !== 'immediate' ||
    selected['class-select'].value !== 'scout' ||
    selected['level-select'].value !== (next ? protocol.nextMissionId : protocol.missionId) ||
    selected['body-select'].value !== protocol.actorSetId ||
    selected['theme-select'].value !== protocol.themeId ||
    selected['terrain-select'].value !== 'hybrid' ||
    selected['level-select'].label !==
      `${next ? '02' : '01'} · ${next ? (locale === 'uk' ? protocol.nextNameUK : protocol.nextNameEN) : locale === 'uk' ? protocol.missionNameUK : protocol.missionName}`
  )
    fail('Observed showcase controls differ from the exact mission/locale protocol.');
  return state;
}

/** Interpret the existing public Library row ID, not an engine identity or a
 * guessed suffix. The aliases come from the exact selected archive source. */
export function selectDiscoveryShowcaseCard(capture, selection) {
  if (
    !capture ||
    !Array.isArray(capture.rows) ||
    capture.rows.length > 128 ||
    capture.total !== capture.rows.length ||
    !selection?.aliases?.length
  )
    fail('Public showcase chooser metadata is missing or exceeds its bound.');
  const matches = capture.rows.filter((row) => {
    if (!row.visible || row.disabled || row.name !== selection.name || !text(row.id, 8192))
      return false;
    try {
      const id = JSON.parse(row.id);
      return (
        Array.isArray(id) &&
        id.length === 5 &&
        id[0] === `journey:${selection.editionId}` &&
        id[1] === selection.editionId &&
        id[4] === '' &&
        selection.aliases.some((alias) => id[2] === alias.campaign && id[3] === alias.mission)
      );
    } catch {
      return false;
    }
  });
  if (matches.length !== 1)
    fail('Exact showcase mission is not uniquely available in the public chooser.');
  return matches[0];
}

export function validateDiscoveryShowcaseCopy(expected, observed, locale) {
  if (
    !['en', 'uk'].includes(locale) ||
    !expected?.[locale] ||
    observed.title !== expected[locale].title ||
    observed.knowledgeMatched !== true
  )
    fail('The visible discovery copy differs from its exact earned locale.');
  return observed;
}

/** Use the existing public compact header or native Home path. A viewport
 * change may hide header actions; it never authorizes clicking hidden controls. */
export async function visitDiscoveryShowcaseCollection({ page, click, visit, record, onRoute }) {
  const route = (await page.locator('#shell-collection').isVisible()) ? 'header' : 'home';
  await onRoute(route);
  if (route === 'home') {
    await click('#shell-menu');
    await page.locator('#shell-home').waitFor({ state: 'visible' });
    await click('#shell-home #shell-gallery');
  } else await click('#shell-collection');
  await page.locator('#collection-dialog').waitFor({ state: 'visible' });
  await visit(route);
  await click('#collection-back');
  await page.locator('#collection-dialog').waitFor({ state: 'hidden' });
  if (route === 'home') {
    // Native dialog cancel restores the existing won result; it does not start a run.
    await page.keyboard.press('Escape');
    await page.locator('#shell-home').waitFor({ state: 'hidden' });
  }
  const state = await record(`collection ${route} return to won result`);
  if (state.overlay.kind !== 'won' || state.overlay.hidden !== false || state.openDialogs.length)
    fail('Closing Collection did not restore the underlying won result.');
  return route;
}

/** Functional showcase navigation is intentionally separate from timing samples.
 * DOM evaluation below reads surfaces only; all choices use native public controls. */
export async function observeDiscoveryShowcase({
  page,
  protocolId,
  showcaseCopy,
  showcaseSelection,
  origin,
  record,
  screenshot,
  save,
  running,
  key,
}) {
  const protocol = DISCOVERY_SHOWCASE_PROTOCOLS[protocolId];
  if (!protocol) fail('Unknown showcase protocol.');
  const resultButton = `[data-reward-id="${protocol.rewardId}"][data-reward-surface="result"]`;
  const collectionButton = `[data-reward-id="${protocol.rewardId}"][data-reward-surface="collection"]`;
  const phases = [];
  const snapshot = async (label) => {
    const surface = await page.evaluate(async () => {
      const doc = globalThis.document;
      const { discoveryCycleSurface } = await import('/docs/verification/discovery-observer.mjs');
      return {
        ...discoveryCycleSurface(doc),
        locale: doc.documentElement.lang,
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
        focus: {
          id: doc.activeElement?.id,
          rewardId: doc.activeElement?.dataset.rewardId,
          surface: doc.activeElement?.dataset.rewardSurface,
        },
        save: { ...doc.getElementById('completion-reward-save-status')?.dataset },
        trust: globalThis.__discoveryShowcaseInputs,
      };
    });
    phases.push({ label, ...surface });
    await save(`showcase-surface-${phases.length}.json`, phases.at(-1));
    return surface;
  };
  const click = async (selector) => {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.locator(selector).click();
  };
  const viewer = async (selector, label, locale) => {
    await click(selector);
    await page.waitForFunction(
      () => {
        const dialog = globalThis.document.getElementById('completion-reward-dialog');
        return (
          dialog?.open &&
          [...dialog.querySelectorAll('img')].some((img) => img.complete && img.naturalWidth > 0)
        );
      },
      {},
      { timeout: 20000 },
    );
    const observedCopy = await page.evaluate(
      (paragraph) => ({
        title: globalThis.document.getElementById('completion-reward-title')?.textContent,
        knowledgeMatched:
          globalThis.document
            .getElementById('completion-reward-dialog')
            ?.textContent.includes(paragraph) === true,
      }),
      showcaseCopy[locale].paragraph,
    );
    await save(`${label}-copy.json`, {
      locale,
      ...observedCopy,
      expectedTitle: showcaseCopy[locale].title,
      expectedParagraphSha256: digest(Buffer.from(showcaseCopy[locale].paragraph)),
    });
    validateDiscoveryShowcaseCopy(showcaseCopy, observedCopy, locale);
    const surface = await snapshot(label);
    if (
      !surface.state.rewardViewer ||
      surface.locale !== locale ||
      !surface.decodedVisibleImages ||
      surface.brokenVisibleImages ||
      !surface.closeViewer.visible
    )
      fail('Showcase discovery is not visibly decoded with an accessible Back control.');
    await screenshot(label);
    await click('#completion-reward-dialog > button');
    await page.waitForFunction(
      () => !globalThis.document.getElementById('completion-reward-dialog')?.open,
    );
    const closed = await snapshot(`${label}-closed`);
    if (
      closed.focus.rewardId !== protocol.rewardId ||
      closed.focus.surface !== (selector === resultButton ? 'result' : 'collection')
    )
      fail('Closing the discovery did not restore its public opener focus.');
  };
  const collection = async (label, locale) =>
    visitDiscoveryShowcaseCollection({
      page,
      click,
      record,
      onRoute: (route) =>
        save(`${label}-navigation.json`, {
          route,
          locale,
          underlying: 'won-result',
          requestedAt: new Date().toISOString(),
        }),
      visit: async () => {
        await page.locator('#completion-reward-exhibit-select').selectOption(protocol.campaignId);
        await page.waitForFunction(
          (rewardId) =>
            globalThis.document.querySelector(
              `#completion-reward-shelf article[data-reward-id="${rewardId}"]`,
            )?.dataset.earned === 'true',
          protocol.rewardId,
        );
        const progress = await page.evaluate(
          (rewardId) => ({
            earned: globalThis.document.querySelector(
              `#completion-reward-shelf article[data-reward-id="${rewardId}"]`,
            )?.dataset.earned,
            finales: [
              ...globalThis.document.querySelectorAll(
                '#completion-reward-shelf article[data-scope="campaign"]',
              ),
            ].map((node) => ({ id: node.dataset.rewardId, earned: node.dataset.earned })),
          }),
          protocol.rewardId,
        );
        await save(`${label}-progress.json`, progress);
        if (
          progress.earned !== 'true' ||
          !progress.finales.length ||
          progress.finales.some((row) => row.earned !== 'false')
        )
          fail('The first mission discovery or still-locked campaign promise is inaccurate.');
        await viewer(collectionButton, label, locale);
      },
    });
  await page.goto(`${origin}/game/index.html?edition=${protocol.editionId}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForDiscoveryBoot({ page, save });
  await page.bringToFront();
  const initial = await record('showcase fresh page');
  await screenshot('showcase-fresh-page');
  if (initial.muted === 'true') await click('#shell-sound');
  // Additive passive trusted-input accounting. It cannot dispatch or accept a win.
  await page.evaluate(() => {
    const inputs = { count: 0, untrusted: 0 };
    const observe = (event) => {
      inputs.count++;
      if (!event.isTrusted) inputs.untrusted++;
    };
    globalThis.__discoveryShowcaseInputs = inputs;
    globalThis.document.addEventListener('keydown', observe, true);
    globalThis.__discoveryWinCleanup = () =>
      globalThis.document.removeEventListener('keydown', observe, true);
  });
  await click('#shell-play');
  await page.locator('#journey-chooser').waitFor({ state: 'visible' });
  await page.locator('#journey-search').fill(protocol.missionName);
  await page.locator('#journey-cards button.journey-card').first().waitFor({ state: 'attached' });
  const chooser = await page.locator('#journey-cards button.journey-card').evaluateAll((nodes) => ({
    total: nodes.length,
    rows: nodes.slice(0, 128).map((node) => {
      const bounds = node.getBoundingClientRect();
      const style = globalThis.getComputedStyle(node);
      return {
        id: (node.dataset.missionId ?? '').slice(0, 8192),
        name: node.querySelector('strong')?.textContent?.slice(0, 256),
        text: node.textContent?.slice(0, 512),
        disabled: node.disabled,
        visible:
          !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) !== 0 &&
          bounds.width > 0 &&
          bounds.height > 0,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      };
    }),
  }));
  await save('showcase-chooser.json', { selection: showcaseSelection, ...chooser });
  const chosen = selectDiscoveryShowcaseCard(chooser, showcaseSelection);
  const card = page.locator(
    `#journey-cards button.journey-card[data-mission-id=${JSON.stringify(chosen.id)}]`,
  );
  if ((await card.count()) !== 1) fail('The exact public chooser row changed before activation.');
  await card.scrollIntoViewIfNeeded();
  await card.focus();
  await page.keyboard.press('Enter');
  await running();
  validateDiscoveryShowcaseState(await record('showcase chosen mission'), protocolId);
  // Ordinary restart gives the declared candidate route a fresh attempt.
  await click('#pause-button');
  await click('#overlay-restart');
  await click('#restart-confirm');
  await running();
  await executeDiscoveryShowcaseRoute({ protocolId, read: record, press: key, save, attempt: 1 });
  await page.locator(resultButton).waitFor({ state: 'visible' });
  await snapshot('english-desktop-first-win');
  await screenshot('english-desktop-first-win');
  await viewer(resultButton, 'english-desktop-discovery', 'en');
  await collection('english-desktop-collection', 'en');
  await click('#shell-settings');
  await page.locator('#settings-dialog [data-language-select]').selectOption('uk');
  await click('[data-close="settings-dialog"]');
  await page.waitForFunction(() => globalThis.document.documentElement.lang === 'uk');
  await page.setViewportSize({ width: 390, height: 844 });
  validateDiscoveryShowcaseState(await record('ukrainian portrait result'), protocolId, {
    locale: 'uk',
  });
  await screenshot('ukrainian-portrait-result');
  await viewer(resultButton, 'ukrainian-portrait-discovery', 'uk');
  await collection('ukrainian-portrait-collection', 'uk');
  await click('#retry-button');
  await running();
  validateDiscoveryShowcaseState(await record('single-action retry'), protocolId, { locale: 'uk' });
  await executeDiscoveryShowcaseRoute({ protocolId, read: record, press: key, save, attempt: 2 });
  await page.locator(resultButton).waitFor({ state: 'visible' });
  await snapshot('ukrainian-portrait-repeat-win');
  await click('#next-button');
  await running();
  validateDiscoveryShowcaseState(await record('single-action next'), protocolId, {
    locale: 'uk',
    next: true,
  });
  await click('#pause-button'); // Leave neutral gameplay input before final evidence/cleanup.
  await screenshot('ukrainian-portrait-next-paused');
  const last = await snapshot('ukrainian-portrait-next-paused');
  if (!last.trust.count || last.trust.untrusted)
    fail('Only trusted browser keyboard input is allowed.');
  const report = {
    format: 'revealline-discovery-showcase-observation.v1',
    qualified: false,
    completed: true,
    protocolId,
    routeStatus: protocol.routeStatus,
    ordinaryWins: 2,
    distinctMissionsWon: 1,
    phases,
    limitations: [
      'English desktop first win and Ukrainian portrait revisit/repeat win are one earned session, not independent fresh-profile qualifications.',
      'Functional public controls only; no performance, human, touch, physical controller or device qualification.',
      'Only the first showcase mission and its discovery are exercised; later application and six-win finale are not completed here.',
      'Offline route witnesses remain experimental browser candidates; a successful observation does not guarantee future wall-clock routes.',
    ],
  };
  await save('showcase.json', report);
  return report;
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
    context,
    page,
    server,
    cdp,
    tracing = false,
    identity = null,
    browserEvidence = null,
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
    const protocol = runtimeProtocol(plan);
    const traced = ['timeline', 'cpu'].includes(plan.mode);
    const preparedBrowser = await prepareDiscoveryBrowser(plan, playwrightModule);
    browserEvidence = preparedBrowser.evidence;
    await save('browser-selection.json', { qualified: false, ...browserEvidence });
    const binding =
      plan.mode === 'showcase'
        ? {
            label: plan.caseId,
            deviceLabel: plan.deviceLabel,
            editionId: protocol.editionId,
            gameplayId: protocol.gameplayId,
            inputProtocol: `${protocol.id};public chooser;experimental keyboard route;EN desktop win;UK portrait revisit/retry/next;no progress injection`,
            settingsIdentity: `en1280x633@1;uk390x844@1;standard;immediate;scout;${protocol.actorSetId};${protocol.themeId};headers-packaged-preview;functional-only`,
            sourceKind: 'compiled-artifact',
            sourceIdentity: plan.artifact.archiveSha256,
          }
        : {
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
    // Old Chrome plans retain their exact comparison identity. A separately
    // declared engine cannot be silently mixed with their timing observations.
    if (browserEvidence.selection !== 'chrome')
      binding.settingsIdentity += `;browser-${browserEvidence.selection}@${browserEvidence.runtime.expectedBrowserVersion}`;
    await save('case.json', {
      format: 'revealline-matched-arcade-case.v1',
      qualified: false,
      plan,
      identity,
      binding,
      browser: browserEvidence,
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
          ? 'Exact playable archive and explicit public controls under the existing packaged-preview security/cache headers. The packaged-preview soundtrack origins are retained; this is not deployed public-origin/CSP or warm-cache qualification. Source-publication eligibility, human/device review and release qualification are separate.'
          : 'Exact playable archive and explicit public controls on a minimal loopback server; production CSP/cache-header behavior is not reproduced. Source-publication eligibility, human/device review and release qualification are separate.',
    });
    browser = await preparedBrowser.browserType.launch(preparedBrowser.launchOptions);
    browserEvidence = { ...browserEvidence, actualBrowserVersion: browser.version() };
    await save('browser.json', { qualified: false, ...browserEvidence });
    if (
      !text(browserEvidence.actualBrowserVersion, 128) ||
      (browserEvidence.selection === 'firefox' &&
        browserEvidence.actualBrowserVersion !== browserEvidence.runtime.expectedBrowserVersion)
    )
      fail('Launched browser version differs from the declared runtime.');
    context = await browser.newContext({
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
    let showcase = null;
    if (plan.mode === 'showcase') {
      showcase = await observeDiscoveryShowcase({
        page,
        protocolId: plan.protocol,
        showcaseCopy: checked.showcaseCopy,
        showcaseSelection: checked.showcaseSelection,
        origin: server.origin,
        record,
        screenshot,
        save,
        running,
        key,
      });
    } else {
      await page.goto(`${server.origin}/game/index.html?edition=${PROTOCOL.editionId}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForDiscoveryBoot({ page, save });
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
          if (
            record.visible !== null ||
            !['won', 'campaign-complete'].includes(overlay.dataset.kind)
          )
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
    }
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
      browser: browserEvidence,
      events,
      errors,
      ...(showcase
        ? {
            showcase: {
              protocolId: plan.protocol,
              ordinaryWins: showcase.ordinaryWins,
              distinctMissionsWon: showcase.distinctMissionsWon,
            },
          }
        : {}),
      limitations: showcase?.limitations ?? [
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
        ...(error.boot ? { boot: error.boot } : {}),
        ...(error.bootEvidenceError ? { bootEvidenceError: error.bootEvidenceError } : {}),
        identity,
        browser: browserEvidence,
        events,
        errors,
        at: new Date().toISOString(),
      },
    });
  } finally {
    await finishDiscoveryObservation({
      page,
      context,
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
