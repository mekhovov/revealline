import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import {
  preparedPackIdentity,
  verifyIndexedInstalledPack,
} from '../mission-library/pack-identity.mjs';
import { customLibrarySources } from '../mission-library/custom-source.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const source = await readJSON('../content/packs/night-shift.json');
const index = await readJSON('../content/mission-library-index.json');
const row = index.missions.find((item) => item.packId === source.id);
const ready = async (value) => (await preparePack(value)).pack;

test('indexed identity verifies the complete prepared pack with no network or decoding', async () => {
  const pack = await ready(source);
  const first = preparedPackIdentity(pack);
  assert.equal(preparedPackIdentity(pack), first, 'Exact immutable owner shares one computation.');
  assert.deepEqual(await first, row.packIdentity);
  assert.equal(await verifyIndexedInstalledPack(pack, row), true);
  assert.ok(Object.isFrozen(await first));
  assert.throws(() => preparedPackIdentity(structuredClone(pack)), /prepared/);
});

test('same ID/version/campaign does not disguise a presentation-only Custom modification', async () => {
  const modified = structuredClone(source);
  modified.themes[0].palette.accent = '#112233';
  const pack = await ready(modified);
  assert.equal(await verifyIndexedInstalledPack(pack, row), false);
  const custom = await customLibrarySources(
    [{ pack, entries: pack.campaigns.map((campaign) => resolvePackCampaign(pack, campaign.id)) }],
    {
      isOfficial: (value) => verifyIndexedInstalledPack(value, row),
      compatibility: () => ['solo'],
      describe: () => ({ rules: 'Authored rules' }),
      availability: () => ({ state: 'ready' }),
      launch: () => true,
    },
  );
  assert.equal(custom.length, 1);
  assert.equal(custom[0].editionId, (await preparedPackIdentity(pack)).sha256);
});

test('identity includes author content and rejects wrong metadata even if pack bytes match', async () => {
  const pack = await ready(source);
  for (const changes of [
    { packId: 'other' },
    { packVersion: '2.0.0' },
    { campaignId: 'missing' },
    { campaignKey: 'wrong' },
    { levelIndex: 99 },
    { levelId: 'wrong' },
    { levelRevision: 'wrong' },
    { packIdentity: { ...row.packIdentity, sha256: 'a'.repeat(64) } },
    { packIdentity: { ...row.packIdentity, bytes: 1 } },
  ])
    assert.equal(await verifyIndexedInstalledPack(pack, { ...row, ...changes }), false);
  const modified = structuredClone(source);
  modified.campaigns[0].levels[0].rules.lives++;
  assert.equal(await verifyIndexedInstalledPack(await ready(modified), row), false);
});
