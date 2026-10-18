import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { posix } from 'node:path';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';
import {
  PAGES_ROOT,
  pagesSmokePlan,
  validatePagesSmokePlan,
  redactPagesText,
  encodePagesReport,
  safePagesURL,
  createPagesDiagnostics,
  installPagesLifecycleObserver,
  readPagesDiagnosticState,
  retainPagesPublicEvidence,
  pagesBudget,
  readPagesBinding,
  observePagesSmoke,
  executePagesSoloFlows,
} from './solo-pages-smoke.mjs';
import {
  validatePagesDispatch,
  assessOwnedPagesSmoke,
  runOwnedPagesSmoke,
} from './run-solo-pages-smoke.mjs';

const revision = '1'.repeat(40);
const secret = 'modeled-only/"credential &value';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const validEnv = () => ({
  GITHUB_REPOSITORY: 'mekhovov/revealline',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: revision,
  PAGES_SMOKE_ENGINE: 'chromium',
  REVEALLINE_PAGES_TEST_PASSWORD: secret,
  PATH: process.env.PATH,
  GH_TOKEN: 'must-not-reach-child',
  DEBUG: '*',
});
const closed = () => ({
  status: 'closed',
  exitCode: 0,
  violation: null,
  forcedCleanup: false,
  cleanupUnconfirmed: false,
  survivors: [],
  ambiguous: [],
});
const binding = () => ({ sourceRevision: revision, metadata: { sha256: '2'.repeat(64) } });
const validReport = () => ({
  format: 'RevealLinePublishedPagesSmokeReportV1',
  status: 'passed-controls',
  controlsComplete: true,
  expectedRevision: revision,
  engine: 'chromium',
  browserVersion: 'modeled-123',
  profile: 'fresh-ephemeral',
  performanceExcluded: true,
  cleanup: { context: 'closed', browser: 'closed' },
  bindingBefore: binding(),
  bindingAfter: binding(),
  stages: [
    'ordinary-password-accepted',
    'solo-direct-start-pause-resume',
    'missions-current-selection',
    'settings-demo-return',
    'team-versus-public-return',
  ],
  pages: [
    { total: 0, overflow: false, events: [] },
    { total: 0, overflow: false, events: [] },
  ],
});

test('fixed policy and dispatch refuse widened limits, remote inputs and missing credentials', async () => {
  const plan = await pagesSmokePlan();
  for (const [key, value] of Object.entries({
    root: 'https://example.org/',
    ownerTimeoutMs: 600001,
    flowTimeoutMs: 570001,
    outerTimeoutSeconds: 721,
    jobTimeoutMinutes: 33,
    cleanupTimeoutMs: 10001,
    sharedModeTimeoutMs: 180001,
    reportBytes: 262145,
    maximumEvents: 129,
    privateOutputBytes: 1048577,
    rssBytes: 7 * 1024 ** 3,
    engines: ['chromium', 'firefox'],
    retries: 1,
    node: '22.22.2',
    playwright: 'latest',
    expectedDeployment: 'arbitrary',
  }))
    assert.throws(() => validatePagesSmokePlan({ ...plan, [key]: value }), key);
  validatePagesDispatch(validEnv(), revision, '22.13.1');
  for (const [key, value] of Object.entries({
    GITHUB_REPOSITORY: 'other/repo',
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_REF: 'refs/heads/other',
    GITHUB_SHA: '2'.repeat(40),
    PAGES_SMOKE_ENGINE: 'firefox',
    REVEALLINE_PAGES_TEST_PASSWORD: '',
  }))
    assert.throws(
      () => validatePagesDispatch({ ...validEnv(), [key]: value }, revision, '22.13.1'),
      key,
    );
  assert.throws(() => validatePagesDispatch(validEnv(), revision, '22.22.2'));
});

test('known credential is removed from nested errors, encoded call logs, keys and URLs', () => {
  const value = {
    [secret]: [
      secret,
      JSON.stringify(secret).slice(1, -1),
      encodeURIComponent(secret),
      Buffer.from(secret).toString('base64'),
    ],
  };
  const text = encodePagesReport(value, secret);
  for (const item of Object.values(value)[0]) assert(!text.includes(item));
  assert(!redactPagesText('fill("' + secret + '") failed', secret).includes(secret));
  assert.equal(
    safePagesURL('https://user:pass@example.org/a?password=secret#value', secret),
    'https://example.org/a',
  );
  assert.throws(() => encodePagesReport({ text: 'x'.repeat(100) }, secret, 10), /byte cap/);
});

test('diagnostics retain bounded redacted failures and never serialize console arguments', () => {
  const page = new EventEmitter();
  const observed = createPagesDiagnostics(page, secret, 3);
  page.emit('pageerror', new Error('Call log ' + secret));
  page.emit('console', {
    type: () => 'error',
    text: () => 'safe diagnostic ' + secret,
    args: () => {
      throw new Error('must not inspect console argument objects');
    },
  });
  page.emit('requestfailed', {
    url: () => PAGES_ROOT + encodeURIComponent(secret) + '?q=' + secret,
    resourceType: () => 'script',
    failure: () => ({ errorText: secret }),
  });
  page.emit('response', { status: () => 404, url: () => PAGES_ROOT + '?q=' + secret });
  assert.equal(observed.result.total, 4);
  assert.equal(observed.result.events.length, 3);
  assert.equal(observed.result.overflow, true);
  assert(!JSON.stringify(observed.result).includes(secret));
  observed.detach();
  assert.equal(page.listenerCount('pageerror'), 0);
});

