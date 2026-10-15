/** Collected salvage drives drafts; uncollected drops are not progress yet. */
export function updateOverflightSurvivalHUD({ run, compiled, document, text }) {
  const $ = (id) => document.getElementById(id);
  const index = run.progression.choices;
  const thresholds = compiled.upgrades.thresholds;
  const previous = thresholds[index - 1] ?? 0;
  const complete = index >= thresholds.length;
  const next = thresholds[index] ?? previous;
  const required = Math.max(1, next - previous);
  const collected = complete
    ? required
    : Math.max(0, Math.min(required, run.progression.xp - previous));
  const remaining = Math.max(0, Math.ceil(next - run.progression.xp));
  const label = complete
    ? text('buildComplete')
    : text('salvageToUpgrade').replace('{remaining}', String(remaining));
  $('hud-salvage').textContent = label;
  $('hud-salvage').title = text('collectSalvage');
  $('xp-fill').style.width = `${(collected / required) * 100}%`;
  const meter = $('hud-salvage-meter');
  meter.setAttribute('aria-label', text('salvageProgress'));
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', String(required));
  meter.setAttribute('aria-valuenow', String(collected));
  meter.setAttribute('aria-valuetext', label);
  const objective = $('hud-final-objective');
  objective.hidden = !run.goals.finalSpawned || run.goals.finalDefeated;
  const objectiveText = objective.hidden ? '' : text('finalObjective');
  if (objective.textContent !== objectiveText) objective.textContent = objectiveText;
}
