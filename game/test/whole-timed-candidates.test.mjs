import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createWholeFieldCandidates,
  createWholeTimedCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { createTimedBorderCandidates } from '../content-design/timed-border-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../core/timed-bonuses.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
} from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { playTimedTakingRoute } from './helpers/timed-taking-evidence.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { classicEffectActive } from '../core/classic-state.mjs';

const ids = ['behind-the-patrol', 'second-landing', 'long-rail'];
const isolated = compileContentProject(
  withPressureDifficulty(createTimedBorderCandidates({ version: TIMED_BONUS_TRAIL_VERSION })),
);

for (const artwork of [false, true])
  test(`timed successor changes only three reviewed mission revisions: artwork=${artwork}`, () => {
    const before = createWholeFieldCandidates({ artwork });
    const baseline = compileContentProject(before);
    const source = createWholeTimedCandidates({ artwork });
    const project = compileContentProject(source);
    assert.equal(source.revision, 'timed-border-review-1');
    assert.equal(source.missions.length, 83);
    assert.deepEqual(
      source.missions.filter((m) => m.timedBonuses).map((m) => m.id),
      ids,
    );
    assert(
      source.missions
        .filter((m) => m.timedBonuses)
        .every((m) => m.timedBonuses.schedules.length === 1),
    );
    assert.deepEqual(source.maps, before.maps);
    assert.deepEqual(source.assets, before.assets);
    assert.equal(source.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(
      source.missions.map((m) => m.id),
      before.missions.map((m) => m.id),
    );
    for (const mission of source.missions) {
      const prior = before.missions.find((m) => m.id === mission.id);
      assert.deepEqual(mission.presentation, prior.presentation);
      if (ids.includes(mission.id)) {
        assert.equal(mission.timedBonuses.version, TIMED_BONUS_TRAIL_VERSION);
        assert.deepEqual(
          mission.bonuses,
          prior.bonuses,
          'Optional timed items do not remove fixed bonuses',
        );
        assert.notEqual(mission.revision, prior.revision);
        assert.deepEqual(
          { ...mission, revision: prior.revision, timedBonuses: undefined },
          { ...prior, timedBonuses: undefined },
        );
      } else assert.deepEqual(mission, prior);
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const mode of ['solo', 'versus']) {
          const actual = resolveMission(project, mission.id, { difficulty, mode });
          const expected = resolveMission(
            ids.includes(mission.id) ? isolated : baseline,
            mission.id,
            { difficulty, mode },
          );
          assert.deepEqual(actual.level, expected.level);
          assert.equal(actual.simulationIdentity, expected.simulationIdentity);
          assert.equal(actual.officialProgressEligible, false);
        }
    }
    source.missions.find((m) => m.id === ids[0]).timedBonuses.schedules[0].anchors[0].x++;
    assert.notDeepEqual(createWholeTimedCandidates({ artwork }), source);
    assert.deepEqual(createWholeFieldCandidates({ artwork }), before);
  });

test('timed review preserves the entire core sequence and separate optional Remixes in both hosts', async () => {
  const route = createAuthoredJourneyRoute('whole-spatial-v3');
  const previous = createAuthoredJourneyRoute('whole-spatial-v2');
  assert.equal(route.sessionKey, 'revealline.suspended.journey-whole-spatial.v3');
  assert.equal(route.profileKey, 'journey-whole-spatial-v3');
  assert.notEqual(route.sessionKey, previous.sessionKey);
  assert.notEqual(route.profileKey, previous.profileKey);
  assert.match(route.label, /timed-bonus.*balance pending/);
  assert(authoredJourneyUsesActorMaterials(route.id));
  assert.equal(authoredJourneyModeHref(route.id, 'solo'), '../?journey=whole-spatial-v3');
  assert.equal(
    authoredJourneyModeHref(route.id, 'versus'),
    'couch/?return=solo&journey=whole-spatial-v3',
  );
  assert(
    Object.isFrozen(route.source.missions.find((m) => m.id === ids[0]).timedBonuses.schedules),
  );
  const themes = journeyActorThemeCandidates(
    JSON.parse(await readFile(new URL('../content-design/themes.json', import.meta.url))).themes,
  );
  for (const create of [createCandidateSoloHost, createCandidateVersusHost]) {
    const host = create(route.source, { themes, corePackIds: route.corePackIds });
    const old = create(previous.source, { themes, corePackIds: previous.corePackIds });
    const sequence = (h) => {
      const result = [];
      for (let m = h.catalog.missions[0]; m; m = h.next(m.id)) {
        assert(!result.includes(m.id));
        result.push(m.id);
      }
      return result;
    };
    assert.deepEqual(sequence(host), sequence(old));
    assert.equal(sequence(host).length, 71);
    assert.equal(host.catalog.missions.filter((m) => !host.isCore(m.id)).length, 12);
  }
});

