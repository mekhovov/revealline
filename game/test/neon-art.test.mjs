import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createNeonCandidates } from '../content-design/neon-candidates.mjs';
import { NEON_ART_CANDIDATES } from '../content-design/neon-art.mjs';
import { JOURNEY_ART_CANDIDATES } from '../content-design/journey-art.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('seven unique Neon originals have exact pins, one consumer each and verified candidate previews', async () => {
  const source = createNeonCandidates({ artwork: true });
  const project = compileContentProject(source);
  const grey = compileContentProject(createNeonCandidates());
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((row) => row.id === 'horizon');
  assert.equal(NEON_ART_CANDIDATES.length, 7);
  assert.equal(
    new Set(JOURNEY_ART_CANDIDATES.map((row) => row.sha256)).size,
    JOURNEY_ART_CANDIDATES.length,
  );
  for (const asset of NEON_ART_CANDIDATES) {
    assert(JOURNEY_ART_CANDIDATES.includes(asset));
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.readUInt32BE(16), asset.width);
    assert.equal(bytes.readUInt32BE(20), asset.height);
    assert.equal(asset.width, asset.height * 2);
    const consumers = source.missions.filter(
      (mission) => mission.presentation.backgroundAssetId === asset.id,
    );
    assert.equal(consumers.length, 1);
    const id = consumers[0].id;
    const media = await loadPreviewArtwork(asset, {
      fetchAsset: async () => new Response(bytes),
      digest: (value) => webcrypto.subtle.digest('SHA-256', value),
    });
    const preview = prepareContentPreview(source, id, { theme, artwork: media });
    assert.equal(preview.scenario.visualOverrides.background.dataUrl, media.dataUrl);
    assert(
      preview.manifest.diagnostics.some(
        (row) => row.code === 'candidate-art-not-visually-qualified',
      ),
    );
    assert.throws(() => prepareContentPreview(source, id, { theme }), /verify/);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        const manifest = resolveMission(project, id, { difficulty, mode });
        assert.equal(
          manifest.simulationIdentity,
          resolveMission(grey, id, { difficulty, mode }).simulationIdentity,
        );
        assert.equal(manifest.officialProgressEligible, false);
      }
  }
  assert.equal(grey.assets.length, 0);
  for (const mission of grey.missions) assert.equal(mission.presentation.backgroundAssetId, null);
});

test('all42 Neon clear-route checkpoints remain unchanged with original pictures attached', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/neon-clear-routes.json', import.meta.url)),
  );
  const project = compileContentProject(createNeonCandidates({ artwork: true }));
  let checked = 0;
  for (const { difficulty, turnPolicy, rows } of fixture.sets)
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
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
  assert.equal(checked, 42);
});
