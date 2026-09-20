/** Shared color-independent silhouettes for Studio and mission diagrams.
 * Adds a path only; the caller owns ink, fill and frozen capture overlays.
 */
export function traceContentActor(ctx, type, x, y, radius) {
  if (type === 'relay-sentinel') {
    // A three-point crown remains distinct from emitter posts and patrol arrows.
    ctx.moveTo(x - radius, y - radius);
    ctx.lineTo(x - radius * 0.35, y);
    ctx.lineTo(x, y - radius);
    ctx.lineTo(x + radius * 0.35, y);
    ctx.lineTo(x + radius, y - radius);
    ctx.lineTo(x + radius * 0.7, y + radius);
    ctx.lineTo(x - radius * 0.7, y + radius);
    ctx.closePath();
  } else if (type === 'impact-carrier') {
    // A split lightning bolt is readable without motion or color cues.
    ctx.moveTo(x + radius * 0.2, y - radius);
    ctx.lineTo(x - radius, y + radius * 0.15);
    ctx.lineTo(x - radius * 0.15, y + radius * 0.15);
    ctx.lineTo(x - radius * 0.2, y + radius);
    ctx.lineTo(x + radius, y - radius * 0.15);
    ctx.lineTo(x + radius * 0.15, y - radius * 0.15);
    ctx.closePath();
  } else if (type === 'lane-boss') {
    // Twin posts and a bridge: distinct from moving patrols and tracked roamers.
    ctx.rect(x - radius, y - radius, radius * 0.45, radius * 2);
    ctx.rect(x + radius * 0.55, y - radius, radius * 0.45, radius * 2);
    ctx.rect(x - radius * 0.55, y - radius * 0.2, radius * 1.1, radius * 0.4);
  } else if (['bouncer', 'drifter'].includes(type)) ctx.arc(x, y, radius, 0, Math.PI * 2);
  else if (type === 'border-patrol') {
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.closePath();
  } else if (type === 'claimed-rover') {
    ctx.rect(x - radius * 0.7, y - radius * 0.65, radius * 1.4, radius * 1.3);
    ctx.rect(x - radius, y - radius, radius * 0.3, radius * 2);
    ctx.rect(x + radius * 0.7, y - radius, radius * 0.3, radius * 2);
  } else if (type === 'eroder') {
    // A toothed blade, not a patrol triangle or the roamer's tracked square.
    ctx.rect(x - radius * 0.45, y - radius * 0.2, radius * 0.9, radius * 1.2);
    ctx.rect(x - radius, y - radius * 0.6, radius * 2, radius * 0.5);
    for (const tooth of [-1, -0.2, 0.6])
      ctx.rect(x + radius * tooth, y - radius, radius * 0.4, radius * 0.4);
  } else {
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y + radius);
    ctx.lineTo(x - radius, y + radius);
    ctx.closePath();
  }
}

/** The validated manifest owns role selection; historical global v1 is unchanged. */
export function contentActorMarkerType(level, actor) {
  const impact = level.classic?.lineImpact;
  return actor.type === 'bouncer' &&
    impact?.version === 'line-impact.v2' &&
    impact.actorIds.includes(actor.id)
    ? 'impact-carrier'
    : actor.type;
}

/** Initial authoring facts come from the resolved descriptor, not map-marker guesses. */
export function contentActorDescription(level, actor) {
  if (actor.type === 'relay-sentinel' && level.encounter?.version === 'xonix-encounter.v2') {
    const recipe = level.encounter;
    return `stationary Sentinel, ${recipe.shieldObjectiveIds.length} shield relay${recipe.shieldObjectiveIds.length === 1 ? '' : 's'}; ${recipe.shielded.warningTicks / 120}s lane warning; close ${recipe.minReleaseCutCells} new trail cells during CORE OPEN or isolate the core`;
  }
  if (actor.type === 'lane-boss') {
    const recipe = level.enemies.find((entry) => entry.id === actor.id);
    return `stationary lane emitter, ${recipe.axis} lane, ${recipe.warningSeconds}s warning / ${recipe.activeSeconds}s active / ${recipe.period}s cycle`;
  }
  return contentActorMarkerType(level, actor) === 'impact-carrier'
    ? 'trail-impact carrier'
    : actor.type;
}
