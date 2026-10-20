import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REMOTE_TEAM_NAVIGATION_FORMAT,
  REMOTE_TEAM_NAVIGATION_MAX_BYTES,
  REMOTE_TEAM_NAVIGATION_TARGETS,
  remoteTeamNavigationTarget,
  encodeRemoteTeamNavigation,
  inspectRemoteTeamNavigation,
  runRemoteTeamNavigationCLI,
} from './remote-team-navigation.mjs';

const fixture = () => ({
  format: REMOTE_TEAM_NAVIGATION_FORMAT,
  target: 'cultural',
  mode: 'team',
  editionId: 'team-cultural-specialist-originals-2',
  factory: remoteTeamNavigationTarget('cultural').factory,
  project: { id: 'synthetic-inspection-only', revision: '1', sha256: 'a'.repeat(64) },
  view: { campaigns: [{}], presentations: {}, ordinals: {} },
  cards: {},
});

test('only the three explicit first-party factory targets can be selected', async () => {
  assert.deepEqual(REMOTE_TEAM_NAVIGATION_TARGETS, ['cultural', 'expedition', 'hunt']);
  for (const target of REMOTE_TEAM_NAVIGATION_TARGETS)
    assert(Object.isFrozen(remoteTeamNavigationTarget(target)));
  for (const target of ['imported-team', 'constructor', '__proto__', '../game/coop/core.mjs', null])
    assert.throws(() => remoteTeamNavigationTarget(target), /registered remote Team target/);
  await assert.rejects(
    runRemoteTeamNavigationCLI(['produce', 'imported-team', 'unused']),
    /registered remote Team target/,
  );
  await assert.rejects(runRemoteTeamNavigationCLI(['produce', 'cultural']), /Usage:/);
});

test('bounded structural inspection is canonical and explicitly supplies no native trust', () => {
  const value = fixture();
  const bytes = encodeRemoteTeamNavigation(value);
  assert.deepEqual(inspectRemoteTeamNavigation(bytes, 'cultural'), value);
  assert.equal(Object.hasOwn(value.view, 'executionMetadata'), false);
  assert.throws(
    () => inspectRemoteTeamNavigation(Buffer.from(JSON.stringify(value)), 'cultural'),
    /canonical bytes/,
  );
  assert.throws(() => inspectRemoteTeamNavigation(bytes, 'hunt'), /target does not match/);
  assert.throws(
    () =>
      inspectRemoteTeamNavigation(encodeRemoteTeamNavigation({ ...value, packs: [] }), 'cultural'),
    /Unexpected/,
  );
  assert.throws(
    () =>
      inspectRemoteTeamNavigation(Buffer.alloc(REMOTE_TEAM_NAVIGATION_MAX_BYTES + 1), 'cultural'),
    /bounded/,
  );
  assert.throws(
    () => encodeRemoteTeamNavigation({ text: 'x'.repeat(REMOTE_TEAM_NAVIGATION_MAX_BYTES) }),
    /4 MiB/,
  );
});
