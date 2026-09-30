import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { loadBenchmarkCatalog } from '../../authoring/playable-benchmark/catalog.mjs';
import { createBenchmarkSession } from '../../authoring/playable-benchmark/session.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';

// Bounded source-runtime evidence. Original PNG bytes are read and verified by
// the ordinary loader; only browser image decoding is stubbed. This does not
// qualify artwork, a built distribution, input UI, or a user's saved settings.
test('benchmark matches ordinary fresh Standard source preparation and Retry', async (t) => {
  const catalog = await loadBenchmarkCatalog();
  assert.deepEqual(
    catalog.entries.map((entry) => entry.id),
    ['first-return', 'return-in-reserve', 'crossed-bands'],
  );
  const route = await loadAuthoredJourneyRoute(catalog.routeId);
  const themeSource = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const allowedPaths = new Set(catalog.entries.map((entry) => entry.manifest.background.path));
  let reads = 0;
  const host = createContentAttemptPreparer(route.source, {
    themes: journeyActorThemeCandidates(themeSource.themes, {
      includeOriginals: route.preserveOriginalThemes === true,
    }),
    buildVersion: 'source-parity-test',
    loadArtwork: (asset, { signal }) =>
      loadPreviewArtwork(asset, {
        signal,
        digest: (bytes) => webcrypto.subtle.digest('SHA-256', bytes),
        fetchAsset: async (path, { signal: requestSignal }) => {
          assert(allowedPaths.has(path), 'Only the three selected originals may be read.');
          reads++;
          return new Response(
            await readFile(new URL(`../${path}`, import.meta.url), { signal: requestSignal }),
          );
        },
      }),
    decodeImage: async (dataUrl) => {
      const header = inspectImageDataUrl(dataUrl);
      assert(header.valid);
      return { width: header.width, height: header.height };
    },
  });
  t.after(() => host.dispose());
  const tuning = resolveGameplayTuning('standard');
  for (const entry of catalog.entries)
    await t.test(`${entry.id}: initial state, 240 fixed ticks and owned Retry`, async (t) => {
      const mission = host.catalog
        .journey()
        .missions.find(
          (mission) =>
            mission.levelId === entry.id &&
            mission.packId === entry.packId &&
            mission.campaignId === entry.campaignId,
        );
      assert(mission, 'The ordinary source host must own the selected exact mission.');
      // These are the normal source-host preparation options, with a deliberately
      // fixed Standard snapshot instead of ambient user preferences.
      const prepared = await host.prepare(
        { missionId: mission.id, difficulty: 'standard', seed: 1, turnPolicy: 'immediate' },
        { gameplayTuning: tuning },
      );
      assert.deepEqual(prepared.manifest, entry.manifest);
      assert.deepEqual(prepared.run.classRecipes, CLASSES);
      assert.equal(prepared.run.classId, 'scout');
      assert.equal(prepared.run.player.graceUntil, 0);
      const initial = createRun(prepared.run.level, {
        seed: prepared.run.seed,
        turnPolicy: prepared.run.turnPolicy,
        classId: prepared.run.classId,
        classRecipes: prepared.run.classRecipes,
      });
      const sourceBefore = canonicalJSON(entry.manifest);
      const callerManifest = structuredClone(entry.manifest);
      const benchmark = createBenchmarkSession(callerManifest);
      t.after(() => benchmark.dispose());
      assert.deepEqual(benchmark.run, prepared.run);
      assert.equal(benchmark.setup.sourceSimulationIdentity, prepared.manifest.simulationIdentity);
      assert.equal(benchmark.setup.sourceRevision, prepared.manifest.level.revision);
      assert.equal(benchmark.setup.runtimeLevelIdentity, dataIdentity(prepared.run.level));
      assert.equal(benchmark.setup.runtimeRevision, prepared.run.revision);
      assert.equal(benchmark.setup.gameplayTuning, tuning.version);
      assert.equal(benchmark.setup.difficulty, 'standard');
      assert.equal(benchmark.setup.adminOverride, false);
      assert(Object.isFrozen(benchmark.setup));

      assert(benchmark.start());
      const command = { direction: 'down', boost: false, action: false, pickup: false };
      for (let tick = 1; tick <= 240; tick++) {
        assert.equal(benchmark.advance(command, FIXED_DT), 1);
        stepRun(prepared.run, command, FIXED_DT);
        assert.deepEqual(benchmark.run, prepared.run, `Full runtime state at tick ${tick}`);
      }

      // Neither later caller edits nor mutable gameplay state own the next Retry.
      callerManifest.level.rules.moveSpeed = 1;
      callerManifest.level.goal.coverage = 0.99;
      assert(benchmark.retry());
      assert.equal(benchmark.playing, false);
      assert.deepEqual(benchmark.events, []);
      assert.deepEqual(benchmark.run, initial);
      assert.equal(canonicalJSON(entry.manifest), sourceBefore);
      t.diagnostic(
        JSON.stringify({
          sourceSimulationIdentity: benchmark.setup.sourceSimulationIdentity,
          runtimeLevelIdentity: benchmark.setup.runtimeLevelIdentity,
          gameplayTuning: tuning.version,
          ruleset: initial.ruleset,
          rosterHash: initial.rosterHash,
          classRevision: initial.classRevision,
          loadoutHash: initial.loadoutHash,
          seed: initial.seed,
          turnPolicy: initial.turnPolicy,
          initialGrace: initial.player.graceUntil,
          respawnSeconds: initial.rules.respawnSeconds,
          graceSeconds: initial.rules.graceSeconds,
          matchedTicks: 240,
          retryMatched: true,
        }),
      );
    });
  assert.equal(
    reads,
    3,
    'One bounded original-art read per mission, no network or preference access.',
  );
});