async function publicFetchFixture(change = () => {}) {
  const plan = await pagesSmokePlan();
  const entries = plan.assets.map((path) => ({
    path,
    bytes: Buffer.byteLength(path),
    sha256: sha(path),
  }));
  const files = new Map(plan.assets.map((path) => [path, Buffer.from(path)]));
  files.set(
    'main-deployment.json',
    Buffer.from(
      JSON.stringify({
        format: 'revealline-main-deployment.v1',
        channel: 'main',
        sourceRevision: revision,
        buildVersion: 'main-' + revision.slice(0, 12),
        play: 'game/',
      }),
    ),
  );
  files.set(
    'manifest.json',
    Buffer.from(JSON.stringify({ sourceRevision: revision, files: entries })),
  );
  change(files, entries);
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert(!JSON.stringify(options.headers).includes(secret));
    const path = String(url).slice(PAGES_ROOT.length);
    const body = files.get(path);
    return {
      status: 200,
      url: String(url),
      body: (async function* () {
        yield body;
      })(),
    };
  };
}
test('public binding checks exact deployed source and all five critical bytes', async () => {
  const result = await readPagesBinding(revision, pagesBudget(10000), await publicFetchFixture());
  assert.equal(result.assets.length, 5);
  assert.equal(result.sourceRevision, revision);
});
test('wrong source, changed payload, duplicate inventory and oversized metadata fail before browser admission', async () => {
  const mutations = [
    (files) => {
      const meta = JSON.parse(files.get('main-deployment.json'));
      meta.sourceRevision = '2'.repeat(40);
      files.set('main-deployment.json', Buffer.from(JSON.stringify(meta)));
    },
    (files) => files.set('game/app.mjs', Buffer.from('changed')),
    (files, entries) =>
      files.set(
        'manifest.json',
        Buffer.from(JSON.stringify({ sourceRevision: revision, files: [...entries, entries[0]] })),
      ),
    (files) => files.set('main-deployment.json', Buffer.alloc(16385, 32)),
  ];
  for (const change of mutations)
    await assert.rejects(
      readPagesBinding(revision, pagesBudget(10000), await publicFetchFixture(change)),
    );
});
test('global operation deadline cannot renew or authorize later work', async () => {
  const budget = pagesBudget(10);
  await assert.rejects(
    budget.step('never', () => new Promise(() => {}), 10),
    /expired/,
  );
  let called = false;
  await assert.rejects(
    budget.step('late', () => {
      called = true;
    }),
  );
  assert.equal(called, false);
});

