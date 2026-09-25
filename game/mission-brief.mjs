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
  const encounter = level.encounter;
  const multiShield = encounter?.version === 'xonix-encounter.v2';
  const shieldCount = multiShield ? encounter.shieldObjectiveIds.length : 1;
  const shieldLabel = `${shieldCount} shield relay${shieldCount === 1 ? '' : 's'}`;
  const otherRequired = multiShield ? Math.max(0, required - shieldCount - 1) : 0;
  const label = compact(objectiveLabel, 24).toLowerCase() || 'objective';
  const plural = /[^aeiou]y$/.test(label) ? `${label.slice(0, -1)}ies` : `${label}s`;
  const goal = multiShield
    ? `Reveal ${coverage}% · ${shieldLabel} + core${otherRequired ? ` · ${otherRequired} other required ${otherRequired === 1 ? label : plural}` : ''}.`
    : `Reveal ${coverage}%${required ? ` · ${required} required ${required === 1 ? label : plural}` : ''}.`;
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
  const encounterGoal = encounter
    ? `Capture ${multiShield && shieldCount > 1 ? `all ${shieldLabel}` : 'the shield relay'}. Then close ${encounter.minReleaseCutCells} new trail cells during CORE OPEN, or isolate the core.`
    : '';
  const foundations = [
    'xonix-level.v5',
    'xonix-level.v6',
    'xonix-level.v7',
    'xonix-level.v8',
  ].includes(level.version);
  const classicHint = [
    'xonix-level.v4',
    'xonix-level.v5',
    'xonix-level.v6',
    'xonix-level.v7',
    'xonix-level.v8',
  ].includes(level.version)
    ? [
        level.directionalFields?.zones?.length
          ? 'Arrow fields: faster with the arrow, slower against it; never forced drift. Capture removes their effect.'
          : '',
        level.relayGates?.gates?.length
          ? 'Capture matching-number relays to open permanent return routes. Closed gates block cuts.'
          : '',
        foundations && level.enemies?.some((enemy) => enemy.type === 'lane-boss')
          ? 'Lanes lock, warn, then fire. Leave the lane and secure exposed trail.'
          : '',
        level.classic?.enemyPressure?.actors?.length
          ? 'AIM locks. Evade HEAD; close before TRAIL catches up.'
          : '',
        level.classic?.powerups?.length ? 'Touch pickups to collect their effects.' : '',
        level.classic?.timedBonuses
          ? 'Timed pickups: wait for the solid symbol, then touch before its ring expires. Missed pickups may return elsewhere; enclosure alone does not collect them.'
          : '',
        level.classic?.terrain?.some((tile) => tile.kind === 'lethal')
          ? 'Red crosshatched fields damage on contact; enclose them before crossing.'
          : level.classic?.terrain?.some((tile) => tile.kind === 'slow')
            ? 'Striped fields slow your craft while they remain hidden.'
            : '',
        level.enemies?.some((enemy) => enemy.type === 'contour-patrol')
          ? 'Contour crawlers follow new frontiers after captures. Check your return.'
          : '',
        level.enemies?.some((enemy) => enemy.type === 'claimed-rover')
          ? 'Rovers wake on claimed ground after a warning.'
          : '',
        level.enemies?.some((enemy) => enemy.type === 'eroder')
          ? 'Eroders warn before reopening captured ground.'
          : '',
      ]
        .filter(Boolean)
        .slice(
          0,
          level.classic?.lineImpact ||
            (foundations && level.enemies?.some((enemy) => enemy.type === 'lane-boss'))
            ? 1
            : 2,
        )
        .join('\n')
    : '';
  const captureHint =
    rules.stopOnCapture === true
      ? t("gameplay:brief.closingACutStopsYourCraftTapAFreshDirection")
      : '';
  const impactHint = level.classic?.lineImpact
    ? level.classic.lineImpact.version === 'line-impact.v2'
      ? 'Only bolts send sparks. Close before one reaches you; other trail hits are instant.'
      : 'Line hit? Close your cut before the travelling spark reaches you.'
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
      ? `Capture ${multiShield && shieldCount > 1 ? `all ${shieldLabel}` : 'the shield relay'} first. Watch the patterned lane before each attack.`
      : intro
        ? t("interface:yourFirstRouteFlyDownFromTheMarkedStartTo")
        : level.classic?.enemyPressure?.actors?.length
          ? 'AIM → CHASE → REST. Close to cancel pursuit; turn away from a heading lock.'
          : 'Choose your route. Open Missions → Mission brief for guidance.',
  });
}
