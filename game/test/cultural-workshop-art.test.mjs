import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createCulturalWorkshopArtCandidates } from '../content-design/cultural-workshop-art-candidates.mjs';
import { CULTURAL_WORKSHOP_ART_CANDIDATES } from '../content-design/cultural-workshop-art.mjs';
import { createCulturalWorkshopCandidates } from '../content-design/cultural-workshop-candidates.mjs';
import { createSpatialBalanceCandidates } from '../content-design/spatial-balance-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { compileAssetRevision, loadPreviewArtwork } from '../content-design/assets.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const originalFactory = (spatial) =>
  spatial ? createSpatialBalanceCandidates() : createCulturalWorkshopCandidates();
const editions = new Map(
  [false, true].map((spatial) => {
    const original = originalFactory(spatial);
    const source = createCulturalWorkshopArtCandidates({ spatial });
    return [
      spatial,
      {
        original,
        source,
        previous: compileContentProject(original),
        project: compileContentProject(source),
      },
    ];
  }),
);
const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/cultural-workshop-clear-routes.json', import.meta.url)),
);
const spatialFixture = JSON.parse(
  await readFile(new URL('./fixtures/spatial-balance-clear-routes.json', import.meta.url)),
);
const expectedIds = [
  'cross-stitch-crossings',
  'rushnyk-bands',
  'pysanka-sections',
  'dnipro-crossings',
  'four-motor-landings',
  'circuit-lanes',
  'twin-lens-chambers',
  'toolbench-weave',
];
const digest = (bytes) => webcrypto.subtle.digest('SHA-256', bytes);

for (const spatial of [false, true])
  test(`art-only successor keeps exact maps and all48 mode/preset simulations: spatial=${spatial}`, () => {
    const { original, source, previous, project } = editions.get(spatial);
    assert.deepEqual(originalFactory(spatial), original, 'Creating art does not alter defaults.');
    assert.deepEqual(source.maps, original.maps);
    assert.equal(source.actorCatalogId, original.actorCatalogId);
    assert.equal(source.difficultyCatalogId, original.difficultyCatalogId);
    assert.notEqual(source.id, original.id);
    assert.notEqual(dataIdentity(source), dataIdentity(original));
    assert.match(source.revision, /art-r1/);
    assert.equal(source.assets.length, 8);
    assert.equal(previous.assets.length, 0);
    assert.deepEqual(
      source.missions.map((m) => m.id),
      expectedIds,
    );
    for (const collection of ['missions', 'campaigns', 'packs']) {
      assert.equal(source[collection].length, original[collection].length);
      for (const row of source[collection]) {
        const old = original[collection].find((candidate) => candidate.id === row.id);
        assert(old);
        assert.notEqual(row.revision, old.revision);
        assert.match(row.revision, /art-r1/);
        const restored = { ...row, revision: old.revision };
        if (collection === 'missions') {
          assert.equal(row.presentation.themeId, old.presentation.themeId);
          assert.equal(row.presentation.backgroundAssetId, `cultural-workshop-${row.id}`);
          assert.equal(old.presentation.backgroundAssetId, null);
          assert.notEqual(dataIdentity(row.presentation), dataIdentity(old.presentation));
          restored.presentation = old.presentation;
        }
        assert.deepEqual(restored, old, `${collection}/${row.id}: only art edition fields change.`);
      }
    }
    let checked = 0;
    for (const id of expectedIds)
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const mode of ['solo', 'versus']) {
          const before = resolveMission(previous, id, { difficulty, mode });
          const after = resolveMission(project, id, { difficulty, mode });
          assert.equal(after.simulationIdentity, before.simulationIdentity);
          assert.deepEqual({ ...after.level, revision: before.level.revision }, before.level);
          assert.notEqual(dataIdentity(after.presentation), dataIdentity(before.presentation));
          assert(!Object.hasOwn(after, 'presentationIdentity'), 'No new shared manifest field.');
          assert.equal(after.background.id, `cultural-workshop-${id}`);
          assert.equal(after.background.review, 'candidate');
          assert.equal(after.officialProgressEligible, false);
          assert.equal(after.validation, 'compiled-candidate-not-playtested');
          assert(after.diagnostics.some((d) => d.code === 'candidate-art-not-visually-qualified'));
          assert(!after.diagnostics.some((d) => d.code === 'greybox-background'));
          checked++;
        }
    assert.equal(checked, 48);
  });

