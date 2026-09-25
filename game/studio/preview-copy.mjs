import { studioDifficultyName } from './difficulty-view.mjs';
import { editorErrorText } from './editor-copy.mjs';
import { localizedAttribute, localizedText, t } from '../i18n/index.mjs';
import { contentText, isRegisteredContent } from '../i18n/content.mjs';
import { journeyPreset } from '../content-design/catalogs.mjs';
import { contentActorDescription } from '../content-design/actor-marker.mjs';

const presetKeys = {
  'journey-difficulty-v1': {
    gentle: 'tools:studio.rules.originalGentle',
    standard: 'tools:studio.rules.originalStandard',
    expert: 'tools:studio.rules.originalExpert',
  },
  'journey-difficulty-v2': {
    gentle: 'tools:studio.rules.pressureGentle',
    standard: 'tools:studio.rules.pressureStandard',
    expert: 'tools:studio.rules.pressureExpert',
  },
};
const bonusKeys = {
  'extra-life': 'tools:studio.bonus.extraLife',
  'player-speed': 'tools:studio.bonus.playerSpeed',
  'enemy-slow': 'tools:studio.bonus.enemySlow',
  'enemy-freeze': 'tools:studio.bonus.enemyFreeze',
};
const directionKeys = {
  up: 'tools:studio.geometry.up',
  down: 'tools:studio.geometry.down',
  left: 'tools:studio.geometry.left',
  right: 'tools:studio.geometry.right',
};
const terrainKeys = { slow: 'interface:slowField', lethal: 'interface:lethalField' };
const surfaceKeys = {
  ...terrainKeys,
  foundations: 'interface:foundation',
  walls: 'interface:wall2',
};
export function studioDirectionName(direction) {
  return directionKeys[direction] ? t(directionKeys[direction]) : direction;
}
export function studioSurfaceName(surface) {
  return surfaceKeys[surface] ? t(surfaceKeys[surface]) : surface;
}

/** The accepted project owns its child copy. A custom project cannot translate
 * an unchanged child just by retaining a shipped mission's name or identifier. */
export function studioContentText(project, record, field) {
  return isRegisteredContent(project)
    ? contentText(record, field)
    : field.split('.').reduce((value, key) => value?.[key], record);
}
export function studioBonusName(kind) {
  return bonusKeys[kind] ? t(bonusKeys[kind]) : kind;
}
/** Bind only presentation to one accepted snapshot. Locale refreshes cannot
 * inspect, apply, save, select, or rewrite an editor's pending input. */
export function bindStudioPreviewCopy(document, project, mission, preview) {
  const $ = (id) => document.getElementById(id);
  localizedText($('map-name'), () => studioContentText(project, mission, 'name'));
  localizedText($('lesson'), () => studioContentText(project, mission, 'design.routeDecision'));
  localizedText($('rules'), () => studioRulesText(project, mission, preview));
  localizedText($('geometry'), () => studioGeometryText(mission, preview));
  localizedAttribute($('play'), 'title', () =>
    mission.combat?.enabled
      ? t('tools:studio.preview.combatUnavailable')
      : mission.modes.includes('solo')
        ? ''
        : t('tools:studio.preview.soloUnavailable'),
  );
}
export function studioRulesText(project, mission, preview) {
  const { manifest } = preview;
  const preset = journeyPreset(manifest.difficulty, project.difficultyCatalogId);
  return t(manifest.mode === 'team' ? 'tools:studio.rules.team' : 'tools:studio.rules.solo', {
    count: manifest.level.rules.lives ?? preset.lives,
    speed: manifest.level.rules.moveSpeed,
    coverage: Math.round(mission.coverage * 100),
    countdown: t(
      mission.timeLimitSeconds ? 'tools:studio.rules.countdown' : 'tools:studio.rules.noCountdown',
    ),
    catalog: project.difficultyCatalogId,
    description: t(presetKeys[project.difficultyCatalogId][manifest.difficulty]),
  });
}

const domainKeys = {
  'unclaimed-field': 'tools:studio.gameplay.unclaimedField',
  'outer-perimeter': 'tools:studio.gameplay.outerPerimeter',
  'moving-frontier': 'tools:studio.gameplay.movingFrontier',
  'reclaimed-ground': 'tools:studio.gameplay.reclaimedGround',
  'stationary-unclaimed-field': 'tools:studio.gameplay.stationaryField',
};
const warningKeys = {
  'projection-not-balance-evidence': 'tools:studio.gameplay.projectionWarning',
  'admin-playtest-no-awards': 'tools:studio.gameplay.adminWarning',
  'density-target-not-reached': 'tools:studio.gameplay.densityWarning',
  'encounter-roster-preserved': 'tools:studio.gameplay.encounterWarning',
};
export function studioActorDomain(domain) {
  return domainKeys[domain] ? t(domainKeys[domain]) : domain;
}
/** The inspector's canonical report remains usable by the CLI and identity
 * checks. Localized labels never enter that report or its runtime recipe. */
