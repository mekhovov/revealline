import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { resolveMission, compileContentProject } from '../content-design/project.mjs';
import { createRun } from '../core/index.mjs';
import { campaignKey } from '../library.mjs';

test('host-facing executions use exact shared presets, never a second Legacy difficulty pass', () => {
  const source = createOpeningCandidates(),
    before = structuredClone(source);
  const catalog = createContentExecutionCatalog(source, { packIds: ['journey-opening'] });
  const project = compileContentProject(source);
  assert.equal(catalog.entries.length, 6);
  assert.equal(catalog.officialProgressEligible, false);
  for (const entry of catalog.entries) {
    assert.equal(catalog.select(entry.sourcePackId, entry.campaignId, entry.difficulty), entry);
    assert.equal(catalog.find(entry.sourcePackId, entry.campaignId, entry.executionKey), entry);
    assert.equal(entry.baseCampaignKey, campaignKey(entry.baseCampaign));
    assert.equal(entry.executionKey, campaignKey(entry.campaign));
    assert.equal(entry.policyVersion, 'journey-arcade-v2');
    assert.equal(entry.officialProgressEligible, false);
    assert(Object.isFrozen(entry.campaign.levels[0].rules));
    for (const level of entry.campaign.levels) {
      const expected = resolveMission(project, level.id, { difficulty: entry.difficulty });
      assert.deepEqual(level, expected.level);
      const run = createRun(level);
      assert.equal(run.lives, { gentle: 5, standard: 3, expert: 2 }[entry.difficulty]);
      assert.equal(run.rules.moveSpeed, 10);
      assert.equal(run.coverage, 0);
      const keeper = level.enemies.find((actor) => actor.type === 'bouncer');
      assert(
        Math.abs(
          Math.hypot(keeper.vx, keeper.vy) -
            2.4 * { gentle: 0.85, standard: 1, expert: 1.1 }[entry.difficulty],
        ) < 1e-12,
      );
    }
  }
  assert.deepEqual(source, before);
  assert.deepEqual(catalog.journey('expert').missions, catalog.journey('standard').missions);
});

test('shared campaign membership retains exact pack ownership for selection and recovery', () => {
  const source = createOpeningCandidates();
  source.packs[1].campaignIds = ['prologue'];
  const catalog = createContentExecutionCatalog(source);
  const a = catalog.select('journey-opening', 'prologue', 'gentle');
  const b = catalog.select('opening-remixes', 'prologue', 'gentle');
  assert.equal(a.executionKey, b.executionKey);
  assert.notEqual(a, b);
  assert.equal(catalog.find('journey-opening', 'prologue', a.executionKey), a);
  assert.equal(catalog.find('opening-remixes', 'prologue', b.executionKey), b);
  assert.equal(catalog.find('unknown', 'prologue', a.executionKey), null);
  assert.equal(catalog.find('journey-opening', 'horizon-school', a.executionKey), null);
  assert.equal(catalog.select('journey-opening', 'unknown'), null);
  const hostile = {
    toString() {
      throw new Error('Do not coerce callers.');
    },
  };
  assert.equal(catalog.select(hostile, 'prologue'), null);
  assert.equal(catalog.find('journey-opening', hostile, a.executionKey), null);
  assert.equal(catalog.find('journey-opening', 'prologue', hostile), null);
});

test('execution catalogs own source and reject caller-supplied policy or privilege changes', () => {
  const source = createOpeningCandidates();
  const catalog = createContentExecutionCatalog(source);
  const entry = catalog.select('journey-opening', 'prologue');
  source.missions[0].coverage = 0.99;
  assert.equal(entry.campaign.levels[0].goal.coverage, 0.3);
  assert.throws(() => {
    entry.campaign.levels[0].rules.lives = 999;
  }, TypeError);
  for (const options of [
    { difficulty: 'gentle' },
    { policyVersion: 'gentle.v1' },
    { officialProgressEligible: true },
    { mode: 'team' },
  ])
    assert.throws(() => createContentExecutionCatalog(source, options));
  assert.throws(() => catalog.select('journey-opening', 'prologue', 'automatic'));
  assert.throws(() => catalog.journey('automatic'));
});

test('saved candidate execution identity pins artwork and presentation without changing physics or Journey progress IDs', () => {
  const source = createOpeningCandidates({ artwork: true });
  const original = createContentExecutionCatalog(source);
  const first = original.select('journey-opening', 'prologue');
  const other = original.select('journey-opening', 'horizon-school');
  for (const edit of [
    (value) => {
      value.assets[0].sha256 = '0'.repeat(64);
    },
    (value) => {
      value.assets[0].revision = 'r2';
    },
    (value) => {
      value.missions[0].presentation.backgroundAssetId = null;
    },
    (value) => {
      value.missions[0].presentation.themeId = 'another-theme';
    },
    (value) => {
      value.missions[0].revision = 'new-edition';
    },
    (value) => {
      value.missions[0].name = 'A newly named first mission';
    },
  ]) {
    const changed = structuredClone(source);
    edit(changed);
    const catalog = createContentExecutionCatalog(changed);
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const before = original.select('journey-opening', 'prologue', difficulty);
      const after = catalog.select('journey-opening', 'prologue', difficulty);
      assert.notEqual(after.executionKey, before.executionKey);
      assert.equal(
        catalog.find('journey-opening', 'prologue', before.executionKey),
        null,
        'A changed edition cannot silently restore against the old campaign key.',
      );
      assert.deepEqual(
        after.manifests.map((m) => m.simulationIdentity),
        before.manifests.map((m) => m.simulationIdentity),
      );
      assert.deepEqual(
        catalog.journey(difficulty).missions.map((m) => m.id),
        original.journey(difficulty).missions.map((m) => m.id),
      );
    }
    assert.notEqual(
      catalog.select('journey-opening', 'prologue').baseCampaignKey,
      first.baseCampaignKey,
    );
    assert.equal(
      catalog.select('journey-opening', 'horizon-school').executionKey,
      other.executionKey,
      'An unrelated campaign keeps its exact edition.',
    );
  }
});
