import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  DEFAULT_CAMPAIGN_DIFFICULTY,
  CAMPAIGN_DIFFICULTIES,
  resolveCampaignDifficulty,
  createDifficultyContext,
  findDifficultyContext,
} from '../campaign-difficulty.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { createRun, stepRun, releaseInputs, getSummary, FIXED_DT } from '../core/index.mjs';
import { versionsForCampaign } from '../core/versions.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { campaignKey, boardIdentity } from '../library.mjs';
import { emptyProgress, awardCompletion } from '../progress.mjs';
import { preparePack, resolvePackCampaign, scenarioFromPack } from '../packs.mjs';
import { validateScenario } from '../content.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const clone = (value) => structuredClone(value);
const sha = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const base = await json('../content/campaign.json');
base.classRecipes = await json('../content/classes.json');
const baseline = await json('./fixtures/compatibility-v060.json');
const index = await json('../content/packs/index.json');
const campaigns = [base],
  packs = [];
for (const entry of index.packs) {
  const source = await json(`../content/packs/${entry.path}`);
  // Artwork decoding is a separate transport test; keep every gameplay field.
  source.visualOverrides = {};
  source.levelVisuals = [];
  const prepared = await preparePack(source, {
    decodeImage: async () => {
      throw new Error('Unexpected image');
    },
  });
  packs.push(prepared.pack);
  campaigns.push(
    ...prepared.pack.campaigns.map((c) => resolvePackCampaign(prepared.pack, c.id).campaign),
  );
}
const sentinel = campaigns.find((c) => c.levels[0].version === 'xonix-level.v2');
const single = () => ({
  ...clone(base),
  levels: [clone(base.levels[0])],
  briefs: base.briefs.slice(0, 1),
});

test('Standard preserves every shipped campaign shape, key and frozen legacy board identity', () => {
  assert.equal(DEFAULT_CAMPAIGN_DIFFICULTY, 'standard');
  assert.deepEqual(CAMPAIGN_DIFFICULTIES, ['standard', 'gentle']);
  assert.equal(
    campaigns.reduce((n, c) => n + c.levels.length, 0),
    38,
  );
  for (const campaign of campaigns) {
    const before = canonicalJSON(campaign),
      context = createDifficultyContext(campaign);
    assert.equal(canonicalJSON(context.campaign), before);
    assert.equal(context.campaignKey, campaignKey(campaign));
    assert.equal(context.baseCampaignKey, context.campaignKey);
    assert.equal(context.policyVersion, null);
    assert.notEqual(context.campaign, campaign);
    const old = baseline.campaigns.find((c) => c.id === campaign.id);
    if (!old) continue;
    assert.equal(context.campaignKey, old.key);
    for (const level of context.campaign.levels) {
      const reference = old.levels.find((l) => l.id === level.id);
      assert.equal(sha(normalizedLevel(level)), reference.normalizedSha256);
      for (const [turnPolicy, expected] of Object.entries(reference.boards))
        assert.equal(
          boardIdentity({
            campaign: context.campaign,
            level,
            recipe: context.campaign.classRecipes.find((c) => c.id === 'scout'),
            turnPolicy,
            seed: 1,
          }),
          expected,
        );
    }
  }
});

