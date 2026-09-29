import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createEditionZip } from '../publishing/edition-zip.mjs';
import { PREVIEW_SECURITY_HEADERS } from './game-cli.mjs';
import {
  validateDiscoveryRuntimePlan,
  verifyDiscoveryRuntimeArtifact,
  serveDiscoveryRuntime,
  observeDiscoveryRuntime,
  finishDiscoveryObservation,
  recordDiscoveryFailureEvidence,
  DISCOVERY_SHOWCASE_PROTOCOLS,
  executeDiscoveryShowcaseRoute,
  validateDiscoveryShowcaseState,
  validateDiscoveryShowcaseCopy,
  selectDiscoveryShowcaseCard,
  visitDiscoveryShowcaseCollection,
} from './observe-discovery-runtime.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('cleanup failures cannot leave successful completion evidence and do not hide a primary failure', async () => {
  for (const primary of [null, new Error('Original measurement failed')]) {
    const saved = new Map(),
      sequence = [];
    const browserFailure = new Error('Browser close rejected');
    await assert.rejects(
      finishDiscoveryObservation({
        browser: {
          async close() {
            sequence.push('browser');
            throw browserFailure;
          },
        },
        server: {
          async close() {
            sequence.push('server');
          },
        },
        save: async (name, value) => {
          sequence.push(name);
          saved.set(name, value);
        },
        complete: { qualified: false, completed: true },
        error: primary,
      }),
      (error) =>
        primary
          ? error === primary
          : error instanceof AggregateError && error.errors[0] === browserFailure,
    );
    assert.equal(saved.has('complete.json'), false);
    assert.deepEqual(
      sequence.filter((name) => !name.endsWith('.json')),
      ['browser', 'server'],
    );
    const cleanup = saved.get('cleanup.json');
    assert.equal(cleanup.completed, false);
    assert.equal(cleanup.operations.find((row) => row.name === 'browser').closed, false);
    assert.equal(cleanup.operations.find((row) => row.name === 'server').closed, true);
    assert.equal(cleanup.primaryError, primary?.stack ?? null);
    if (!primary) assert.equal(saved.get('failure.json').completed, false);
  }
});

test('successful completion is finalized after the browser and server close', async () => {
  const sequence = [];
  await finishDiscoveryObservation({
    browser: {
      async close() {
        sequence.push('browser');
      },
    },
    server: {
      async close() {
        sequence.push('server');
      },
    },
    save: async (name, value) => {
      sequence.push(name);
      if (['cleanup.json', 'complete.json'].includes(name))
        assert.equal(value.cleanup?.completed ?? value.completed, true);
    },
    complete: { qualified: false, completed: true },
  });
  assert.deepEqual(sequence, [
    'cleanup-browser-start.json',
    'browser',
    'cleanup-browser-outcome.json',
    'cleanup-server-start.json',
    'server',
    'cleanup-server-outcome.json',
    'cleanup.json',
    'complete.json',
  ]);
});

test('owned page and context close before a browser that cannot finish with active contexts', async () => {
  const calls = [],
    saved = new Map();
  let pageClosed = false,
    contextClosed = false;
  await finishDiscoveryObservation({
    page: {
      evaluate: async () => calls.push('observer'),
      close: async (options) => {
        calls.push('page');
        assert.deepEqual(options, { runBeforeUnload: false });
        pageClosed = true;
      },
    },
    context: {
      close: async () => {
        calls.push('context');
        assert.equal(pageClosed, true, 'The owned page must have finished closing.');
        contextClosed = true;
      },
    },
    cdp: { detach: async () => calls.push('cdp') },
    browser: {
      close: () => {
        calls.push('browser');
        return contextClosed ? Promise.resolve() : new Promise(() => {});
      },
    },
    server: { close: async () => calls.push('server') },
    cleanupTimeoutMs: 10,
    save: async (name, value) => {
      if (name === 'complete.json')
        assert.deepEqual(calls, ['observer', 'cdp', 'page', 'context', 'browser', 'server']);
      saved.set(name, structuredClone(value));
    },
    complete: { qualified: false, completed: true },
  });
  assert.equal(saved.get('complete.json').completed, true);
  for (const name of calls) {
    assert.equal(saved.get(`cleanup-${name}-start.json`).timeoutMs, 10);
    assert.equal(saved.get(`cleanup-${name}-outcome.json`).closed, true);
    assert.equal(saved.get(`cleanup-${name}-outcome.json`).timedOut, false);
  }
});

test('never-settling observer, CDP, page, context or browser cleanup cannot prevent remaining owners or failure evidence', async () => {
  for (const stalled of ['observer', 'cdp', 'page', 'context', 'browser']) {
    const calls = [],
      saved = new Map();
    let resolveLate;
    const close = (name) => () => {
      calls.push(name);
      return name === stalled
        ? new Promise((resolve) => {
            resolveLate = resolve;
          })
        : Promise.resolve();
    };
    await assert.rejects(
      finishDiscoveryObservation({
        page: { evaluate: close('observer'), close: close('page') },
        context: { close: close('context') },
        cdp: { detach: close('cdp') },
        browser: { close: close('browser') },
        server: { close: close('server') },
        cleanupTimeoutMs: 10,
        save: async (name, value) => saved.set(name, structuredClone(value)),
        complete: { qualified: false, completed: true },
      }),
      (error) =>
        error instanceof AggregateError &&
        error.errors.length === 1 &&
        error.errors[0].code === 'DISCOVERY_CLEANUP_TIMEOUT',
    );
    assert.deepEqual(calls, ['observer', 'cdp', 'page', 'context', 'browser', 'server']);
    assert.equal(saved.has('complete.json'), false);
    const outcome = saved.get(`cleanup-${stalled}-outcome.json`);
    assert.equal(saved.get(`cleanup-${stalled}-start.json`).phase, 'started');
    assert.equal(outcome.closed, false);
    assert.equal(outcome.timedOut, true);
    assert.equal(saved.get('cleanup.json').completed, false);
    assert.equal(saved.get('cleanup-server-outcome.json').closed, true);
    assert.equal(saved.get('failure.json').completed, false);
    const before = JSON.stringify([...saved]);
    resolveLate();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(JSON.stringify([...saved]), before, 'Late resolution cannot relabel a timeout.');
  }
});