function browserModel(options = {}) {
  const calls = [];
  const pages = [];
  let releaseEarly = null;
  const context = {
    async addInitScript(callback) {
      assert.equal(callback, installPagesLifecycleObserver);
      calls.push('passive-init');
    },
    pages: () =>
      options.extraPage
        ? [new EventEmitter(), ...pages.filter((p) => !p.closed)]
        : pages.filter((p) => !p.closed),
    async newPage() {
      const page = new EventEmitter();
      let pageURL = '';
      page.url = () => pageURL;
      page.isClosed = () => Boolean(page.closed);
      page.evaluate = async (callback) => {
        assert.equal(callback, readPagesDiagnosticState);
        calls.push('public-evidence');
        if (options.evidenceFailure) throw new Error('evidence failed ' + secret);
        const value = {
          flightState: options.soloFailure ? 'paused' : 'briefing',
          runMessage: 'warning ' + secret,
          lifecycle: options.missingLifecycle
            ? null
            : {
                format: 'PagesPublicLifecycleV1',
                timeBasis: 'document-performance.now',
                timeOrigin: 1000,
                total: 2,
                omitted: options.evidenceOverflow ? 1 : 0,
                overflow: options.evidenceOverflow === true,
                retained: [
                  {
                    sequence: 1,
                    atMs: 0,
                    kind: 'installed',
                    clockInvalid: options.evidenceClockInvalid === true,
                  },
                ],
              },
        };
        if (options.earlyEvidenceLate && !releaseEarly) {
          return new Promise((resolve) => {
            releaseEarly = () => resolve({ ...value, runMessage: 'late earlier observation' });
          });
        }
        return value;
      };
      page.goto = async (url) => {
        pageURL = options.redirect ? 'https://example.org/game/' : url;
        calls.push('goto');
      };
      page.close = async () => {
        calls.push('page.close');
        if (!options.closeIgnored) page.closed = true;
      };
      page.locator = (selector) => ({
        waitFor: async () => calls.push('visible:' + selector),
        fill: async (value) => {
          assert.equal(value, secret);
          calls.push('password.fill');
          if (options.afterFillRedirect) pageURL = 'https://example.org/game/';
        },
        click: async () => calls.push('click:' + selector),
      });
      page.waitForFunction = async () => {
        if (options.authFailure) throw new Error('fill "' + secret + '" rejected');
        calls.push('password.accepted');
      };
      pages.push(page);
      return page;
    },
    async close() {
      calls.push('context.close');
      if (options.lateError) pages[0].emit('pageerror', new Error('late ' + secret));
      if (options.contextFailure) throw new Error('context close ' + secret);
    },
  };
  const browser = {
    version: () => 'modeled-' + (options.engine ?? 'chromium'),
    async newContext(settings) {
      assert(!Object.hasOwn(settings, 'storageState'));
      if (options.contextCreationFailure) throw new Error('context creation');
      calls.push('fresh-context');
      return context;
    },
    async close() {
      calls.push('browser.close');
      if (options.browserFailure) throw new Error('browser close');
    },
  };
  return {
    calls,
    pages,
    releaseEarly: () => releaseEarly?.(),
    browserType: {
      async launch(settings) {
        assert.equal(settings.env.REVEALLINE_PAGES_TEST_PASSWORD, undefined);
        assert.equal(settings.env.DEBUG, undefined);
        calls.push('browser.launch');
        return browser;
      },
    },
  };
}
async function observeModel(options = {}) {
  const model = browserModel(options);
  const retained = [];
  let bindings = 0,
    clock = 0;
  let soloCalls = 0,
    sharedCalls = 0;
  const report = await observePagesSmoke({
    expectedRevision: revision,
    engine: options.engine ?? 'chromium',
    password: secret,
    browserType: model.browserType,
    ...(options.earlyEvidenceLate ? { now: () => clock } : {}),
    checkpoint: async (value) => retained.push(value),
    binding: async () => {
      bindings++;
      return options.deploymentChange && bindings === 2
        ? { ...binding(), changed: true }
        : binding();
    },
    soloFlows: async () => {
      soloCalls++;
      if (options.earlyEvidenceLate) clock = 569999;
      if (options.soloFailure) throw new Error('public flow failed ' + secret);
    },
    sharedFlows: async ({ record, deadline, now }) => {
      assert(deadline - now() <= 180000);
      sharedCalls++;
      record.status = 'modeled-public-control';
    },
    sharedAssessment: () => ({ status: 'modeled-public-control' }),
  });
  return { ...model, report, retained, soloCalls, sharedCalls };
}
test('fresh observer admits ordinary authentication and closes context before browser', async () => {
  const result = await observeModel();
  assert.equal(result.report.status, 'passed-controls');
  assert.equal(result.soloCalls, 1);
  assert.equal(result.sharedCalls, 1);
  assert.deepEqual(result.calls.slice(-2), ['context.close', 'browser.close']);
  assert.equal(result.calls.filter((x) => x === 'password.fill').length, 1);
});
test('both fixed desktop engines are labelled and unknown/mismatched engines are refused', async () => {
  for (const engine of ['chromium', 'webkit']) {
    const result = await observeModel({ engine });
    assert.equal(result.report.status, 'passed-controls');
    assert.equal(result.report.engine, engine);
    assert.equal(result.report.browserVersion, 'modeled-' + engine);
    assessOwnedPagesSmoke({ ...validReport(), engine }, closed(), revision, engine);
  }
  await assert.rejects(observeModel({ engine: 'firefox' }), /engine/);
  assert.throws(() => assessOwnedPagesSmoke(validReport(), closed(), revision, 'webkit'));
  assert.throws(() => assessOwnedPagesSmoke(validReport(), closed(), revision, 'firefox'));
});

test('redirected or changed credential document cannot receive a fill or submission', async () => {
  const redirected = await observeModel({ redirect: true });
  assert.equal(redirected.report.status, 'failed');
  assert(!redirected.calls.includes('password.fill'));
  assert(!redirected.calls.includes('click:#access-gate button[type="submit"]'));
  const changed = await observeModel({ afterFillRedirect: true });
  assert.equal(changed.report.status, 'failed');
  assert(changed.calls.includes('password.fill'));
  assert(!changed.calls.includes('click:#access-gate button[type="submit"]'));
});

test('authentication failure retains safe evidence and never enters public flows', async () => {
  const result = await observeModel({ authFailure: true });
  assert.equal(result.report.status, 'failed');
  assert.equal(result.soloCalls + result.sharedCalls, 0);
  assert.deepEqual(result.calls.slice(-2), ['context.close', 'browser.close']);
  assert(!JSON.stringify(result.retained).includes(secret));
});
test('unexpected initial page or unclosed Solo page cannot be accepted', async () => {
  for (const options of [{ extraPage: true }, { closeIgnored: true }]) {
    const result = await observeModel(options);
    assert.equal(result.report.status, 'failed');
    assert.equal(result.sharedCalls, 0);
    assert.equal(result.calls.at(-1), 'browser.close');
  }
});

test('initial context failure still closes the launched browser', async () => {
  const result = await observeModel({ contextCreationFailure: true });
  assert.equal(result.report.status, 'failed');
  assert.equal(result.calls.at(-1), 'browser.close');
  assert.equal(result.report.cleanup.context, 'not-created');
});
test('partial public failure cannot advance to shared navigation', async () => {
  const result = await observeModel({ soloFailure: true });
  assert.equal(result.report.status, 'failed');
  assert.equal(result.sharedCalls, 0);
  assert(!JSON.stringify(result.retained).includes(secret));
});
test('late diagnostics, deployment changes and either cleanup failure cannot become a pass', async () => {
  for (const options of [
    { lateError: true },
    { deploymentChange: true },
    { contextFailure: true },
    { browserFailure: true },
  ]) {
    const result = await observeModel(options);
    assert.equal(result.report.status, 'failed', JSON.stringify(options));
    assert.equal(result.calls.at(-1), 'browser.close');
  }
});
test('missing credential fails before browser launch', async () => {
  let called = false;
  await assert.rejects(
    observePagesSmoke({
      expectedRevision: revision,
      engine: 'chromium',
      password: '',
      browserType: {
        launch() {
          called = true;
        },
      },
    }),
    /credential/,
  );
  assert.equal(called, false);
});