test('all 38 Gentle maps retain topology, goals, equipment and supported simulation pairs', () => {
  const invariant = (level) => {
    const copy = normalizedLevel(level);
    delete copy.revision;
    for (const key of ['lives', 'timeLimitSeconds', 'cutTimeLimitSeconds', 'maxTrailCells'])
      delete copy.rules[key];
    for (const e of copy.enemies) {
      const adjusted = {
        bouncer: ['vx', 'vy'],
        'border-patrol': ['speed'],
        'lane-boss': ['warningSeconds', 'period'],
        'contour-patrol': ['speed'],
        'claimed-rover': ['vx', 'vy'],
        eroder: ['vx', 'vy'],
      };
      for (const key of adjusted[e.type] ?? []) delete e[key];
    }
    if (copy.encounter) {
      for (const key of ['warningTicks', 'restTicks']) delete copy.encounter.shielded[key];
      for (const key of ['warningTicks', 'openTicks']) delete copy.encounter.exposed[key];
    }
    return copy;
  };
  for (const campaign of campaigns) {
    const before = canonicalJSON(campaign),
      context = createDifficultyContext(campaign, 'gentle');
    assert.equal(context.campaignKey, campaignKey(context.campaign));
    assert.notEqual(context.campaignKey, campaignKey(campaign));
    assert.deepEqual(versionsForCampaign(context.campaign), versionsForCampaign(campaign));
    assert.deepEqual(context.campaign.classRecipes, campaign.classRecipes);
    for (const [i, level] of context.campaign.levels.entries()) {
      assert.notEqual(level.revision, campaign.levels[i].revision);
      assert.deepEqual(invariant(level), invariant(campaign.levels[i]));
      const original = normalizedLevel(campaign.levels[i]);
      for (const [j, enemy] of level.enemies.entries()) {
        const prior = original.enemies[j];
        if (['bouncer', 'claimed-rover', 'eroder'].includes(enemy.type)) {
          assert.equal(enemy.vx, prior.vx * 0.6, `${enemy.id}: Gentle horizontal velocity`);
          assert.equal(enemy.vy, prior.vy * 0.6, `${enemy.id}: Gentle vertical velocity`);
        } else if (['border-patrol', 'contour-patrol'].includes(enemy.type)) {
          assert.equal(enemy.speed, (prior.speed ?? 4) * 0.6, `${enemy.id}: Gentle patrol speed`);
        } else if (enemy.type === 'lane-boss') {
          assert.ok(enemy.warningSeconds >= (prior.warningSeconds ?? 1.5));
          assert.ok(
            enemy.period - enemy.warningSeconds >=
              (prior.period ?? 6) - (prior.warningSeconds ?? 1.5),
          );
        }
      }
      const state = createRun(level, { classRecipes: context.campaign.classRecipes });
      assert.equal(state.rules.lives, Math.max(normalizedLevel(campaign.levels[i]).rules.lives, 5));
      assert.equal(state.rules.timeLimitSeconds, 0);
      assert.equal(state.rules.cutTimeLimitSeconds, 0);
      assert.equal(state.rules.maxTrailCells, 0);
      assert.deepEqual(
        state.cells,
        createRun(campaign.levels[i], { classRecipes: campaign.classRecipes }).cells,
      );
    }
    assert.equal(canonicalJSON(campaign), before);
  }
  for (const pack of packs)
    for (const source of pack.campaigns) {
      const campaign = resolvePackCampaign(pack, source.id).campaign;
      const gentle = createDifficultyContext(campaign, 'gentle').campaign;
      for (const level of gentle.levels) {
        const scenario = scenarioFromPack(pack, source.id, level.id);
        scenario.level = clone(level);
        if (Object.hasOwn(scenario, 'masteryDefinition')) scenario.masteryDefinition = null;
        const check = validateScenario(scenario);
        assert.equal(check.valid, true, check.errors.join('; '));
      }
    }
});