test('prior edition completion and backups cannot clear the new timed missions', async () => {
  const disk = managedIndexedDB();
  const stores = ['whole-spatial-v2', 'whole-spatial-v3'].map((id) =>
    createJourneyProfileStore({
      backend: createJourneyBackend({
        ...disk,
        profileKey: createAuthoredJourneyRoute(id).profileKey,
      }),
    }),
  );
  await Promise.all(stores.map((s) => s.load()));
  stores[0].recordMany([
    {
      type: 'complete',
      mode: 'solo',
      missionId: 'candidate/journey-border/border-bloom/behind-the-patrol',
      runId: 'fixed-bonuses-only',
      gameplayId: 'prior',
      difficulty: 'standard',
    },
  ]);
  await stores[0].flush();
  assert.deepEqual(stores[1].snapshot(), emptyJourneyProfile());
  assert.throws(() => stores[1].restore(stores[0].export()), /different Journey edition/);
  assert.deepEqual(stores[1].snapshot(), emptyJourneyProfile());
});

const inputs = JSON.parse(
  await readFile(new URL('./fixtures/timed-taking-routes.json', import.meta.url)),
).rows.filter((r) => r.policy === 'v2');
const pins = JSON.parse(
  await readFile(new URL('./fixtures/trail-aware-taking.json', import.meta.url)),
).rows;
const project = compileContentProject(createWholeTimedCandidates({ artwork: true }));
const key = (r) => [r.policy, r.id, r.difficulty, r.turnPolicy, r.seed, r.purpose].join('/');

test('combined timed evidence includes all54 ordinary cases plus alternate-anchor and relocation probes', () => {
  assert.equal(inputs.length, 56);
  assert.equal(inputs.filter((r) => r.purpose === 'ordinary').length, 54);
  const expected = [];
  for (const id of ids)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center'])
        for (const seed of {
          'behind-the-patrol': [1, 3, 10],
          'second-landing': [1, 2, 6],
          'long-rail': [1, 2, 3],
        }[id])
          expected.push(['v2', id, difficulty, turnPolicy, seed, 'ordinary'].join('/'));
  assert.deepEqual(
    inputs
      .filter((r) => r.purpose === 'ordinary')
      .map(key)
      .sort(),
    expected.sort(),
  );
  assert.equal(new Set(inputs.map(key)).size, 56);
  for (const id of ids) {
    assert.equal(
      new Set(
        inputs
          .filter((r) => r.id === id)
          .map((r) => JSON.stringify(r.observations.collectedAnchor)),
      ).size,
      3,
    );
  }
  assert.equal(inputs.find((r) => r.purpose === 'miss-then-relocate').observations.appearances, 2);
});

