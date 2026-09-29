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

test('never-settling observer, CDP and browser cleanup cannot prevent remaining owners or failure evidence', async () => {
  for (const stalled of ['observer', 'cdp', 'browser']) {
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
        page: { evaluate: close('observer') },
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
    assert.deepEqual(calls, ['observer', 'cdp', 'browser', 'server']);
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
      assert.deepEqual(calls, ['browser', 'server']);
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
      page: { evaluate: () => new Promise(() => {}) },
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
  assert.deepEqual(calls, ['browser', 'server']);
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
  newContext: async () => ({ newPage: async () => ({
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
  assert.equal(fake.calls.at(-1), 'browser closed');
  assert.equal(fake.calls.filter((item) => item === 'renderer read').length, 4);
  const cleanup = JSON.parse(await readFile(path.join(output, 'cleanup.json')));
  assert.equal(cleanup.completed, false);
  assert.equal(cleanup.primaryError, fake.primary.stack);
  assert.equal(cleanup.diagnosticFailures.filter((item) => item.timedOut).length, 3);
  assert.equal(cleanup.operations.find((item) => item.name === 'observer').timedOut, true);
  assert.equal(cleanup.operations.find((item) => item.name === 'server').closed, true);
  const failure = JSON.parse(await readFile(path.join(output, 'failure.json')));
  assert.equal(failure.error, fake.primary.stack);
  assert.equal(failure.identity.sourceRevision, input.plan.artifact.sourceRevision);
  const observation = JSON.parse(await readFile(path.join(output, 'case.json')));
  await assert.rejects(fetch(observation.origin + '/game/app.mjs'));
  await assert.rejects(readFile(path.join(output, 'complete.json')), { code: 'ENOENT' });
});
function fixture({ gameplayId = '7feffc97157784af', extra = false } = {}) {
  const rewardPath = 'game/content/company-campaigns/fpv-meet-aircraft.rewards.json';
  const files = new Map([
    ['game/index.html', Buffer.from('<title>Read-only archive test</title>')],
    ['game/company.html', Buffer.from('<title>Entry</title>')],
    ['game/app.mjs', Buffer.from('export const fixture = true;')],
    ['edition-catalog.json', Buffer.from('{"edition":"fpv-learning"}')],
    [
      rewardPath,
      Buffer.from(
        JSON.stringify([
          {
            scope: { kind: 'mission', id: 'fpv-meet-aircraft-01' },
            requirements: {
              missions: [
                {
                  missionId: 'fpv-meet-aircraft-01',
                  bindings: [{ gameplayId, difficulty: 'standard' }],
                },
              ],
            },
          },
        ]),
      ),
    ],
  ]);
  const manifest = Buffer.from(
    JSON.stringify({
      format: 'revealline-edition-manifest.v1',
      editionId: 'fpv-learning',
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
    protocol: 'fpv-frame-first-win.v1',
    deviceLabel: 'Synthetic unit-test metadata; no browser measurement',
    quietWindow: 'Unit tests only.',
    mode: 'timings',
    cycles: 0,
    artifact: {
      archive: 'distribution.zip',
      archiveSha256: hash(archive),
      manifest: 'manifest.json',
      manifestSha256: hash(manifest),
      sourceRevision: 'a'.repeat(40),
      sourceTree: 'b'.repeat(40),
      editionId: 'fpv-learning',
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
