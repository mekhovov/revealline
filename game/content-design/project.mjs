import { boundedJSON, exactKeys, required, stableId, dataIdentity } from '../data-json.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { CLASSES, rosterHash } from '../core/registry.mjs';
import { compileMapDesign } from './map.mjs';
import { compileAssetRevision } from './assets.mjs';
import { inspectMissionTopology } from './diagnostics.mjs';
import { resolveTeamMission } from './team-runtime.mjs';
import { CONTENT_PROJECT_JSON_LIMITS, CONTENT_PROJECT_ITEM_LIMITS } from './limits.mjs';
import {
  journeyPolicy,
  journeyActors,
  DIFFICULTY_CATALOG,
  compileActor,
  journeyPreset,
  freezeDesign,
} from './catalogs.mjs';

const compiledProjects = new WeakSet();
const text = (value, max = 512) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
function identity(value, format, extras) {
  exactKeys(value, ['format', 'id', 'revision', 'name', ...extras], format);
  required(
    value.format === format &&
      stableId(value.id) &&
      text(value.name, 160) &&
      text(value.revision, 80),
    `Invalid ${format} identity.`,
  );
}
function unique(values, label, max = 512) {
  required(Array.isArray(values) && values.length <= max, `${label} exceeds its item budget.`);
  const ids = new Set();
  for (const value of values) {
    required(stableId(value.id) && !ids.has(value.id), `${label} requires unique stable IDs.`);
    ids.add(value.id);
  }
  return ids;
}
function archiveFlag(value) {
  required(
    value.archived === undefined || typeof value.archived === 'boolean',
    'Archive state must be an explicit boolean.',
  );
}
function refs(values, available, label) {
  required(
    Array.isArray(values) &&
      new Set(values).size === values.length &&
      values.every((id) => available.has(id)),
    `${label} has duplicate or missing references.`,
  );
}
function checkDesign(design) {
  exactKeys(
    design,
    [
      'routeDecision',
      'lesson',
      'counterplay',
      'captureConsequence',
      'introduces',
      'practices',
      'combines',
      'memorableMoment',
      'mastery',
      'durationSeconds',
      'difficulty',
    ],
    'mission design',
  );
  for (const key of [
    'routeDecision',
    'lesson',
    'counterplay',
    'captureConsequence',
    'memorableMoment',
    'mastery',
  ])
    required(text(design[key]), `Mission needs ${key}.`);
  for (const key of ['introduces', 'practices', 'combines'])
    required(
      Array.isArray(design[key]) &&
        design[key].length <= 12 &&
        design[key].every(stableId) &&
        new Set(design[key]).size === design[key].length,
      `Invalid ${key} mechanic references.`,
    );
  required(design.introduces.length <= 1, 'Introduce at most one mandatory rule per mission.');
  required(
    Array.isArray(design.durationSeconds) &&
      design.durationSeconds.length === 2 &&
      integer(design.durationSeconds[0], 10, 600) &&
      integer(design.durationSeconds[1], design.durationSeconds[0], 600),
    'Invalid duration range.',
  );
  const facets = [
    'band',
    'planning',
    'execution',
    'threatDensity',
    'timePressure',
    'mechanicLoad',
    'coordination',
  ];
  exactKeys(design.difficulty, facets, 'difficulty facets');
  for (const key of facets)
    required(integer(design.difficulty[key], key === 'band' ? 1 : 0, 12), `Invalid ${key} rating.`);
}

/** One owned project registry for authoring, CLI, preview and runtime adapters.
 * Compilation validates a candidate; it does not publish it or authorize clears. */
