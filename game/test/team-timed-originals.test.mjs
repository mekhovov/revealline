import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createTeamTimedOriginalCandidates } from '../content-design/team-timed-originals.mjs';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { TEAM_TIMED_ART_CANDIDATES } from '../content-design/team-timed-art.mjs';
import { JOURNEY_ART_CANDIDATES } from '../content-design/journey-art.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamJourneyProgress } from '../content-design/team-progress.mjs';
import { TEAM_TIMED_PROFILE_KEY } from '../content-design/team-timed-entry.mjs';
import { createJourneyBackend, createJourneyProfileStore } from '../journey/profile.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCoop } from '../coop/core.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const source = createTeamTimedOriginalCandidates();
const journey = createCandidateTeamHost(source, { corePackIds: ['shared-windows'] });
const first = journey.row(journey.catalog.missions[0]);
const second = journey.destination(first).next;

test('three unique original pictures share compiler and optional-distribution pins', async () => {
  assert.equal(TEAM_TIMED_ART_CANDIDATES.length, 3);
  assert.equal(new Set(TEAM_TIMED_ART_CANDIDATES.map((a) => a.sha256)).size, 3);
  let bytes = 0;
  for (const asset of TEAM_TIMED_ART_CANDIDATES) {
    assert(JOURNEY_ART_CANDIDATES.includes(asset));
    assert(Object.isFrozen(asset));
    const data = await readFile(new URL('../' + asset.path, import.meta.url));
    assert.equal(data.length, asset.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
    assert.equal(data.readUInt32BE(16), asset.width);
    assert.equal(data.readUInt32BE(20), asset.height);
    assert.equal(asset.width, 2 * asset.height);
    assert(asset.bytes < 4 * 1024 * 1024);
    bytes += asset.bytes;
  }
  assert.equal(bytes, 7282747);
  const provenance = JSON.parse(
    await readFile(new URL('../../docs/research/team-timed-art-prompts.json', import.meta.url)),
  );
  assert.equal(provenance.tool, 'built-in-imagegen');
  assert.deepEqual(
    provenance.assets.map((a) => a.missionId),
    source.missions.map((m) => m.id),
  );
  for (const row of provenance.assets) {
    assert(TEAM_TIMED_ART_CANDIDATES.some((a) => 'game/' + a.path === row.path));
    assert(row.prompt.includes('original opaque raster'));
    assert.equal(row.review.kind, 'assistant-image-inspection-not-human-playtest');
  }
});

test('pictured Studio, export and runtime preserve all nine greybox gameplay editions', () => {
  const before = createTeamTimedCandidates(),
    baseline = structuredClone(before);
  const pictured = compileContentProject(source),
    grey = compileContentProject(before);
  for (const m of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const a = resolveMission(pictured, m.id, { mode: 'team', difficulty }),
        b = resolveMission(grey, m.id, { mode: 'team', difficulty });
      assert.deepEqual(a.level, b.level);
      assert.equal(a.simulationIdentity, b.simulationIdentity);
      assert(a.background);
      assert.equal(a.background.id, `team-windows-${m.id}`);
      assert.equal(a.officialProgressEligible, false);
      assert.deepEqual(
        prepareContentPreview(source, m.id, { mode: 'team', difficulty }).manifest,
        a,
      );
      assert.deepEqual(createTeamTestPack(source, m.id, difficulty).levels, [a.level]);
    }
  assert.deepEqual(createTeamTimedCandidates(), baseline);
  const editable = createTeamTimedOriginalCandidates();
  editable.maps[0].walls[0].w = 1;
  editable.assets[0].alt = 'Draft';
  assert.deepEqual(createTeamTimedOriginalCandidates(), source);
});

test('all presets continue across three campaigns then stop, with no imported-row authority', () => {
  assert.equal(journey.catalog.missions.length, 3);
  assert.equal(journey.rows.length, 9);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const rows = journey.catalog.missions.map((m) => journey.row(m, difficulty));
    assert.deepEqual(
      rows.map((r) => r.level.id),
      ['window-exchange', 'coolant-crossing', 'depot-dash'],
    );
    assert.deepEqual(
      rows.map((r) => journey.destination(r).next),
      [rows[1], rows[2], null],
    );
    assert.deepEqual(
      rows.map((r) => journey.destination(r).crossesCampaign),
      [true, true, false],
    );
    for (const row of rows) {
      assert.equal(row.pack.version, 'revealline-coop-pack.v5');
      assert.equal(row.pack.ruleset, 'revealline-coop.v7');
      assert.equal(journey.destination({ ...row }), null);
      assert.equal(row.officialProgressEligible, false);
    }
  }
});

