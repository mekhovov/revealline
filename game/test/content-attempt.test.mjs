import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { CONTENT_ATTEMPT_PREPARATION_TIMEOUT_MS } from '../content-design/limits.mjs';

const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
const requestFor = (host, index = 0, changes = {}) => ({
  missionId: host.catalog.journey().missions[index].id,
  difficulty: 'standard',
  seed: 1,
  turnPolicy: 'immediate',
  ...changes,
});
const setup = (options = {}, source = createOpeningCandidates()) =>
  createContentAttemptPreparer(source, { themes, ...options });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test('all sixty candidate attempts use the exact compiler and produce replay-verifiable full clears', async () => {
  const host = setup(),
    project = compileContentProject(createOpeningCandidates());
  const standard = JSON.parse(
    await readFile(new URL('./fixtures/horizon-greybox-routes.json', import.meta.url)),
  );
  const presets = JSON.parse(
    await readFile(new URL('./fixtures/horizon-preset-routes.json', import.meta.url)),
  );
  let count = 0,
    previous = null;
  for (const { difficulty, turnPolicy, rows } of [
    { difficulty: 'standard', turnPolicy: 'immediate', rows: standard.rows },
    ...presets.sets,
  ]) {
    for (const [id, identity, checkpoint, segments] of rows) {
      const mission = host.catalog.journey().missions.find((item) => item.levelId === id);
      const prepared = await host.prepare({
        missionId: mission.id,
        difficulty,
        turnPolicy,
        seed: 1,
      });
      const manifest = resolveMission(project, id, { difficulty });
      assert.deepEqual(prepared.manifest, manifest);
      assert.equal(prepared.manifest.simulationIdentity, identity);
      assert.equal(prepared.theme.id, manifest.presentation.themeId);
      assert.equal(prepared.officialProgressEligible, false);
      assert.equal(prepared.run.classId, 'scout');
      assert.equal(prepared.run.lives, { gentle: 5, standard: 3, expert: 2 }[difficulty]);
      assert.equal(prepared.run.rules.moveSpeed, 10);
      assert(host.current(prepared));
      assert(!host.current(previous));
      assert.deepEqual(
        authoritativeCheckpoint(prepared.run),
        authoritativeCheckpoint(
          createRun(manifest.level, { seed: 1, turnPolicy, classId: 'scout' }),
        ),
      );
      for (const [direction, ticks] of segments) {
        for (let tick = 0; tick < ticks; tick++) {
          recordInput(prepared.recorder, { direction });
          stepRun(prepared.run, { direction }, FIXED_DT);
        }
      }
      assert.equal(prepared.run.status, 'won');
      assert.equal(authoritativeCheckpoint(prepared.run).hash, checkpoint);
      assert.equal(verifyReplay(exportReplay(prepared.recorder, prepared.run)).match, true);
      previous = prepared;
      count++;
    }
  }
  assert.equal(count, 60);
  host.dispose();
  assert(!host.current(previous));
});

test('preparation snapshots source, themes and request without freezing or changing an existing run', async () => {
  const source = createOpeningCandidates(),
    themeSource = structuredClone(themes);
  const host = setup({ themes: themeSource }, source);
  const request = requestFor(host),
    original = structuredClone(request);
  const loading = host.prepare(request);
  request.seed = 99;
  source.missions[0].coverage = 0.95;
  themeSource[0].name = 'Changed outside';
  const first = await loading;
  assert.deepEqual(first.selection, original);
  assert.equal(first.theme.name, 'Horizon School');
  const checkpoint = authoritativeCheckpoint(first.run);
  const second = await host.prepare(requestFor(host, 1));
  assert.deepEqual(authoritativeCheckpoint(first.run), checkpoint);
  assert.notEqual(first.run, second.run);
  assert.notEqual(first.recorder, second.recorder);
  assert(!Object.isFrozen(second.run));
  assert(Object.isFrozen(second.theme.palette));
  assert(Object.isFrozen(second.visualOverrides));
  assert(!host.current({ ...second }));
  host.dispose();
});

test('unknown missions, privileges, loadouts and invalid options cannot retire a valid prepared attempt', async () => {
  const host = setup({ packIds: ['journey-opening'] });
  const original = await host.prepare(requestFor(host));
  for (const changes of [
    { missionId: 'missing' },
    { missionId: ['first-return'] },
    { difficulty: 'automatic' },
    { difficulty: null },
    { seed: -1 },
    { seed: 4294967296 },
    { seed: 1.5 },
    { turnPolicy: 'random' },
    { mode: 'team' },
    { officialProgressEligible: true },
    { classId: 'interceptor' },
    { classRecipes: [] },
    { rules: { moveSpeed: 100 } },
  ]) {
    await assert.rejects(host.prepare(requestFor(host, 0, changes)));
    assert(host.current(original));
  }
  const all = setup();
  await assert.rejects(host.prepare(requestFor(all, 9)), /catalog/);
  assert(host.current(original));
  all.dispose();
  host.dispose();
  await assert.rejects(host.prepare(requestFor(host)), /disposed/);
});

