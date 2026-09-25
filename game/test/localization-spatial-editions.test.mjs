import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { contentText } from '../i18n/content.mjs';
import { dataIdentity } from '../data-json.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { createSpatialNextEditionSources } from '../mission-library/spatial-next-editions.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyMissionDetails } from '../mission-library/journey-presentation.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';

const revised = ['stepping-stones', 'return-pocket', 'neutral-ground'];

test('current cultural routes and manually selectable prior editions translate without replacing their owners', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const originalThemes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  const route = await loadAuthoredJourneyRoute('whole-spatial-v10');
  const host = createCandidateVersusHost(route.source, {
    themes: journeyActorThemeCandidates(originalThemes, { includeOriginals: true }),
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  let launched;
  const prior = await createSpatialNextEditionSources({
    activeRouteId: route.id,
    originalThemes,
    launch: (selection) => {
      launched = selection;
      return true;
    },
  });
  context.after(() => prior.dispose());
  const library = createMissionLibrary([
    journeyLibrarySource({
      editionId: route.id,
      edition: route.label,
      catalog: host.catalog,
      launch: () => true,
    }),
    ...prior.sources,
  ]);
  const before = JSON.stringify(library.missions);
  setLocale('uk', { persist: false });
  assert.doesNotMatch(contentText(route, 'label'), /Journey|balance|cultural/);
  for (const id of revised) {
    const mission = host.catalog.missions.find((item) => item.levelId === id);
    const manifest = host.manifest(mission);
    const identity = dataIdentity(manifest);
    const guidance = journeyMissionDetails(manifest);
    assert.match(guidance.route, /[А-ЯІЇЄҐ]/);
    assert.doesNotMatch(guidance.route, /[A-Za-z]/);
    assert.doesNotMatch(guidance.mastery, /[A-Za-z]/);
    const editions = library.missions.filter((item) => item.runtimeId === mission.id);
    assert.equal(editions.length, 2);
    for (const row of editions) {
      const display = library.presentation(row);
      assert.notEqual(display.name, row.name);
      assert.notEqual(display.hook, row.hook);
      if (row.editionId === 'whole-spatial-v9') {
        assert.equal(display.edition, 'Попередня Подорож · v9');
        assert.equal(await library.launch(row, { mode: 'versus' }), true);
        assert.equal(launched.libraryMissionId, row.id);
      }
    }
    const edited = { ...manifest, missionId: 'my-custom-route' };
    assert.equal(contentText(edited, 'design.routeDecision'), manifest.design.routeDecision);
    assert.equal(dataIdentity(manifest), identity);
  }
  assert.equal(JSON.stringify(library.missions), before);
  setLocale('en', { persist: false });
  for (const row of library.missions.filter((item) => item.editionId === 'whole-spatial-v9'))
    assert.equal(library.presentation(row).edition, 'Previous Journey · v9');
});
