import { localizedMessage, t } from '../i18n/index.mjs';
import {
  journeyActors,
  journeyPreset,
  journeyLaneTiming,
  journeySentinelTiming,
  journeyPressureTiming,
  journeyCombatTiming,
} from '../content-design/catalogs.mjs';
import { studioActorDomain } from './preview-copy.mjs';

export const actorRoleKeys = {
  'field-keeper': 'content:journey.fieldKeeper',
  'perimeter-patrol': 'tools:studio.actorEditor.perimeterPatrol',
  'frontier-patrol': 'tools:studio.actorEditor.frontierPatrol',
  'reclaimed-roamer': 'tools:studio.actorEditor.reclaimedRoamer',
  'territory-eroder': 'content:territoryEroder',
  'impact-carrier': 'interface:trailImpactCarrier',
  'lane-emitter': 'interface:laneEmitter',
  'relay-sentinel': 'tools:studio.actorEditor.sentinel',
  'trail-pursuer': 'interface:trailPursuer',
  'heading-interceptor': 'interface:headingInterceptor',
  'optional-scout': 'tools:studio.actorEditor.scout',
  'optional-sentry': 'tools:studio.actorEditor.sentry',
};
const tierKeys = {
  measured: 'tools:studio.actorEditor.measured',
  standard: 'tools:studio.actorEditor.standard',
  brisk: 'tools:studio.actorEditor.brisk',
};
const damageKeys = {
  'body-and-trail': 'tools:studio.actorEditor.damageBodyTrail',
  body: 'tools:studio.actorEditor.damageBody',
  'body-and-trail-while-active': 'tools:studio.actorEditor.damageActive',
  'body-and-propagating-trail-impact': 'tools:studio.actorEditor.damageImpact',
  'exposed-body-and-trail-in-active-lane': 'tools:studio.actorEditor.damageLane',
  'body-contact-and-exposed-body-or-trail-in-active-lane':
    'tools:studio.actorEditor.damageSentinel',
  none: 'tools:studio.actorEditor.damageNone',
  'exposed-body-by-projectile-only': 'tools:studio.actorEditor.damageProjectile',
};
const counterplayKeys = {
  'field-keeper': 'content:studio.actor.counterplay.fieldKeeper',
  'perimeter-patrol': 'content:studio.actor.counterplay.perimeterPatrol',
  'frontier-patrol': 'content:studio.actor.counterplay.frontierPatrol',
  'reclaimed-roamer': 'content:studio.actor.counterplay.reclaimedRoamer',
  'territory-eroder': 'content:studio.actor.counterplay.territoryEroder',
  'impact-carrier': 'content:studio.actor.counterplay.impactCarrier',
  'lane-emitter': 'content:studio.actor.counterplay.laneEmitter',
  'relay-sentinel': 'content:studio.actor.counterplay.sentinel',
  'trail-pursuer': 'content:studio.actor.counterplay.trailPursuer',
  'heading-interceptor': 'content:studio.actor.counterplay.headingInterceptor',
  'optional-scout': 'content:studio.actor.counterplay.scout',
  'optional-sentry': 'content:studio.actor.counterplay.sentry',
};
export const actorRoleName = (role) => (actorRoleKeys[role] ? t(actorRoleKeys[role]) : role);
export const actorCounterplay = (role) => t(counterplayKeys[role]);

/** Capture the chosen catalog and timing once. Locale refreshes only resolve
 * these messages; they do not rebuild options or read unsaved editor fields. */