test('cleanup journals and summary save failures remain independent of resource shutdown and primary errors', async () => {
  for (const failedFile of [
    'cleanup-page-start.json',
    'cleanup-page-outcome.json',
    'cleanup-context-start.json',
    'cleanup-context-outcome.json',
    'cleanup-browser-start.json',
    'cleanup-browser-outcome.json',
    'cleanup.json',
    'failure.json',
  ]) {
    for (const primary of [null, new Error('Original observation failed')]) {
      const saved = new Map(),
        calls = [],
        saveFailure = new Error('Evidence disk failure'),
        closeFailure = new Error('Browser close failed');
      await assert.rejects(
        finishDiscoveryObservation({
          page: { evaluate: async () => {}, close: async () => calls.push('page') },
          context: { close: async () => calls.push('context') },
          browser: {
            async close() {
              calls.push('browser');
              throw closeFailure;
            },
          },
          server: {
            async close() {
              calls.push('server');
            },
          },
          save: async (name, value) => {
            if (name === failedFile) throw saveFailure;
            saved.set(name, structuredClone(value));
          },
          complete: { qualified: false, completed: true },
          error: primary,
        }),
        (error) =>
          primary
            ? error === primary
            : error instanceof AggregateError &&
              error.errors.includes(closeFailure) &&
              error.errors.includes(saveFailure),
      );
      assert.deepEqual(calls, ['page', 'context', 'browser', 'server']);
      assert.equal(saved.get('cleanup-server-outcome.json').closed, true);
      assert.equal(saved.has('complete.json'), false);
      if (saved.has('cleanup.json')) assert.equal(saved.get('cleanup.json').completed, false);
    }
  }
});

test('a stalled journal write cannot block cleanup, and a timed-out close preserves the primary failure', async () => {
  const saved = new Map(),
    calls = [],
    primary = new Error('Original route failed');
  await assert.rejects(
    finishDiscoveryObservation({
      page: { evaluate: () => new Promise(() => {}), close: async () => calls.push('page') },
      context: { close: async () => calls.push('context') },
      browser: { close: async () => calls.push('browser') },
      server: { close: async () => calls.push('server') },
      save: async (name, value) => {
        if (name === 'cleanup-observer-start.json') return new Promise(() => {});
        saved.set(name, structuredClone(value));
      },
      cleanupTimeoutMs: 10,
      error: primary,
    }),
    (error) => error === primary,
  );
  assert.deepEqual(calls, ['page', 'context', 'browser', 'server']);
  assert.equal(saved.has('complete.json'), false);
  assert.equal(saved.get('cleanup.json').journalFailures.length, 1);
  assert.equal(saved.get('cleanup.json').operations[0].timedOut, true);
  assert.equal(saved.get('cleanup.json').primaryError, primary.stack);
});

test('a final completion write error is returned after every resource has closed', async () => {
  const saved = new Map(),
    failure = new Error('Completion disk failure');
  await assert.rejects(
    finishDiscoveryObservation({
      browser: { close: async () => {} },
      server: { close: async () => {} },
      save: async (name, value) => {
        if (name === 'complete.json') throw failure;
        saved.set(name, structuredClone(value));
      },
    }),
    (error) => error === failure,
  );
  assert.equal(saved.has('complete.json'), false);
  assert.equal(saved.get('cleanup.json').completed, true);
});

test('cleanup rejects an invalid deadline before operating on owners', async () => {
  for (const cleanupTimeoutMs of [0, -1, 1.5, Infinity, 60_001])
    await assert.rejects(
      finishDiscoveryObservation({ cleanupTimeoutMs }),
      /Cleanup timeout must be an integer/,
    );
});

test('bounded failure evidence preserves partial files and reports independent save, renderer and trace stalls', async () => {
  const saved = new Map(),
    original = new Error('Source-bound observation failed');
  const diagnostics = await recordDiscoveryFailureEvidence({
    page: { evaluate: () => new Promise(() => {}) },
    save: async (name) => {
      throw new Error(`Cannot save ${name}`);
    },
    screenshot: async () => {
      saved.set('failure.png', 'partial screenshot');
      throw new Error('Screenshot failed after partial output');
    },
    stopTrace: () => new Promise(() => {}),
    failure: { error: original.stack, sourceRevision: 'a'.repeat(40) },
    timeoutMs: 10,
  });
  assert.equal(diagnostics.length, 6);
  assert.equal(diagnostics.filter((item) => item.timedOut).length, 4);
  assert.equal(saved.get('failure.png'), 'partial screenshot');
  const closed = [];
  await assert.rejects(
    finishDiscoveryObservation({
      browser: { close: async () => closed.push('browser') },
      server: { close: async () => closed.push('server') },
      save: async (name, value) => saved.set(name, structuredClone(value)),
      diagnosticFailures: diagnostics,
      error: original,
    }),
    (error) => error === original,
  );
  assert.deepEqual(closed, ['browser', 'server']);
  assert.deepEqual(saved.get('cleanup.json').diagnosticFailures, diagnostics);
  assert.equal(saved.get('cleanup.json').completed, false);
  assert.equal(saved.has('complete.json'), false);
});

