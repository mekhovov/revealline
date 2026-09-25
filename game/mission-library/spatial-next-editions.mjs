import { boundedJSON, required } from '../data-json.mjs';
import { validateTheme } from '../content.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { createMissionCard } from '../content-design/mission-card.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { journeyLibrarySource } from './journey-source.mjs';
import { combineJourneyLibrarySources } from './cross-mode-journey.mjs';
import { journeyMissionDetails } from './journey-presentation.mjs';

const REVISED_MISSIONS = new Set(['stepping-stones', 'return-pocket', 'neutral-ground']);
const ACTIVE_ROUTE_ID = 'whole-spatial-v10';
const PRIOR_ROUTE_ID = 'whole-spatial-v9';

/** Bound the display projection before compilation. compileContentProject
 * resolves every mission/preset/mode it receives, so filtering only after an
 * execution catalog is built would make three historical cards pay for the
 * complete 91-mission edition twice. The full v9 route remains the launch
 * authority; this projection owns card/details qualification only. */
export function spatialNextPriorEditionProjection(source) {
  required(
    source &&
      ['maps', 'missions', 'campaigns', 'packs', 'assets'].every((key) =>
        Array.isArray(source[key]),
      ),
    'Spatial edition needs a complete prior source.',
  );
  const missions = source.missions.filter((mission) => REVISED_MISSIONS.has(mission.id));
  required(
    missions.length === REVISED_MISSIONS.size &&
      new Set(missions.map((mission) => mission.id)).size === REVISED_MISSIONS.size,
    'Spatial edition must project each prior mission exactly once.',
  );
  const mapKeys = new Set(missions.map((mission) => JSON.stringify(mission.map)));
  const maps = source.maps.filter((map) =>
    mapKeys.has(JSON.stringify({ id: map.id, revision: map.revision })),
  );
  required(maps.length === mapKeys.size, 'Spatial edition map projection is incomplete.');

  const campaigns = source.campaigns.flatMap((campaign) => {
    const missionIds = campaign.missionIds.filter((id) => REVISED_MISSIONS.has(id));
    return missionIds.length ? [{ ...campaign, missionIds }] : [];
  });
  for (const mission of missions)
    required(
      campaigns.filter((campaign) => campaign.missionIds.includes(mission.id)).length === 1,
      'Spatial edition mission needs one prior campaign owner.',
    );
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const packs = source.packs.flatMap((pack) => {
    const owned = pack.campaignIds.filter((id) => campaignIds.has(id));
    return owned.length ? [{ ...pack, campaignIds: owned }] : [];
  });
  for (const campaign of campaigns)
    required(
      packs.filter((pack) => pack.campaignIds.includes(campaign.id)).length === 1,
      'Spatial edition campaign needs one prior pack owner.',
    );

  const assetIds = new Set(
    missions.map((mission) => mission.presentation.backgroundAssetId).filter((id) => id !== null),
  );
  const assets = source.assets.filter((asset) => assetIds.has(asset.id));
  required(assets.length === assetIds.size, 'Spatial edition asset projection is incomplete.');
  return {
    ...source,
    maps,
    missions,
    campaigns,
    packs,
    assets,
  };
}

/** Add only the three prior v9 mission cards beside the active v10 Journey.
 * They remain manual launches into the complete v9 route; this three-card view
 * never becomes an automatic Next sequence or cross-edition progress owner. */
export async function createSpatialNextEditionSources({
  activeRouteId,
  originalThemes,
  difficulty = () => 'standard',
  launch,
  profile,
} = {}) {
  if (activeRouteId !== ACTIVE_ROUTE_ID)
    return Object.freeze({ sources: Object.freeze([]), dispose() {} });
  required(typeof launch === 'function', 'Spatial editions need an exact mission handoff.');
  required(typeof difficulty === 'function', 'Spatial editions need the selected preset.');
  required(
    profile === undefined || typeof profile?.snapshot === 'function',
    'Spatial edition progress needs its own profile.',
  );
  const route = await loadAuthoredJourneyRoute(PRIOR_ROUTE_ID);
  const originals = boundedJSON(originalThemes, {
    maxBytes: 262144,
    maxNodes: 8192,
    maxDepth: 12,
  });
  required(Array.isArray(originals) && originals.length > 0, 'Candidate themes are required.');
  const themes = journeyActorThemeCandidates(originals, {
    includeOriginals: route.preserveOriginalThemes === true,
  });
  required(
    new Set(themes.map((theme) => theme.id)).size === themes.length &&
      themes.every((theme) => validateTheme(theme).valid),
    'Spatial editions need valid, unique candidate themes.',
  );
  const themeIds = new Set(themes.map((theme) => theme.id));
  const project = compileContentProject(spatialNextPriorEditionProjection(route.source));
  let disposed = false;
  const qualified = ['solo', 'versus'].map((mode) => {
    const executions = createContentExecutionCatalog(project, { mode });
    const fullCatalog = createJourneyCatalog(
      executions.journey().campaigns.map(({ packId, runtime, manifests }) => ({
        source: 'candidate',
        packId,
        id: runtime.id,
        title: runtime.title,
        modes: [mode],
        levels: runtime.levels.map((level, index) => ({
          id: level.id,
          name: level.name,
          hook: manifests[index].design.routeDecision,
        })),
      })),
    );
    const missions = fullCatalog.missions.filter((mission) =>
      REVISED_MISSIONS.has(mission.levelId),
    );
    required(
      missions.length === REVISED_MISSIONS.size &&
        new Set(missions.map((mission) => mission.levelId)).size === REVISED_MISSIONS.size,
      'Spatial edition must contain each prior mission owner exactly once.',
    );
    const manifestFor = (mission, preset = difficulty()) =>
      executions
        .select(mission.packId, mission.campaignId, preset)
        ?.manifests.find((item) => item.missionId === mission.levelId);
    for (const mission of missions)
      for (const preset of ['gentle', 'standard', 'expert']) {
        const manifest = manifestFor(mission, preset);
        required(
          manifest?.background && themeIds.has(manifest.presentation.themeId),
          'Spatial edition needs its exact authored theme and original.',
        );
      }
    const source = journeyLibrarySource({
      editionId: route.id,
      edition: 'Previous Journey · v9',
      catalog: { missions },
      profile,
      details: (mission) => journeyMissionDetails(manifestFor(mission)),
      card: (mission) => createMissionCard(manifestFor(mission)),
      launch: (_mission, context) => {
        if (disposed || context?.isCurrent?.() === false) return false;
        return launch(context);
      },
    });
    return {
      mode,
      source: {
        ...source,
        ...(profile === undefined ? { progress: () => '' } : {}),
        availability: () =>
          disposed
            ? { state: 'unavailable', reason: 'This mission library is closed. Reopen missions.' }
            : { state: 'ready' },
      },
    };
  });
  return Object.freeze({
    sources: Object.freeze([
      Object.freeze({
        ...combineJourneyLibrarySources(qualified),
        automaticContinuation: false,
      }),
    ]),
    dispose() {
      disposed = true;
    },
  });
}
