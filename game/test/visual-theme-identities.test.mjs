import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import campaign from '../content/campaign.json' with { type: 'json' };
import classes from '../content/classes.json' with { type: 'json' };
import {
  buildCoopPack,
  createCoopLevelRecipe,
  COOP_PACK_RECIPE_VERSION,
} from '../coop/recipes.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK, readCoopPack } from '../coop/library.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import {
  prepareCampaignVisualThemeContext as campaignContext,
  prepareTeamVisualThemeContext as teamContext,
} from '../presentation/visual-theme-identities.mjs';
import {
  createVisualThemeCatalogue,
  VISUAL_THEME_CATALOGUE_FORMAT,
} from '../presentation/visual-theme-catalogue.mjs';

const clone = (value) => structuredClone(value);
const sha = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const imported = readCoopPack(
  JSON.stringify(
    buildCoopPack({
      version: COOP_PACK_RECIPE_VERSION,
      id: 'theme-import',
      revision: 1,
      name: 'Theme import',
      levels: [createCoopLevelRecipe('coverage')],
    }),
  ),
);
const authored = { ...campaign, classRecipes: classes };
const executions = createExecutionCatalog([{ campaign: authored }]);
const standard = executions.entries.find((entry) => entry.difficulty === 'standard');
const gentle = executions.entries.find((entry) => entry.difficulty === 'gentle');
const association = (mode) => ({ editionId: 'field-kit', contentThemeId: 'fpv', mode });
const solo = (entry = standard, index = 0, mode = 'solo') => ({
  entry,
  level: entry.campaign.levels[index],
  association: association(mode),
});
const team = (pack = COOP_STARTER_PACK, index = 0) => ({
  pack,
  level: pack.levels[index],
  association: association('team'),
});

test('real First Signal levels retain their existing authored key across Solo, Versus and Gentle', async () => {
  for (let index = 0; index < campaign.levels.length; index++) {
    const expected = {
      id: campaign.levels[index].id,
      revision: campaign.levels[index].revision,
      sha256: sha(campaign.levels[index]),
    };
    for (const entry of [standard, gentle]) {
      for (const mode of ['solo', 'versus']) {
        const value = await campaignContext(solo(entry, index, mode));
        assert.deepEqual(value.level, expected);
        assert.deepEqual(value.owner, {
          kind: 'campaign',
          baseCampaignKey: standard.baseCampaignKey,
        });
        assert.equal(value.mode, mode);
        assert(Object.isFrozen(value.level));
      }
    }
  }
  assert.notEqual(gentle.campaign.levels[0].revision, campaign.levels[0].revision);
});

test('both real Team arenas reproduce approved pack and level binding hashes', async () => {
  for (let index = 0; index < COOP_STARTER_PACK.levels.length; index++) {
    const value = await teamContext(team(COOP_STARTER_PACK, index));
    const binding = COOP_PICTURE_BINDINGS[index];
    assert.deepEqual(value.owner, {
      kind: 'team-pack',
      id: binding.packId,
      revision: binding.packRevision,
      sha256: binding.packSha256,
    });
    assert.deepEqual(value.level, {
      id: binding.levelId,
      revision: binding.levelRevision,
      sha256: binding.levelSha256,
    });
  }
});

test('validated imported Team pack retains its own complete identity', async () => {
  const value = await teamContext(team(imported));
  assert.equal(value.owner.sha256, sha(imported));
  assert.equal(value.level.sha256, sha(imported.levels[0]));
  assert.notEqual(value.owner.sha256, COOP_PICTURE_BINDINGS[0].packSha256);
});

test('same-ID content changes never inherit an earlier approved binding', async () => {
  const base = await teamContext(team());
  const changedPack = clone(COOP_STARTER_PACK);
  changedPack.name += ' revised';
  const changedOwner = await teamContext(team(changedPack));
  assert.notEqual(changedOwner.owner.sha256, base.owner.sha256);
  assert.deepEqual(changedOwner.level, base.level);
  changedPack.levels[0].name += ' revised';
  assert.notEqual((await teamContext(team(changedPack))).level.sha256, base.level.sha256);
  const changedCampaign = clone(authored);
  changedCampaign.levels[0].name += ' revised';
  const [entry] = createExecutionCatalog([{ campaign: changedCampaign }]).entries;
  assert.notEqual(
    (await campaignContext(solo(entry))).level.sha256,
    (await campaignContext(solo())).level.sha256,
  );
});

test('full selected-level membership rejects same-ID altered and foreign maps', async () => {
  for (const request of [solo(), team()]) {
    const prepare = request.entry ? campaignContext : teamContext;
    const changed = { ...request, level: clone(request.level) };
    changed.level.name += ' spoofed';
    await assert.rejects(prepare(changed), /differs from its accepted content owner/);
  }
  await assert.rejects(campaignContext({ ...solo(), level: gentle.campaign.levels[0] }));
  await assert.rejects(teamContext({ ...team(), level: standard.campaign.levels[0] }));
});