test('actual observation failure reaches bounded cleanup when its renderer diagnostics never settle', async (t) => {
  const folder = await mkdtemp(path.join(tmpdir(), 'discovery-observer-hung-renderer-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const input = fixture(),
    planFile = path.join(folder, 'plan.json'),
    output = path.join(folder, 'attempt'),
    playwrightModule = path.join(folder, 'fake-playwright.mjs');
  await writeFile(planFile, JSON.stringify(input.plan));
  await writeFile(path.join(folder, 'distribution.zip'), input.archive);
  await writeFile(path.join(folder, 'manifest.json'), input.manifest);
  await writeFile(
    playwrightModule,
    `export const primary = new Error('Actual caller route failed');
export const calls = [];
export const chromium = { launch: async () => ({
  close: async () => { calls.push('browser closed'); },
  newContext: async () => ({
    close: async () => { calls.push('context closed'); },
    newPage: async () => ({
    close: async (options) => { calls.push(['page closed', options]); },
    setDefaultTimeout() {}, on() {}, addInitScript: async () => {},
    goto: async () => { throw primary; },
    evaluate: () => { calls.push('renderer read'); return new Promise(() => {}); },
    screenshot: async () => { calls.push('screenshot'); throw Error('Screenshot unavailable'); }
  }) })
}) };`,
  );
  const fake = await import(pathToFileURL(playwrightModule).href);
  await assert.rejects(
    observeDiscoveryRuntime({ planFile, playwrightModule, output, cleanupTimeoutMs: 10 }),
    (error) => error === fake.primary,
  );
  assert.deepEqual(fake.calls.slice(-3), [
    ['page closed', { runBeforeUnload: false }],
    'context closed',
    'browser closed',
  ]);
  assert.equal(fake.calls.filter((item) => item === 'renderer read').length, 4);
  const cleanup = JSON.parse(await readFile(path.join(output, 'cleanup.json')));
  assert.equal(cleanup.completed, false);
  assert.equal(cleanup.primaryError, fake.primary.stack);
  assert.equal(cleanup.diagnosticFailures.filter((item) => item.timedOut).length, 3);
  assert.equal(cleanup.operations.find((item) => item.name === 'observer').timedOut, true);
  assert.equal(cleanup.operations.find((item) => item.name === 'page').closed, true);
  assert.equal(cleanup.operations.find((item) => item.name === 'context').closed, true);
  assert.equal(cleanup.operations.find((item) => item.name === 'server').closed, true);
  const failure = JSON.parse(await readFile(path.join(output, 'failure.json')));
  assert.equal(failure.error, fake.primary.stack);
  assert.equal(failure.identity.sourceRevision, input.plan.artifact.sourceRevision);
  const observation = JSON.parse(await readFile(path.join(output, 'case.json')));
  await assert.rejects(fetch(observation.origin + '/game/app.mjs'));
  await assert.rejects(readFile(path.join(output, 'complete.json')), { code: 'ENOENT' });
});
function fixture({ gameplayId, extra = false, protocolId } = {}) {
  const showcase = DISCOVERY_SHOWCASE_PROTOCOLS[protocolId];
  const editionId = showcase?.editionId ?? 'fpv-learning';
  const missionId = showcase?.missionId ?? 'fpv-meet-aircraft-01';
  gameplayId ??= showcase?.gameplayId ?? '7feffc97157784af';
  const rewardPath =
    showcase?.rewardPath ?? 'game/content/company-campaigns/fpv-meet-aircraft.rewards.json';
  const files = new Map([
    ['game/index.html', Buffer.from('<title>Read-only archive test</title>')],
    ['game/company.html', Buffer.from('<title>Entry</title>')],
    ['game/app.mjs', Buffer.from('export const fixture = true;')],
    ['edition-catalog.json', Buffer.from(JSON.stringify({ edition: editionId }))],
    [
      rewardPath,
      Buffer.from(
        JSON.stringify([
          {
            ...(showcase
              ? {
                  id: showcase.rewardId,
                  locales: {
                    en: { title: 'Example discovery' },
                    uk: { title: 'Приклад відкриття' },
                  },
                  payloads: [
                    {
                      type: 'knowledge',
                      locales: {
                        en: { paragraphs: ['Read the fictional example.'] },
                        uk: { paragraphs: ['Прочитайте вигаданий приклад.'] },
                      },
                    },
                  ],
                }
              : {}),
            scope: { kind: 'mission', id: missionId },
            requirements: {
              missions: [
                {
                  missionId,
                  bindings: [{ gameplayId, difficulty: 'standard' }],
                },
              ],
            },
          },
        ]),
      ),
    ],
  ]);
  if (showcase)
    files.set(
      rewardPath.replace('.rewards.json', '.json'),
      Buffer.from(
        JSON.stringify({
          packs: [{ id: `${showcase.campaignId}-pack`, campaignIds: [showcase.campaignId] }],
          campaigns: [{ id: showcase.campaignId, missionIds: [missionId] }],
          missions: [{ id: missionId, name: showcase.missionName }],
        }),
      ),
    );
  const manifest = Buffer.from(
    JSON.stringify({
      format: 'revealline-edition-manifest.v1',
      editionId,
      entry: 'game/company.html',
      sourceRevision: 'a'.repeat(40),
      sourceTree: 'b'.repeat(40),
      version: 'fixture',
      contentSha256: hash(files.get('edition-catalog.json')),
      totalBytes: [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0),
      files: [...files].map(([name, bytes]) => ({
        path: name,
        bytes: bytes.length,
        sha256: hash(bytes),
      })),
    }),
  );
  files.set('manifest.json', manifest);
  if (extra) files.set('private-sentinel.txt', Buffer.from('Must not be served.'));
  const archive = createEditionZip(files);
  const plan = {
    format: 'revealline-discovery-runtime-plan.v1',
    caseId: 'fixture-a',
    protocol: protocolId ?? 'fpv-frame-first-win.v1',
    deviceLabel: 'Synthetic unit-test metadata; no browser measurement',
    quietWindow: 'Unit tests only.',
    mode: showcase ? 'showcase' : 'timings',
    ...(showcase ? { headerPolicy: 'packaged-preview' } : {}),
    cycles: 0,
    artifact: {
      archive: 'distribution.zip',
      archiveSha256: hash(archive),
      manifest: 'manifest.json',
      manifestSha256: hash(manifest),
      sourceRevision: 'a'.repeat(40),
      sourceTree: 'b'.repeat(40),
      editionId,
    },
  };
  return { plan, archive, manifest, files };
}

test('plans select only the reviewed public-control protocol and bounded independent modes', () => {
  const { plan } = fixture();
  for (const mode of ['timings', 'timeline', 'cpu'])
    assert.equal(validateDiscoveryRuntimePlan({ ...plan, mode }).mode, mode);
  for (const invalid of [
    { ...plan, script: 'arbitrary engine mutation' },
    { ...plan, protocol: 'invented-route' },
    { ...plan, mode: 'profiled-p95' },
    { ...plan, cycles: 21 },
    { ...plan, deviceLabel: '' },
    { ...plan, quietWindow: '' },
    { ...plan, serverPort: -1 },
    { ...plan, headerPolicy: 'relaxed-csp' },
    { ...plan, artifact: { ...plan.artifact, sourceRevision: 'unknown' } },
  ])
    assert.throws(() => validateDiscoveryRuntimePlan(invalid));
});

test('observation verifies exact ZIP/manifest members and source bindings without extraction', () => {
  const input = fixture(),
    checked = verifyDiscoveryRuntimeArtifact(input.plan, input);
  assert.equal(checked.identity.runtimeFiles, input.files.size);
  assert.equal(checked.identity.distribution.sha256, hash(input.archive));
  assert.deepEqual(checked.files.get('game/app.mjs'), input.files.get('game/app.mjs'));
  assert.throws(
    () =>
      verifyDiscoveryRuntimeArtifact(
        { ...input.plan, artifact: { ...input.plan.artifact, sourceTree: 'c'.repeat(40) } },
        input,
      ),
    /source or inventory/,
  );
  const changed = Buffer.from(input.archive);
  changed[40] ^= 1;
  assert.throws(
    () => verifyDiscoveryRuntimeArtifact(input.plan, { ...input, archive: changed }),
    /original bytes/,
  );
  const extra = fixture({ extra: true });
  assert.throws(() => verifyDiscoveryRuntimeArtifact(extra.plan, extra), /directory differs/);
  const missing = fixture({ gameplayId: 'different-engine-inputs' });
  assert.throws(
    () => verifyDiscoveryRuntimeArtifact(missing.plan, missing),
    /reviewed gameplay binding/,
  );
});

test('a rehashed manifest cannot conceal a changed listed runtime member', () => {
  const input = fixture(),
    manifest = JSON.parse(input.manifest);
  manifest.files.find((file) => file.path === 'game/app.mjs').sha256 = 'c'.repeat(64);
  const original = Buffer.from(JSON.stringify(manifest)),
    files = new Map(input.files);
  files.set('manifest.json', original);
  const archive = createEditionZip(files),
    plan = {
      ...input.plan,
      artifact: {
        ...input.plan.artifact,
        archiveSha256: hash(archive),
        manifestSha256: hash(original),
      },
    };
  assert.throws(
    () => verifyDiscoveryRuntimeArtifact(plan, { archive, manifest: original }),
    /member hash differs/,
  );
});

test('server owns immutable copies, serves only checked members, and closes cleanly', async (t) => {
  const input = fixture(),
    { files } = verifyDiscoveryRuntimeArtifact(input.plan, input);
  const server = await serveDiscoveryRuntime(files, Buffer.from('export const passive = true;'), {
    reviewModel: Buffer.from('export const model = true;'),
  });
  t.after(() => server.close());
  files.get('game/app.mjs').fill(0);
  const response = await fetch(server.origin + '/game/app.mjs');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/javascript');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-security-policy'), null);
  assert.equal(await response.text(), 'export const fixture = true;');
  assert.equal(
    (await fetch(server.origin + '/docs/verification/discovery-observer.mjs')).status,
    200,
  );
  for (const name of ['/scripts/game-cli.mjs', '/private-sentinel.txt', '/%2e%2e/package.json'])
    assert.equal((await fetch(server.origin + name)).status, 404);
  assert.equal((await fetch(server.origin + '/game/app.mjs', { method: 'POST' })).status, 404);
});

