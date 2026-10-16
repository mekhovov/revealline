/** Read-only source inventory for the multiplayer expansion plan.
 * Run from the repository root; stdout is JSON. Counts are source entries,
 * never certification of player visibility, distinct geometry or playability.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createAuthoredJourneyRoute } from '../game/content-design/route.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../game/content-design/mode-href.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { resolveContentJourney } from '../game/content-design/journey.mjs';

const teamFactories = [
  ['team-expedition-v1', 'multiplayer-expansion', 'createTeamExpansionCandidates'],
  ['team-greybox', 'team-journey-candidates', 'createTeamJourneyCandidates', {}],
  ['team-originals', 'team-journey-candidates', 'createTeamJourneyCandidates', { artwork: true }],
  ['team-pressure-originals-1', 'team-pressure-originals', 'createTeamPressureOriginalCandidates'],
  ['team-spatial-originals-1', 'team-spatial-originals', 'createTeamSpatialOriginalCandidates'],
  ['team-trail-impact-originals-1', 'team-impact-originals', 'createTeamImpactOriginalCandidates'],
  [
    'team-specialist-originals-1',
    'team-specialist-originals',
    'createTeamSpecialistOriginalCandidates',
  ],
  [
    'team-complete-specialist-originals-1',
    'team-complete-specialist-originals',
    'createTeamCompleteSpecialistOriginalCandidates',
  ],
  [
    'team-cultural-specialist-originals-1',
    'team-cultural-specialist-originals',
    'createTeamCulturalSpecialistOriginalCandidates',
  ],
  [
    'team-cultural-specialist-originals-2',
    'team-cultural-specialist-v2-originals',
    'createTeamCulturalSpecialistV2OriginalCandidates',
  ],
  ['team-timed-originals', 'team-timed-originals', 'createTeamTimedOriginalCandidates'],
  [
    'team-window-spatial-1',
    'team-window-spatial-candidates',
    'createTeamWindowSpatialCandidates',
    { artwork: true },
  ],
  [
    'team-depot-spatial-1',
    'team-depot-spatial-candidates',
    'createTeamDepotSpatialCandidates',
    { artwork: true },
  ],
  ['humanoid-hunt-v1', 'team-hunt-training-candidates', 'createTeamHuntTrainingCandidates'],
  ['pursuit-pilots-v1', 'pursuit-pilot-candidates', 'createPursuitPilotCandidates', { team: true }],
  [
    'pursuit-campaigns-v1',
    'pursuit-campaign-candidates',
    'createPursuitCampaignCandidates',
    { team: true },
  ],
  ['snake-hunt-v1', 'team-snake-hunt-candidates', 'createTeamSnakeHuntCandidates'],
];
const unique = (values) => [...new Set(values)].sort();
const tally = (values) =>
  Object.fromEntries(
    unique(values).map((value) => [value, values.filter((item) => item === value).length]),
  );
const activeMissions = (source, mode) => {
  const campaignIds = new Set(
    source.packs.filter((pack) => !pack.archived).flatMap((pack) => pack.campaignIds),
  );
  const missionIds = new Set(
    source.campaigns
      .filter((campaign) => !campaign.archived && campaignIds.has(campaign.id))
      .flatMap((campaign) => campaign.missionIds),
  );
  return source.missions.filter(
    (mission) => !mission.archived && missionIds.has(mission.id) && mission.modes.includes(mode),
  );
};
function sourceSummary(source, routeId, mode) {
  const missions = activeMissions(source, mode);
  return {
    routeId,
    mode,
    defaultRoute: DEFAULT_JOURNEY_ROUTES[mode] === routeId,
    projectId: source.id,
    projectRevision: source.revision,
    missionCount: missions.length,
    roles: unique(missions.flatMap((mission) => mission.actors.map((actor) => actor.role))),
    missionFormats: tally(missions.map((mission) => mission.format)),
    teamFormats: tally(missions.flatMap((mission) => (mission.team ? [mission.team.format] : []))),
  };
}
function compiledInventory(source, routeId, mode, detailed = false) {
  const journey = resolveContentJourney(source, { mode, difficulty: 'standard' });
  return {
    ...sourceSummary(source, routeId, mode),
    validationScope: 'Standard compiler resolution; no command-route or human playtest claim',
    campaigns: journey.campaigns.map(({ runtime, manifests }) => ({
      id: runtime.id,
      name: runtime.title ?? runtime.name,
      levelCount: runtime.levels.length,
      versions: unique(runtime.levels.map((level) => level.version)),
      diagnosticErrors: manifests.flatMap((manifest) =>
        manifest.diagnostics.filter((item) => item.severity === 'error'),
      ),
      ...(detailed
        ? {
            levels: runtime.levels.map((level, index) => ({
              id: level.id,
              name: level.name,
              version: level.version,
              width: level.width,
              height: level.height,
              goal: level.goal,
              enemies: tally(level.enemies.map((enemy) => enemy.type)),
              roles: source.missions
                .find((mission) => mission.id === manifests[index].missionId)
                ?.actors.map((actor) => actor.role),
              routeDecision: manifests[index].design.routeDecision,
              lesson: manifests[index].design.lesson,
              simulationIdentity: manifests[index].simulationIdentity,
              diagnosticErrors: manifests[index].diagnostics.filter(
                (item) => item.severity === 'error',
              ),
            })),
          }
        : {}),
    })),
  };
}

const routes = [],
  defaults = [],
  supplemental = [];
for (const id of AUTHORED_JOURNEY_ROUTE_IDS) {
  const { source } = createAuthoredJourneyRoute(id);
  for (const mode of ['solo', 'versus']) {
    if (!activeMissions(source, mode).length) continue;
    routes.push(sourceSummary(source, id, mode));
    if (DEFAULT_JOURNEY_ROUTES[mode] === id)
      defaults.push(compiledInventory(source, id, mode, mode === 'solo'));
    if (
      [
        'duel-expedition-v1',
        'humanoid-hunt-v1',
        'pursuit-pilots-v1',
        'pursuit-campaigns-v1',
        'snake-hunt-v1',
      ].includes(id)
    )
      supplemental.push(compiledInventory(source, id, mode));
  }
}
for (const [id, moduleName, factory, options] of teamFactories) {
  const module = await import(`../game/content-design/${moduleName}.mjs`);
  const source = module[factory](options);
  routes.push(sourceSummary(source, id, 'team'));
  if (DEFAULT_JOURNEY_ROUTES.team === id)
    defaults.push(compiledInventory(source, id, 'team', true));
  if (
    [
      'humanoid-hunt-v1',
      'pursuit-pilots-v1',
      'pursuit-campaigns-v1',
      'snake-hunt-v1',
      'team-depot-spatial-1',
      'team-expedition-v1',
    ].includes(id)
  )
    supplemental.push(compiledInventory(source, id, 'team'));
}
const index = JSON.parse(
  readFileSync(new URL('../game/content/mission-library-index.json', import.meta.url)),
).missions;
const baselineArenas = JSON.parse(
  readFileSync(new URL('../authoring/coop/starter-pack.recipe.json', import.meta.url)),
).levels;
const result = {
  format: 'revealline-multiplayer-source-audit.v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope:
    'Registered territory Journey routes, their Team counterparts, default Standard runtime projections, Classic source index, and starter Team recipes. Local imports, company editions and standalone optional games are not aggregated into core-mode totals.',
  countingPolicy:
    'Default, supplemental and historical route counts overlap. Never sum route editions, difficulties, artwork variants or the Classic index into a unique-level total. Raw route rows are source inventory only.',
  defaultRoutes: DEFAULT_JOURNEY_ROUTES,
  defaults,
  supplemental,
  classicIndex: {
    totalRows: index.length,
    modes: tally(index.flatMap((row) => row.modes)),
    sources: tally(index.map((row) => row.source)),
  },
  legacyTeamRecipes: baselineArenas.map(({ id, name, template }) => ({ id, name, template })),
  registeredRoutes: routes,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
