import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import {
  prepareIndustrialEnvironmentSource,
  resolveIndustrialEnvironment,
} from '../presentation/industrial-environments.mjs';
import {
  snapshotAttemptAppearance,
  acceptAttemptAppearance,
  restoreAttemptAppearance,
  requireAcceptedAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';
import { BoardPainter } from '../ui/render.mjs';

const source = createPursuitCampaignCandidates();
const entry = createContentExecutionCatalog(source, { mode: 'solo' }).entries.find(
  (item) => item.difficulty === 'standard',
);
const origin = {
  kind: 'builtin',
  catalogueId: source.id,
  catalogueRevision: source.revision,
  sourceForm: `compiled-native-v1:${entry.policyVersion}:${entry.difficulty}`,
};
const candidate = (level = entry.campaign.levels[0], signal) =>
  prepareIndustrialEnvironmentSource({
    engine: 'capture',
    mode: 'solo',
    source: level,
    origin,
    signal,
  });
const selection = {
  artRevision: 'industrial-roster-v3',
  collection: { id: 'military-field', revision: 'r1' },
};

test('accepted artwork preserves exact portable selection and restores only its original source', async () => {
  const own = await candidate();
  assert.ok(own);
  const appearance = acceptAttemptAppearance(own, selection);
  assert.ok(appearance.environmentPin);
  assert.ok(Object.isFrozen(appearance));
  assert.ok(Object.isFrozen(appearance.collection));
  assert.ok(resolveIndustrialEnvironment(appearance.environmentPin));
  const saved = snapshotAttemptAppearance(appearance);
  assert.deepEqual(saved, appearance);
  assert.notEqual(saved.environmentPin, appearance.environmentPin);
  assert.throws(() => requireAcceptedAttemptAppearance(saved), /accepted or restored/);
  assert.equal(
    requireAcceptedAttemptAppearance(appearance).environmentPin,
    appearance.environmentPin,
  );
  const restored = restoreAttemptAppearance(JSON.parse(JSON.stringify(saved)), own);
  assert.deepEqual(restored, appearance);
  assert.ok(resolveIndustrialEnvironment(restored.environmentPin));
  assert.throws(() => restoreAttemptAppearance(saved, null), /authority/);
  const different = await candidate(entry.campaign.levels[1]);
  assert.ok(different);
  assert.throws(() => restoreAttemptAppearance(saved, different), /native source/);
});

test('historical absence is not inferred from a supported candidate or new preference', async () => {
  const own = await candidate();
  assert.equal(restoreAttemptAppearance(null, own), null);
  assert.equal(restoreAttemptAppearance(undefined, own), null);
  assert.equal(requireAcceptedAttemptAppearance(null), null);
  const ordinary = acceptAttemptAppearance(own, { artRevision: null, collection: null });
  assert.deepEqual(ordinary, { artRevision: null, collection: null, environmentPin: null });
});

test('portable artwork requires exact revisions and cannot relabel an environment pin', async () => {
  const appearance = acceptAttemptAppearance(await candidate(), selection);
  for (const revision of [undefined, '', 'missing']) {
    const malformed = structuredClone(appearance);
    malformed.collection.revision = revision;
    assert.throws(() => snapshotAttemptAppearance(malformed));
  }
  for (const change of [
    { artRevision: null },
    { artRevision: 'industrial-overhead-v2' },
    { collection: null },
    { collection: { id: 'industrial-workshop', revision: 'r1' } },
  ])
    assert.throws(
      () => restoreAttemptAppearance({ ...appearance, ...change }, null),
      /artwork differ/,
    );
  assert.throws(
    () => snapshotAttemptAppearance({ ...appearance, artRevision: 'unregistered-v8' }),
    /revision/,
  );
});

test('retired source preparation cannot mint a later accepted appearance', async () => {
  const controller = new AbortController();
  const own = await candidate(undefined, controller.signal);
  controller.abort();
  assert.throws(() => acceptAttemptAppearance(own, selection), { name: 'AbortError' });
});

test('Capture painter keeps original branded pins and repeated accepted binding is inert', async () => {
  const appearance = acceptAttemptAppearance(await candidate(), selection);
  const events = [];
  const owner = {
    acceptedAttemptAppearance: undefined,
    arcadeAdapter: { setEnvironment: (value) => events.push(['environment', value]) },
    acceptEnemyArtwork: (value) => events.push(['artwork', value]),
  };
  BoardPainter.prototype.setAttemptAppearance.call(owner, appearance);
  assert.equal(events[1][1], appearance.environmentPin);
  BoardPainter.prototype.setAttemptAppearance.call(owner, appearance);
  assert.equal(events.length, 2);
  assert.throws(
    () => BoardPainter.prototype.setAttemptAppearance.call(owner, structuredClone(appearance)),
    /accepted or restored/,
  );
  assert.equal(events.length, 2);
  BoardPainter.prototype.setAttemptAppearance.call(owner, null);
  assert.deepEqual(events.slice(-2), [
    ['artwork', { artRevision: null, arcadeCollection: null }],
    ['environment', null],
  ]);
});