test('packaged-preview observation reuses exact preview headers without relaxing the player policy', async (t) => {
  const input = fixture();
  const plan = validateDiscoveryRuntimePlan({ ...input.plan, headerPolicy: 'packaged-preview' });
  const { files } = verifyDiscoveryRuntimeArtifact(plan, input);
  const server = await serveDiscoveryRuntime(files, Buffer.from('export const passive = true;'), {
    reviewModel: Buffer.from('export const model = true;'),
    headerPolicy: plan.headerPolicy,
  });
  t.after(() => server.close());
  assert.deepEqual(server.headers, PREVIEW_SECURITY_HEADERS);
  for (const [name, method, status] of [
    ['/game/index.html', 'GET', 200],
    ['/game/app.mjs', 'HEAD', 200],
    ['/docs/verification/discovery-observer.mjs', 'GET', 200],
    ['/not-admitted.txt', 'GET', 404],
    ['/game/app.mjs', 'POST', 404],
  ]) {
    const response = await fetch(server.origin + name, { method });
    assert.equal(response.status, status);
    for (const [key, value] of Object.entries(PREVIEW_SECURITY_HEADERS))
      assert.equal(response.headers.get(key), value, `${method} ${name}: ${key}`);
    if (name === '/game/index.html')
      assert.equal(await response.text(), input.files.get(name.slice(1)).toString());
    else await response.arrayBuffer();
  }
  await assert.rejects(
    serveDiscoveryRuntime(files, Buffer.from(''), { headerPolicy: 'relaxed-csp' }),
    /Unknown observation header policy/,
  );
});

