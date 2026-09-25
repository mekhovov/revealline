import { t } from '../i18n/index.mjs';
import { coopGroundName } from './coop-ground.mjs';
import { TEAM_BONUS_HELP } from './coop-bonus-view.mjs';

/** Presentation advice for an already validated arena. Never changes its recipe. */
export function coopArenaGuidance(level, { jointCuts = true } = {}) {
  const groundName = coopGroundName(level);
  const hunters = level.enemies.some((enemy) => enemy.type === 'hunter');
  const drifters = level.enemies.some((enemy) => enemy.type === 'drifter');
  const roamers = level.enemies.some((enemy) => enemy.type === 'claimed-rover');
  const relays = Boolean(level.strongholds?.length);
  const requiredCores = level.goal.cores?.length ?? 0;
  const threats = [];
  if (level.timedBonuses) threats.push(TEAM_BONUS_HELP);
  const slow = level.terrain?.some((area) => area.kind === 'slow'),
    lethal = level.terrain?.some((area) => area.kind === 'lethal');
  if (slow)
    threats.push(
      t("interface:pairedDashesSlowOnlyYourCraftOnUnclaimedFieldEnemies"),
    );
  if (lethal)
    threats.push(
      t("interface:framedCrossesHarmYourCraftOnUnclaimedFieldEncloseThem"),
    );
  if (slow || lethal)
    threats.push(t("interface:capturingFieldNeutralizesItsTerrainForBothCraftWallsNever"));
  if (hunters)
    threats.push(
      t("interface:huntersMarkARouteBeforeChargingCrossDuringRecoveryOr"),
    );
  if (drifters)
    threats.push(
      t("interface:driftersPatrolContinuouslyAndCanHitYourCraftOrUnfinished"),
    );
  if (roamers)
    threats.push(
      t("interface:trackedRoamersDoNotRetainFieldReclaimTheirFullFootprint"),
    );
  if (relays)
    threats.push(
      t("interface:relayCoresWarnBeforeSendingASparkAlongAnUnfinished"),
    );
  const specialist = level.supportRoles?.length === 2;
  const pulse = specialist
    ? ("" + t("interface:interceptorSupportRemovesNearbyTravellingImpactsDisruptorSupportSlowsNearby") + " ")
    : hunters || drifters || roamers
      ? `Tap Support to slow nearby enemies${relays ? ' and intercept nearby sparks' : ''}. A dashed ring shows the slowdown. `
      : relays
        ? ("" + t("interface:tapSupportNearATravellingSparkToInterceptIt") + " ")
        : '';
  const rescue = `Hold Support on ${groundName} beside a downed partner for one second to rescue them without spending a reserve. Avoid steering while rescuing.`;
  const route = jointCuts
    ? t("interface:startWithASmallLoopThenMeetYourPartnerTo")
    : `Bring each cut back to ${groundName}. Meeting your partner does not join the lines.`;
  return {
    groundName,
    threatTitle: threats.length ? t("interface:watchTheThreats") : t("interface:practiceYourRoutes"),
    threatText: threats.length
      ? threats.join(' ')
      : `This arena has no enemies or relay emitters. Build ${groundName} with short loops, then try longer routes.`,
    supportText: pulse + rescue,
    supportBySeat: (level.supportRoles ?? ['hybrid', 'hybrid']).map((role) =>
      role === 'interceptor'
        ? t("interface:interceptorRemovesNearbyTravellingImpacts")
        : role === 'disruptor'
          ? t("interface:disruptorSlowsNearbyEnemies")
          : t("interface:supportSlowsNearbyEnemiesAndInterceptsImpacts"),
    ),
    showStrongholds: relays,
    strongholdTitle: requiredCores ? t("interface:secureTheRelayCores") : t("interface:relayDefenses"),
    strongholdText:
      'Capture both anchors of a stronghold to expose its core. Claim the exposed core with a later cut to stop its emitter. A shielded core blocks entry.' +
      (requiredCores ? '' : (" " + t("interface:yourGoalIsTheCoverageTarget") + "")),
    briefingTitle:
      requiredCores > 1
        ? t("interface:secureTheRequiredCores")
        : requiredCores
          ? t("interface:takeTheStrongholdTogether")
          : t("interface:makeYourCommonGround"),
    levelNote: requiredCores
      ? t("interface:planRoutesToTheAnchorsThenClaimTheExposedCores")
      : groundName === 'reclaimed ground'
        ? t("interface:createReturnRoutesTogetherUseReclaimedGroundToLaunchYour")
        : t("interface:createSafeRoutesTogetherUseTheRevealedGroundToLaunch"),
    startMessage: `${specialist ? ("" + t("interface:specialistsShareTheBoardInterceptorCoversExposedLinesDisruptorOpens") + " ") : ''}${
      roamers
        ? `Keep an escape corridor before enclosing a tracked roamer. WAKING gives one active second to move away. ${route}`
        : hunters
          ? `Watch the Hunter warnings and cross during recovery. ${route}`
          : drifters
            ? `Keep cuts short near patrolling Drifters. ${route}`
            : relays
              ? `Watch relay warnings; bank the threatened line or intercept its spark with Support. ${route}`
              : route
    }`,
  };
}