export function compileContentProject(source) {
  // Only this module can mint an owned, fully frozen compiled project. Reuse it
  // across preset projections; a copied or imported lookalike must validate anew.
  if (compiledProjects.has(source)) return source;
  const project = boundedJSON(source, CONTENT_PROJECT_JSON_LIMITS);
  identity(project, 'ContentProjectV1', [
    'policyId',
    'actorCatalogId',
    'difficultyCatalogId',
    'maps',
    'missions',
    'campaigns',
    'packs',
    'assets',
  ]);
  const policy = journeyPolicy(project.policyId);
  required(
    stableId(project.actorCatalogId),
    'Project needs an explicit registered actor catalogue ID.',
  );
  const actors = journeyActors(project.actorCatalogId);
  required(
    project.difficultyCatalogId === DIFFICULTY_CATALOG.id,
    'Project must pin registered policy and catalogs.',
  );
  required(
    Array.isArray(project.maps) && project.maps.length <= CONTENT_PROJECT_ITEM_LIMITS.maps,
    'Map revision budget exceeded.',
  );
  const mapIds = new Set(project.maps.map((map) => JSON.stringify([map.id, map.revision])));
  required(mapIds.size === project.maps.length, 'Map revisions must be unique.');
  const missionIds = unique(project.missions, 'missions', CONTENT_PROJECT_ITEM_LIMITS.missions);
  const campaignIds = unique(project.campaigns, 'campaigns', CONTENT_PROJECT_ITEM_LIMITS.campaigns);
  unique(project.packs, 'packs', CONTENT_PROJECT_ITEM_LIMITS.packs);
  unique(project.assets ?? [], 'assets', CONTENT_PROJECT_ITEM_LIMITS.assets);
  const assets = (project.assets ?? []).map(compileAssetRevision);
  const maps = project.maps.map(compileMapDesign);
  for (const mission of project.missions) {
    const directional = mission.format === 'MissionDesignV3';
    const relays = mission.format === 'MissionDesignV2' || directional;
    identity(
      mission,
      directional ? 'MissionDesignV3' : relays ? 'MissionDesignV2' : 'MissionDesignV1',
      [
        'map',
        'spawnId',
        'modes',
        'actors',
        'objectives',
        'bonuses',
        'coverage',
        'timeLimitSeconds',
        'design',
        'presentation',
        'archived',
        'team',
        ...(relays ? ['relayLinks'] : []),
      ],
    );
    archiveFlag(mission);
    exactKeys(mission.map, ['id', 'revision'], 'mission map');
    required(
      mapIds.has(JSON.stringify([mission.map.id, mission.map.revision])),
      'Mission map revision is missing.',
    );
    const map = maps.find(
      (map) => map.source.id === mission.map.id && map.source.revision === mission.map.revision,
    );
    required(
      map.source.format === (directional ? 'MapDesignV3' : relays ? 'MapDesignV2' : 'MapDesignV1'),
      'Mission and map geometry editions must match.',
    );
    required(stableId(mission.spawnId), 'Mission needs a named spawn.');
    required(
      Array.isArray(mission.modes) &&
        mission.modes.length > 0 &&
        new Set(mission.modes).size === mission.modes.length &&
        mission.modes.every((mode) => ['solo', 'versus', 'team'].includes(mode)),
      'Unsupported or unqualified mission mode.',
    );
    required(
      mission.modes.includes('team') ? mission.team !== undefined : mission.team === undefined,
      'Team mode needs an explicit Team mission definition.',
    );
    unique(mission.actors, 'actors', 24);
    unique(mission.objectives, 'objectives', 40);
    unique(mission.bonuses, 'bonuses', 64);
    if (relays) {
      required(!mission.modes.includes('team'), 'Relay missions are not qualified for Team.');
      required(
        Array.isArray(mission.relayLinks) &&
          mission.relayLinks.length === map.geometry.gates.length,
        'Every gate needs exactly one objective link.',
      );
      const linked = new Set();
      for (const link of mission.relayLinks) {
        exactKeys(link, ['gateId', 'objectiveId'], 'relay link');
        required(
          stableId(link.gateId) &&
            map.geometry.gates.some((gate) => gate.id === link.gateId) &&
            !linked.has(link.gateId),
          'Relay links need unique existing gate IDs.',
        );
        required(
          stableId(link.objectiveId) &&
            mission.objectives.some((objective) => objective.id === link.objectiveId),
          'Relay link objective is missing.',
        );
        linked.add(link.gateId);
      }
    }
    required(finite(mission.coverage, 0.01, 1), 'Mission coverage must be 0.01..1.');
    required(
      integer(mission.timeLimitSeconds, 0, 600),
      'Mission countdown must be explicit 0..600 seconds.',
    );
    checkDesign(mission.design);
    exactKeys(mission.presentation, ['themeId', 'backgroundAssetId'], 'presentation');
    required(stableId(mission.presentation.themeId), 'Mission needs a presentation theme.');
    required(
      mission.presentation.backgroundAssetId === null ||
        assets.some((asset) => asset.id === mission.presentation.backgroundAssetId),
      'Missing pinned background asset revision.',
    );
  }
  for (const campaign of project.campaigns) {
    identity(campaign, 'CampaignDesignV1', ['band', 'missionIds', 'archived']);
    archiveFlag(campaign);
    required(integer(campaign.band, 1, 12), 'Campaign needs a challenge band.');
    refs(campaign.missionIds, missionIds, 'Campaign missions');
    for (const id of campaign.missionIds) {
      const band = project.missions.find((mission) => mission.id === id).design.difficulty.band;
      required(
        band >= campaign.band && band <= Math.min(12, campaign.band + 1),
        'Mission band must fit its campaign.',
      );
    }
  }
  for (const pack of project.packs) {
    identity(pack, 'PackDesignV1', ['campaignIds', 'archived']);
    archiveFlag(pack);
    refs(pack.campaignIds, campaignIds, 'Pack campaigns');
  }
  const resolved = freezeDesign({
    format: 'ResolvedContentProjectV1',
    source: project,
    maps,
    missions: project.missions,
    campaigns: project.campaigns,
    packs: project.packs,
    policy,
    actors,
    difficulty: DIFFICULTY_CATALOG,
    assets,
  });
  compiledProjects.add(resolved);
  try {
    for (const mission of project.missions)
      for (const difficulty of Object.keys(DIFFICULTY_CATALOG.presets))
        for (const mode of mission.modes)
          resolveMission(resolved, mission.id, { difficulty, mode });
  } catch (error) {
    compiledProjects.delete(resolved);
    throw error;
  }
  return resolved;
}