test('failed preparation retains declared source pins and never overwrites prior evidence or loads browser tools', async (t) => {
  const folder = await mkdtemp(path.join(tmpdir(), 'discovery-observer-plan-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const input = fixture(),
    plan = { ...input.plan, artifact: { ...input.plan.artifact, archiveSha256: 'f'.repeat(64) } };
  const planFile = path.join(folder, 'plan.json'),
    output = path.join(folder, 'attempt');
  await writeFile(planFile, JSON.stringify(plan));
  await writeFile(path.join(folder, 'distribution.zip'), input.archive);
  await writeFile(path.join(folder, 'manifest.json'), input.manifest);
  await assert.rejects(
    observeDiscoveryRuntime({ planFile, output, playwrightModule: '/no/browser/module.mjs' }),
    /original bytes/,
  );
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'plan.json'))), plan);
  const failure = await readFile(path.join(output, 'failure.json'));
  assert.equal(
    JSON.parse(failure).identity,
    null,
    'Rejected source pins are never reported as verified.',
  );
  await assert.rejects(
    observeDiscoveryRuntime({ planFile, output, playwrightModule: '/no/browser/module.mjs' }),
    /EEXIST/,
  );
  assert.deepEqual(await readFile(path.join(output, 'failure.json')), failure);
  await mkdir(path.join(folder, 'preexisting'));
});

test('passive observer serves its exact static module closure and rejects archive collisions', async (t) => {
  const { files } = fixture();
  const names = [
    'docs/verification/discovery-observer.mjs',
    'docs/verification/company-review-model.mjs',
  ];
  const originals = new Map(
    await Promise.all(
      names.map(async (name) => [name, await readFile(new URL('../' + name, import.meta.url))]),
    ),
  );
  const server = await serveDiscoveryRuntime(files, originals.get(names[0]), {
    reviewModel: originals.get(names[1]),
  });
  t.after(() => server.close());
  const pending = [names[0]],
    seen = new Set();
  while (pending.length) {
    const name = pending.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    assert.ok(
      originals.has(name),
      'Every static passive dependency must be explicitly pinned: ' + name,
    );
    const response = await fetch(server.origin + '/' + name);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get('content-type'), 'text/javascript');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, originals.get(name));
    const imports = [
      ...bytes.toString().matchAll(/(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g),
    ];
    for (const [, specifier] of imports) {
      assert.ok(specifier.startsWith('.'), 'No implicit external observer dependency.');
      pending.push(new URL(specifier, server.origin + '/' + name).pathname.slice(1));
    }
  }
  assert.deepEqual([...seen].sort(), names.sort());
  assert.equal(
    (await fetch(server.origin + '/docs/verification/discovery-comparison.mjs')).status,
    404,
    'The Node-only comparator is not silently added to browser dependencies.',
  );
  await assert.rejects(
    serveDiscoveryRuntime(files, originals.get(names[0])),
    /Missing pinned passive observer dependency/,
  );
  for (const name of names) {
    const colliding = new Map(files);
    colliding.set(name, Buffer.from('unrelated edition member'));
    await assert.rejects(
      serveDiscoveryRuntime(colliding, originals.get(names[0]), {
        reviewModel: originals.get(names[1]),
      }),
      /collides/,
    );
  }
});

function showcaseState(protocol, { locale = 'en', won = false, next = false } = {}) {
  return {
    body: { editionId: protocol.editionId, flightState: won ? 'won' : 'running' },
    locale,
    overlay: { kind: won ? 'won' : 'ready', hidden: !won },
    selection: Object.fromEntries(
      Object.entries({
        'difficulty-select': 'standard',
        'turn-select': 'immediate',
        'class-select': 'scout',
        'level-select': next ? protocol.nextMissionId : protocol.missionId,
        'body-select': protocol.actorSetId,
        'theme-select': protocol.themeId,
        'terrain-select': 'hybrid',
      }).map(([id, value]) => [
        id,
        {
          value,
          ...(id === 'level-select'
            ? {
                label: `${next ? '02' : '01'} · ${next ? (locale === 'uk' ? protocol.nextNameUK : protocol.nextNameEN) : locale === 'uk' ? protocol.missionNameUK : protocol.missionName}`,
              }
            : {}),
        },
      ]),
    ),
  };
}

test('showcase registry is immutable, source-bound and separate from the original timing protocol', () => {
  assert.equal(Object.keys(DISCOVERY_SHOWCASE_PROTOCOLS).length, 3);
  for (const protocol of Object.values(DISCOVERY_SHOWCASE_PROTOCOLS)) {
    const input = fixture({ protocolId: protocol.id });
    const plan = validateDiscoveryRuntimePlan(input.plan);
    const checked = verifyDiscoveryRuntimeArtifact(plan, input);
    assert.equal(checked.identity.gameplayId, protocol.gameplayId);
    assert.equal(checked.identity.editionId, protocol.editionId);
    assert.equal(plan.mode, 'showcase');
    assert.match(protocol.routeStatus, /experimental/);
    assert.ok(Object.isFrozen(protocol));
    assert.ok(Object.isFrozen(protocol.route));
    assert.ok(protocol.route.every(Object.isFrozen));
    for (const override of [
      { mode: 'timings' },
      { mode: 'timeline' },
      { cycles: 20 },
      { headerPolicy: 'minimal' },
      { headerPolicy: undefined },
      { route: [['ArrowRight', 1]] },
      { artifact: { ...plan.artifact, editionId: 'fpv-learning' } },
    ])
      assert.throws(() => validateDiscoveryRuntimePlan({ ...plan, ...override }));
    const wrong = fixture({ protocolId: protocol.id, gameplayId: 'changed-rules' });
    assert.throws(
      () => verifyDiscoveryRuntimeArtifact(wrong.plan, wrong),
      /reviewed gameplay binding/,
    );
  }
  const old = fixture();
  assert.throws(() => validateDiscoveryRuntimePlan({ ...old.plan, mode: 'showcase' }));
  assert.equal(
    verifyDiscoveryRuntimeArtifact(old.plan, old).identity.gameplayId,
    '7feffc97157784af',
  );
});

