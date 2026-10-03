import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSnakeHuntCandidates } from '../content-design/snake-hunt-candidates.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { entryScenario, expansionFromScenario, prepareDocument } from '../playground/model.mjs';
import { preparePack, scenarioFromPack, validatePack, emptyPackLibrary } from '../packs.mjs';
import { validateScenario } from '../content.mjs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';
import { encounterVariantSource } from '../hunt/variants.mjs';
import { authoredModeDestinations, authoredTeamReturn } from '../ui/authored-mode-routes.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
function scenario() {
  const host = createCandidateSoloHost(createSnakeHuntCandidates({ artwork: false }), {
    themes,
    buildVersion: 'dev',
    corePackIds: ['journey-snake-hunt'],
  });
  return entryScenario(host.entries[0]);
}

test('Snake editor export, installed pack and scenario roundtrip retain explicit rules and reject historical relabelling', async () => {
  const original = scenario();
  const pack = expansionFromScenario(original);
  assert.equal(pack.format, 'xonix-pack.v11');
  assert.equal(validatePack(pack).valid, true);
  const { pack: prepared } = await preparePack(pack);
  const restored = scenarioFromPack(prepared, pack.campaigns[0].id, original.level.id);
  assert.deepEqual(restored.level.snake, original.level.snake);
  assert.equal(restored.format, 'xonix-playground.v11');
  assert.equal(validateScenario({ ...restored, format: 'xonix-playground.v10' }).valid, false);
  assert.equal(validatePack({ ...pack, format: 'xonix-pack.v10' }).valid, false);
  const imported = await prepareDocument(original.level, {
    current: original,
    packLibrary: emptyPackLibrary(),
  });
  assert.deepEqual(imported.scenario.level.snake, original.level.snake);
  assert.doesNotThrow(() =>
    createMasteryCatalog([
      {
        campaign: { ...pack.campaigns[0], classRecipes: pack.classRecipes },
        sourcePackId: pack.id,
        sourcePackFormat: pack.format,
        masteries: [],
      },
    ]),
  );
});

test('optional encounter replacement cannot remove Snake quota targets or rewrite its order', () => {
  const source = createSnakeHuntCandidates({ artwork: false });
  for (const variant of ['off', 'bonus', 'patrol']) {
    const changed = encounterVariantSource(source, variant);
    assert.deepEqual(
      changed.missions.map((m) => ({ actors: m.actors, hunt: m.hunt, snake: m.snake })),
      source.missions.map((m) => ({ actors: m.actors, hunt: m.hunt, snake: m.snake })),
    );
  }
});

test('Snake navigation selects the matching separate Team campaign without importing progress', () => {
  assert.equal(
    authoredModeDestinations('solo', 'snake-hunt-v1').team,
    'couch/relay-rescue.html?journey=snake-hunt-v1&return=solo',
  );
  assert.equal(
    authoredTeamReturn(
      'https://example.test/game/couch/relay-rescue.html?journey=snake-hunt-v1&return=versus',
    ).versus,
    './?journey=snake-hunt-v1',
  );
  assert.equal(
    authoredTeamReturn(
      'https://example.test/game/couch/relay-rescue.html?journey=snake-hunt-v1&practice=foreign',
    ),
    null,
  );
});
