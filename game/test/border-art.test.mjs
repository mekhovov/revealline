import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { BORDER_ART_CANDIDATES } from '../content-design/border-art.mjs';
import { NEON_ART_CANDIDATES } from '../content-design/neon-art.mjs';
import { ROVER_ART_CANDIDATES } from '../content-design/rover-art.mjs';
import { FRACTURE_ART_CANDIDATES } from '../content-design/fracture-art.mjs';
import { PHASE_ART_CANDIDATES } from '../content-design/phase-art.mjs';
import { LIVEWIRE_ART_CANDIDATES } from '../content-design/livewire-art.mjs';
import { RELAY_ART_CANDIDATES } from '../content-design/relay-art.mjs';
import { JOURNEY_ART_CANDIDATES } from '../content-design/journey-art.mjs';
import {
  SIGNAL_ILLUSTRATED_ART_CANDIDATES,
  SIGNAL_PIXEL_ART_CANDIDATES,
  SIGNAL_TEAM_ART_CANDIDATES,
} from '../content-design/signal-art.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { validateTheme } from '../content.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('all seven Border compositions are unique original pinned bytes, paired with exact candidate previews', async () => {
  const source = createBorderCandidates({ artwork: true });
  const project = compileContentProject(source),
    grey = compileContentProject(createBorderCandidates());
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((row) => row.id === 'border-bloom');
  assert.deepEqual(validateTheme(theme).errors, []);
  assert.equal(BORDER_ART_CANDIDATES.length, 7);
  const expectedCount =
    17 +
    SIGNAL_ILLUSTRATED_ART_CANDIDATES.length +
    SIGNAL_PIXEL_ART_CANDIDATES.length +
    SIGNAL_TEAM_ART_CANDIDATES.length +
    NEON_ART_CANDIDATES.length +
    ROVER_ART_CANDIDATES.length +
    FRACTURE_ART_CANDIDATES.length +
    PHASE_ART_CANDIDATES.length +
    LIVEWIRE_ART_CANDIDATES.length +
    RELAY_ART_CANDIDATES.length;
  assert.equal(JOURNEY_ART_CANDIDATES.length, expectedCount);
  assert.equal(new Set(JOURNEY_ART_CANDIDATES.map((row) => row.sha256)).size, expectedCount);
  for (const asset of BORDER_ART_CANDIDATES) {
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
    assert.equal(preview.scenario.theme.id, 'border-bloom');
    assert.equal(preview.scenario.visualOverrides.background.dataUrl, media.dataUrl);
    assert(
      preview.manifest.diagnostics.some(
        (row) => row.code === 'candidate-art-not-visually-qualified',
      ),
    );
    assert.throws(() => prepareContentPreview(source, id, { theme }), /verify/);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        assert.equal(
          resolveMission(project, id, { difficulty, mode }).simulationIdentity,
          resolveMission(grey, id, { difficulty, mode }).simulationIdentity,
        );
      }
  }
});

test('all84 complete Border routes retain exact physics checkpoints with their original artwork attached', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/border-clear-routes.json', import.meta.url)),
  );
  const projects = new Map(
    [true, false].map((bonuses) => {
      const source = createBorderCandidates({ artwork: true });
      if (!bonuses) for (const mission of source.missions) mission.bonuses = [];
      return [bonuses, compileContentProject(source)];
    }),
  );
  for (const { bonuses, difficulty, turnPolicy, rows } of fixture.sets)
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(projects.get(bonuses), id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
      for (const [direction, ticks] of segments)
        for (let n = 0; n < ticks; n++) stepRun(run, { direction }, FIXED_DT);
      assert.equal(run.status, 'won', id);
      assert.equal(run.lives, manifest.level.rules.lives, id);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
    }
});
