import { readPublishedSnapshot } from '../content-design/route-snapshot.mjs';
import { REMOTE_TEAM_NAVIGATION } from '../content-design/remote-team-navigation-registry.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { classifyContent } from '../content-design/content-lifecycle.mjs';
import { journeyLibrarySource } from './journey-source.mjs';
import { teamJourneyLibraryOwner, teamArenaLibrarySource } from './team-source.mjs';
import { COOP_STARTER_PACK, coopGoalText } from '../coop/library.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { t, getLocale } from '../i18n/index.mjs';
import { huntText } from '../hunt/copy.mjs';

// Cache only complete, verified immutable display views. Failed/retired reads
// never occupy a cache entry or share an in-flight owner with a later Retry.
const readyByFetcher = new WeakMap();
const current = ({ signal, assertCurrent }) => {
  assertCurrent?.();
  signal?.throwIfAborted();
};

function expand(values, count) {
  if (
    !Array.isArray(values) ||
    values.length % 2 ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 65536
  )
    throw new Error('Invalid Team display diagram.');
  const result = [];
  for (let i = 0; i < values.length; i += 2) {
    const length = values[i + 1];
    if (!Number.isSafeInteger(length) || length < 1 || result.length + length > count)
      throw new Error('Invalid Team display diagram run.');
    for (let j = 0; j < length; j++) result.push(values[i]);
  }
  if (result.length !== count) throw new Error('Incomplete Team display diagram.');
  return result;
}

// This creates no native rows, executable packs, profile, or route admission.
function displayView(payload, descriptor) {
  if (
    payload.format !== 'revealline-remote-team-display.v1' ||
    payload.mode !== 'team' ||
    payload.target !== descriptor.target ||
    payload.editionId !== descriptor.editionId ||
    payload.factory !== descriptor.factory ||
    payload.project?.id !== descriptor.project.id ||
    payload.project?.revision !== descriptor.project.revision ||
    payload.project?.sha256 !== descriptor.project.sha256
  )
    throw new Error('Team display data has a different source.');
  const projection = payload.view;
  const base = createJourneyCatalog(projection.campaigns);
  const missions = Object.freeze(
    base.missions.map((mission) =>
      Object.freeze({
        ...mission,
        levelIndex: projection.ordinals[mission.id],
      }),
    ),
  );
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  const remap = (mission) => (mission ? (byId.get(mission.id) ?? null) : null);
  const catalog = Object.freeze({
    ...base,
    missions,
    find: (id) => byId.get(id) ?? null,
    forMode: (mode) => Object.freeze(base.forMode(mode).map(remap)),
    next: (...args) => remap(base.next(...args)),
    search: (...args) => base.search(...args).map(remap),
  });
  const itemFor = (mission, difficulty) =>
    catalog.find(mission?.id) === mission
      ? (projection.presentations[mission.id]?.[difficulty] ?? null)
      : null;
  const cards = new Map();
  return Object.freeze({
    catalog,
    has: (mission, difficulty) => Boolean(itemFor(mission, difficulty)),
    tags: (mission, difficulty) => itemFor(mission, difficulty)?.tags ?? [],
    card(mission, difficulty) {
      const id = itemFor(mission, difficulty)?.card;
      if (!id) return null;
      if (!cards.has(id)) {
        const compact = payload.cards[id],
          count = compact.width * compact.height;
        cards.set(
          id,
          freezeDesign({
            ...compact,
            cells: expand(compact.cells, count),
            terrain: expand(compact.terrain, count),
          }),
        );
      }
      return cards.get(id);
    },
    details(mission, difficulty) {
      const item = itemFor(mission, difficulty);
      if (!item) return null;
      const translated = (field, fallback) => {
        const value = item.translations[field];
        return getLocale() !== 'en' && value?.source === fallback ? t(value.key) : fallback;
      };
      return Object.freeze({
        challenge: t('interface:missionLibrary.challenge', {
          band: item.band,
          difficulty: t(`interface:missionLibrary.difficulty.${difficulty}`),
        }),
        route: translated('routeDecision', item.route),
        mastery: translated('mastery', item.mastery),
      });
    },
  });
}

async function readView(descriptor, options) {
  current(options);
  const key = options.fetchAsset ?? globalThis.fetch;
  if (typeof key !== 'function') throw new TypeError('Team display needs an asset reader.');
  let cache = readyByFetcher.get(key);
  if (!cache) readyByFetcher.set(key, (cache = new Map()));
  if (cache.has(descriptor)) {
    current(options);
    return cache.get(descriptor);
  }
  const payload = await readPublishedSnapshot(descriptor, options);
  current(options);
  const view = displayView(payload, descriptor);
  current(options);
  cache.set(descriptor, view);
  return view;
}

/** Async browsing for Solo only. Receiving Team still validates every exact
 * launch handoff and resolves its native preset. Missing/stale data rejects into
 * the existing opening Retry owner; there is deliberately no compiler fallback.
 */
async function createSources({
  launch,
  difficulty = () => 'standard',
  fetchAsset,
  signal,
  assertCurrent,
}) {
  if (typeof launch !== 'function') throw new TypeError('Team browsing needs an exact handoff.');
  const options = { fetchAsset, signal, assertCurrent },
    views = new Map();
  for (const descriptor of REMOTE_TEAM_NAVIGATION) {
    views.set(descriptor.target, await readView(descriptor, options));
  }
  current(options);
  const label = {
    cultural: () => t('interface:missionLibrary.team.journeyEdition'),
    expedition: () => t('interface:expeditions.team'),
    hunt: () => huntText('lessons'),
  };
  const sources = new Map(
    REMOTE_TEAM_NAVIGATION.map((descriptor) => {
      const view = views.get(descriptor.target),
        editionLabel = label[descriptor.target];
      const source = journeyLibrarySource({
        editionId: descriptor.editionId,
        edition: editionLabel(),
        editionLabel,
        lifecycle:
          classifyContent({ family: 'team', id: descriptor.editionId }) === 'archived'
            ? 'archive'
            : 'current',
        catalog: view.catalog,
        tags: (mission) => view.tags(mission, difficulty()),
        card: (mission) => view.card(mission, difficulty()),
        details: (mission) => view.details(mission, difficulty()),
        launch(mission, context) {
          if (!view.has(mission, difficulty()))
            throw new Error(t('errors:missionLibrary.teamMissionUnavailable'));
          return launch(context);
        },
      });
      return [
        descriptor.target,
        Object.freeze({
          ...source,
          id: teamJourneyLibraryOwner(descriptor.editionId),
          ...(descriptor.target === 'hunt' ? { automaticContinuation: false } : {}),
        }),
      ];
    }),
  );
  if (!validateCoopPack(COOP_STARTER_PACK).valid)
    throw new Error('The retained Team arenas failed validation.');
  const rows = COOP_STARTER_PACK.levels.map((level) =>
    Object.freeze({
      title: level.name,
      packName: COOP_STARTER_PACK.name,
      goal: coopGoalText(level),
      levelId: level.id,
      level,
      pack: COOP_STARTER_PACK,
      artworkSource: null,
    }),
  );
  current(options);
  return Object.freeze([
    sources.get('expedition'),
    sources.get('hunt'),
    sources.get('cultural'),
    teamArenaLibrarySource({ rows, launch: (_row, context) => launch(context) }),
  ]);
}

export async function loadRemoteTeamLibrarySources(options = {}) {
  try {
    return await createSources(options);
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    // Retirement is still authoritative even when the transport failed first.
    current(options);
    throw new Error(t('interface:missionsCouldNotLoadChooseMissionsToRetry'), { cause });
  }
}
