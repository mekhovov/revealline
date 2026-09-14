import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createStudioFixtureLoader } from '../../authoring/asset-studio/scene-preview.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const optional = /\/(?:fpv-arcade-r5|fpv-arcade)\.json$/;
const readJSON = async (url) => JSON.parse(await fs.readFile(url, 'utf8'));
function loaderFor(read) {
  const requests = [];
  const loader = createStudioFixtureLoader({
    readJSON: async (url) => {
      requests.push(url.pathname);
      return read(url);
    },
  });
  return { loader, requests };
}

test('offline player presets load independently of every optional or mission pack', async () => {
  const { loader, requests } = loaderFor((url) => {
    assert.ok(url.pathname.endsWith('/motion-lab/presets.json'));
    return readJSON(url);
  });
  const presets = await loader.presets();
  for (const id of [
    'scout',
    'light-carrier',
    'heavy-carrier',
    'interceptor',
    'fiber-relay',
    'impact',
    'trapper',
  ])
    assert.ok(presets.characters[`fpv-${id}-v1`]);
  assert.equal(await loader.presets(), presets);
  assert.equal(requests.length, 1);
});

test('exact owner context uses its own level and theme without any pack fetch or mutation', async () => {
  const descriptor = CURRENT_ART_SOURCES.find(
    (row) => row.owner.themeId === 'fpv' && row.level?.id === 'orchard-crossing',
  );
  const owner = { descriptor, level: descriptor.level, theme: descriptor.theme, fit: 'contain' },
    before = structuredClone(owner);
  const { loader, requests } = loaderFor((url) => {
    assert.ok(url.pathname.endsWith('/motion-lab/presets.json'), 'No mission pack dependency');
    return readJSON(url);
  });
  const context = await loader.context(descriptor.id, owner);
  assert.equal(context.level, owner.level);
  assert.equal(context.theme, owner.theme);
  assert.deepEqual(
    authoritativeCheckpoint(context.run),
    authoritativeCheckpoint(createRun(owner.level, { seed: descriptor.seed ?? 0 })),
  );
  assert.equal(context.run.tick, 0, 'Exact owner context does not advance an unrelated fixture.');
  assert.equal(requests.length, 1);
  assert.deepEqual(owner, before);
  const missing = loaderFor(() =>
    assert.fail('An incomplete owner must fail before loading fixtures.'),
  );
  await assert.rejects(
    missing.loader.context(descriptor.id, { ...owner, level: null }),
    /Exact picture owner metadata is unavailable; no substitute board/,
  );
  await assert.rejects(
    missing.loader.context(descriptor.id, { ...owner, theme: null }),
    /Exact picture owner metadata is unavailable/,
  );
  assert.deepEqual(missing.requests, []);
});

test('offline optional-pack fallback retains all seven enemy roles and online fixture choices', async () => {
  const offline = loaderFor((url) => {
    if (optional.test(url.pathname)) throw new TypeError('Network unavailable');
    return readJSON(url);
  });
  const online = loaderFor(readJSON);
  for (const kind of [
    'bouncer',
    'border-patrol',
    'contour-patrol',
    'claimed-rover',
    'eroder',
    'lane-boss',
    'relay-sentinel',
  ]) {
    const [cold, connected] = await Promise.all([
      offline.loader.context(`enemy.${kind}`),
      online.loader.context(`enemy.${kind}`),
    ]);
    assert.ok(
      cold.run.enemies.some((enemy) => enemy.type === kind),
      kind,
    );
    assert.deepEqual(cold.level, connected.level, `${kind} keeps its original inspection mission`);
    assert.deepEqual(cold.theme, connected.theme);
    assert.deepEqual(authoritativeCheckpoint(cold.run), authoritativeCheckpoint(connected.run));
  }
  for (const id of [
    'player.scout.compact',
    'terrain.wall',
    'terrain.slow',
    'terrain.lethal',
    'pickup.life',
    'pickup.speed',
    'pickup.slow',
    'pickup.freeze',
    'pickup.objective',
    'pickup.supply',
  ]) {
    const cold = await offline.loader.context(id);
    assert.equal(cold.run.status, 'running', id);
    assert.equal(cold.run.tick, 12, id);
  }
  assert.equal(offline.requests.filter((url) => optional.test(url)).length, 2);
  const a = await offline.loader.context('enemy.bouncer'),
    b = await offline.loader.context('enemy.bouncer');
  assert.notEqual(a.run, b.run);
  assert.notEqual(a.run.cells, b.run.cells);
});

test('failed core loads remain explicit and retry without poisoning player presets', async () => {
  let available = false;
  const { loader } = loaderFor((url) => {
    if (!available && url.pathname.endsWith('/classic-lab.json'))
      throw new Error('Core fixture unavailable');
    if (optional.test(url.pathname)) throw new TypeError('Network unavailable');
    return readJSON(url);
  });
  await assert.rejects(loader.context('enemy.eroder'), /Core fixture unavailable/);
  assert.ok((await loader.presets()).characters['fpv-scout-v1']);
  available = true;
  const restored = await loader.context('enemy.eroder');
  assert.ok(restored.run.enemies.some((enemy) => enemy.type === 'eroder'));
});