test('showcase state admission requires exact edition, mission, rules, art and localized mission labels', () => {
  for (const protocol of Object.values(DISCOVERY_SHOWCASE_PROTOCOLS)) {
    for (const locale of ['en', 'uk']) {
      const state = showcaseState(protocol, { locale });
      assert.equal(validateDiscoveryShowcaseState(state, protocol.id, { locale }), state);
      for (const field of [
        'difficulty-select',
        'turn-select',
        'class-select',
        'level-select',
        'body-select',
        'theme-select',
        'terrain-select',
      ]) {
        const changed = structuredClone(state);
        changed.selection[field].value = 'unrelated';
        assert.throws(
          () => validateDiscoveryShowcaseState(changed, protocol.id, { locale }),
          /exact mission/,
        );
      }
      for (const change of [
        (state) => (state.body.editionId = 'foreign-edition'),
        (state) => (state.locale = 'foreign-locale'),
        (state) => (state.selection['level-select'].label = 'Untranslated or wrong mission'),
      ]) {
        const changed = structuredClone(state);
        change(changed);
        assert.throws(
          () => validateDiscoveryShowcaseState(changed, protocol.id, { locale }),
          /exact mission/,
        );
      }
    }
    for (const locale of ['en', 'uk']) {
      const next = showcaseState(protocol, { locale, next: true });
      assert.equal(validateDiscoveryShowcaseState(next, protocol.id, { locale, next: true }), next);
      assert.throws(() => validateDiscoveryShowcaseState(next, protocol.id, { locale }));
    }
  }
});

test('showcase routes preserve a bounded failed attempt and never convert an offline witness into a win', async () => {
  for (const protocol of Object.values(DISCOVERY_SHOWCASE_PROTOCOLS)) {
    const presses = [],
      saved = new Map();
    await assert.rejects(
      executeDiscoveryShowcaseRoute({
        protocolId: protocol.id,
        attempt: 1,
        read: async () => showcaseState(protocol),
        press: async (...args) => presses.push(args),
        save: async (name, value) => saved.set(name, value),
      }),
      /did not produce an ordinary win/,
    );
    assert.deepEqual(presses, protocol.route);
    const receipt = saved.get('showcase-attempt-1.json');
    assert.equal(receipt.won, false);
    assert.equal(receipt.states.length, protocol.route.length + 1);
    assert.match(receipt.inputSource, /no engine\/progress/);
  }
});

test('showcase route stops at an actual visible win and rejects a hidden/stale or foreign result', async () => {
  const protocol = DISCOVERY_SHOWCASE_PROTOCOLS['victory-ideas-first-win.v1'];
  for (const end of [
    'won',
    'hidden-won',
    'lost',
    'wrong-mission',
    'foreign-result',
    'foreign-edition',
  ]) {
    let presses = 0;
    const saved = new Map();
    const run = executeDiscoveryShowcaseRoute({
      protocolId: protocol.id,
      attempt: 2,
      read: async () => {
        const state = showcaseState(protocol, { won: presses > 0 });
        if (presses) {
          if (end === 'hidden-won') state.overlay.hidden = true;
          if (end === 'lost') state.overlay.kind = 'lost';
          if (end === 'foreign-result') state.selection['level-select'].value = 'foreign-mission';
          if (end === 'foreign-edition') state.body.editionId = 'foreign-edition';
          if (end === 'wrong-mission') {
            state.overlay = { kind: 'ready', hidden: true };
            state.body.flightState = 'running';
            state.selection['level-select'].value = 'another-mission';
          }
        }
        return state;
      },
      press: async () => presses++,
      save: async (name, value) => saved.set(name, value),
    });
    if (end === 'won') await run;
    else await assert.rejects(run);
    assert.equal(presses, 1, 'There is no automatic retry or progression injection.');
    assert.equal(saved.get('showcase-attempt-2.json').won, end === 'won');
  }
});

test('showcase pins and localized public selector labels match the authored selected campaign closure', async () => {
  for (const protocol of Object.values(DISCOVERY_SHOWCASE_PROTOCOLS)) {
    const rewards = JSON.parse(
      await readFile(new URL(`../${protocol.rewardPath}`, import.meta.url)),
    );
    const reward = rewards.find((row) => row.id === protocol.rewardId);
    assert.equal(reward.scope.id, protocol.missionId);
    assert.ok(
      reward.requirements.missions.some(
        (row) =>
          row.missionId === protocol.missionId &&
          row.bindings.some(
            (binding) =>
              binding.gameplayId === protocol.gameplayId && binding.difficulty === 'standard',
          ),
      ),
    );
    const localization = JSON.parse(
      await readFile(
        new URL(
          `../game/content/company-campaigns/${protocol.campaignId}.localization.json`,
          import.meta.url,
        ),
      ),
    );
    const first = localization.records.find((row) => row.id === protocol.missionId).fields.name;
    const next = localization.records.find((row) => row.id === protocol.nextMissionId).fields.name;
    assert.equal(first.en, protocol.missionName);
    assert.equal(first.uk, protocol.missionNameUK);
    assert.equal(next.en, protocol.nextNameEN);
    assert.equal(next.uk, protocol.nextNameUK);
  }
});

