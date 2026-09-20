import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import {
  SIGNAL_ILLUSTRATED_ART_CANDIDATES,
  SIGNAL_PIXEL_ART_CANDIDATES,
  SIGNAL_TEAM_ART_CANDIDATES,
} from '../content-design/signal-art.mjs';
import { createTeamSignalCandidates } from '../content-design/team-signal-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { validateTheme } from '../content.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

for (const [option, SIGNAL_ART_CANDIDATES, prefix] of [
  ['illustratedArtwork', SIGNAL_ILLUSTRATED_ART_CANDIDATES, 'signal'],
  ['artwork', SIGNAL_PIXEL_ART_CANDIDATES, 'signal-pixel'],
])
  test(`each Signal ${option} original is exact pinned PNG bytes with an explicitly verified preview`, async () => {
    const source = createSignalCandidates({ [option]: true });
    const project = compileContentProject(source);
    const grey = compileContentProject(createSignalCandidates({ campaignTheme: true }));
    const theme = JSON.parse(
      await readFile(new URL('../content-design/themes.json', import.meta.url)),
    ).themes.find((row) => row.id === 'signal-gardens');
    assert.deepEqual(validateTheme(theme).errors, []);
    assert(SIGNAL_ART_CANDIDATES.length > 0 && SIGNAL_ART_CANDIDATES.length <= 7);
    assert.equal(
      new Set(SIGNAL_ART_CANDIDATES.map((row) => row.sha256)).size,
      SIGNAL_ART_CANDIDATES.length,
    );
    for (const asset of SIGNAL_ART_CANDIDATES) {
      const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
      assert.equal(bytes.length, asset.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
      assert.equal(bytes.readUInt32BE(16), asset.width);
      assert.equal(bytes.readUInt32BE(20), asset.height);
      assert.equal(asset.width, asset.height * 2);
      const consumers = source.missions.filter(
        (m) => m.presentation.backgroundAssetId === asset.id,
      );
      assert.equal(consumers.length, 1);
      const id = consumers[0].id;
      const media = await loadPreviewArtwork(asset, {
        fetchAsset: async () => new Response(bytes),
        digest: (value) => webcrypto.subtle.digest('SHA-256', value),
      });
      const preview = prepareContentPreview(source, id, { theme, artwork: media });
      assert.equal(preview.scenario.theme.id, 'signal-gardens');
      assert.equal(preview.scenario.visualOverrides.background.dataUrl, media.dataUrl);
      assert(
        preview.manifest.diagnostics.some(
          (row) => row.code === 'candidate-art-not-visually-qualified',
        ),
      );
      assert.throws(() => prepareContentPreview(source, id, { theme }), /verify/);
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const mode of ['solo', 'versus'])
          assert.equal(
            resolveMission(project, id, { difficulty, mode }).simulationIdentity,
            resolveMission(grey, id, { difficulty, mode }).simulationIdentity,
          );
    }
    for (const mission of createSignalCandidates().missions)
      assert.equal(
        mission.presentation.backgroundAssetId,
        null,
        'Historical default remains greybox',
      );
    for (const mission of source.missions) {
      const present = SIGNAL_ART_CANDIDATES.some((asset) => asset.id === `${prefix}-${mission.id}`);
      assert.equal(
        mission.presentation.backgroundAssetId,
        present ? `${prefix}-${mission.id}` : null,
      );
    }
  });

for (const option of ['artwork', 'illustratedArtwork'])
  test(`all84 Signal clear-route checkpoints remain unchanged with ${option} pictures attached`, async () => {
    const fixture = JSON.parse(
      await readFile(new URL('./fixtures/signal-clear-routes.json', import.meta.url)),
    );
    const projects = new Map(
      [true, false].map((bonuses) => {
        const source = createSignalCandidates({ [option]: true, campaignTheme: false });
        if (!bonuses) for (const mission of source.missions) mission.bonuses = [];
        return [bonuses, compileContentProject(source)];
      }),
    );
    let checked = 0;
    for (const { bonuses, difficulty, turnPolicy, rows } of fixture.sets)
      for (const [id, identity, checkpoint, segments] of rows) {
        const manifest = resolveMission(projects.get(bonuses), id, { difficulty });
        assert.equal(manifest.simulationIdentity, identity, id);
        const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
        for (const [direction, ticks] of segments)
          for (let tick = 0; tick < ticks; tick++) {
            assert.equal(run.status, 'running', id);
            stepRun(run, { direction }, FIXED_DT);
            assert.equal(run.classic.livesLost, 0, id);
          }
        assert.equal(run.status, 'won', id);
        assert.equal(run.lives, manifest.level.rules.lives, id);
        assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
        checked++;
      }
    assert.equal(checked, 84);
  });

test('Signal art variants require an explicit unambiguous choice and never grant qualification', () => {
  assert.equal(SIGNAL_PIXEL_ART_CANDIDATES.length, 7);
  assert.throws(
    () => createSignalCandidates({ artwork: true, illustratedArtwork: true }),
    /not both/,
  );
  for (const source of [
    createSignalCandidates({ artwork: true }),
    createSignalCandidates({ illustratedArtwork: true }),
  ]) {
    const project = compileContentProject(source);
    for (const mission of project.missions)
      assert.equal(resolveMission(project, mission.id).officialProgressEligible, false);
  }
});

test('Shared detour has a separately pinned original without changing Team rules or geometry-only exports', async () => {
  assert.equal(SIGNAL_TEAM_ART_CANDIDATES.length, 1);
  const asset = SIGNAL_TEAM_ART_CANDIDATES[0];
  const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  assert.equal(bytes.readUInt32BE(16), asset.width);
  assert.equal(bytes.readUInt32BE(20), asset.height);
  assert.equal(asset.width, asset.height * 2);
  const media = await loadPreviewArtwork(asset, {
    fetchAsset: async () => new Response(bytes),
    digest: (value) => webcrypto.subtle.digest('SHA-256', value),
  });
  assert(media.dataUrl.startsWith('data:image/png;base64,'));
  const original = createTeamSignalCandidates({ campaignTheme: true });
  const pictured = createTeamSignalCandidates({ artwork: true });
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const before = resolveMission(compileContentProject(original), 'shared-detour', {
      difficulty,
      mode: 'team',
    });
    const after = resolveMission(compileContentProject(pictured), 'shared-detour', {
      difficulty,
      mode: 'team',
    });
    assert.deepEqual(after.level, before.level);
    assert.equal(after.simulationIdentity, before.simulationIdentity);
    assert.deepEqual(after.background, asset);
    assert.equal(after.officialProgressEligible, false);
    assert.deepEqual(
      createTeamTestPack(pictured, 'shared-detour', difficulty),
      createTeamTestPack(original, 'shared-detour', difficulty),
    );
  }
  assert.equal(createTeamSignalCandidates().missions[0].presentation.backgroundAssetId, null);
});
