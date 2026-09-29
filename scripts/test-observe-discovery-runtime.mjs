import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createEditionZip } from '../publishing/edition-zip.mjs';
import {
  validateDiscoveryRuntimePlan,
  verifyDiscoveryRuntimeArtifact,
  serveDiscoveryRuntime,
  observeDiscoveryRuntime,
  finishDiscoveryObservation,
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
    assert.deepEqual(sequence.slice(0, 2), ['browser', 'server']);
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
      assert.equal(value.cleanup?.completed ?? value.completed, true);
    },
    complete: { qualified: false, completed: true },
  });
  assert.deepEqual(sequence, ['browser', 'server', 'cleanup.json', 'complete.json']);
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
  assert.equal(await response.text(), 'export const fixture = true;');
  assert.equal(
    (await fetch(server.origin + '/docs/verification/discovery-observer.mjs')).status,
    200,
  );
  for (const name of ['/scripts/game-cli.mjs', '/private-sentinel.txt', '/%2e%2e/package.json'])
    assert.equal((await fetch(server.origin + name)).status, 404);
  assert.equal((await fetch(server.origin + '/game/app.mjs', { method: 'POST' })).status, 404);
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