test('showcase locale checks reject stale reward titles or untranslated knowledge from the exact admitted copy', () => {
  const input = fixture({ protocolId: 'social-community-first-win.v1' });
  const { showcaseCopy } = verifyDiscoveryRuntimeArtifact(input.plan, input);
  assert.notEqual(showcaseCopy.en.title, showcaseCopy.uk.title);
  assert.notEqual(showcaseCopy.en.paragraph, showcaseCopy.uk.paragraph);
  for (const locale of ['en', 'uk']) {
    const observed = { title: showcaseCopy[locale].title, knowledgeMatched: true };
    assert.equal(validateDiscoveryShowcaseCopy(showcaseCopy, observed, locale), observed);
    assert.throws(
      () =>
        validateDiscoveryShowcaseCopy(
          showcaseCopy,
          { ...observed, title: showcaseCopy[locale === 'en' ? 'uk' : 'en'].title },
          locale,
        ),
      /exact earned locale/,
    );
    assert.throws(
      () =>
        validateDiscoveryShowcaseCopy(
          showcaseCopy,
          { ...observed, knowledgeMatched: false },
          locale,
        ),
      /exact earned locale/,
    );
    assert.throws(() => validateDiscoveryShowcaseCopy({}, observed, locale), /exact earned locale/);
  }
});

test('public chooser selection understands the exact source-derived Library tuple and rejects guessed suffixes', () => {
  for (const protocol of Object.values(DISCOVERY_SHOWCASE_PROTOCOLS)) {
    const input = fixture({ protocolId: protocol.id });
    const { showcaseSelection: selection } = verifyDiscoveryRuntimeArtifact(input.plan, input);
    const alias = selection.aliases[0];
    const tuple = [
      `journey:${protocol.editionId}`,
      protocol.editionId,
      alias.campaign,
      alias.mission,
      '',
    ];
    const row = {
      id: JSON.stringify(tuple),
      name: protocol.missionName,
      visible: true,
      disabled: false,
    };
    assert.equal(
      row.id.endsWith('/' + protocol.missionId),
      false,
      'This is the real Library wrapper, not a bare Journey ID.',
    );
    const hidden = { ...row, visible: false };
    assert.equal(selectDiscoveryShowcaseCard({ total: 2, rows: [hidden, row] }, selection), row);
    const rejected = [
      { ...row, id: alias.mission },
      {
        ...row,
        id: JSON.stringify(tuple.map((value, index) => (index === 0 ? 'journey:foreign' : value))),
      },
      {
        ...row,
        id: JSON.stringify(tuple.map((value, index) => (index === 1 ? 'foreign' : value))),
      },
      {
        ...row,
        id: JSON.stringify(tuple.map((value, index) => (index === 2 ? 'wrong-campaign' : value))),
      },
      {
        ...row,
        id: JSON.stringify(
          tuple.map((value, index) => (index === 3 ? alias.mission + '-wrong' : value)),
        ),
      },
      {
        ...row,
        id: JSON.stringify(tuple.map((value, index) => (index === 4 ? 'historical' : value))),
      },
      { ...row, name: 'Same route, unrelated title' },
      { ...row, disabled: true },
      hidden,
    ];
    for (const bad of rejected)
      assert.throws(
        () => selectDiscoveryShowcaseCard({ total: 1, rows: [bad] }, selection),
        /not uniquely/,
      );
    assert.throws(
      () => selectDiscoveryShowcaseCard({ total: 2, rows: [row, row] }, selection),
      /not uniquely/,
    );
    assert.throws(
      () => selectDiscoveryShowcaseCard({ total: 129, rows: [row] }, selection),
      /bound/,
    );
  }
});

test('showcase Collection uses the public header or native narrow Home route and returns to the same win', async () => {
  for (const compact of [false, true]) {
    const actions = [];
    let home = false,
      collection = false,
      recordedRoute;
    const visible = (selector) =>
      selector === '#shell-collection' ? !compact : selector === '#shell-home' ? home : collection;
    const click = async (selector) => {
      actions.push(selector);
      if (selector === '#shell-collection') {
        assert.equal(compact, false);
        collection = true;
      } else if (selector === '#shell-menu') {
        assert.equal(compact, true);
        home = true;
      } else if (selector === '#shell-home #shell-gallery') {
        assert.equal(home, true);
        collection = true;
      } else if (selector === '#collection-back') {
        assert.equal(collection, true);
        collection = false;
      } else assert.fail('No private or hidden alternative is allowed: ' + selector);
    };
    const page = {
      locator: (selector) => ({
        isVisible: async () => visible(selector),
        waitFor: async ({ state }) => assert.equal(visible(selector), state === 'visible'),
      }),
      keyboard: {
        press: async (key) => {
          assert.equal(key, 'Escape');
          assert.equal(home, true);
          assert.equal(collection, false);
          actions.push(key);
          home = false;
        },
      },
    };
    const route = await visitDiscoveryShowcaseCollection({
      page,
      click,
      onRoute: async (value) => {
        recordedRoute = value;
      },
      visit: async () => {
        assert.equal(collection, true);
        actions.push('inspect exact earned reward');
      },
      record: async () => ({
        overlay: { kind: 'won', hidden: false },
        openDialogs: [home && 'shell-home', collection && 'collection-dialog'].filter(Boolean),
      }),
    });
    assert.equal(route, compact ? 'home' : 'header');
    assert.equal(recordedRoute, route);
    assert.deepEqual(
      actions,
      compact
        ? [
            '#shell-menu',
            '#shell-home #shell-gallery',
            'inspect exact earned reward',
            '#collection-back',
            'Escape',
          ]
        : ['#shell-collection', 'inspect exact earned reward', '#collection-back'],
    );
    assert.equal(home, false);
    assert.equal(collection, false);
  }
});

