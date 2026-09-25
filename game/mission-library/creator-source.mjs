import {
  installedCreatorManifests,
  loadInstalledCreatorBundle,
  createCreatorStore,
} from '../creator/installed.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { creatorProfileKey } from '../creator/runtime.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';

/** Modern project-backed content is always Custom, even when source IDs or
 * labels match official content. Browsing reads metadata; play verifies bytes. */
export async function installedCreatorLibrarySources({
  store: suppliedStore,
  launch = (href) => {
    location.href = href;
  },
} = {}) {
  const store = suppliedStore ?? createCreatorStore();
  const sources = [];
  let manifests;
  try {
    manifests = await installedCreatorManifests(store);
  } finally {
    if (!suppliedStore) store.close();
  }
  for (const manifest of manifests) {
    const catalog = createContentExecutionCatalog(manifest.content.project, { mode: 'solo' });
    const entries = catalog.journey().missions;
    let progress = null;
    try {
      progress = await createJourneyBackend({
        profileKey: creatorProfileKey(manifest.editionId),
      }).read();
    } catch {
      /* Browsing remains available when progress storage is unavailable. */
    }
    sources.push({
      id: `creator:${manifest.editionId}`,
      editionId: manifest.editionId,
      edition: `${manifest.content.project.name.slice(0, 140)} · ${manifest.editionId.slice(0, 8)}`,
      collection: 'Custom',
      entries,
      describe(mission) {
        const campaign = manifest.content.project.campaigns.find(
          (c) => c.id === mission.campaignId,
        );
        const level = manifest.content.project.missions.find((m) => m.id === mission.levelId);
        return {
          id: level.id,
          revision: level.revision,
          campaignKey: campaign.id,
          campaignTitle: campaign.name,
          name: level.name,
          levelIndex: campaign.missionIds.indexOf(level.id),
          modes: ['solo'],
          tags: [],
          rules: 'Creator template · compiled difficulty presets · exact installed edition',
          hook: level.design.routeDecision,
        };
      },
      availability: () => ({ state: 'ready' }),
      progress: (mission) => (progress?.clears.solo[mission.levelId] ? 'Cleared' : ''),
      async launch(mission, context) {
        const launchStore = suppliedStore ?? createCreatorStore();
        try {
          await loadInstalledCreatorBundle(launchStore, manifest.editionId, {
            signal: context.signal,
          });
        } finally {
          if (!suppliedStore) launchStore.close();
        }
        if (context.signal?.aborted)
          throw new DOMException('Custom mission cancelled.', 'AbortError');
        const href = new URL('./creator/player.html', new URL('../', import.meta.url));
        href.searchParams.set('edition', manifest.editionId);
        href.searchParams.set('mission', mission.levelId);
        return launch(href.href);
      },
    });
  }
  return sources;
}