export function studioGameplayText(report, status = {}) {
  return t('tools:studio.gameplay.summary', {
    speed: Number(report.playerSpeed.toFixed(3)),
    enemies: report.population.actualEnemies,
    added: report.population.addedKeepers,
    actors:
      report.actors
        .filter((actor) => actor.enabled)
        .map((actor) =>
          t('tools:studio.gameplay.actor', {
            id: actor.id,
            speed: Number(actor.speed.toFixed(3)),
            domain: studioActorDomain(actor.domain),
          }),
        )
        .join('; ') || t('tools:studio.capture.none'),
    settings: t(
      report.recipe.adminOverride
        ? 'tools:studio.gameplay.adminSettings'
        : 'tools:studio.gameplay.normalSettings',
    ),
    warnings: report.warnings
      .map((warning) =>
        warningKeys[warning.code]
          ? t(warningKeys[warning.code], {
              added: report.population.addedKeepers,
              requested: report.population.requestedAdditionalKeepers,
            })
          : warning.message,
      )
      .join(' '),
    storage: status.error ? t('tools:studio.gameplay.sessionOnly') : '',
  }).trim();
}
export function studioGeometryText(mission, preview) {
  const { geometry, manifest, authoredTerrain, markers } = preview;
  const list = (rows) => rows.join('; ') || t('tools:studio.capture.none');
  return [
    t('tools:studio.geometry.summary', {
      foundation: geometry.foundationCount,
      eligible: geometry.eligibleCount,
      components: geometry.safeComponents.length,
      spawns: list(
        (markers.spawns ?? [manifest.level.spawn]).map((spawn, index) =>
          t('tools:studio.geometry.spawn', { index: index + 1, x: spawn.x, y: spawn.y }),
        ),
      ),
      actors: list(
        markers.actors.map((actor) =>
          t('tools:studio.geometry.actor', {
            id: actor.id,
            description: contentActorDescription(manifest.level, actor),
            x: actor.x,
            y: actor.y,
          }),
        ),
      ),
      bonuses: list(
        mission.bonuses.map((bonus) =>
          t('tools:studio.geometry.bonus', {
            id: bonus.id,
            kind: studioBonusName(bonus.kind),
            x: bonus.x,
            y: bonus.y,
          }),
        ),
      ),
    }),
    t('tools:studio.geometry.timed', {
      schedules: list(
        (mission.timedBonuses?.schedules ?? []).map((schedule) =>
          t('tools:studio.geometry.schedule', {
            id: schedule.id,
            anchors: schedule.anchors.length,
            announcement: schedule.announcementTicks / 120,
            available: schedule.availableTicks / 120,
            cooldown: schedule.cooldownTicks / 120,
            collections: schedule.maxCollections,
          }),
        ),
      ),
    }),
    t('tools:studio.geometry.objectives', {
      objectives: list(
        mission.objectives.map((objective) =>
          t('tools:studio.geometry.objective', {
            id: objective.id,
            x: objective.x,
            y: objective.y,
            requirement: t(
              objective.required
                ? 'tools:studio.geometry.required'
                : 'tools:studio.geometry.optional',
            ),
            visibility: t(
              objective.hidden ? 'tools:studio.geometry.hidden' : 'tools:studio.geometry.visible',
            ),
          }),
        ),
      ),
    }),
    ...(mission.relayLinks
      ? [
          t('tools:studio.geometry.gates', {
            gates: list(
              markers.gates.map((gate) =>
                t('tools:studio.geometry.gate', {
                  label: gate.label,
                  id: gate.id,
                  objective: gate.objectiveId,
                }),
              ),
            ),
          }),
        ]
      : []),
    t('tools:studio.geometry.terrain', {
      terrain: list(
        authoredTerrain.map((area) =>
          t('tools:studio.geometry.area', {
            kind: terrainKeys[area.kind] ? t(terrainKeys[area.kind]) : area.kind,
            x: area.x,
            y: area.y,
            width: area.w,
            height: area.h,
          }),
        ),
      ),
    }),
    ...(manifest.level.directionalFields
      ? [
          t('tools:studio.geometry.fields', {
            fields: list(
              manifest.level.directionalFields.zones.map((zone) =>
                t('tools:studio.geometry.field', {
                  id: zone.id,
                  direction: studioDirectionName(zone.direction),
                  x: zone.x,
                  y: zone.y,
                  width: zone.w,
                  height: zone.h,
                }),
              ),
            ),
          }),
        ]
      : []),
  ].join(' ');
}

export function studioPreviewLoadingText(project, missionId, difficulty) {
  const mission = project.missions.find((entry) => entry.id === missionId);
  return t('tools:studio.preview.loading', {
    name: studioContentText(project, mission, 'name'),
    difficulty: studioDifficultyName(difficulty),
  });
}
export function studioPreviewFailureText(error) {
  return t('tools:studio.preview.loadFailed', { message: editorErrorText(error) });
}