test('Gentle movement defaults and lane timing boundaries remain valid and non-punitive', () => {
  for (const timing of [
    null,
    { warningSeconds: 0.25, activeSeconds: 0.1, period: 0.6 },
    { warningSeconds: 10, activeSeconds: 10, period: 60 },
  ]) {
    const c = single(),
      level = c.levels[0];
    level.enemies = [
      { id: 'moving', type: 'bouncer', x: 40.5, y: 25.5, vx: -20, vy: 0 },
      { id: 'rail', type: 'border-patrol', x: 5.5, y: 0.5 },
      { id: 'lane', type: 'lane-boss', x: 12.5, y: 18.5, axis: 'horizontal', ...(timing ?? {}) },
    ];
    level.rules = {
      lives: 9,
      timeLimitSeconds: 1800,
      cutTimeLimitSeconds: 120,
      maxTrailCells: 1564,
    };
    const transformed = createDifficultyContext(c, 'gentle').campaign.levels[0];
    assert.equal(transformed.rules.lives, 9);
    assert.equal(transformed.enemies[0].vx, -12);
    assert.equal(transformed.enemies[0].vy, 0);
    assert.equal(transformed.enemies[1].speed, 2.4);
    const boss = transformed.enemies[2],
      original = level.enemies[2];
    assert.ok(boss.warningSeconds >= (original.warningSeconds ?? 1.5));
    assert.ok(
      boss.period - boss.warningSeconds >=
        (original.period ?? 6) - (original.warningSeconds ?? 1.5),
    );
    assert.equal(boss.activeSeconds, original.activeSeconds);
    assert.doesNotThrow(() => createRun(transformed));
  }
  const c = single();
  c.levels[0].enemies = [{ id: 'rail', type: 'border-patrol', x: 5.5, y: 0.5, speed: 0 }];
  assert.equal(createDifficultyContext(c, 'gentle').campaign.levels[0].enemies[0].speed, 0);
});

test('Sentinel extends only warning/rest/open intervals and caps large authored timings', () => {
  for (const ticks of [1, 3601, 7200]) {
    const c = clone(sentinel),
      descriptor = c.levels[0].encounter;
    descriptor.shielded.warningTicks = descriptor.shielded.restTicks = ticks;
    descriptor.exposed.warningTicks = descriptor.exposed.openTicks = ticks;
    const changed = createDifficultyContext(c, 'gentle').campaign.levels[0].encounter;
    assert.equal(changed.shielded.warningTicks, Math.min(7200, ticks * 2));
    assert.equal(changed.exposed.openTicks, Math.min(7200, ticks * 2));
    for (const key of ['initialDelayTicks', 'transitionTicks', 'minReleaseCutCells', 'laneWidth'])
      assert.equal(changed[key], descriptor[key]);
    assert.equal(changed.shielded.activeTicks, descriptor.shielded.activeTicks);
    assert.equal(changed.exposed.activeTicks, descriptor.exposed.activeTicks);
  }
});

test('contexts are deeply owned, stable, and resolved only by the full installed setup key', () => {
  const c = single(),
    first = createDifficultyContext(c, 'gentle');
  assert.deepEqual(createDifficultyContext(clone(c), 'gentle'), first);
  assert.deepEqual(findDifficultyContext(c, first.campaignKey), first);
  assert.equal(findDifficultyContext(c, `${first.campaign.id}/1/0000000000000000`), null);
  assert.equal(findDifficultyContext(c, createDifficultyContext(c).campaignKey).mode, 'standard');
  assert.throws(() => {
    first.campaign.levels[0].rules.lives = 9;
  }, TypeError);
  assert.throws(() => first.campaign.classRecipes.reverse(), TypeError);
  c.levels[0].rules.moveSpeed += 1;
  assert.equal(findDifficultyContext(c, first.campaignKey), null);
  assert.notEqual(
    createDifficultyContext(c, 'gentle').campaign.levels[0].revision,
    first.campaign.levels[0].revision,
  );
  const roster = single();
  roster.classRecipes.reverse();
  assert.notEqual(createDifficultyContext(roster, 'gentle').campaignKey, first.campaignKey);
  const long = single();
  long.revision = 'R'.repeat(60);
  long.levels[0].revision = 'L'.repeat(80);
  assert.ok(createDifficultyContext(long, 'gentle').campaign.levels[0].revision.length <= 80);
});

