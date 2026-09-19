import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_STARTER_PACK, coopPackDestination } from '../coop/library.mjs';

test('ordered successors use the exact accepted recipe and return an independent target snapshot', () => {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'my-import';
  pack.levels.reverse();
  const before = structuredClone(pack);
  const first = coopPackDestination(pack, structuredClone(pack.levels[0]));
  assert.equal(first.final, false);
  assert.deepEqual(first.next, pack.levels[1]);
  first.next.name = 'Caller-owned draft';
  assert.deepEqual(pack, before);
  assert.deepEqual(coopPackDestination(pack, pack.levels[1]), { next: null, final: true });
});

test('an accepted pack snapshot keeps its successor when its original source changes', () => {
  const source = structuredClone(COOP_STARTER_PACK);
  const accepted = structuredClone(source);
  source.levels.reverse();
  source.levels[0].name = 'A newer source revision';
  assert.deepEqual(
    coopPackDestination(accepted, accepted.levels[0]).next,
    COOP_STARTER_PACK.levels[1],
  );
});

test('same IDs do not substitute a changed or missing current recipe', () => {
  const pack = structuredClone(COOP_STARTER_PACK);
  const changed = structuredClone(pack.levels[0]);
  changed.goal.coverage += 0.01;
  assert.equal(coopPackDestination(pack, changed), null);
  assert.equal(coopPackDestination(pack, { ...pack.levels[0], id: 'missing' }), null);
  assert.equal(coopPackDestination(pack, null), null);
});

for (const kind of ['missing', 'invalid', 'duplicate', 'extra-art']) {
  test(`${kind} successor data cannot produce a destination`, () => {
    const pack = structuredClone(COOP_STARTER_PACK);
    const current = structuredClone(pack.levels[0]);
    if (kind === 'missing') pack.levels[1] = null;
    if (kind === 'invalid') pack.levels[1].goal = { coverage: 1.2 };
    if (kind === 'duplicate') pack.levels[1].id = pack.levels[0].id;
    if (kind === 'extra-art') pack.levels[1].picture = { required: true };
    assert.equal(coopPackDestination(pack, current), null);
  });
}

test('an empty or malformed pack has no implicit built-in successor', () => {
  for (const pack of [null, {}, { ...COOP_STARTER_PACK, levels: [] }])
    assert.equal(coopPackDestination(pack, COOP_STARTER_PACK.levels[0]), null);
});
