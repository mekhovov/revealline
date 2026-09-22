import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { authoredJourneyUsesActorMaterials } from '../content-design/mode-href.mjs';
import { journeyLibrarySource } from './journey-source.mjs';
import { combineJourneyLibrarySources } from './cross-mode-journey.mjs';
import { journeyMissionDetails, authoredJourneyMissionTags } from './journey-presentation.mjs';
import { classicLibrarySources, prepareMissionLibraryIndex } from './classic-source.mjs';
import { boundedJSON } from '../data-json.mjs';
import { externalChapterHash } from '../external-chapter.mjs';
import { campaignKey } from '../library.mjs';
import { createRun } from '../core/index.mjs';
import { createDuel } from '../multiplayer.mjs';

/** Read-only remote browsing. Compiler-qualified Journey objects and checked
 * Base metadata grant an exact receiving-host lookup, never an in-Team run.
 * Retained packs remain Unavailable until a separate installation/readiness
 * adapter can prove their ownership. No fake image decoder or prepared pack is
 * used to turn browsing metadata into launch authority.
 */
export async function createRemoteSoloVersusLibrarySources({
  baseURL,
  fetch: request = globalThis.fetch,
  launch,
  difficulty = () => 'standard',
  signal,
}) {
  if (typeof launch !== 'function' || typeof request !== 'function')
    throw new TypeError('Remote browsing needs a metadata reader and exact handoff.');
  const root = new URL(baseURL);
  if (!['http:', 'https:', 'file:'].includes(root.protocol) || root.username || root.password)
    throw new TypeError('Remote browsing needs the fixed same-game content root.');
  const check = () => {
    if (signal?.aborted) throw new DOMException('Mission browsing cancelled.', 'AbortError');
  };
  async function read(path, maxBytes = 512 * 1024) {
    check();
    const response = await request(new URL(path, root), { signal });
    if (!response.ok) throw new Error(`Mission metadata is unavailable (${response.status}).`);
    const text = await response.text();
    check();
    const value = boundedJSON(text, {
      maxBytes,
      maxNodes: 50000,
      maxArray: 4096,
      maxDepth: 32,
      maxString: 4096,
    });
    return { text, value };
  }
  const [route, indexFile, themeFile, campaignFile, classesFile] = await Promise.all([
    loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo),
    read('content/mission-library-index.json'),
    read('content-design/themes.json'),
    read('content/campaign.json'),
    read('content/classes.json'),
  ]);
  check();
  const index = prepareMissionLibraryIndex(indexFile.value);
  const themes = authoredJourneyUsesActorMaterials(route.id)
    ? journeyActorThemeCandidates(themeFile.value.themes, {
        includeOriginals: route.preserveOriginalThemes === true,
      })
    : themeFile.value.themes;
  const options = {
    themes,
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  };
  const solo = createCandidateSoloHost(route.source, options);
  try {
    const versus = createCandidateVersusHost(route.source, options);
    const sourceFor = (host, manifest) => ({
      ...journeyLibrarySource({
        editionId: route.id,
        edition: 'New Journey',
        catalog: host.catalog,
        details: (mission) => journeyMissionDetails(manifest(mission, difficulty())),
        tags: (mission) => authoredJourneyMissionTags(mission, manifest(mission, 'standard')),
        card: (mission) => host.card(mission, difficulty()),
        launch: (_mission, context) => launch(context),
      }),
      // This host does not read another mode's saved progress or claim clears.
      progress: () => '',
    });
    const journey = combineJourneyLibrarySources([
      {
        mode: 'solo',
        source: sourceFor(solo, (mission, preset) =>
          solo
            .select(mission, preset)
            ?.manifests.find((item) => item.missionId === mission.levelId),
        ),
      },
      {
        mode: 'versus',
        source: sourceFor(versus, (mission, preset) => versus.manifest(mission, preset)),
      },
    ]);
    const baseCampaign = { ...campaignFile.value, classRecipes: classesFile.value };
    const hash = await externalChapterHash(campaignFile.text);
    const bytes = new TextEncoder().encode(campaignFile.text).length;
    const readyBase = new Map();
    for (const row of index.missions.filter((item) => item.source === 'base')) {
      const level = baseCampaign.levels[row.levelIndex];
      if (
        hash !== row.sourceFile.sha256 ||
        bytes !== row.sourceFile.bytes ||
        campaignKey(baseCampaign) !== row.campaignKey ||
        level?.id !== row.levelId ||
        level?.revision !== row.levelRevision
      )
        throw new Error('Base mission metadata differs from the retained source edition.');
      const modes = new Set();
      const config = { classRecipes: classesFile.value, classId: classesFile.value[0].id };
      for (const mode of row.modes) {
        if (mode === 'solo') createRun(level, config);
        else createDuel(level, config);
        modes.add(mode);
      }
      readyBase.set(row.id, modes);
    }
    check();
    const retained = classicLibrarySources(index, {
      availability: (row, mode) =>
        readyBase.get(row.id)?.has(mode)
          ? { state: 'ready' }
          : {
              state: 'unavailable',
              reason:
                'Retained chapter: installation and original-picture readiness are not yet checked from Team. Open Solo or Versus to install or play this edition.',
            },
      launch: (_row, context) => launch(context),
      progress: () => '',
    });
    return Object.freeze({
      sources: Object.freeze([journey, ...retained]),
      dispose: () => solo.preparer.dispose(),
    });
  } catch (error) {
    solo.preparer.dispose();
    throw error;
  }
}