export function resolveMission(project, id, { mode = 'solo', difficulty = 'standard' } = {}) {
  required(compiledProjects.has(project), 'Compile the source project before resolving a mission.');
  const mission = project.missions.find((candidate) => candidate.id === id);
  required(mission && mission.modes.includes(mode), 'Mission does not support this mode.');
  const preset = journeyPreset(difficulty);
  const policy = project.policy;
  const map = project.maps.find(
    (candidate) =>
      candidate.source.id === mission.map.id && candidate.source.revision === mission.map.revision,
  );
  if (mode === 'team') return resolveTeamMission(project, mission, map, difficulty);
  const spawn = map.geometry.spawns.find((candidate) => candidate.id === mission.spawnId);
  required(spawn, 'Mission spawn is missing from its map revision.');
  const carriers = mission.actors.filter((actor) => actor.role === 'impact-carrier');
  const directional = mission.format === 'MissionDesignV3';
  const relays = mission.format === 'MissionDesignV2' || directional;
  const level = normalizedLevel({
    version: directional ? 'xonix-level.v7' : relays ? 'xonix-level.v6' : 'xonix-level.v5',
    id: mission.id,
    revision: mission.revision,
    name: mission.name,
    width: map.geometry.width,
    height: map.geometry.height,
    spawn: { x: spawn.x, y: spawn.y },
    walls: map.source.walls ?? [],
    foundations: map.source.foundations ?? [],
    ...(relays
      ? {
          relayGates: {
            version: 'relay-gates.v1',
            gates: map.source.gates.map((gate) => ({
              ...gate,
              objectiveId: mission.relayLinks.find((link) => link.gateId === gate.id).objectiveId,
            })),
          },
        }
      : {}),
    goal: { coverage: mission.coverage },
    ...(directional
      ? { directionalFields: { version: 'directional-fields.v1', zones: map.source.speedZones } }
      : {}),
    encounter: null,
    classic: {
      version: 'classic.v1',
      terrain: map.source.terrain ?? [],
      powerups: mission.bonuses,
      ...(policy.arcadeActions ? { arcadeActions: policy.arcadeActions } : {}),
      ...(carriers.length
        ? {
            lineImpact: {
              version: 'line-impact.v2',
              speed: project.actors.roles['impact-carrier'].impactSpeed,
              actorIds: carriers.map((actor) => actor.id).sort(),
            },
          }
        : {}),
    },
    enemies: mission.actors.map((actor) => compileActor(actor, difficulty, project.actors.id)),
    objectives: mission.objectives,
    supplies: [],
    rules: {
      ...policy.rules,
      lives: preset.lives,
      timeLimitSeconds: preset.failingDeadline ? mission.timeLimitSeconds : 0,
    },
  });
  const { name: _name, id: _id, revision: _revision, ...simulation } = level;
  const topology = inspectMissionTopology(level, map.geometry);
  const simulationIdentity = dataIdentity({
    policy: policy.id,
    difficulty,
    rosterHash: rosterHash(CLASSES),
    level: simulation,
  });
  return freezeDesign({
    format: directional ? 'ResolvedMissionV3' : relays ? 'ResolvedMissionV2' : 'ResolvedMissionV1',
    missionId: mission.id,
    mode,
    difficulty,
    policyId: policy.id,
    simulationIdentity,
    level,
    presentation: mission.presentation,
    background:
      project.assets.find((asset) => asset.id === mission.presentation.backgroundAssetId) ?? null,
    design: mission.design,
    officialProgressEligible: false,
    validation: 'compiled-candidate-not-playtested',
    topology,
    diagnostics: [
      ...map.geometry.diagnostics,
      ...topology.diagnostics,
      ...(mission.presentation.backgroundAssetId === null
        ? [{ severity: 'warning', code: 'greybox-background' }]
        : [{ severity: 'warning', code: 'candidate-art-not-visually-qualified' }]),
    ],
  });
}
