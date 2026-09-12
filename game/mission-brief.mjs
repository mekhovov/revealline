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
  const label = compact(objectiveLabel, 24).toLowerCase() || 'objective';
  const plural = /[^aeiou]y$/.test(label) ? `${label.slice(0, -1)}ies` : `${label}s`;
  const goal = `Reveal ${coverage}%${required ? ` · ${required} required ${required === 1 ? label : plural}` : ''}.`;
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
  const encounter = level.encounter;
  const encounterGoal = encounter
    ? `Capture the shield relay. Then close ${encounter.minReleaseCutCells} new trail cells during CORE OPEN, or isolate the core.`
    : '';
  const facts = [goal, encounterGoal, limits, recommendation].filter(Boolean).join('\n');
  return Object.freeze({
    title,
    fullTitle,
    goal,
    facts,
    copy: intro
      ? `Leave safe ground, draw a line and return.\nReveal ${coverage}% by enclosing regions without a field enemy.`
      : facts,
    fullBrief:
      authored ||
      'Return to safe ground to secure each line. Regions without a field enemy are revealed.',
    status: encounter
      ? 'Capture the shield relay first. Watch the patterned lane before each attack.'
      : intro
        ? 'Your first route: fly down from the marked start to the opposite border.'
        : 'Choose your route. Open Missions → Mission brief for guidance.',
  });
}
