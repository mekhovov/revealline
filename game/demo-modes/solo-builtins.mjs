import { SOLO_BUILTIN_DEMO_INDEX } from './solo-builtins-index.mjs';
import { loadDemoCatalog, resolveDemoCatalog } from '../demo-catalog.mjs';
import { loadDemoSources } from '../demo-sources.mjs';
import { campaignKey } from '../library.mjs';
import { missionLibraryHref } from '../mission-library/handoff.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { authoredJourneyUsesActorMaterials } from '../content-design/mode-href.mjs';
import { loadBuiltinClassicSoloDemoSources } from './solo-classic-builtins.mjs';
import { createSoloDemoSourceOwner } from './solo-source-owner.mjs';

const catalogPaths = ['journey-current', 'journey-archive'];

/** These are finite authored chooser identities, not new pack installation
 * authority. Compilation and recording bodies are deferred until selection. */
export async function loadBuiltinSoloDemoSources({
  signal,
  fetch: fetcher = globalThis.fetch,
  index,
} = {}) {
  const results = await Promise.allSettled([
    loadBuiltinClassicSoloDemoSources({ signal, fetch: fetcher, index }),
    loadBuiltinJourneySoloDemoSources({ signal, fetch: fetcher }),
  ]);
  signal?.throwIfAborted();
  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

export async function loadBuiltinJourneySoloDemoSources({
  signal,
  fetch: fetcher = globalThis.fetch,
} = {}) {
  const results = await Promise.allSettled(
    catalogPaths.map((group) =>
      loadDemoCatalog({
        signal,
        fetch: fetcher,
        catalogURL: new URL(`../demo-data/catalog.${group}.json`, import.meta.url),
      }),
    ),
  );
  signal?.throwIfAborted();
  // Offline or stale metadata can make a bounded authored group unavailable;
  // ordinary installed Solo sources still remain usable. Qualification audits
  // these same shards independently and never treat runtime skipping as proof.
  const catalogs = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  return catalogs.flatMap((catalog) =>
    catalog.clips.flatMap((clip) => {
      const metadata = SOLO_BUILTIN_DEMO_INDEX.find(
        (row) =>
          row.id === clip.id &&
          row.campaignKey === clip.campaignKey &&
          row.levelId === clip.levelId,
      );
      if (!metadata) return [];
      const owner = createSoloDemoSourceOwner(
        Object.freeze({ id: clip.levelId, name: clip.title }),
      );
      return [
        {
          ...clip,
          modeId: 'solo',
          kind: 'replay',
          levelKey: metadata.levelKey,
          variantId: 'standard',
          approachable: metadata === SOLO_BUILTIN_DEMO_INDEX[0],
          get entry() {
            return owner.entry;
          },
          get level() {
            return owner.level;
          },
          get journeyContext() {
            return owner.entry
              ? {
                  editionId: metadata.routeId,
                  missionId: metadata.missionId,
                  entries: [owner.entry],
                  profile: null,
                  pictures: null,
                }
              : null;
          },
          get launchURL() {
            return missionLibraryHref({
              baseURL: new URL('../', import.meta.url).href,
              currentMode: 'solo',
              mode: 'solo',
              journey: metadata.routeId,
              missionId: metadata.libraryMissionId,
              ready: true,
            });
          },
          async create({ signal }) {
            signal?.throwIfAborted();
            const [{ loadAuthoredJourneyRoute }, { createSoloRouteHost }, response] =
              await Promise.all([
                import('../content-design/route-loader.mjs'),
                import('../content-design/solo-route-host.mjs'),
                fetcher(new URL('../content-design/themes.json', import.meta.url), { signal }),
              ]);
            if (!response.ok) throw new Error('Authored Solo presentation is unavailable.');
            const originals = (await response.json()).themes;
            const route = await loadAuthoredJourneyRoute(metadata.routeId, {
              fullSource: true,
              signal,
            });
            signal?.throwIfAborted();
            const themes = authoredJourneyUsesActorMaterials(route.id)
              ? journeyActorThemeCandidates(originals, {
                  includeOriginals: route.preserveOriginalThemes === true,
                })
              : originals;
            const host = await createSoloRouteHost(route, { themes, buildVersion: 'demo', signal });
            try {
              signal?.throwIfAborted();
              const candidate = host.entries.find(
                (value) =>
                  value.difficulty === 'standard' &&
                  campaignKey(value.campaign) === clip.campaignKey,
              );
              const resolved =
                candidate &&
                resolveDemoCatalog({ format: catalog.format, clips: [clip] }, [candidate])[0];
              if (!resolved)
                throw Object.assign(new Error('Authored Solo demonstration content has changed.'), {
                  code: 'content-mismatch',
                });
              const [source] = await loadDemoSources({
                entries: [candidate],
                catalogs: [{ format: catalog.format, clips: [clip] }],
                signal,
                fetch: fetcher,
                library: { list: async () => [] },
                WorkerClass: null,
              });
              const player = await source.create({ signal });
              try {
                signal?.throwIfAborted();
              } catch (error) {
                player.dispose();
                throw error;
              }
              return owner.adopt(player, {
                entry: candidate,
                level: resolved.level,
                signals: [signal],
              });
            } finally {
              host.preparer.dispose();
            }
          },
        },
      ];
    }),
  );
}

/** Existing recordings and live variety retain their ordinary owners. A lazy
 * authored replay only fills a missing source ID, never replaces a whole level. */
export function mergeBuiltinSoloDemoSources(existing, builtin) {
  const ids = new Set(existing.map((source) => source.id));
  return [...existing, ...builtin.filter((source) => !ids.has(source.id))];
}
