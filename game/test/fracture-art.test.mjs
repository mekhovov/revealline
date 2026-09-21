import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createFractureCandidates } from '../content-design/fracture-candidates.mjs';
import { FRACTURE_ART_CANDIDATES } from '../content-design/fracture-art.mjs';
import { JOURNEY_ART_CANDIDATES } from '../content-design/journey-art.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('Fracture originals have exact pins and verified opt-in previews without substituting missing artwork', async () => {
  const source = createFractureCandidates({ artwork: true });
  const project = compileContentProject(source);
  const grey = compileContentProject(createFractureCandidates());
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((row) => row.id === 'horizon');
  assert.equal(FRACTURE_ART_CANDIDATES.length, 1, 'only First fracture has original artwork yet');
  assert.equal(
    new Set(JOURNEY_ART_CANDIDATES.map((asset) => asset.sha256)).size,
    JOURNEY_ART_CANDIDATES.length,
  );
  for (const asset of FRACTURE_ART_CANDIDATES) {
    assert(JOURNEY_ART_CANDIDATES.includes(asset));
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), asset.width);
    assert.equal(bytes.readUInt32BE(20), asset.height);
    assert.equal(asset.width, asset.height * 2);
    const consumers = source.missions.filter(
      (mission) => mission.presentation.backgroundAssetId === asset.id,
    );
    assert.equal(consumers.length, 1);
    const media = await loadPreviewArtwork(asset, {
      fetchAsset: async () => new Response(bytes),
      digest: (value) => webcrypto.subtle.digest('SHA-256', value),
    });
    const preview = prepareContentPreview(source, consumers[0].id, { theme, artwork: media });
    assert.equal(preview.scenario.visualOverrides.background.dataUrl, media.dataUrl);
    assert(
      preview.manifest.diagnostics.some((d) => d.code === 'candidate-art-not-visually-qualified'),
    );
    assert.throws(() => prepareContentPreview(source, consumers[0].id, { theme }), /verify/);
  }
  assert.equal(source.missions.filter((m) => m.presentation.backgroundAssetId === null).length, 6);
  assert.equal(grey.assets.length, 0);
  for (const mission of grey.missions) {
    assert.equal(mission.presentation.backgroundAssetId, null);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        const manifest = resolveMission(project, mission.id, { difficulty, mode });
        assert.equal(
          manifest.simulationIdentity,
          resolveMission(grey, mission.id, { difficulty, mode }).simulationIdentity,
        );
        assert.equal(manifest.officialProgressEligible, false);
      }
  }
  const second = createFractureCandidates({ artwork: true });
  second.assets[0].alt = 'Edited local draft';
  assert.notEqual(second.assets[0].alt, FRACTURE_ART_CANDIDATES[0].alt);
});

test('Fracture pictured routes preserve all42 exact historical clear checkpoints', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/fracture-clear-routes.json', import.meta.url)),
  );
  const project = compileContentProject(createFractureCandidates({ artwork: true }));
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

test('Studio inspects pictured Fracture candidates without bypassing explicit Apply', async () => {
  const studio = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const handler = studio.match(
    /\$\('fracture'\)\.onclick = guarded\(\(\) => \{([\s\S]*?)\n\}\);/,
  )[1];
  assert.match(handler, /discardSource\(\)/);
  assert.match(handler, /createFractureCandidates\(\{ artwork: true \}\)/);
  assert.match(handler, /inspectSource\(\)/);
  assert.doesNotMatch(handler, /session\.(?:apply|replace|transact)|location\.|publish/i);
});