test('eight immutable pins have exactly one recognized mission binding and owned factory copies', () => {
  assert.equal(CULTURAL_WORKSHOP_ART_CANDIDATES.length, 8);
  assert(Object.isFrozen(CULTURAL_WORKSHOP_ART_CANDIDATES));
  for (const field of ['id', 'path', 'sha256'])
    assert.equal(new Set(CULTURAL_WORKSHOP_ART_CANDIDATES.map((asset) => asset[field])).size, 8);
  for (const asset of CULTURAL_WORKSHOP_ART_CANDIDATES) {
    assert(Object.isFrozen(asset));
    assert.deepEqual(compileAssetRevision(asset), asset);
    const id = asset.id.slice('cultural-workshop-'.length);
    assert(expectedIds.includes(id));
    const folder = expectedIds.indexOf(id) < 4 ? 'ornament-study-r1' : 'workshop-study-r1';
    assert.equal(asset.path, `content-design/assets/${folder}/${id}.png`);
    for (const { source } of editions.values()) {
      assert.equal(
        source.missions.filter((m) => m.presentation.backgroundAssetId === asset.id).length,
        1,
      );
      assert.deepEqual(
        source.assets.find((a) => a.id === asset.id),
        asset,
      );
    }
  }
  for (const spatial of [false, true]) {
    const untouched = structuredClone(editions.get(spatial).source);
    const local = createCulturalWorkshopArtCandidates({ spatial });
    local.assets[0].alt = 'Local draft changes';
    local.missions[0].presentation.backgroundAssetId = null;
    local.maps[0].walls.length = 0;
    assert.deepEqual(createCulturalWorkshopArtCandidates({ spatial }), untouched);
    assert.deepEqual(editions.get(spatial).source, untouched);
    assert.notEqual(CULTURAL_WORKSHOP_ART_CANDIDATES[0].alt, 'Local draft changes');
  }
});

test('missing pins, duplicate asset IDs and unrecognized bindings fail strict compilation', () => {
  for (const mutate of [
    (source) => source.assets.shift(),
    (source) => source.assets.push(structuredClone(source.assets[0])),
    (source) => {
      source.missions[0].presentation.backgroundAssetId = 'unrecognized-art';
    },
  ]) {
    const source = createCulturalWorkshopArtCandidates();
    mutate(source);
    assert.throws(() => compileContentProject(source));
  }
});

