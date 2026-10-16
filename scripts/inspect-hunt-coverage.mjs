import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createAuthoredJourneyRoute } from '../game/content-design/route.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { authoredJourneyUsesActorMaterials } from '../game/content-design/mode-href.mjs';
import {
  createEncounterSoloHost,
  createEncounterVersusHost,
} from '../game/content-design/encounter-host.mjs';
import { createCandidateTeamHost } from '../game/content-design/team-host.mjs';
import { createTeamCulturalSpecialistV2OriginalCandidates } from '../game/content-design/team-cultural-specialist-v2-originals.mjs';
import { createTeamHuntTrainingCandidates } from '../game/content-design/team-hunt-training-candidates.mjs';
import { journeyActorThemeCandidates } from '../game/presentation/journey-actor-materials.mjs';
import { ENCOUNTER_VARIANTS } from '../game/hunt/preferences.mjs';
import { deriveEncounterLevel } from '../game/hunt/variants.mjs';

// A structural content inspection, not a gameplay suite or human-play approval.
const originalThemes = JSON.parse(
  await readFile(new URL('../game/content-design/themes.json', import.meta.url)),
).themes;
const routes = [];
for (const routeId of [DEFAULT_JOURNEY_ROUTES.solo, 'humanoid-hunt-v1']) {
  const route = createAuthoredJourneyRoute(routeId);
  const themes = authoredJourneyUsesActorMaterials(routeId)
    ? journeyActorThemeCandidates(originalThemes, {
        includeOriginals: route.preserveOriginalThemes === true,
      })
    : originalThemes;
  for (const mode of ['solo', 'versus']) {
    let variant = 'authored';
    const started = performance.now();
    const host = (mode === 'solo' ? createEncounterSoloHost : createEncounterVersusHost)(
      route.source,
      {
        themes,
        corePackIds: route.corePackIds,
        optionalCampaignIds: route.optionalCampaignIds,
        getEncounterVariant: () => variant,
      },
    );
    const startupMilliseconds = Math.round(performance.now() - started);
    const missions = host.catalog.missions.map((mission) => ({
      id: mission.id,
      name: mission.name,
      availableVariants: [],
      variants: {},
    }));
    for (variant of ENCOUNTER_VARIANTS) {
      host.ensureVariant(variant);
      for (const [index, mission] of host.catalog.missions.entries()) {
        if (!host.availableVariants(mission).includes(variant)) continue;
        const selection = (host.select ?? host.row)(mission, 'standard');
        if (!selection.encounterVariants.includes(variant)) continue;
        const level =
          mode === 'solo'
            ? selection.campaign.levels.find((level) => level.id === mission.levelId)
            : selection.level;
        missions[index].availableVariants.push(variant);
        missions[index].variants[variant] = {
          levelVersion: level.version,
          mode: level.classic?.hunt?.mode ?? null,
          targets: level.classic?.hunt?.targets.length ?? 0,
          quota: level.classic?.hunt?.quota ?? null,
        };
      }
    }
    routes.push({
      routeId,
      mode,
      qualification: 'structural',
      humanPlay: 'pending',
      startupMilliseconds,
      count: missions.length,
      countsByVariant: Object.fromEntries(
        ENCOUNTER_VARIANTS.map((variant) => [
          variant,
          missions.filter((mission) => mission.availableVariants.includes(variant)).length,
        ]),
      ),
      errors: host.variantErrors,
      missions,
    });
    host.preparer?.dispose();
    process.stdout.write(
      `${routeId} ${mode}: ${missions.length} missions; authored startup ${startupMilliseconds}ms\n`,
    );
  }
}
for (const [routeId, source] of [
  [DEFAULT_JOURNEY_ROUTES.team, createTeamCulturalSpecialistV2OriginalCandidates()],
  ['humanoid-hunt-v1', createTeamHuntTrainingCandidates()],
]) {
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const missions = host.catalog.missions.map((mission) => {
    const original = host.row(mission, 'standard').level,
      variants = {},
      errors = {};
    for (const variant of ENCOUNTER_VARIANTS) {
      try {
        const level = deriveEncounterLevel(original, variant, { mode: 'team' });
        if (level)
          variants[variant] = {
            levelVersion: level.version,
            mode: level.hunt?.mode ?? null,
            targets: level.hunt?.targets.length ?? 0,
            quota: level.hunt?.quota ?? null,
          };
      } catch (error) {
        errors[variant] = error.message;
      }
    }
    return {
      id: mission.id,
      name: mission.name,
      availableVariants: Object.keys(variants),
      variants,
      ...(Object.keys(errors).length ? { errors } : {}),
    };
  });
  routes.push({
    routeId,
    mode: 'team',
    qualification: 'structural',
    humanPlay: 'pending',
    count: missions.length,
    countsByVariant: Object.fromEntries(
      ENCOUNTER_VARIANTS.map((variant) => [
        variant,
        missions.filter((mission) => mission.availableVariants.includes(variant)).length,
      ]),
    ),
    missions,
  });
  process.stdout.write(`${routeId} team: ${missions.length} missions\n`);
}
const output = {
  format: 'humanoid-hunt-structural-coverage.v1',
  qualification: 'structural',
  humanPlay: 'pending',
  automatedSuites: 'WAIVED_SKIPPED_NOT_PASSED',
  notes: [
    'Compilation, initial geometry and finite population admission only.',
    'No simulation playthrough, route completion, controller, difficulty balance or performance qualification is implied.',
    'Default authored routes and previous progress keys remain unchanged.',
  ],
  routes,
};
await writeFile(
  new URL('../docs/humanoid-hunt-coverage.json', import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);
