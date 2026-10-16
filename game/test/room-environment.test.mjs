import test from 'node:test';
import assert from 'node:assert/strict';
import { roomCatalogue } from '../../services/rooms/server.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { prepareRunningEnemyLevel } from '../hunt/running-enemies.mjs';
import { prepareTeamRunningEnemies } from '../hunt/team-running-enemies.mjs';
import {
  prepareRoomEnvironment,
  roomAppearanceIdentity,
  serializeRoomAppearance,
  restoreRoomAppearance,
} from '../online/room-environment.mjs';
import {
  acceptAttemptAppearance,
  snapshotAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';

const entries = await roomCatalogue();
const military = {
  artRevision: 'industrial-roster-v3',
  collection: { id: 'military-field', revision: 'r1' },
};
function recipe(entry, targets = 'authored', pace = 'normal') {
  const raw =
    entry.family === 'snake'
      ? prepareClassicSnakeLevel(entry, {
          pace,
          format: 'campaign',
          targetRules: targets,
          preset: 'classic',
        })
      : targets === 'authored'
        ? entry.level
        : (entry.mode === 'team' ? prepareTeamRunningEnemies : prepareRunningEnemyLevel)(
            entry.level,
            { style: targets === 'varied' ? 'varied' : 'original' },
          );
  return {
    family: entry.family,
    mode: entry.mode,
    level: raw.level ?? raw,
    seed: 17,
    content: { catalogueId: entry.id, source: { kind: 'builtin' } },
  };
}
const owned = [];
for (const entry of entries) {
  if (!entry.id.includes('pursuit') && !entry.id.includes('classic-living')) continue;
  const value = recipe(entry);
  const candidate = await prepareRoomEnvironment(value);
  if (candidate) owned.push({ entry, value, candidate });
}

test('all 84 official room entries authenticate authored and moving/varied native recipes', async () => {
  assert.equal(owned.length, 84);
  for (const { entry, candidate } of owned) {
    assert.ok(acceptAttemptAppearance(candidate, military).environmentPin);
    for (const targets of ['moving', 'varied']) {
      const accepted = await prepareRoomEnvironment(recipe(entry, targets));
      assert.ok(accepted, `${entry.id} ${targets}`);
    }
    if (entry.family === 'snake')
      for (const pace of ['slow', 'fast'])
        assert.ok(await prepareRoomEnvironment(recipe(entry, 'varied', pace)));
  }
});

test('room artwork rejects changed geometry, changed owner, community aliases and retired operations', async () => {
  const { value } = owned[0];
  const changed = structuredClone(value);
  changed.level.width += 1;
  assert.equal(await prepareRoomEnvironment(changed), null);
  const foreign = structuredClone(value);
  foreign.content.source.kind = 'community';
  assert.equal(await prepareRoomEnvironment(foreign), null);
  const wrong = structuredClone(value);
  wrong.content.catalogueId += '-copy';
  assert.equal(await prepareRoomEnvironment(wrong), null);
  await assert.rejects(prepareRoomEnvironment(value, { signal: AbortSignal.abort() }), {
    name: 'AbortError',
  });
});

test('room page restoration retains exact artwork but another endpoint, generation or content cannot inherit it', () => {
  const { candidate } = owned[0],
    accepted = acceptAttemptAppearance(candidate, military);
  const identity = roomAppearanceIdentity('https://rooms.example.test', {
    roomId: '1'.repeat(32),
    contentHash: '2'.repeat(64),
    generation: 1,
  });
  const raw = serializeRoomAppearance(identity, accepted);
  assert.deepEqual(
    snapshotAttemptAppearance(restoreRoomAppearance(raw, identity, candidate)),
    snapshotAttemptAppearance(accepted),
  );
  for (const patch of [
    { service: 'https://elsewhere.example.test' },
    { generation: 2 },
    { contentHash: '3'.repeat(64) },
  ])
    assert.equal(restoreRoomAppearance(raw, { ...identity, ...patch }, candidate), undefined);
  assert.equal(
    restoreRoomAppearance(serializeRoomAppearance(identity, null), identity, candidate),
    null,
  );
  assert.equal(restoreRoomAppearance(null, identity, candidate), undefined);
  assert.throws(() => restoreRoomAppearance(raw, identity, owned[1].candidate), /./);
  const forged = JSON.parse(raw);
  forged.appearance.environmentPin.appearanceSha256 = '0'.repeat(64);
  assert.throws(() => restoreRoomAppearance(JSON.stringify(forged), identity, candidate), /./);
});