for (const row of inputs)
  test(`combined timed collect/clear/replay/equal race: ${key(row)}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    const pinned = pins.find((r) => r.key === key(row));
    assert.equal(manifest.simulationIdentity, pinned.simulationIdentity);
    const { observations } = playTimedTakingRoute(manifest.level, row);
    assert.deepEqual(observations, { ...row.observations, checkpoint: pinned.checkpoint });
    const versus = resolveMission(project, row.id, { difficulty: row.difficulty, mode: 'versus' });
    assert.deepEqual(versus.level, manifest.level);
    const match = createDuel(
      versus.level,
      { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    assert.notEqual(match.runs[0].classic.timedBonuses, match.runs[1].classic.timedBonuses);
    resumeDuel(match);
    for (const { direction, ticks } of row.segments)
      for (let n = 0; n < ticks; n++) {
        assert.equal(match.status, 'running');
        stepDuel(match, [{ direction }, { direction }]);
        assert(match.runs.every((r) => r.classic.livesLost === 0));
      }
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    for (const run of match.runs) {
      assert.equal(run.status, 'won');
      assert.equal(run.classic.timedBonuses.schedules[0].collections, 1);
      assert.equal(authoritativeCheckpoint(run).hash, pinned.checkpoint);
    }
  });

const assessed = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
).rows;
const refined = JSON.parse(
  await readFile(new URL('./fixtures/opening-pressure-routes.json', import.meta.url)),
).rows;
for (const id of ids)
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center'])
      test(`combined optional timed pickup can be missed: ${id}/${difficulty}/${turnPolicy}`, () => {
        const same = (r) =>
          (r.id ?? r.missionId) === id &&
          r.difficulty === difficulty &&
          r.turnPolicy === turnPolicy;
        const segments = assessed.find(same)?.chosen?.segments ?? refined.find(same)?.segments;
        assert(segments);
        const { level } = resolveMission(project, id, { difficulty });
        const options = { seed: 1, classId: 'scout', turnPolicy };
        const run = createRun(level, options),
          recorder = createRecorder(level, options);
        const match = createDuel(level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
        resumeDuel(match);
        let appearances = 0;
        const grants = [];
        for (const segment of segments) {
          const [direction, ticks] = Array.isArray(segment)
            ? segment
            : [segment.direction, segment.ticks];
          for (let n = 0; n < ticks; n++) {
            assert.equal(run.status, 'running');
            assert.equal(match.status, 'running');
            recordInput(recorder, { direction });
            stepRun(run, { direction }, FIXED_DT);
            stepDuel(match, [{ direction }, { direction }]);
            assert.equal(run.classic.livesLost, 0);
            appearances += run.events.filter((e) => e.type === 'bonus.appeared').length;
            grants.push(
              ...run.events.filter((e) => e.type === 'powerup.collected').map((e) => e.kind),
            );
          }
        }
        assert.equal(run.status, 'won');
        assert.equal(appearances, 1, 'A visible opportunity was actually missed');
        assert.equal(run.classic.timedBonuses.schedules[0].collections, 0);
        assert.deepEqual(
          grants,
          id === 'long-rail' ? ['player-speed'] : [],
          'Long Rail still takes its fixed speed item',
        );
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
        assert.equal(match.status, 'finished');
        assert.equal(match.winner, null);
        for (const board of match.runs)
          assert.deepEqual(authoritativeCheckpoint(board), authoritativeCheckpoint(run));
      });

for (const id of ids)
  test(`v3 post-contact save restores bounded effects or life gain and the exact reviewed clear: ${id}`, async () => {
    const row = inputs.find(
      (r) =>
        r.id === id &&
        r.difficulty === 'standard' &&
        r.turnPolicy === 'immediate' &&
        r.seed === 1 &&
        r.purpose === 'ordinary',
    );
    const { level } = resolveMission(project, id, { difficulty: row.difficulty });
    const campaign = {
      version: 'xonix-campaign.v1',
      id: 'whole-timed-review-save',
      revision: '1',
      levels: [level],
      classRecipes: CLASSES,
    };
    const key = campaignKey(campaign);
    let saved, collectedCheckpoint;
    // Slow/freeze activate on the next fixed tick, never retroactively during
    // the collision that collected them. Save the actually active effect.
    const saveTick = row.observations.collectionTick + 1;
    playTimedTakingRoute(level, row, {
      replay: false,
      onStep(run, recorder, command) {
        if (run.tick !== saveTick) return;
        const kind = level.classic.timedBonuses.schedules[0].kind;
        if (kind !== 'extra-life') assert(classicEffectActive(run, kind));
        else assert.equal(run.lives, level.rules.lives + 1);
        collectedCheckpoint = authoritativeCheckpoint(run);
        saved = suspendSession({
          run,
          recorder,
          campaignKey: key,
          themeId: 'fpv',
          bodyId: 'quad',
          runId: 'whole-timed-review',
          continuation: command,
        });
      },
    });
    assert(saved);
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), collectedCheckpoint);
    let tick = 0;
    for (const { direction, ticks } of row.segments)
      for (let n = 0; n < ticks; n++) {
        if (++tick <= saveTick) continue;
        recordInput(restored.recorder, { direction });
        stepRun(restored.run, { direction }, FIXED_DT);
        assert.equal(restored.run.classic.livesLost, 0);
      }
    assert.equal(restored.run.status, 'won');
    assert.equal(
      authoritativeCheckpoint(restored.run).hash,
      pins.find(
        (r) =>
          r.key ===
          [row.policy, row.id, row.difficulty, row.turnPolicy, row.seed, row.purpose].join('/'),
      ).checkpoint,
    );
    assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
  });

test('Studio timed combined inspection retains explicit Apply and labels pending acceptance', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(html, /\.\.\/\?journey=whole-spatial-v3/);
  assert.match(html, /\.\.\/couch\/\?journey=whole-spatial-v3/);
  assert.match(html, /id="whole-timed"/);
  const handler = js.slice(
    js.indexOf("$('whole-timed').onclick"),
    js.indexOf("$('import').onchange"),
  );
  assert.match(handler, /if \(!discardSource\(\)\) return;/);
  assert.match(handler, /createWholeTimedCandidates\(\{ artwork: true \}\)/);
  assert.match(handler, /inspectSource\(\)/);
  assert.doesNotMatch(handler, /session\.(?:apply|replace|save)|\.publish/);
});