test('missing authored theme is explicit, never silently replaced by a legacy theme', async () => {
  const wrong = { ...themes[0], id: 'retro' };
  const host = setup({ themes: [wrong] });
  await assert.rejects(host.prepare(requestFor(host)), /exact presentation theme/);
  assert.throws(() => setup({ themes: [themes[0], themes[0]] }), /Duplicate/);
  assert.throws(() => setup({ themes: [{ ...themes[0], palette: {} }] }), /palette/);
  host.dispose();
});

test('exact original asset is verified before exposing a new attempt; copied media cannot impersonate verification', async () => {
  const source = createOpeningCandidates({ artwork: true });
  const asset = source.assets[0];
  const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
  const media = await loadPreviewArtwork(asset, {
    fetchAsset: async () => new Response(bytes),
    digest: (value) => webcrypto.subtle.digest('SHA-256', value),
  });
  const host = setup(
    {
      loadArtwork: async () => media,
      decodeImage: async () => ({ width: asset.width, height: asset.height }),
    },
    source,
  );
  const first = await host.prepare(requestFor(host));
  assert.equal(first.visualOverrides.background.dataUrl, media.dataUrl);
  assert.equal(first.visualOverrides.background.name, asset.alt);
  // Same loader result cannot authorize a different mission's image.
  await assert.rejects(host.prepare(requestFor(host, 1)), /verify/);
  assert(!host.current(first));
  assert.equal(first.run.tick, 0, 'A failed replacement never changes an existing attempt.');
  const forged = setup({ loadArtwork: async () => ({ ...media }) }, source);
  await assert.rejects(forged.prepare(requestFor(forged)), /verify/);
  host.dispose();
  forged.dispose();
});

test('cancel, disposal and external abort settle even when artwork ignores cancellation', async () => {
  for (const action of ['cancel', 'dispose', 'abort']) {
    const started = deferred(),
      late = deferred(),
      controller = new AbortController();
    const host = setup(
      {
        loadArtwork: () => {
          started.resolve();
          return late.promise;
        },
      },
      createOpeningCandidates({ artwork: true }),
    );
    const loading = host.prepare(requestFor(host), { signal: controller.signal });
    await started.promise;
    if (action === 'abort') controller.abort();
    else host[action]();
    await assert.rejects(loading, { name: 'AbortError' });
    late.resolve({ dataUrl: 'late-unverified' });
    await new Promise((resolve) => setImmediate(resolve));
    assert(!host.current(null));
    host.dispose();
  }
});

test('a timed out artwork loader cannot hold preparation forever', async () => {
  const host = setup(
    { timeoutMs: 5, loadArtwork: () => new Promise(() => {}) },
    createOpeningCandidates({ artwork: true }),
  );
  await assert.rejects(host.prepare(requestFor(host)), /timed out/);
  host.dispose();
});

test('candidate preparation accepts the complete reviewed-art budget and rejects larger deadlines', () => {
  const host = setup({ timeoutMs: CONTENT_ATTEMPT_PREPARATION_TIMEOUT_MS });
  host.dispose();
  assert.throws(() => setup({ timeoutMs: CONTENT_ATTEMPT_PREPARATION_TIMEOUT_MS + 1 }), /timeout/);
});

test('a pre-aborted request does not start loading or retire an existing prepared attempt', async () => {
  const host = setup();
  const first = await host.prepare(requestFor(host));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(host.prepare(requestFor(host, 1), { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert(host.current(first));
  host.dispose();
});

test('observer failure is contained but observer cancellation or replacement owns the outcome', async () => {
  const host = setup();
  const first = await host.prepare(requestFor(host), {
    onStatus() {
      throw new Error('UI failed');
    },
  });
  assert(host.current(first));
  await assert.rejects(
    host.prepare(requestFor(host), {
      onStatus() {
        host.cancel();
      },
    }),
    { name: 'AbortError' },
  );
  let newer;
  await assert.rejects(
    host.prepare(requestFor(host), {
      onStatus() {
        newer ??= host.prepare(requestFor(host, 1));
      },
    }),
    { name: 'AbortError' },
  );
  const replacement = await newer;
  assert(host.current(replacement));
  assert.equal(replacement.mission.levelId, 'choose-your-share');
  host.dispose();
});

test('reentrant abort callbacks cannot let an older request replace a newer intent', async () => {
  const source = createOpeningCandidates({ artwork: true });
  // Leave one greybox available as a deterministic no-network newer request.
  source.missions[2].presentation.backgroundAssetId = null;
  const started = deferred();
  let newer;
  const host = setup(
    {
      loadArtwork(_asset, { signal }) {
        signal.addEventListener(
          'abort',
          () => {
            newer = host.prepare(requestFor(host, 2));
          },
          { once: true },
        );
        started.resolve();
        return new Promise(() => {});
      },
    },
    source,
  );
  const first = host.prepare(requestFor(host));
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await started.promise;
  await assert.rejects(host.prepare(requestFor(host, 1)), { name: 'AbortError' });
  await rejected;
  const latest = await newer;
  assert.equal(latest.mission.levelId, 'two-keepers');
  assert(host.current(latest));
  host.dispose();
});
