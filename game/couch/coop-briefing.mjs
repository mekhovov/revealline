import { t } from '../i18n/index.mjs';
import { coopGroundContext, coopGroundLabel } from './coop-ground.mjs';
import { teamBonusHelp } from './coop-bonus-view.mjs';

/** Presentation advice for an already validated arena. Never changes its recipe. */
export function coopArenaGuidance(level, { jointCuts = true } = {}) {
  const groundName = coopGroundLabel(level);
  const context = coopGroundContext(level);
  const hunters = level.enemies.some((enemy) => enemy.type === 'hunter');
  const drifters = level.enemies.some((enemy) => enemy.type === 'drifter');
  const roamers = level.enemies.some((enemy) => enemy.type === 'claimed-rover');
  const relays = Boolean(level.strongholds?.length);
  const requiredCores = level.goal.cores?.length ?? 0;
  const threats = [];
  if (level.timedBonuses) threats.push(teamBonusHelp());
  const slow = level.terrain?.some((area) => area.kind === 'slow'),
    lethal = level.terrain?.some((area) => area.kind === 'lethal');
  if (slow) threats.push(t('interface:pairedDashesSlowOnlyYourCraftOnUnclaimedFieldEnemies'));
  if (lethal) threats.push(t('interface:framedCrossesHarmYourCraftOnUnclaimedFieldEncloseThem'));
  if (slow || lethal)
    threats.push(t('interface:capturingFieldNeutralizesItsTerrainForBothCraftWallsNever'));
  if (hunters) threats.push(t('interface:huntersMarkARouteBeforeChargingCrossDuringRecoveryOr'));
  if (drifters)
    threats.push(t('interface:driftersPatrolContinuouslyAndCanHitYourCraftOrUnfinished'));
  if (roamers) threats.push(t('interface:trackedRoamersDoNotRetainFieldReclaimTheirFullFootprint'));
  if (relays) threats.push(t('interface:relayCoresWarnBeforeSendingASparkAlongAnUnfinished'));
  const specialist = level.supportRoles?.length === 2;
  const pulse = specialist
    ? '' +
      t('interface:interceptorSupportRemovesNearbyTravellingImpactsDisruptorSupportSlowsNearby') +
      ' '
    : hunters || drifters || roamers
      ? t(relays ? 'gameplay:team.supportSlowAndIntercept' : 'gameplay:team.supportSlow') + ' '
      : relays
        ? '' + t('interface:tapSupportNearATravellingSparkToInterceptIt') + ' '
        : '';
  const rescue = t('gameplay:team.rescueAdvice', { context });
  const route = jointCuts
    ? t('interface:startWithASmallLoopThenMeetYourPartnerTo')
    : t('gameplay:team.separateCuts', { context });
  return {
    groundName,
    threatTitle: threats.length
      ? t('interface:watchTheThreats')
      : t('interface:practiceYourRoutes'),
    threatText: threats.length ? threats.join(' ') : t('gameplay:team.noThreats', { context }),
    supportText: pulse + rescue,
    supportBySeat: (level.supportRoles ?? ['hybrid', 'hybrid']).map((role) =>
      role === 'interceptor'
        ? t('interface:interceptorRemovesNearbyTravellingImpacts')
        : role === 'disruptor'
          ? t('interface:disruptorSlowsNearbyEnemies')
          : t('interface:supportSlowsNearbyEnemiesAndInterceptsImpacts'),
    ),
    showStrongholds: relays,
    strongholdTitle: requiredCores
      ? t('interface:secureTheRelayCores')
      : t('interface:relayDefenses'),
    strongholdText:
      t('gameplay:team.strongholdAdvice') +
      (requiredCores ? '' : ' ' + t('interface:yourGoalIsTheCoverageTarget') + ''),
    briefingTitle:
      requiredCores > 1
        ? t('interface:secureTheRequiredCores')
        : requiredCores
          ? t('interface:takeTheStrongholdTogether')
          : t('interface:makeYourCommonGround'),
    levelNote: requiredCores
      ? t('interface:planRoutesToTheAnchorsThenClaimTheExposedCores')
      : context === 'reclaimed'
        ? t('interface:createReturnRoutesTogetherUseReclaimedGroundToLaunchYour')
        : t('interface:createSafeRoutesTogetherUseTheRevealedGroundToLaunch'),
    startMessage: `${specialist ? '' + t('interface:specialistsShareTheBoardInterceptorCoversExposedLinesDisruptorOpens') + ' ' : ''}${
      roamers
        ? t('gameplay:team.startRoamer', { route })
        : hunters
          ? t('gameplay:team.startHunter', { route })
          : drifters
            ? t('gameplay:team.startDrifter', { route })
            : relays
              ? t('gameplay:team.startRelay', { route })
              : route
    }`,
  };
}
