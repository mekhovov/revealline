import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { TEAM_ART_CANDIDATES } from '../content-design/team-art.mjs';
import { SIGNAL_TEAM_ART_CANDIDATES } from '../content-design/signal-art.mjs';
import { JOURNEY_ART_CANDIDATES } from '../content-design/journey-art.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamFoundationGoal } from './helpers/team-foundation-goal.mjs';
import { inspectTeamMaterialGoal } from './helpers/team-material-goal.mjs';
import { inspectTeamRoamerGoal } from './helpers/team-roamer-goal.mjs';

test('twelve Team missions bind unique verified originals without changing historical gameplay', async () => {
  const source = createTeamJourneyCandidates({ artwork: true });
  const grey = createTeamJourneyCandidates();
  const pictured = compileContentProject(source);
  const original = compileContentProject(grey);
  assert.equal(TEAM_ART_CANDIDATES.length, 11);
  assert.equal(source.assets.length, 12);
  assert.equal(grey.assets.length, 0);
  assert.equal(new Set(source.assets.map((a) => a.sha256)).size, 12);
  assert.equal(
    new Set(JOURNEY_ART_CANDIDATES.map((a) => a.sha256)).size,
    JOURNEY_ART_CANDIDATES.length,
  );
  for (const asset of source.assets) {
    assert(
      JOURNEY_ART_CANDIDATES.some((row) => row.id === asset.id && row.sha256 === asset.sha256),
    );
    const bytes = await readFile(new URL('../' + asset.path, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), asset.width);
    assert.equal(bytes.readUInt32BE(20), asset.height);
    assert.equal(asset.width, asset.height * 2);
    const verified = await loadPreviewArtwork(asset, {
      fetchAsset: async () => new Response(bytes),
      digest: (value) => webcrypto.subtle.digest('SHA-256', value),
    });
    assert(verified.dataUrl.startsWith('data:image/png;base64,'));
    const consumers = source.missions.filter((m) => m.presentation.backgroundAssetId === asset.id);
    assert.equal(consumers.length, 1);
  }
  assert.equal(
    source.missions.find((m) => m.id === 'shared-detour').presentation.backgroundAssetId,
    SIGNAL_TEAM_ART_CANDIDATES[0].id,
  );
  for (const mission of source.missions) {
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const a = resolveMission(pictured, mission.id, { mode: 'team', difficulty });
      const b = resolveMission(original, mission.id, { mode: 'team', difficulty });
      assert.deepEqual(a.level, b.level);
      assert.equal(a.simulationIdentity, b.simulationIdentity);
      assert.equal(a.presentation.themeId, b.presentation.themeId);
      assert.equal(a.officialProgressEligible, false);
      assert.equal(a.background.id, mission.presentation.backgroundAssetId);
      // Geometry exports must not misrepresent themselves as artwork delivery.
      assert.deepEqual(
        createTeamTestPack(source, mission.id, difficulty),
        createTeamTestPack(grey, mission.id, difficulty),
      );
    }
  }
  source.assets[0].alt = 'Local edit';
  assert.notEqual(createTeamJourneyCandidates({ artwork: true }).assets[0].alt, 'Local edit');
});

test('eleven Team prompt receipts preserve exact pins and unqualified status', async () => {
  const record = JSON.parse(
    await readFile(new URL('../../docs/research/team-original-art-prompts.json', import.meta.url)),
  );
  assert.equal(record.tool, 'built-in-imagegen');
  assert.equal(record.assets.length, 11);
  assert.equal(new Set(record.assets.map((a) => a.missionId)).size, 11);
  for (const row of record.assets) {
    const asset = TEAM_ART_CANDIDATES.find((a) => 'game/' + a.path === row.path);
    assert(asset);
    for (const key of ['sha256', 'bytes', 'width', 'height']) assert.equal(row[key], asset[key]);
    assert(row.prompt.length > 500);
    assert.equal(row.review.kind, 'assistant-image-inspection-not-human-playtest');
    assert(row.review.pending.includes('Human visual and gameplay qualification'));
    assert.equal(asset.review, 'candidate');
  }
});

test('pictured Team missions preserve prepared two-seat route outcomes across all twelve layouts', async () => {
  const pictured = compileContentProject(createTeamJourneyCandidates({ artwork: true }));
  const grey = compileContentProject(createTeamJourneyCandidates());
  const files = [
    [
      'team-opening-routes',
      'routes',
      (run, evidence) => ({
        achieved: run.status === 'won' && evidence.closed.size === 2 && evidence.downs === 0,
      }),
    ],
    ['team-foundation-routes', 'clear', inspectTeamFoundationGoal],
    ['team-material-routes', 'routes', inspectTeamMaterialGoal],
    ['team-roamer-routes', 'routes', inspectTeamRoamerGoal],
  ];
  const ids = new Set();
  let cases = 0;
  for (const [file, key, inspectGoal] of files) {
    const fixture = JSON.parse(
      await readFile(new URL('./fixtures/' + file + '.json', import.meta.url)),
    );
    for (const row of fixture[key]) {
      ids.add(row.missionId);
      const options = { mode: 'team', difficulty: row.difficulty };
      const a = resolveMission(pictured, row.missionId, options);
      const b = resolveMission(grey, row.missionId, options);
      if (row.simulationIdentity) assert.equal(a.simulationIdentity, row.simulationIdentity);
      for (const jointCuts of [true, false]) {
        const played = playTeamFoundationRoute(a.level, row.log, { jointCuts, inspectGoal });
        const previous = playTeamFoundationRoute(b.level, row.log, { jointCuts, inspectGoal });
        assert.equal(played.checkpoint, previous.checkpoint);
        const expected = row.results?.find((result) => result.jointCuts === jointCuts);
        if (expected) assert.equal(played.checkpoint, expected.checkpoint);
        assert.equal(played.run.status, 'won');
        assert.deepEqual(played.mastery, previous.mastery);
        assert.equal(played.evidence.downs, 0);
        assert.deepEqual([...played.evidence.closed].sort(), [0, 1]);
        cases++;
      }
    }
  }
  assert.equal(ids.size, 12);
  assert.equal(cases, 64);
});

test('Studio artwork opt-in still requires Apply and does not silently change Team gameplay delivery', async () => {
  const studio = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const handler = studio.match(
    /\$\('team-journey'\)\.onclick = guarded\(\(\) => \{([\s\S]*?)\n\}\);/,
  )[1];
  assert.match(handler, /createTeamJourneyCandidates\(\{ artwork: true \}\)/);
  assert.match(handler, /inspectSource\(\)/);
  assert.doesNotMatch(handler, /session\.(?:apply|replace|transact)|location\.|publish/i);
  const entry = await readFile(
    new URL('../content-design/team-entry.mjs', import.meta.url),
    'utf8',
  );
  assert.match(entry, /createTeamJourneyCandidates\(\)/);
  assert.doesNotMatch(entry, /artwork: true/);
});