function soloPageModel(options = {}) {
  let now = 0,
    time = 0,
    demoTime = 0;
  const controls = Object.fromEntries(
    [
      'shell-home',
      'shell-featured',
      'mission-replace-dialog',
      'mode-leave-dialog',
      'journey-chooser',
      'journey-back',
      'shell-play',
      'start-button',
      'pause-button',
      'shell-menu',
      'settings-dialog',
      'settings-tab-extras',
      'shell-demo',
      'demo-dialog',
      'demo-back',
      'shell-options',
    ].map((id) => [id, { visible: false, enabled: true, open: false }]),
  );
  const state = {
    hidden: false,
    focused: true,
    bootState: 'ready',
    bootHidden: true,
    flightState: 'briefing',
    controls,
    journeyMode: 'solo',
    current: [{ enabled: true, availability: 'included' }],
    time: '0:00',
    lives: '3',
    coverage: '0%',
    demoScene: '',
    demoLevel: '',
    demoStatus: '',
  };
  controls['shell-home'] = { visible: true, enabled: true, open: true };
  controls['shell-featured'] = { visible: true, enabled: true, open: false };
  const calls = [];
  const page = {
    async evaluate() {
      if (options.lateHome && now === 0) now = 120001;
      if (state.flightState === 'running') state.time = '0:' + ++time;
      if (controls['demo-dialog'].open) state.demoStatus = 'Demo ' + ++demoTime;
      if (options.ambiguousCurrent && controls['journey-chooser'].open)
        state.current = [
          { enabled: true, availability: 'included' },
          { enabled: true, availability: 'ready' },
        ];
      return structuredClone(state);
    },
    async waitForTimeout(ms) {
      now += ms;
      if (options.pausedClockChanges && state.flightState === 'paused') state.time = 'changed';
    },
    locator(selector) {
      return {
        async click() {
          calls.push(selector);
          if (selector === '#shell-featured') {
            controls['shell-home'].open = false;
            state.flightState = options.directStartPaused ? 'paused' : 'running';
            controls['start-button'].visible = options.directStartPaused === true;
            if (options.directStartPaused) state.runMessage = 'Paused after a long frame';
          } else if (selector === '#shell-play') {
            controls['shell-home'].open = false;
            controls['journey-chooser'] = { visible: true, enabled: true, open: true };
          } else if (selector === '#journey-back') {
            controls['journey-chooser'].open = false;
            controls['shell-home'].open = true;
          } else if (selector.startsWith('.journey-card')) {
            controls['journey-chooser'].open = false;
            controls['shell-home'].open = false;
            controls['start-button'].visible = true;
            state.flightState = 'briefing';
            if (options.unexpectedConfirmation) controls['mission-replace-dialog'].open = true;
          } else if (selector === '#start-button') {
            state.flightState = 'running';
            controls['start-button'].visible = false;
          } else if (selector === '#pause-button') {
            state.flightState = 'paused';
            controls['start-button'].visible = true;
          } else if (selector === '#shell-menu') {
            controls['shell-home'].open = true;
          } else if (selector === '#shell-options') {
            controls['settings-dialog'] = { visible: true, open: true, enabled: true };
          } else if (selector === '#shell-demo') {
            controls['settings-dialog'].open = false;
            controls['demo-dialog'] = { visible: true, open: true, enabled: true };
            state.demoScene = 'playing';
            state.demoLevel = 'First return';
            state.demoStatus = 'Demo 0';
          } else if (selector === '#demo-back') {
            controls['demo-dialog'].open = false;
            controls['settings-dialog'].open = true;
          }
        },
      };
    },
  };
  return { page, calls, now: () => now };
}
test('actual Solo driver starts directly before Missions, then uses Resume and restored Settings', async () => {
  const model = soloPageModel();
  const record = { actions: [], samples: [] };
  await executePagesSoloFlows(model.page, pagesBudget(570000, model.now), record);
  assert.deepEqual(record.actions, [
    '#shell-featured',
    '#pause-button',
    '#start-button',
    '#pause-button',
    '#shell-menu',
    '#shell-play',
    '#journey-back',
    '#shell-play',
    '.journey-card[data-current="true"]:visible',
    '#shell-menu',
    '#shell-options',
    '#settings-tab-extras',
    '#shell-demo',
    '#demo-back',
  ]);
  assert.equal(record.samples.at(-1).phase, 'settings-restored');
  assert.equal(record.samples.at(-1).state.controls['settings-dialog'].open, true);
});
test('actual Solo driver refuses ambiguous selection and a clock moving during Pause', async () => {
  for (const options of [
    { ambiguousCurrent: true },
    { pausedClockChanges: true },
    { unexpectedConfirmation: true },
  ]) {
    const model = soloPageModel(options);
    await assert.rejects(
      executePagesSoloFlows(model.page, pagesBudget(570000, model.now), {
        actions: [],
        samples: [],
      }),
    );
    assert(!model.calls.includes('#shell-demo'));
  }
});
test('phase waiter rejects a late successful Home read before taking any public action', async () => {
  const model = soloPageModel({ lateHome: true });
  await assert.rejects(
    executePagesSoloFlows(model.page, pagesBudget(570000, model.now), {
      actions: [],
      samples: [],
    }),
    /Public state deadline: Home/,
  );
  assert.deepEqual(model.calls, []);
});

