import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { LIVEWIRE_ART_CANDIDATES } from '../content-design/livewire-art.mjs';
import { JOURNEY_ART_CANDIDATES } from '../content-design/journey-art.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('all seven Livewire originals have exact unique pins and verified opt-in previews', async () => {
  const source = createLivewireCandidates({ artwork: true });
  const project = compileContentProject(source);
  const grey = compileContentProject(createLivewireCandidates());
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((row) => row.id === 'horizon');
  assert.equal(LIVEWIRE_ART_CANDIDATES.length, 7);
  assert.equal(
    new Set(JOURNEY_ART_CANDIDATES.map((asset) => asset.sha256)).size,
    JOURNEY_ART_CANDIDATES.length,
  );
  for (const asset of LIVEWIRE_ART_CANDIDATES) {
    assert(JOURNEY_ART_CANDIDATES.includes(asset));
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), asset.width);
    assert.equal(bytes.readUInt32BE(20), asset.height);
    assert.equal(asset.width, asset.height * 2);
    const consumers = source.missions.filter((m) => m.presentation.backgroundAssetId === asset.id);
    assert.equal(consumers.length, 1);
    assert.equal(asset.id, `livewire-foundry-${consumers[0].id}`);
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
  assert.equal(source.missions.filter((m) => m.presentation.backgroundAssetId === null).length, 0);
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
  const second = createLivewireCandidates({ artwork: true });
  second.assets[0].alt = 'Local edit';
  assert.notEqual(second.assets[0].alt, LIVEWIRE_ART_CANDIDATES[0].alt);
});

test('Livewire prompts and pending reviews correspond to the original pins', async () => {
  const record = JSON.parse(
    await readFile(
      new URL('../../docs/research/livewire-original-art-prompts.json', import.meta.url),
    ),
  );
  assert.equal(record.tool, 'built-in-imagegen');
  assert.equal(record.assets.length, LIVEWIRE_ART_CANDIDATES.length);
  assert.equal(new Set(record.assets.map((entry) => entry.missionId)).size, 7);
  for (const entry of record.assets) {
    const asset = LIVEWIRE_ART_CANDIDATES.find((row) => `game/${row.path}` === entry.path);
    assert(asset);
    for (const key of ['sha256', 'bytes', 'width', 'height']) assert.equal(entry[key], asset[key]);
    assert(entry.prompt.length > 500);
    assert.equal(entry.review.kind, 'assistant-image-inspection-not-human-playtest');
    assert(entry.review.pending.includes('Human visual and gameplay qualification'));
    assert.equal(asset.review, 'candidate');
  }
});

test('Livewire pictured edition preserves all42 historical clear checkpoints', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/livewire-clear-routes.json', import.meta.url)),
  );
  const project = compileContentProject(createLivewireCandidates({ artwork: true }));
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

test('Studio inspects pictured Livewire candidates without bypassing explicit Apply', async () => {
  const studio = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const handler = studio.match(
    /\$\('livewire'\)\.onclick = guarded\(\(\) => \{([\s\S]*?)\n\}\);/,
  )[1];
  assert.match(handler, /discardSource\(\)/);
  assert.match(handler, /createLivewireCandidates\(\{ artwork: true \}\)/);
  assert.match(handler, /inspectSource\(\)/);
  assert.doesNotMatch(handler, /session\.(?:apply|replace|transact)|location\.|publish/i);
});
