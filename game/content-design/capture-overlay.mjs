/** Visual/accessible projection of the engine's frozen capture result. This is
 * not a second flood algorithm, a legal-trail validator, or a live prediction. */
export function captureOverlay(preview) {
  const { geometry, capture, markers } = preview;
  const cells = Array(geometry.cells.length).fill(null);
  const anchors = new Set();
  for (const component of capture.components) {
    for (const cell of component.cells)
      cells[cell] = component.retained ? 'retained' : 'would-fill';
    for (const id of component.enemyIds) anchors.add(id);
  }
  for (const cell of capture.securedTrail) cells[cell] = 'trail';
  const affected = new Set(capture.affectedObjectiveIds);
  const retained = capture.components.filter((component) => component.retained).length;
  return {
    cells,
    actors: markers.actors.map((actor) => ({ ...actor, anchor: anchors.has(actor.id) })),
    objectives: markers.objectives.map((objective) => ({
      ...objective,
      affected: affected.has(objective.id),
    })),
    summary:
      `Frozen snapshot: ${retained} retained regions, ${capture.components.length - retained} would-fill regions, ` +
      `${capture.filledCells.length} would-fill cells and ${capture.securedTrail.length} hypothetical trail cells. ` +
      `Field anchors: ${[...anchors].join(', ') || 'none'}. ` +
      `Affected objectives: ${[...affected].join(', ') || 'none'}. ` +
      (capture.affectedGateIds
        ? `Would-open gates: ${capture.affectedGateIds.join(', ') || 'none'}. ${capture.reservedGateCells.length} reserved gate cells never count toward earned coverage. `
        : '') +
      capture.assumption,
  };
}