test('Team scoped bookmarks, skips and backup do not overwrite the legacy Team cursor', async () => {
  const memory = managedIndexedDB();
  const legacyBackend = createJourneyBackend(memory);
  const original = await legacyBackend.commit([
    { type: 'select', mode: 'team', missionId: 'existing-team-cursor' },
  ]);
  const backend = createJourneyBackend({ ...memory, profileKey: TEAM_TIMED_PROFILE_KEY });
  const progress = createTeamJourneyProgress(journey, { backend, sessionId: 'timed-review' });
  await progress.load();
  assert.equal(progress.initial('standard'), first);
  assert(progress.started(second, createCoop(second.level), { skipped: first }));
  await progress.retry();
  assert.deepEqual(await legacyBackend.read(), original);
  assert.equal((await backend.read()).cursors.team, second.mission.id);
  assert.deepEqual(progress.snapshot().skipped.team, [first.mission.id]);
  assert.deepEqual(progress.snapshot().clears.team, {});
  const backup = JSON.parse(progress.export());
  assert.equal(backup.format, 'revealline-journey-backup.v2');
  assert.equal(backup.profileKey, TEAM_TIMED_PROFILE_KEY);
  assert.equal(progress.backupFilename, `revealline-${TEAM_TIMED_PROFILE_KEY}-progress.json`);
  const legacy = createTeamJourneyProgress(journey, { backend: legacyBackend });
  await legacy.load();
  assert.equal(legacy.backupFilename, 'revealline-journey-progress.json');
  assert.equal(JSON.parse(legacy.export()).format, 'revealline-journey-backup.v1');
  const reopened = createTeamJourneyProgress(journey, { backend });
  await reopened.load();
  assert.equal(reopened.initial('expert').level.id, 'coolant-crossing');
  assert.equal(reopened.initial('expert').difficulty, 'expert');
  const defaultStore = createJourneyProfileStore({ backend: legacyBackend });
  assert.throws(() => defaultStore.inspectBackup(backup), /Unsupported|backup/i);
  const scopedStore = createJourneyProfileStore({ backend });
  assert.doesNotThrow(() => scopedStore.inspectBackup(backup));
  assert.throws(
    () => createTeamJourneyProgress(journey, { backend, profileKey: 'wrong-scope' }),
    /backend and profile edition must agree/,
  );
  assert.throws(
    () => createTeamJourneyProgress(journey, { profileKey: '../bad' }),
    /stable profile key/,
  );
  for (const owner of [progress, legacy, reopened]) owner.dispose();
});

test('scoped denied storage retains session-only bookmarks and retries only its own key', async () => {
  const memory = managedIndexedDB(),
    backend = createJourneyBackend({ ...memory, profileKey: TEAM_TIMED_PROFILE_KEY });
  let denied = true;
  const progress = createTeamJourneyProgress(journey, {
    profileKey: TEAM_TIMED_PROFILE_KEY,
    backend: {
      profileKey: TEAM_TIMED_PROFILE_KEY,
      read: () => {
        if (denied) throw Error('Denied');
        return backend.read();
      },
      commit: (events) => {
        if (denied) throw Error('Denied');
        return backend.commit(events);
      },
    },
  });
  await progress.load();
  assert.equal(progress.status().durable, false);
  assert(progress.started(first, createCoop(first.level)));
  assert.equal(JSON.parse(progress.export()).profile.cursors.team, first.mission.id);
  denied = false;
  await progress.retry();
  assert.equal(progress.status().durable, true);
  assert.equal((await backend.read()).cursors.team, first.mission.id);
  assert.equal((await createJourneyBackend(memory).read()).cursors.team, null);
  progress.dispose();
});