test('forged campaign wrapper keys, policy, projection and difficulty fail closed', async () => {
  for (const modify of [
    (entry) => {
      entry.baseCampaignKey = 'another/1/key';
    },
    (entry) => {
      entry.executionKey = 'another/1/key';
    },
    (entry) => {
      entry.policyVersion = 'journey-arcade-v2';
    },
    (entry) => {
      entry.campaign.levels[0].name += ' changed';
    },
    (entry) => {
      entry.difficulty = 'expert';
    },
    (entry) => {
      delete entry.difficulty;
    },
    (entry) => {
      entry.activity = 'challenge';
    },
  ]) {
    const entry = clone(standard);
    modify(entry);
    await assert.rejects(campaignContext(solo(entry)));
  }
});

test('cross-mode owners and undeclared associations cannot become valid contexts', async () => {
  await assert.rejects(campaignContext({ ...solo(), association: association('team') }));
  for (const mode of ['solo', 'versus'])
    await assert.rejects(teamContext({ ...team(), association: association(mode) }));
  await assert.rejects(campaignContext({ ...solo(), entry: COOP_STARTER_PACK }));
  await assert.rejects(teamContext({ ...team(), pack: authored }));
  await assert.rejects(teamContext({ ...team(), association: { mode: 'team' } }));
  await assert.rejects(
    teamContext({ ...team(), association: { ...association('team'), collection: 'latest' } }),
  );
});

test('invalid Team geometry, extra historical fields and revision coercion fail validation', async () => {
  for (const modify of [
    (pack) => {
      pack.levels[0].width = 0;
    },
    (pack) => {
      pack.themeId = 'fpv';
    },
    (pack) => {
      pack.revision = '2';
    },
  ]) {
    const pack = clone(COOP_STARTER_PACK);
    modify(pack);
    await assert.rejects(teamContext(team(pack)));
  }
});

test('snapshots are owned before asynchronous hashing and retain authored revision whitespace', async () => {
  const request = clone(team());
  const expected = await teamContext(request);
  const pending = teamContext(request);
  request.pack.name = 'mutated during hash';
  request.level.name = 'mutated selected level';
  request.association.editionId = 'another-edition';
  assert.deepEqual(await pending, expected);
  const source = clone(authored);
  source.revision = ' legacy ';
  source.levels[0].revision = ' first ';
  const [entry] = createExecutionCatalog([{ campaign: source }]).entries;
  const value = await campaignContext(solo(entry));
  assert.equal(value.owner.baseCampaignKey, entry.baseCampaignKey);
  assert.equal(value.level.revision, ' first ');
});

test('cancellation before preparation and during hash rejects without publishing a context', async () => {
  for (const [prepare, request] of [
    [campaignContext, solo()],
    [teamContext, team()],
  ]) {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(prepare(request, { signal: controller.signal }), { name: 'AbortError' });
    const late = new AbortController();
    const pending = prepare(request, { signal: late.signal });
    late.abort();
    await assert.rejects(pending, { name: 'AbortError' });
  }
});

test('hostile data and oversized Team input are rejected without invoking accessors', async () => {
  let called = false;
  const pack = clone(COOP_STARTER_PACK);
  Object.defineProperty(pack, 'name', {
    enumerable: true,
    get() {
      called = true;
      return 'bad';
    },
  });
  await assert.rejects(teamContext({ ...team(), pack }));
  assert.equal(called, false);
  await assert.rejects(
    teamContext({ ...team(), pack: { ...COOP_STARTER_PACK, name: 'x'.repeat(9000) } }),
  );
});

test('actual adapter contexts join exact catalogue coverage without cross-mode fallback', async () => {
  const content = await campaignContext(solo());
  const presentation = {
    source: { id: 'studio', revision: 1 },
    theme: { id: 'fpv', revision: 32 },
    collection: null,
    sha256: 'a'.repeat(64),
  };
  const catalogue = createVisualThemeCatalogue({
    format: VISUAL_THEME_CATALOGUE_FORMAT,
    id: 'qualification',
    revision: 1,
    entries: [
      { id: 'field-kit', revision: 1, name: 'Field Kit', presentation, coverage: [content] },
    ],
  });
  const selection = { id: 'field-kit', revision: 1 };
  assert.equal(catalogue.resolve(selection, content).kind, 'compatible');
  assert.equal(
    catalogue.resolve(selection, await campaignContext(solo(gentle))).kind,
    'compatible',
  );
  assert.equal(
    catalogue.resolve(selection, await campaignContext(solo(standard, 0, 'versus'))).kind,
    'unsupported',
  );
  assert.equal(catalogue.resolve(selection, await teamContext(team())).kind, 'unsupported');
});