test('showcase Collection cannot continue to Retry with Home still open or a missing won result', async () => {
  for (const state of [
    { overlay: { kind: 'won', hidden: false }, openDialogs: ['shell-home'] },
    { overlay: { kind: 'paused', hidden: false }, openDialogs: [] },
    { overlay: { kind: 'won', hidden: true }, openDialogs: [] },
  ]) {
    await assert.rejects(
      visitDiscoveryShowcaseCollection({
        page: { locator: () => ({ isVisible: async () => true, waitFor: async () => {} }) },
        click: async () => {},
        visit: async () => {},
        onRoute: async () => {},
        record: async () => state,
      }),
      /underlying won result/,
    );
  }
});

test('Social public route candidate keeps a bounded margin through the exact shared gameplay', async () => {
  const { compileContentProject, resolveMission } = await import(
    '../game/content-design/project.mjs'
  );
  const { applyGameplayTuning, resolveGameplayTuning } = await import(
    '../game/gameplay-tuning.mjs'
  );
  const { createRun, stepRun, FIXED_DT } = await import('../game/core/index.mjs');
  const { dataIdentity } = await import('../game/data-json.mjs');
  const protocol = DISCOVERY_SHOWCASE_PROTOCOLS['social-community-first-win.v1'];
  const source = JSON.parse(
    await readFile(
      new URL(
        '../game/content/company-campaigns/social-drone-community-connections.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const manifest = resolveMission(compileContentProject(source), protocol.missionId, {
    difficulty: 'standard',
  });
  const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
  assert.equal(protocol.routeRevision, 2);
  assert.equal(protocol.route.length, 4);
  assert.ok(protocol.route.reduce((sum, [, duration]) => sum + duration, 0) < 20000);
  // Disposable source verification is preparation only. The observer imports no
  // engine and accepts a win only from the actual visible public game result.
  for (const offset of [-24, -12, 0, 12, 24]) {
    const run = createRun(level, { seed: 1, classId: 'scout', turnPolicy: 'immediate' });
    assert.equal(
      dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes }),
      protocol.gameplayId,
    );
    for (const [key, duration] of protocol.route) {
      const direction = key.slice('Arrow'.length).toLowerCase();
      const ticks = Math.round(duration / 1000 / FIXED_DT) + offset;
      let stopped = false;
      for (let tick = 0; tick < ticks && run.status !== 'won'; tick++) {
        stepRun(run, { direction: stopped ? null : direction }, FIXED_DT);
        if (
          run.status === 'respawning' ||
          run.events.some((event) => event.type === 'capture.stopped')
        )
          stopped = true;
      }
    }
    assert.equal(run.status, 'won', `offset ${offset}: offline feasibility, not a browser win`);
    assert.equal(run.classic.livesLost, 0);
    assert.ok(run.coverage >= level.goal.coverage);
    assert.ok(
      run.objectives
        .filter((objective) => objective.required)
        .every((objective) => objective.captured),
    );
  }
});

test('Ukraine public route leaves a closing-leg margin without changing its actual win authority', async () => {
  const { compileContentProject, resolveMission } = await import(
    '../game/content-design/project.mjs'
  );
  const { applyGameplayTuning, resolveGameplayTuning } = await import(
    '../game/gameplay-tuning.mjs'
  );
  const { createRun, stepRun, FIXED_DT } = await import('../game/core/index.mjs');
  const { dataIdentity } = await import('../game/data-json.mjs');
  const protocol = DISCOVERY_SHOWCASE_PROTOCOLS['ukraine-threads-first-win.v1'];
  const source = JSON.parse(
    await readFile(
      new URL('../game/content/company-campaigns/ukraine-threads.json', import.meta.url),
      'utf8',
    ),
  );
  const manifest = resolveMission(compileContentProject(source), protocol.missionId, {
    difficulty: 'standard',
  });
  const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
  assert.equal(protocol.routeRevision, 2);
  assert.deepEqual(protocol.route, [
    ['ArrowRight', (163 * 1000) / 120],
    ['ArrowDown', 5000],
  ]);
  // This is only a disposable route-feasibility proof: the browser still checks
  // a visible earned result. First-leg +/-100 ms and closing-leg +/-200 ms are
  // independent offsets, not claims about scheduling on every loaded machine.
  for (const rightOffset of [-12, 0, 12])
    for (const downOffset of [-24, 0, 24]) {
      const run = createRun(level, { seed: 1, classId: 'scout', turnPolicy: 'immediate' });
      assert.equal(
        dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes }),
        protocol.gameplayId,
      );
      for (const [index, [key, duration]] of protocol.route.entries()) {
        const direction = key.slice('Arrow'.length).toLowerCase();
        const ticks =
          Math.round(duration / 1000 / FIXED_DT) + (index === 0 ? rightOffset : downOffset);
        for (let tick = 0; tick < ticks && run.status === 'running'; tick++)
          stepRun(run, { direction }, FIXED_DT);
      }
      assert.equal(
        run.status,
        'won',
        `offsets ${rightOffset}/${downOffset}: offline feasibility only`,
      );
      assert.equal(run.classic.livesLost, 0);
      assert.ok(run.coverage >= level.goal.coverage);
      assert.ok(
        run.objectives
          .filter((objective) => objective.required)
          .every((objective) => objective.captured),
      );
    }
});