test('enum and bounded campaign validation reject hostile or unsupported data without getters', () => {
  for (const value of [undefined, null, {}, ['gentle'], 'Gentle', 'easy', 1])
    assert.throws(() => resolveCampaignDifficulty(value));
  let getters = 0;
  const getter = single();
  Object.defineProperty(getter, 'levels', {
    enumerable: true,
    get() {
      getters++;
      return [];
    },
  });
  const levelGetter = single();
  Object.defineProperty(levelGetter.levels[0], 'version', {
    enumerable: true,
    get() {
      getters++;
      return 'xonix-level.v1';
    },
  });
  const invalid = [
    getter,
    levelGetter,
    null,
    [],
    '{}',
    Object.create(base),
    { ...single(), difficulty: 'gentle' },
  ];
  const cycle = single();
  cycle.self = cycle;
  invalid.push(cycle);
  const sparse = single();
  sparse.levels = Array(1);
  invalid.push(sparse);
  const duplicate = single();
  duplicate.levels.push(clone(duplicate.levels[0]));
  invalid.push(duplicate);
  const many = single();
  many.levels = Array.from({ length: 129 }, (_, i) => ({
    ...clone(many.levels[0]),
    id: `map-${i}`,
  }));
  invalid.push(many);
  const unknown = single();
  unknown.levels[0].enemies[0].type = 'unregistered';
  invalid.push(unknown);
  const mixed = single();
  mixed.levels.push(clone(sentinel.levels[0]));
  invalid.push(mixed);
  const filtered = single();
  filtered.classIds = ['scout'];
  invalid.push(filtered);
  const oversized = single();
  oversized.levels[0].metadata = { description: 'x'.repeat(65537) };
  invalid.push(oversized);
  for (const c of invalid) assert.throws(() => createDifficultyContext(c, 'gentle'));
  assert.equal(getters, 0);
});

for (const policy of ['immediate', 'grid-center']) {
  test(`Standard ${policy} First Signal still reproduces the frozen events and checkpoint`, () => {
    const entry = baseline.cases.find(
      (c) => c.campaignId === base.id && c.options.turnPolicy === policy,
    );
    assert.ok(entry);
    const context = createDifficultyContext(base),
      level = context.campaign.levels.find((l) => l.id === entry.level.id);
    const run = createRun(level, { ...entry.options, classRecipes: context.campaign.classRecipes }),
      events = [];
    for (const segment of entry.segments) {
      if (segment.releaseBefore) releaseInputs(run);
      for (let i = 0; i < segment.ticks; i++) {
        stepRun(run, segment.input, FIXED_DT);
        events.push(...run.events);
      }
    }
    assert.deepEqual(getSummary(run), entry.summary);
    assert.deepEqual(authoritativeCheckpoint(run), entry.checkpoint);
    assert.equal(sha(events), entry.eventsSha256);
  });
  test(`Gentle ${policy} removes an actual timer barrier and carries its own replay/award identity`, () => {
    const c = single();
    c.levels[0].rules.timeLimitSeconds = 0.1;
    c.levels[0].goal.coverage = 0.3;
    c.levels[0].enemies[0] = { id: 'east', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0 };
    const standard = createDifficultyContext(c),
      gentle = createDifficultyContext(c, 'gentle');
    const options = { classRecipes: c.classRecipes, classId: 'scout', turnPolicy: policy, seed: 1 };
    const oldRun = createRun(standard.campaign.levels[0], options);
    const run = createRun(gentle.campaign.levels[0], options),
      recorder = createRecorder(gentle.campaign.levels[0], options);
    for (let i = 0; i < 2000 && run.status === 'running'; i++) {
      const input = { direction: 'down' };
      stepRun(oldRun, input, FIXED_DT);
      stepRun(run, input, FIXED_DT);
      recordInput(recorder, input);
    }
    assert.equal(oldRun.status, 'lost');
    assert.equal(oldRun.failureCause, 'mission-timeout');
    assert.equal(run.status, 'won');
    assert.equal(run.lives, 5);
    const replay = exportReplay(recorder, run);
    assert.equal(verifyReplay(replay).match, true);
    assert.equal(replay.level.revision, gentle.campaign.levels[0].revision);
    const originalProgress = emptyProgress(c);
    assert.equal(
      awardCompletion(originalProgress, c, getSummary(run), { runId: 'wrong-mode' }),
      originalProgress,
    );
    assert.ok(
      awardCompletion(emptyProgress(gentle.campaign), gentle.campaign, getSummary(run), {
        runId: 'own-mode',
      }).clears[run.levelId],
    );
  });
}