export function actorEditorCopy({
  roleId,
  actorCatalogId,
  difficultyCatalogId,
  difficulty,
  combatEnabled,
}) {
  const role = journeyActors(actorCatalogId).roles[roleId];
  const preset = journeyPreset(difficulty, difficultyCatalogId);
  const sentinel = role.type === 'relay-sentinel';
  const emitter = role.type === 'lane-boss';
  const tiers = sentinel ? { measured: 0 } : emitter ? role.timings : role.speeds;
  const tierLabel = localizedMessage(
    sentinel
      ? preset.attackRestFactor === undefined
        ? 'tools:studio.actorEditor.sentinelFixed'
        : 'tools:studio.actorEditor.sentinelDifficulty'
      : emitter
        ? 'tools:studio.actorEditor.cadence'
        : 'tools:studio.actorEditor.speed',
  );
  const options = Object.entries(tiers).map(([id, value]) => {
    if (sentinel) {
      const timing = journeySentinelTiming(difficulty, difficultyCatalogId);
      return [
        id,
        () =>
          t('tools:studio.actorEditor.sentinelTier', {
            tier: t(tierKeys[id]),
            warning: timing.shielded.warningTicks / 120,
            rest: timing.shielded.restTicks / 120,
            open: timing.exposed.openTicks / 120,
          }),
      ];
    }
    if (emitter) {
      const timing = journeyLaneTiming(value, difficulty, difficultyCatalogId);
      return [
        id,
        () =>
          t('tools:studio.actorEditor.emitterTier', {
            tier: t(tierKeys[id]),
            warning: value.warningSeconds,
            active: value.activeSeconds,
            period: Number(timing.period.toFixed(4)),
          }),
      ];
    }
    return [
      id,
      () =>
        t('tools:studio.actorEditor.speedTier', {
          tier: t(tierKeys[id]),
          speed: Number((value * preset.enemySpeedFactor).toFixed(3)),
        }),
    ];
  });
  let positionHelp = localizedMessage(
    sentinel
      ? 'tools:studio.actorEditor.sentinelPosition'
      : roleId === 'frontier-patrol'
        ? 'tools:studio.actorEditor.frontierPosition'
        : roleId === 'reclaimed-roamer'
          ? 'tools:studio.actorEditor.roamerPosition'
          : roleId === 'territory-eroder'
            ? 'tools:studio.actorEditor.eroderPosition'
            : roleId === 'impact-carrier'
              ? 'tools:studio.actorEditor.impactPosition'
              : emitter
                ? 'tools:studio.actorEditor.emitterPosition'
                : 'tools:studio.actorEditor.position',
    { speed: role.impactSpeed, width: role.laneWidth },
  );
  if (role.pressureRecipe) {
    const timing = journeyPressureTiming(roleId, difficulty, actorCatalogId, difficultyCatalogId);
    positionHelp = localizedMessage('tools:studio.actorEditor.pressurePosition', {
      warning: timing.warningTicks / 120,
      commit: timing.commitTicks / 120,
      cooldown: timing.cooldownTicks / 120,
      radius: timing.senseRadius,
    });
  }
  if (role.combatRole) {
    const timing = journeyCombatTiming(roleId, difficulty, actorCatalogId, difficultyCatalogId);
    positionHelp = localizedMessage(
      role.combatRole === 'sentry'
        ? combatEnabled
          ? 'tools:studio.actorEditor.sentryActivePosition'
          : 'tools:studio.actorEditor.sentryInactivePosition'
        : combatEnabled
          ? 'tools:studio.actorEditor.scoutActivePosition'
          : 'tools:studio.actorEditor.scoutInactivePosition',
      {
        opening: timing.openingTicks / 120,
        warning: timing.warningTicks / 120,
        recovery: timing.recoveryTicks / 120,
        rest: timing.restTicks / 120,
      },
    );
  }
  return {
    tierLabel,
    options,
    positionHelp,
    description: () =>
      t('tools:studio.actorEditor.description', {
        domain: studioActorDomain(role.domain),
        damage: t(damageKeys[role.damageTarget]),
        retention: t(
          role.retainsField
            ? 'tools:studio.actorEditor.retainsField'
            : 'tools:studio.actorEditor.doesNotRetainField',
        ),
        counterplay: actorCounterplay(roleId),
      }),
  };
}