test('owner assessment rejects closed-looking reports with every failed closure boundary', () => {
  assessOwnedPagesSmoke(validReport(), closed(), revision, 'chromium');
  for (const patch of [
    { exitCode: 1 },
    { status: 'failed' },
    { violation: 'deadline' },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { survivors: [{ pid: 1 }] },
    { ambiguous: [{ pid: 2 }] },
  ])
    assert.throws(() =>
      assessOwnedPagesSmoke(validReport(), { ...closed(), ...patch }, revision, 'chromium'),
    );
  for (const patch of [
    { failure: 'late failure' },
    { cleanupFailure: 'context' },
    { status: 'incomplete' },
    { browserVersion: '' },
    { browserVersion: 'x'.repeat(129) },
    { expectedRevision: '2'.repeat(40) },
  ])
    assert.throws(() =>
      assessOwnedPagesSmoke({ ...validReport(), ...patch }, closed(), revision, 'chromium'),
    );
});
async function ownedModel(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pages-smoke-test-'));
  try {
    const moduleRoot = join(root, 'node_modules/playwright');
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(join(moduleRoot, 'package.json'), JSON.stringify({ version: '1.62.1' }));
    let sources = 0;
    const output = join(root, 'public');
    const result = await runOwnedPagesSmoke({
      expectedRevision: revision,
      playwrightPath: join(moduleRoot, 'index.mjs'),
      output,
      env: validEnv(),
      platformNode: '22.13.1',
      sourceIdentity: () => ({
        revision,
        tree: options.changedSource && ++sources > 1 ? 'changed' : 'tree',
      }),
      owner: async (argv, settings) => {
        assert(!argv.join(' ').includes(secret));
        assert.equal(settings.env.REVEALLINE_PAGES_TEST_PASSWORD, secret);
        assert.equal(settings.env.GH_TOKEN, undefined);
        assert.equal(settings.env.DEBUG, undefined);
        assert.equal(settings.timeoutMs, 600000);
        assert.equal(settings.rssBytes, 6 * 1024 ** 3);
        await writeFile(settings.log, 'unexpected call log ' + secret);
        await writeFile(argv[5], JSON.stringify({ ...validReport(), extra: secret }));
        if (options.throwOwner) {
          await writeFile(settings.receipt, JSON.stringify({ status: 'failed', error: secret }));
          throw new Error(secret);
        }
        return { ...closed(), ...(options.ownerFailure ? { forcedCleanup: true } : {}) };
      },
    });
    const retained = Object.fromEntries(
      await Promise.all(
        (await readdir(output)).map(async (name) => [
          name,
          await readFile(join(output, name), 'utf8'),
        ]),
      ),
    );
    assert(!JSON.stringify(retained).includes(secret));
    return { result, retained };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('actual owner launcher redacts private child output and does not forward unrelated secrets', async () => {
  const { result, retained } = await ownedModel();
  assert.equal(result.status, 'passed-controls');
  assert(retained['child-log.json'].includes('[redacted]'));
  assert(retained['report.json'].includes('[redacted]'));
});
test('actual owner launcher retains failures, partial reports and changed-source refusal', async () => {
  for (const options of [{ ownerFailure: true }, { throwOwner: true }, { changedSource: true }]) {
    const { result, retained } = await ownedModel(options);
    assert.equal(result.status, 'failed', JSON.stringify(options));
    assert(retained['summary.json']);
    assert(retained['report.json']);
  }
});
test(
  'real owned child deadline is failed cleanup authority, never a successful smoke',
  { skip: process.platform !== 'linux' },
  async () => {
    const { ownedCommand } = await import('./run-solo-remote-correctness.mjs');
    const root = await mkdtemp(join(tmpdir(), 'pages-owner-control-'));
    try {
      const record = await ownedCommand([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
        cwd: root,
        env: { PATH: process.env.PATH },
        log: join(root, 'child.log'),
        timeoutMs: 250,
        outputBytes: 4096,
        rssBytes: 256 * 1024 ** 2,
      });
      assert.equal(record.status, 'failed');
      assert.equal(record.violation, 'deadline');
      assert.equal(record.forcedCleanup, true);
      assert.deepEqual(record.survivors, []);
      assert.throws(() => assessOwnedPagesSmoke(validReport(), record, revision, 'chromium'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
test('actual child import failure produces only a redacted bounded failure envelope', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pages-child-control-'));
  try {
    const output = join(root, 'report.json');
    const child = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./solo-pages-smoke.mjs', import.meta.url)),
        revision,
        'chromium',
        join(root, secret, 'missing.mjs'),
        output,
      ],
      {
        env: { PATH: process.env.PATH, REVEALLINE_PAGES_TEST_PASSWORD: secret },
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 16384,
      },
    );
    assert.equal(child.status, 1);
    assert(!child.stdout.includes(secret) && !child.stderr.includes(secret));
    const raw = await readFile(output, 'utf8');
    assert(!raw.includes(secret));
    assert.equal(JSON.parse(raw).status, 'failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('fixed workflow separates PR source checks from secret-bearing main-only browser execution', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/published-pages-smoke.yml', import.meta.url),
    'utf8',
  );
  assert(workflow.includes('types: [opened, synchronize, reopened]'));
  assert(workflow.includes("node-version: '22.13.1'"));
  assert(workflow.includes('node --test scripts/solo-pages-smoke.test.mjs'));
  const browser = workflow.split('\n  browser:\n')[1];
  assert(browser);
  assert(browser.includes('needs: source'));
  assert(browser.includes('engine: [chromium, webkit]'));
  assert(browser.includes('fail-fast: false'));
  assert(browser.includes('PAGES_SMOKE_ENGINE: $' + '{{ matrix.engine }}'));
  assert(browser.includes('published-pages-controls-$' + '{{ matrix.engine }}-'));
  assert(
    browser.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"),
  );
  assert(browser.includes('EXPECTED_DEPLOYED_SHA: $' + '{{ github.sha }}'));
  assert(
    browser.includes(
      'REVEALLINE_PAGES_TEST_PASSWORD: $' + '{{ secrets.REVEALLINE_PAGES_TEST_PASSWORD }}',
    ),
  );
  assert(!workflow.split('\n  browser:\n')[0].includes('secrets.'));
  assert(!workflow.includes('inputs:'));
  assert(
    browser.includes(
      'timeout --signal=TERM --kill-after=30s 12m node scripts/run-solo-pages-smoke.mjs',
    ),
  );
  assert(!browser.includes('child.log'));
  assert(!browser.includes('trace.zip'));
  assert(browser.includes('failure-envelope.json'));
  const source = await readFile(new URL('./solo-pages-smoke.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['storageState:', '.route(', 'tracing.start(', 'recordVideo:'])
    assert(!source.includes(forbidden));
  assert.equal((source.match(/\.addInitScript\(/g) ?? []).length, 1);
  assert(source.includes('context.addInitScript(installPagesLifecycleObserver)'));
  assert(!installPagesLifecycleObserver.toString().includes('setTimeout'));
  assert(!installPagesLifecycleObserver.toString().includes('requestAnimationFrame'));
});

test('both exact jobs contain the actual Linux owner import and direct-read closure', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/published-pages-smoke.yml', import.meta.url),
    'utf8',
  );
  const needed = new Set([
    'package.json',
    'package-lock.json',
    '.prettierrc.json',
    '.prettierignore',
    'eslint.config.mjs',
    'scripts/eslint-localization.mjs',
    '.github/workflows/published-pages-smoke.yml',
    'docs/performance/solo-published-pages-smoke-plan.json',
    // Actual top-level reads in the unchanged localization import.
    'game/vendor/lz-string-1.5.0.min.js',
    'game/vendor/LZ-STRING-LICENSE.txt',
  ]);
  const queue = [
    'scripts/solo-pages-smoke.test.mjs',
    'scripts/run-solo-pages-smoke.mjs',
    // Exact Linux-only dynamic owner import; unrelated modes are not executed.
    'scripts/run-solo-remote-correctness.mjs',
  ];
  const visited = new Set();
  while (queue.length) {
    const path = queue.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    needed.add(path);
    const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    for (const node of ast.body) {
      if (
        !['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
      )
        continue;
      const relative = node.source?.value;
      if (typeof relative !== 'string' || !relative.startsWith('.')) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), relative));
      assert(!target.startsWith('../'));
      queue.push(target);
    }
  }
  const check = (job) => {
    assert(
      job.includes('npm ci --ignore-scripts --no-audit --no-fund'),
      'Owner dependencies must be installed',
    );
    const match = job.match(/          sparse-checkout: \|\n((?:            .*\n)+)/);
    assert(match, 'Exact sparse checkout required');
    const paths = new Set(
      match[1]
        .trim()
        .split('\n')
        .map((line) => line.trim()),
    );
    for (const path of needed)
      assert(paths.has('/' + path), 'Missing actual source/read input: ' + path);
  };
  const sourceJob = workflow.split('\n  source:\n')[1].split('\n  browser:\n')[0];
  const browserJob = workflow.split('\n  browser:\n')[1];
  for (const job of [sourceJob, browserJob]) {
    check(job);
    for (const missing of [
      'scripts/run-solo-remote-correctness.mjs',
      'game/vendor/lz-string-1.5.0.min.js',
      'game/vendor/LZ-STRING-LICENSE.txt',
    ])
      assert.throws(
        () => check(job.replace('            /' + missing + '\n', '')),
        /Missing actual/,
      );
    assert.throws(
      () => check(job.replace('npm ci --ignore-scripts --no-audit --no-fund', 'echo omitted')),
      /dependencies/,
    );
  }
});

function lifecycleModel({ bodyInitially = true } = {}) {
  const win = new EventEmitter(),
    doc = new EventEmitter();
  const body = {
    dataset: { flightState: 'briefing' },
    getAttribute: (name) => (name === 'data-flight-state' ? body.dataset.flightState : null),
  };
  const nodes = new Map([
    [
      'run-message',
      { textContent: 'Paused after a long frame', dataset: { cue: 'paused-resume' } },
    ],
    ['flight-preparation-status', { textContent: '', dataset: {} }],
    ['presentation-preparation-status', { textContent: 'Ready', dataset: {} }],
  ]);
  let now = 0,
    mutation,
    observations = 0;
  win.top = win;
  win.addEventListener = (name, handler) => win.on(name, handler);
  doc.addEventListener = (name, handler) => doc.on(name, handler);
  doc.hidden = false;
  doc.visibilityState = 'visible';
  doc.hasFocus = () => !doc.hidden;
  doc.body = bodyInitially ? body : null;
  doc.getElementById = (id) => nodes.get(id) ?? null;
  const environment = {
    window: win,
    document: doc,
    performance: { now: () => now, timeOrigin: 123456 },
    MutationObserver: class {
      constructor(callback) {
        mutation = callback;
      }
      observe(target, options) {
        assert.equal(target, body);
        assert.deepEqual(JSON.parse(JSON.stringify(options)), {
          attributes: true,
          attributeFilter: ['data-flight-state'],
          attributeOldValue: true,
        });
        observations++;
      }
    },
  };
  runInNewContext('(' + installPagesLifecycleObserver.toString() + ')()', environment);
  return {
    environment,
    win,
    doc,
    body,
    nodes,
    observations: () => observations,
    read: () => JSON.parse(JSON.stringify(environment.__revealLinePagesLifecycle.read())),
    diagnostic: () =>
      JSON.parse(
        JSON.stringify(
          runInNewContext('(' + readPagesDiagnosticState.toString() + ')()', environment),
        ),
      ),
    at(value) {
      now = value;
    },
    event(kind, extra = {}) {
      win.emit(kind, { target: win, ...extra });
    },
    change(states) {
      const records = states.slice(0, -1).map((oldValue) => ({
        target: body,
        attributeName: 'data-flight-state',
        oldValue,
      }));
      body.dataset.flightState = states.at(-1);
      mutation(records);
    },
  };
}
test('serialized passive observer retains coalesced Start and Pause plus real window lifecycle', () => {
  const model = lifecycleModel({ bodyInitially: false });
  assert.equal(model.observations(), 0);
  model.doc.body = model.body;
  model.doc.emit('DOMContentLoaded');
  assert.equal(model.observations(), 1);
  model.at(12);
  model.change(['briefing', 'running', 'paused']);
  model.win.emit('blur', { target: model.body });
  model.at(13);
  model.event('blur');
  model.doc.hidden = true;
  model.doc.visibilityState = 'hidden';
  model.doc.emit('visibilitychange');
  model.at(15);
  model.doc.hidden = false;
  model.doc.visibilityState = 'visible';
  model.event('focus');
  const observed = model.read();
  assert.deepEqual(
    observed.retained
      .filter((event) => event.kind === 'flight-state')
      .map(({ from, to, atMs }) => ({ from, to, atMs })),
    [
      { from: 'briefing', to: 'running', atMs: 12 },
      { from: 'running', to: 'paused', atMs: 12 },
    ],
  );
  assert.equal(observed.retained.filter((event) => event.kind === 'blur').length, 1);
  assert.equal(observed.retained.find((event) => event.kind === 'visibilitychange').hidden, true);
  assert.equal(observed.retained.at(-1).focused, true);
  assert.equal(observed.timeBasis, 'document-performance.now');
  assert.equal(observed.timeOrigin, 123456);
  assert.equal(observed.omitted, 0);
});
test('passive ring preserves initial Start/Pause and latest events with explicit bounded omission', () => {
  const model = lifecycleModel();
  model.change(['briefing', 'running', 'paused']);
  for (let i = 0; i < 100; i++) {
    model.at(i + 1);
    model.event(i % 2 ? 'focus' : 'blur');
  }
  const observed = model.read();
  assert.equal(observed.retained.length, 64);
  assert.equal(observed.omitted, observed.total - 64);
  assert.equal(observed.overflow, true);
  assert.equal(observed.retained[0].sequence, 1);
  assert.equal(observed.retained[15].sequence, 16);
  assert.equal(observed.retained[16].sequence, observed.total - 47);
  assert.equal(observed.retained.at(-1).sequence, observed.total);
  assert.deepEqual(
    observed.retained.filter((event) => event.kind === 'flight-state').map((event) => event.to),
    ['running', 'paused'],
  );
});
test('observer ignores unchanged labels and records invalid clock without inventing timing', () => {
  const model = lifecycleModel();
  const before = model.read().total;
  model.change(['briefing', 'briefing', 'briefing']);
  assert.equal(model.read().total, before);
  model.at(10);
  model.event('pageshow', { persisted: true });
  model.at(9);
  model.event('pagehide');
  assert.equal(model.read().retained.at(-1).clockInvalid, true);
  assert.equal(model.read().retained.at(-2).persisted, true);
  model.change(['briefing', 'x'.repeat(10000)]);
  assert.equal(model.read().retained.at(-1).to, '[over-limit public label]');
});
test('actual public diagnostic getter reads warning/preparation only and never keeps a truncated secret prefix', async () => {
  const model = lifecycleModel();
  model.nodes.get('run-message').textContent = 'notice ' + secret;
  model.nodes.get('flight-preparation-status').textContent = 'Getting ready';
  model.nodes.get('presentation-preparation-status').textContent = 'x'.repeat(1020) + secret;
  const value = model.diagnostic();
  assert.equal(value.runMessage, 'notice ' + secret);
  assert.equal(value.runMessageCue, 'paused-resume');
  assert.equal(value.preparation, 'Getting ready');
  assert.equal(value.presentation, '[public text exceeds 1024 characters]');
  const page = new EventEmitter();
  page.evaluate = async () => value;
  const observed = createPagesDiagnostics(page, secret);
  await observed.capturePublic();
  const encoded = JSON.stringify(observed.result.publicEvidence);
  assert(!encoded.includes(secret));
  assert(encoded.includes('[redacted]'));
  assert.equal(observed.result.publicEvidence.lifecycle.format, 'PagesPublicLifecycleV1');
});
test('console diagnostic text is redacted before truncation and inaccessible text does not throw', () => {
  const page = new EventEmitter();
  const observed = createPagesDiagnostics(page, secret);
  for (const value of [
    secret,
    JSON.stringify(secret).slice(1, -1),
    encodeURIComponent(secret),
    Buffer.from(secret).toString('base64'),
  ]) {
    page.emit('console', {
      type: () => 'warning',
      text: () => 'x'.repeat(1000) + value + 'tail',
      args: () => {
        throw new Error('argument objects must never be inspected');
      },
    });
    const retained = observed.result.events.at(-1).message;
    assert(retained.includes('[redacted]'));
    assert(!retained.includes(value.slice(0, 12)));
    assert(retained.length <= 1024);
  }
  assert.doesNotThrow(() =>
    page.emit('console', {
      type: () => 'error',
      text: () => {
        throw new Error(secret);
      },
    }),
  );
  assert.equal(observed.result.events.at(-1).textReadFailure, true);
});
test('failed Solo flow retains final public warning before cleanup without replacing its primary failure', async () => {
  const result = await observeModel({ soloFailure: true });
  assert.match(result.report.failure, /^public flow failed/);
  assert.equal(result.sharedCalls, 0);
  assert.equal(result.report.pages[0].publicEvidence.flightState, 'paused');
  assert.equal(result.report.pages[0].publicEvidence.runMessage, 'warning [redacted]');
  assert(result.calls.indexOf('public-evidence') < result.calls.indexOf('context.close'));
  const both = await observeModel({ soloFailure: true, evidenceFailure: true });
  assert.match(both.report.failure, /^public flow failed/);
  assert.match(both.report.publicEvidenceFailure, /^evidence failed/);
  assert(!JSON.stringify(both.retained).includes(secret));
  assert.deepEqual(both.calls.slice(-2), ['context.close', 'browser.close']);
});
test('missing, overflowed or clock-invalid public evidence cannot pass otherwise complete controls', async () => {
  for (const options of [
    { missingLifecycle: true },
    { evidenceOverflow: true },
    { evidenceClockInvalid: true },
  ]) {
    const result = await observeModel(options);
    assert.equal(result.report.status, 'failed');
    assert(result.report.failure);
    assert.deepEqual(result.calls.slice(-2), ['context.close', 'browser.close']);
  }
});
test('final evidence deadline stops later reads and rejects late result retention', async () => {
  const page = new EventEmitter();
  let resolve,
    laterCalls = 0;
  page.isClosed = () => false;
  page.evaluate = () =>
    new Promise((ready) => {
      resolve = ready;
    });
  const observed = createPagesDiagnostics(page, secret);
  const failure = await retainPagesPublicEvidence(
    [observed, { page: { isClosed: () => false }, capturePublic: async () => laterCalls++ }],
    secret,
    1,
  );
  assert.equal(failure, 'Public evidence read deadline');
  resolve({
    lifecycle: { format: 'PagesPublicLifecycleV1', omitted: 0, overflow: false, retained: [] },
  });
  await new Promise((ready) => setImmediate(ready));
  assert.equal(observed.result.publicEvidence, undefined);
  assert.equal(laterCalls, 0);
  await assert.rejects(retainPagesPublicEvidence([], secret, 5001), /budget/);
});
test('a Direct Start returning to paused remains failure without automatic Resume or extra public actions', async () => {
  const model = soloPageModel({ directStartPaused: true });
  const record = { actions: [], samples: [] };
  await assert.rejects(
    executePagesSoloFlows(model.page, pagesBudget(570000, model.now), record),
    /Solo running/,
  );
  assert.deepEqual(model.calls, ['#shell-featured']);
  assert.equal(record.lastPublicState.flightState, 'paused');
  assert.equal(record.lastPublicState.runMessage, 'Paused after a long frame');
});

test('late first Start and Pause retain reserved slots after earlier lifecycle overflow', () => {
  const model = lifecycleModel();
  for (let i = 0; i < 100; i++) {
    model.at(i + 1);
    model.event('blur');
  }
  model.change(['briefing', 'running', 'paused']);
  for (let i = 0; i < 100; i++) {
    model.at(i + 101);
    model.event('focus');
  }
  const observed = model.read();
  assert.equal(observed.retained.length, 64);
  assert.equal(observed.omitted, observed.total - 64);
  assert.deepEqual(
    observed.retained
      .filter((event) => event.kind === 'flight-state')
      .map(({ from, to }) => ({ from, to })),
    [
      { from: 'briefing', to: 'running' },
      { from: 'running', to: 'paused' },
    ],
  );
  assert.equal(observed.retained.at(-1).sequence, observed.total);
});

test('actual early-success evidence timeout cannot overwrite the final failed-flow observation', async () => {
  // The unchanged global flow budget leaves 1ms for the normal early capture.
  // Its evaluate remains pending through the final read and both cleanup calls.
  const result = await observeModel({ earlyEvidenceLate: true });
  assert.equal(result.report.status, 'failed');
  assert.match(result.report.failure, /retain Solo public evidence|Pages smoke deadline expired/);
  assert.equal(result.sharedCalls, 0);
  assert.equal(result.report.pages[0].publicEvidence.runMessage, 'warning [redacted]');
  assert.deepEqual(result.calls.slice(-2), ['context.close', 'browser.close']);
  const before = JSON.stringify(result.report.pages[0].publicEvidence);
  result.releaseEarly();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.stringify(result.report.pages[0].publicEvidence), before);
});
