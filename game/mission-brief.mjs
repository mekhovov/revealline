import { t, getLocale } from './i18n/index.mjs';
import { contentText } from './i18n/content.mjs';
const compact = (value, limit) => {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
};

/** Presentation only: derive requirements from the authored rules, never from
 * prose. Keep the complete authored briefing separately from the ready card.
 */
export function missionBriefing(
  level,
  { brief, objectiveLabel = t("gameplay:brief.objective"), classes = [], intro = false } = {},
) {
  const originalBrief =
    typeof brief === 'string' && brief.trim() ? brief : level.metadata?.description || '';
  const authored = brief || contentText(level, 'metadata.description') || '';
  const fullTitle = contentText(level, 'name');
  const title = compact(fullTitle, 44);
  const coverage = Number((level.goal.coverage * 100).toFixed(6));
  const required = (level.objectives || []).filter((item) => item.required).length;
  const label = compact(objectiveLabel, 24).toLowerCase() || 'objective';
  const objective = getLocale() === 'en' && required !== 1
    ? /[^aeiou]y$/.test(label) ? `${label.slice(0, -1)}ies` : `${label}s`
    : label;
  const goal = required
    ? t('gameplay:brief.goalObjectives', { coverage, count: required, objective })
    : t('gameplay:brief.coverage', { coverage });
  const rules = level.rules || {};
  const limits = [
    rules.timeLimitSeconds > 0 ? t("gameplay:deadlineS", { value1: rules.timeLimitSeconds }) : '',
    rules.cutTimeLimitSeconds > 0 ? t("gameplay:cutS", { value1: rules.cutTimeLimitSeconds }) : '',
    rules.maxTrailCells > 0 ? t("gameplay:cableCells", { value1: rules.maxTrailCells }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // Existing pack briefs use this explicit prefix. Only known class labels
  // become a compact recommendation; the full prose is always available.
  const suggested = /^\s*Recommended:\s*([^.!?]+)/i.exec(originalBrief)?.[1] || '';
  const recommendations = classes
    .filter(
      (recipe) =>
        typeof recipe.label === 'string' &&
        suggested.toLowerCase().includes(recipe.label.toLowerCase()),
    )
    .map((recipe) => contentText(recipe, 'label'));
  const recommendation = recommendations.length
    ? t("gameplay:recommended", { value1: compact(recommendations.join(' / '), 68) })
    : '';
  const encounter = level.encounter;
  const encounterGoal = encounter
    ? t("gameplay:captureTheShieldRelayThenCloseNewTrailCellsDuring", { value1: encounter.minReleaseCutCells })
    : '';
  const classicHint =
    level.version === 'xonix-level.v4'
      ? [
          level.classic?.enemyPressure?.actors?.length
            ? t("gameplay:brief.aimLocksATargetTurnBeforeChaseRestReturnsIt")
            : '',
          level.classic?.powerups?.length ? t("gameplay:brief.touchPickupsToCollectTheirEffects") : '',
          level.classic?.terrain?.some((tile) => tile.kind === 'lethal')
            ? t("gameplay:brief.redCrosshatchedFieldsDamageOnContactEncloseThemBeforeCrossing")
            : level.classic?.terrain?.some((tile) => tile.kind === 'slow')
              ? t("gameplay:brief.stripedFieldsSlowYourCraftWhileTheyRemainHidden")
              : '',
          level.enemies?.some((enemy) => enemy.type === 'contour-patrol')
            ? t("gameplay:brief.contourPatrolsFollowNewlyCapturedEdges")
            : '',
          level.enemies?.some((enemy) => enemy.type === 'claimed-rover')
            ? t("gameplay:brief.roversWakeOnClaimedGroundAfterAWarning")
            : '',
          level.enemies?.some((enemy) => enemy.type === 'eroder')
            ? t("gameplay:brief.erodersWarnBeforeReopeningCapturedGround")
            : '',
        ]
          .filter(Boolean)
          .slice(0, level.classic?.lineImpact ? 1 : 2)
          .join('\n')
      : '';
  const captureHint =
    rules.stopOnCapture === true
      ? t("gameplay:brief.closingACutStopsYourCraftTapAFreshDirection")
      : '';
  const impactHint = level.classic?.lineImpact
    ? t("gameplay:brief.lineHitCloseYourCutBeforeTheTravellingSparkReaches")
    : '';
  const facts = [goal, encounterGoal, limits, recommendation].filter(Boolean).join('\n');
  return Object.freeze({
    title,
    fullTitle,
    goal,
    facts,
    copy: intro
      ? t("gameplay:leaveSafeGroundDrawALineAndReturnRevealBy", { value1: coverage })
      : [facts, captureHint, impactHint, classicHint].filter(Boolean).join('\n'),
    fullBrief:
      authored ||
      t("gameplay:brief.returnToSafeGroundToSecureEachLineRegionsWithout"),
    status: encounter
      ? t("gameplay:brief.captureTheShieldRelayFirstWatchThePatternedLaneBefore")
      : intro
        ? t("interface:yourFirstRouteFlyDownFromTheMarkedStartTo")
        : level.classic?.enemyPressure?.actors?.length
          ? t("gameplay:brief.aimChaseRestBaitALockedTargetThenChooseAnother")
          : t("gameplay:brief.chooseYourRouteOpenMissionsMissionBriefForGuidance"),
  });
}
