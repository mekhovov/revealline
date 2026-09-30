import { resolveJourneyRequest } from '../../game/content-design/default-entry.mjs';
import { compileContentProject, resolveMission } from '../../game/content-design/project.mjs';
import { canonicalJSON } from '../../game/data-json.mjs';

export const BENCHMARK_MISSIONS = Object.freeze([
  Object.freeze({
    id: 'first-return',
    purpose: 'Introductory capture',
    cue: 'From the starting edge, steer down to make a first return.',
  }),
  Object.freeze({
    id: 'return-in-reserve',
    purpose: 'Trail pursuit',
    cue: 'Compare the carrier warning, pursuit and live-line impact while making a return.',
  }),
  Object.freeze({
    id: 'crossed-bands',
    purpose: 'Heading interception',
    cue: 'Compare the locked interception warning while choosing a safe return route.',
  }),
]);

/** Source-only authoring entry: the current resolver chooses the route, while
 * its original factory keeps this tool independent of published save hosts. */
export async function loadBenchmarkCatalog() {
  const routeId = resolveJourneyRequest(new URLSearchParams(), { mode: 'solo' });
  const { createAuthoredJourneyRoute } = await import('../../game/content-design/route.mjs');
  const route = createAuthoredJourneyRoute(routeId);
  if (!route?.source) throw new Error('Current Solo source is unavailable for this benchmark.');
  const project = compileContentProject(route.source);
  const sourceBytes = new TextEncoder().encode(canonicalJSON(route.source));
  const digest = await crypto.subtle.digest('SHA-256', sourceBytes);
  const sourceSha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const entries = BENCHMARK_MISSIONS.map((descriptor) => {
    const campaign = project.campaigns.find(
      (candidate) => !candidate.archived && candidate.missionIds.includes(descriptor.id),
    );
    const pack =
      campaign &&
      project.packs.find(
        (candidate) =>
          !candidate.archived &&
          route.corePackIds.includes(candidate.id) &&
          candidate.campaignIds.includes(campaign.id),
      );
    if (!pack)
      throw new Error(`Benchmark mission ${descriptor.id} is not in the current core route.`);
    const manifest = resolveMission(project, descriptor.id, {
      mode: 'solo',
      difficulty: 'standard',
    });
    if (!manifest.background)
      throw new Error(`Benchmark mission ${descriptor.id} has no original artwork.`);
    return Object.freeze({ ...descriptor, packId: pack.id, campaignId: campaign.id, manifest });
  });
  let identityAdapter = null;
  let executionCatalog = null;
  return Object.freeze({
    routeId,
    projectId: route.source.id,
    projectRevision: route.source.revision,
    sourceSha256,
    entries: Object.freeze(entries),
    async actorContent(entry, { signal } = {}) {
      if (!entries.includes(entry)) throw new Error('Choose an owned benchmark mission.');
      signal?.throwIfAborted();
      const { createJourneyVisualThemeIdentityAdapter } = await import(
        '../../game/presentation/journey-visual-theme-identities.mjs'
      );
      const { createContentExecutionCatalog } = await import(
        '../../game/content-design/execution.mjs'
      );
      identityAdapter ??= createJourneyVisualThemeIdentityAdapter(route.source, { mode: 'solo' });
      executionCatalog ??= createContentExecutionCatalog(project, { mode: 'solo' });
      const adapter = await identityAdapter;
      return adapter.prepare(
        {
          entry: executionCatalog.select(entry.packId, entry.campaignId, 'standard'),
          level: entry.manifest.level,
          association: {
            editionId: routeId,
            contentThemeId: entry.manifest.presentation.themeId,
            mode: 'solo',
          },
        },
        { signal },
      );
    },
  });
}
