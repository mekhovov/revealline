const compact = (value, limit) => {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
};

/** Presentation only: derive requirements from the authored rules, never from
 * prose. Keep the complete authored briefing separately from the ready card.
 */
export function missionBriefing(
  level,
  { brief, objectiveLabel = 'Objective', classes = [], intro = false } = {},
) {
  const authored =
    typeof brief === 'string' && brief.trim() ? brief : level.metadata?.description || '';
  const fullTitle = level.name;
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
    rules.timeLimitSeconds > 0 ? `Deadline ${rules.timeLimitSeconds}s` : '',
    rules.cutTimeLimitSeconds > 0 ? `Cut ≤ ${rules.cutTimeLimitSeconds}s` : '',
    rules.maxTrailCells > 0 ? `Cable ≤ ${rules.maxTrailCells} cells` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // Existing pack briefs use this explicit prefix. Only known class labels
  // become a compact recommendation; the full prose is always available.
  const suggested = /^\s*Recommended:\s*([^.!?]+)/i.exec(authored)?.[1] || '';
  const recommendations = classes
    .filter(
      (recipe) =>
        typeof recipe.label === 'string' &&
        suggested.toLowerCase().includes(recipe.label.toLowerCase()),
    )
    .map((recipe) => recipe.label);
  const recommendation = recommendations.length
    ? `Recommended: ${compact(recommendations.join(' / '), 68)}.`
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
          ? 'Contour patrols follow newly captured edges.'
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
      ? 'Closing a cut stops your craft. Tap a fresh direction to fly again.'
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
      ? `Leave safe ground, draw a line and return.\nReveal ${coverage}% by enclosing regions without a field enemy.`
      : [facts, captureHint, impactHint, classicHint].filter(Boolean).join('\n'),
    fullBrief:
      authored ||
      'Return to safe ground to secure each line. Regions without a field enemy are revealed.',
    status: encounter
      ? `Capture ${multiShield && shieldCount > 1 ? `all ${shieldLabel}` : 'the shield relay'} first. Watch the patterned lane before each attack.`
      : intro
        ? 'Your first route: fly down from the marked start to the opposite border.'
        : level.classic?.enemyPressure?.actors?.length
          ? 'AIM → CHASE → REST. Close to cancel pursuit; turn away from a heading lock.'
          : 'Choose your route. Open Missions → Mission brief for guidance.',
  });
}