for (const id of expectedIds)
  test(`${id}: actual unique PNG bytes verify, preview both editions, and reject unverified media`, async () => {
    const asset = CULTURAL_WORKSHOP_ART_CANDIDATES.find((a) => a.id === `cultural-workshop-${id}`);
    assert(asset);
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert(bytes.length > 0 && bytes.length <= 4 * 1024 * 1024);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), asset.width);
    assert.equal(bytes.readUInt32BE(20), asset.height);
    assert.equal(asset.width, asset.height * 2);
    assert.equal(asset.review, 'candidate');
    let fetched = 0;
    const media = await loadPreviewArtwork(asset, {
      fetchAsset: async (path, options) => {
        fetched++;
        assert.equal(path, asset.path);
        assert.equal(options.redirect, 'error');
        return new Response(bytes);
      },
      digest,
    });
    assert.equal(fetched, 1);
    assert(Object.isFrozen(media));
    assert.equal(media.dataUrl, `data:image/png;base64,${bytes.toString('base64')}`);
    for (const { source, project } of editions.values()) {
      const mission = source.missions.find((m) => m.id === id);
      const theme = themes.find((t) => t.id === mission.presentation.themeId);
      assert(theme);
      const preview = prepareContentPreview(source, id, { theme, artwork: media });
      assert.equal(preview.scenario.visualOverrides.background.dataUrl, media.dataUrl);
      assert.equal(preview.scenario.visualOverrides.background.name, asset.alt);
      assert.equal(
        preview.manifest.simulationIdentity,
        resolveMission(project, id).simulationIdentity,
      );
      assert.equal(preview.manifest.officialProgressEligible, false);
      assert.equal(preview.capture.filledCells.length, 0);
      assert.throws(() => prepareContentPreview(source, id, { theme }), /verify/);
      assert.throws(
        () => prepareContentPreview(source, id, { theme, artwork: { ...media } }),
        /verify/,
      );
      const other = source.missions.find((candidate) => candidate.id !== id);
      assert.throws(
        () =>
          prepareContentPreview(source, other.id, {
            theme: themes.find((candidate) => candidate.id === other.presentation.themeId),
            artwork: media,
          }),
        /verify/,
        'Verified bytes for a different picture cannot satisfy this exact pin.',
      );
    }
    const corrupted = Buffer.from(bytes);
    corrupted[corrupted.length - 1] ^= 1;
    await assert.rejects(
      loadPreviewArtwork(asset, {
        fetchAsset: async () => new Response(corrupted),
        digest,
      }),
      /digest/,
    );
  });

test('original-art provenance matches all eight pins and retains pending human qualification', async () => {
  const record = JSON.parse(
    await readFile(
      new URL('../../docs/research/cultural-workshop-original-art-prompts.json', import.meta.url),
    ),
  );
  assert.equal(record.tool, 'built-in-imagegen');
  assert.equal(record.assets.length, 8);
  assert.equal(new Set(record.assets.map((entry) => entry.generationFile)).size, 8);
  assert.deepEqual(
    [...record.assets.map((entry) => entry.missionId)].sort(),
    [...expectedIds].sort(),
  );
  for (const entry of record.assets) {
    const asset = CULTURAL_WORKSHOP_ART_CANDIDATES.find(
      (a) => a.id === `cultural-workshop-${entry.missionId}`,
    );
    assert.equal(entry.path, `game/${asset.path}`);
    assert.match(entry.generationFile, /^exec-[0-9a-f-]+\.png$/i);
    for (const key of ['sha256', 'bytes', 'width', 'height']) assert.equal(entry[key], asset[key]);
    assert(entry.prompt.length > 500);
    assert.equal(entry.review.kind, 'assistant-image-inspection-not-human-playtest');
    assert(Array.isArray(entry.review.observations) && entry.review.observations.length > 0);
    assert(entry.review.pending.includes('Human visual and gameplay qualification'));
  }
});

