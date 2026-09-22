import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack, emptyPackLibrary, installPack, resolvePackCampaign } from '../packs.mjs';
import { campaignKey, emptyLibrary } from '../library.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import {
  resolveInstalledMissionTarget,
  installedMissionExecutionIndex,
} from '../mission-library/installed-target.mjs';

const source = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
);
const second = structuredClone(source.campaigns[0]);
second.id = 'second-campaign';
second.title = 'Same-looking campaign';
second.levels.forEach((level, index) => {
  level.id = `second-map-${index}`;
});
source.campaigns.push(second);
const { pack } = await preparePack(source);
const packs = installPack(emptyPackLibrary(), pack);
const entry = resolvePackCampaign(pack, second.id);
const identity = campaignKey(entry.campaign);
const last = entry.campaign.levels.at(-1);
const request = (changes = {}) => ({
  packs,
  pack,
  sourcePackId: pack.id,
  campaignIdentity: identity,
  levelId: last.id,
  levelRevision: last.revision,
  ...changes,
});

test('exact late mission resolves from the second campaign with an empty untouched profile', () => {
  const profile = emptyLibrary(),
    before = structuredClone(profile);
  const target = resolveInstalledMissionTarget(request());
  assert.equal(target.entry.campaign.id, second.id);
  assert.equal(target.levelIndex, entry.campaign.levels.length - 1);
  assert.equal(target.title, last.name);
  assert.equal(target.identity.levelId, last.id);
  assert.equal(target.identity.levelRevision, last.revision);
  assert.deepEqual(profile, before);
});

test('omitted mission keeps chapter Continue semantics, explicit invalid intent never falls back', () => {
  const target = resolveInstalledMissionTarget(
    request({ levelId: undefined, levelRevision: undefined }),
  );
  assert.equal(target.levelIndex, null);
  assert.equal(Object.hasOwn(target.identity, 'levelId'), false);
  assert.equal(installedMissionExecutionIndex(target, entry, 1), 1);
  for (const levelId of ['', null, 2, 'missing', source.campaigns[0].levels[0].id])
    assert.throws(() => resolveInstalledMissionTarget(request({ levelId })), /exact mission/);
  assert.throws(
    () => resolveInstalledMissionTarget(request({ levelRevision: 'missing' })),
    /revision changed/,
  );
  assert.throws(
    () => resolveInstalledMissionTarget(request({ levelId: undefined })),
    /requires an exact mission/,
  );
});

test('stale or cloned installed owners and wrong campaign fingerprints fail before launch', () => {
  for (const changes of [
    { packs: emptyPackLibrary() },
    { pack: structuredClone(pack) },
    { sourcePackId: 'another-pack' },
  ])
    assert.throws(() => resolveInstalledMissionTarget(request(changes)), /chapter changed/);
  assert.throws(
    () => resolveInstalledMissionTarget(request({ campaignIdentity: 'second-campaign' })),
    /exact chapter/,
  );
  const altered = structuredClone(entry.campaign);
  altered.levels.at(-1).rules.lives += 1;
  assert.throws(
    () => resolveInstalledMissionTarget(request({ campaignIdentity: campaignKey(altered) })),
    /exact chapter/,
  );
});

test('both supported difficulties keep exact authored level instead of progress-clamped fallback', () => {
  const target = resolveInstalledMissionTarget(request());
  const execution = createExecutionCatalog([entry]);
  for (const difficulty of ['standard', 'gentle']) {
    const projected = execution.select(identity, difficulty);
    assert.equal(installedMissionExecutionIndex(target, projected, 0), target.levelIndex);
    assert.equal(projected.campaign.levels[target.levelIndex].id, last.id);
  }
  const reordered = structuredClone(entry);
  reordered.campaign.levels.reverse();
  assert.throws(() => installedMissionExecutionIndex(target, reordered, 0), /exact mission/);
});

test('replacement ticket identity includes exact mission and revision', () => {
  const lastTarget = resolveInstalledMissionTarget(request());
  const first = entry.campaign.levels[0];
  const firstTarget = resolveInstalledMissionTarget(
    request({ levelId: first.id, levelRevision: first.revision }),
  );
  assert.notDeepEqual(lastTarget.identity, firstTarget.identity);
  assert.equal(lastTarget.identity.campaignKey, firstTarget.identity.campaignKey);
  assert.equal(lastTarget.identity.sourcePackId, pack.id);
});
