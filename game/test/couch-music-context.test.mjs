import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  soloCompatibleMusicContext,
  prepareTeamMusicContext,
} from '../couch/couch-music-context.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { canonicalJSON } from '../data-json.mjs';

const solo = {
  campaignKey: 'approved-campaign:revision-hash',
  level: { id: 'opening', revision: '2' },
  themeId: 'fpv',
};
test('compatible Solo/Versus use the exact existing assignment identity', () => {
  assert.deepEqual(soloCompatibleMusicContext(solo), {
    campaignKey: solo.campaignKey,
    themeId: 'fpv',
    mapKey: JSON.stringify([solo.campaignKey, 'opening', '2', 'fpv']),
  });
  assert.ok(Object.isFrozen(soloCompatibleMusicContext(solo)));
});
for (const change of [
  { campaignKey: '' },
  { themeId: '' },
  { level: { id: 'opening' } },
  { level: { id: 'opening', revision: 2 } },
  { campaignKey: 'x'.repeat(512) },
]) {
  test(`invalid or over-budget compatible context is rejected: ${JSON.stringify(change)}`, () =>
    assert.throws(() => soloCompatibleMusicContext({ ...solo, ...change })));
}
const team = (pack = COOP_STARTER_PACK, level = pack.levels[0], extra = {}) =>
  prepareTeamMusicContext({ pack, level, themeId: 'fpv', ...extra });
test('Team context binds the canonical validated pack hash, exact level, revision and theme', async () => {
  const context = await team();
  const hash = createHash('sha256').update(canonicalJSON(COOP_STARTER_PACK)).digest('hex');
  assert.deepEqual(JSON.parse(context.campaignKey), [
    'team-music.v1',
    COOP_STARTER_PACK.version,
    COOP_STARTER_PACK.ruleset,
    COOP_STARTER_PACK.id,
    COOP_STARTER_PACK.revision,
    hash,
  ]);
  assert.equal(
    context.mapKey,
    JSON.stringify([
      context.campaignKey,
      COOP_STARTER_PACK.levels[0].id,
      COOP_STARTER_PACK.levels[0].revision,
      'fpv',
    ]),
  );
  assert.ok(Object.isFrozen(context));
});
test('changed geometry with reused labels/IDs does not reuse the Team assignment', async () => {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.levels[0].goal.coverage += 0.01;
  assert.notEqual((await team(pack)).campaignKey, (await team()).campaignKey);
});
test('equivalent plain/envelope-extracted packs and reordered object keys share an identity', async () => {
  const pack = Object.fromEntries(Object.entries(structuredClone(COOP_STARTER_PACK)).reverse());
  assert.deepEqual(await team(pack), await team());
});
test('hashing owns a snapshot before yielding, so caller mutation cannot retarget it', async () => {
  const pack = structuredClone(COOP_STARTER_PACK);
  const pending = team(pack);
  pack.id = 'another-pack';
  pack.levels[0].goal.coverage += 0.01;
  assert.deepEqual(await pending, await team());
});
test('theme changes affect assignment context, not gameplay pack identity', async () => {
  const fpv = await team();
  const alt = await team(COOP_STARTER_PACK, COOP_STARTER_PACK.levels[0], { themeId: 'ukrainian' });
  assert.equal(fpv.campaignKey, alt.campaignKey);
  assert.notEqual(fpv.mapKey, alt.mapKey);
});
test('same-ID changed level and unknown level are refused before an assignment can escape', async () => {
  const level = structuredClone(COOP_STARTER_PACK.levels[0]);
  level.goal.coverage += 0.01;
  await assert.rejects(team(COOP_STARTER_PACK, level), /accepted pack/i);
  await assert.rejects(team(COOP_STARTER_PACK, { ...level, id: 'missing' }), /accepted pack/i);
});
test('invalid packs and extra historical music fields remain rejected', async () => {
  await assert.rejects(team({ ...COOP_STARTER_PACK, music: 'track' }), /supported fields/i);
  await assert.rejects(team({ ...COOP_STARTER_PACK, levels: [] }, COOP_STARTER_PACK.levels[0]));
});
test('already cancelled and cancelled-during-hash contexts never return an assignment', async () => {
  const first = new AbortController();
  first.abort();
  await assert.rejects(
    team(COOP_STARTER_PACK, COOP_STARTER_PACK.levels[0], { signal: first.signal }),
    { name: 'AbortError' },
  );
  const second = new AbortController();
  const pending = team(COOP_STARTER_PACK, COOP_STARTER_PACK.levels[0], { signal: second.signal });
  second.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
