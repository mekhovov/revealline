import { boundedJSON, required } from "../data-json.mjs";
import { validateTheme } from "../content.mjs";
import { loadAuthoredJourneyRoute } from "../content-design/route-loader.mjs";
import { createContentExecutionCatalog } from "../content-design/execution.mjs";
import { compileContentProject } from "../content-design/project.mjs";
import { createJourneyCatalog } from "../journey/catalog.mjs";
import { createMissionCard } from "../content-design/mission-card.mjs";
import { journeyActorThemeCandidates } from "../presentation/journey-actor-materials.mjs";
import { WHOLE_JOURNEY_REMIX_PACK_IDS } from "../content-design/whole-journey-order.mjs";
import { journeyLibrarySource } from "./journey-source.mjs";
import { combineJourneyLibrarySources } from "./cross-mode-journey.mjs";
import { journeyMissionDetails } from "./journey-presentation.mjs";

const REVISED_MISSIONS = new Set([
  "two-bays",
  "neon-remix",
  "broken-yard",
  "read-the-arrows",
  "twin-receivers",
  "crossing-complete",
]);
const ALTERNATE = Object.freeze({
  "whole-spatial-v6": {
    routeId: "whole-spatial-v5",
    label: "Previous Journey · v5",
  },
  "whole-spatial-v5": {
    routeId: "whole-spatial-v6",
    label: "Spatial challenge · balance pending",
  },
});

/** Only the six changed editions, with their original runtime and display IDs.
 * Compilation qualifies each mode independently; browsing does not construct a
 * preparer, fetch artwork or decode pictures. These browse-only alternatives
 * cannot become an automatic boundary successor; manual Play still enters the
 * receiving host's complete authored sequence.
 * An optional profile must belong to the ALTERNATE edition, never the active one.
 */
export async function createSpatialEditionSources({
  activeRouteId,
  originalThemes,
  difficulty = () => "standard",
  launch,
  profile,
} = {}) {
  const alternate = Object.hasOwn(ALTERNATE, activeRouteId)
    ? ALTERNATE[activeRouteId]
    : null;
  if (!alternate)
    return Object.freeze({ sources: Object.freeze([]), dispose() {} });
  required(
    typeof launch === "function",
    "Spatial editions need an exact mission handoff.",
  );
  required(
    typeof difficulty === "function",
    "Spatial editions need the selected preset.",
  );
  required(
    profile === undefined || typeof profile?.snapshot === "function",
    "Spatial edition progress needs its own profile.",
  );
  const route = await loadAuthoredJourneyRoute(alternate.routeId);
  const originals = boundedJSON(originalThemes, {
    maxBytes: 262144,
    maxNodes: 8192,
    maxDepth: 12,
  });
  required(
    Array.isArray(originals) && originals.length > 0,
    "Candidate themes are required.",
  );
  const themes = journeyActorThemeCandidates(originals, {
    includeOriginals: route.preserveOriginalThemes === true,
  });
  required(
    new Set(themes.map((theme) => theme.id)).size === themes.length &&
      themes.every((theme) => validateTheme(theme).valid),
    "Spatial editions need valid, unique candidate themes.",
  );
  const themeIds = new Set(themes.map((theme) => theme.id));
  const project = compileContentProject(route.source);
  let disposed = false;
  const qualified = ["solo", "versus"].map((mode) => {
    const executions = createContentExecutionCatalog(project, { mode });
    // Construct the full metadata catalogue before filtering. The original
    // campaign position is not the row's position in this six-card library.
    const fullCatalog = createJourneyCatalog(
      executions.journey().campaigns.map(({ packId, runtime, manifests }) => ({
        source: "candidate",
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
        new Set(missions.map((mission) => mission.levelId)).size ===
          REVISED_MISSIONS.size,
      "Spatial edition must contain each of the six original mission owners exactly once.",
    );
    const manifestFor = (mission, preset = difficulty()) =>
      executions
        .select(mission.packId, mission.campaignId, preset)
        ?.manifests.find((item) => item.missionId === mission.levelId);
    for (const mission of missions)
      for (const preset of ["gentle", "standard", "expert"]) {
        const manifest = manifestFor(mission, preset);
        required(
          manifest?.background && themeIds.has(manifest.presentation.themeId),
          "Spatial edition needs its exact authored theme and original.",
        );
      }
    const source = journeyLibrarySource({
      editionId: route.id,
      edition: alternate.label,
      catalog: { missions },
      profile,
      details: (mission) => journeyMissionDetails(manifestFor(mission)),
      card: (mission) => createMissionCard(manifestFor(mission)),
      tags: (mission) =>
        WHOLE_JOURNEY_REMIX_PACK_IDS.includes(mission.packId) ? ["Remix"] : [],
      launch: (_mission, context) => {
        if (disposed || context?.isCurrent?.() === false) return false;
        // The combined adapter validates this exact display identity and mode.
        // Preserve continuation, return and departure guards without rebuilding
        // the context or selecting an identically named active-edition mission.
        return launch(context);
      },
    });
    return {
      mode,
      source: {
        ...source,
        ...(profile === undefined ? { progress: () => "" } : {}),
        availability: () =>
          disposed
            ? {
                state: "unavailable",
                reason: "This mission library is closed. Reopen missions.",
              }
            : { state: "ready" },
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
