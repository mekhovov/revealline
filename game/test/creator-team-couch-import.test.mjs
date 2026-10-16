import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlayableTeamCampaign } from '../couch/creator-team-import.mjs';
import {
  CREATOR_TEAM_PORTABLE_MIME,
  exportCreatorTeamCampaign,
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
} from '../creator/team.mjs';

test('production Team file intake launches a replay-verified Creator campaign', async () => {
  const generated = generateCreatorTeamCampaign({
    id: 'couch-team',
    name: 'Couch Team',
    seed: 7,
  });
  const prepared = await prepareCreatorTeamCampaign(generated.pack, generated.provenance);
  const portable = exportCreatorTeamCampaign(prepared);
  assert.equal(portable.type, CREATOR_TEAM_PORTABLE_MIME);

  const playable = await readPlayableTeamCampaign(portable);
  assert.equal(playable.kind, 'creator');
  assert.deepEqual(playable.pack, generated.pack);
  assert.deepEqual(playable.prepared.evidence, prepared.evidence);
});

test('production Team file intake preserves raw packs and rejects changed Creator evidence', async () => {
  const generated = generateCreatorTeamCampaign({
    id: 'couch-transfer',
    name: 'Couch Transfer',
    seed: 4,
  });
  const raw = await readPlayableTeamCampaign(
    new Blob([JSON.stringify(generated.pack)], { type: 'application/json' }),
  );
  assert.equal(raw.kind, 'raw');
  assert.deepEqual(raw.pack, generated.pack);

  class HostileTeamBlob extends Blob {
    get size() {
      throw new Error('caller size getter must not run');
    }
    get type() {
      throw new Error('caller type getter must not run');
    }
  }
  const owned = await readPlayableTeamCampaign(
    new HostileTeamBlob([JSON.stringify(generated.pack)], { type: 'application/json' }),
  );
  assert.deepEqual(owned.pack, generated.pack);

  const prepared = await prepareCreatorTeamCampaign(generated.pack, generated.provenance);
  const document = JSON.parse(await exportCreatorTeamCampaign(prepared).text());
  document.evidence[0].contributions[0]++;
  await assert.rejects(
    readPlayableTeamCampaign(
      new Blob([JSON.stringify(document)], { type: CREATOR_TEAM_PORTABLE_MIME }),
    ),
    /evidence differs/,
  );
});