function play(spatial, { id, difficulty, turnPolicy, seed, identity, checkpoint, segments }) {
  const { project, previous } = editions.get(spatial);
  const manifest = resolveMission(project, id, { difficulty });
  const original = resolveMission(previous, id, { difficulty });
  assert.equal(manifest.simulationIdentity, identity, id);
  assert.equal(manifest.background.id, `cultural-workshop-${id}`);
  const options = { seed, classId: 'scout', turnPolicy };
  const run = createRun(manifest.level, options),
    baseline = createRun(original.level, options),
    recorder = createRecorder(manifest.level, options);
  for (const [direction, ticks] of segments)
    for (let n = 0; n < ticks; n++) {
      assert.equal(run.status, 'running', id);
      assert.equal(baseline.status, 'running', id);
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      stepRun(baseline, { direction }, FIXED_DT);
      assert.equal(run.classic.livesLost, 0, id);
      assert.equal(baseline.classic.livesLost, 0, id);
      assert.equal(run.lives, manifest.level.rules.lives, id);
    }
  assert.equal(run.status, 'won', id);
  assert.equal(baseline.status, 'won', id);
  const oldCheckpoint = authoritativeCheckpoint(baseline);
  const picturedCheckpoint = authoritativeCheckpoint(run);
  assert.equal(oldCheckpoint.hash, checkpoint, 'The original exact pinned fixture remains valid.');
  assert.notEqual(
    picturedCheckpoint.hash,
    checkpoint,
    'The new edition has a new revision checksum.',
  );
  assert.equal(picturedCheckpoint.algorithm, oldCheckpoint.algorithm);
  assert.deepEqual(Object.keys(picturedCheckpoint.sections), Object.keys(oldCheckpoint.sections));
  for (const key of Object.keys(oldCheckpoint.sections)) {
    if (key === 'identity' || key === 'result')
      assert.notEqual(picturedCheckpoint.sections[key], oldCheckpoint.sections[key], key);
    else assert.equal(picturedCheckpoint.sections[key], oldCheckpoint.sections[key], key);
  }
  // Compare completed fresh-input states, never an injected/stepped replacement.
  // The only four metadata occurrences allowed to differ are the edition revision.
  assert.equal(run.revision, `${baseline.revision}-art-r1`);
  assert.equal(run.level.revision, run.revision);
  assert.equal(run.result.revision, run.revision);
  const metadataNormalized = {
    ...run,
    revision: baseline.revision,
    level: { ...run.level, revision: baseline.level.revision },
    result: { ...run.result, revision: baseline.result.revision },
  };
  metadataNormalized.events = metadataNormalized.events.map((event) => {
    if (event.type !== 'run.completed') return event;
    assert.equal(event.revision, run.revision);
    return { ...event, revision: baseline.revision };
  });
  assert.deepEqual(metadataNormalized, baseline, 'Every non-revision state field stays exact.');
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, id);
}

test('played evidence covers48 original and12 pictured spatial routes without counting motor-feint controls', () => {
  assert.equal(fixture.sets.length, 6);
  const originalKeys = fixture.sets.flatMap(({ difficulty, turnPolicy, rows }) => {
    assert.deepEqual(
      rows.map((row) => row[0]),
      expectedIds,
    );
    return rows.map((row) => `${row[0]}/${difficulty}/${turnPolicy}`);
  });
  assert.equal(new Set(originalKeys).size, 48);
  const pictured = spatialFixture.rows.filter((row) => row.mission !== 'motor-feint');
  assert.equal(pictured.length, 12);
  assert.equal(spatialFixture.rows.filter((row) => row.mission === 'motor-feint').length, 6);
  assert.equal(
    new Set(pictured.map((r) => `${r.mission}/${r.difficulty}/${r.turnPolicy}`)).size,
    12,
  );
  assert.deepEqual([...new Set(pictured.map((r) => r.mission))].sort(), [
    'dnipro-crossings',
    'four-motor-landings',
  ]);
});

for (const { difficulty, turnPolicy, rows } of fixture.sets)
  test(`eight original routes retain exact simulation with new edition replay checksums: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, identity, checkpoint, segments] of rows)
      play(false, {
        id,
        difficulty,
        turnPolicy,
        seed: fixture.seed,
        identity,
        checkpoint,
        segments,
      });
  });

for (const row of spatialFixture.rows.filter((r) => r.mission !== 'motor-feint'))
  test(`pictured spatial route has exact simulation and new edition replay checksum: ${row.mission}/${row.difficulty}/${row.turnPolicy}`, () => {
    play(true, {
      id: row.mission,
      difficulty: row.difficulty,
      turnPolicy: row.turnPolicy,
      seed: row.seed,
      identity: row.simulationIdentity,
      checkpoint: row.checkpoint,
      segments: row.segments,
    });
  });
