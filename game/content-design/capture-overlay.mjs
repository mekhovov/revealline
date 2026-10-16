import { t } from '../i18n/index.mjs';

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
    // Project known engine fields at the view boundary; the capture record and
    // its canonical assumption remain untouched for inspection/export consumers.
    summary: [
      t('tools:studio.capture.snapshot', {
        retained,
        filledRegions: capture.components.length - retained,
        filledCells: capture.filledCells.length,
        trailCells: capture.securedTrail.length,
      }),
      t('tools:studio.capture.anchors', {
        ids: [...anchors].join(', ') || t('tools:studio.capture.none'),
      }),
      t('tools:studio.capture.objectives', {
        ids: [...affected].join(', ') || t('tools:studio.capture.none'),
      }),
      ...(capture.affectedGateIds
        ? [
            t('tools:studio.capture.gates', {
              ids: capture.affectedGateIds.join(', ') || t('tools:studio.capture.none'),
              count: capture.reservedGateCells.length,
            }),
          ]
        : []),
      ...(capture.affectedCombatIds
        ? [
            t('tools:studio.capture.combat', {
              ids: capture.affectedCombatIds.join(', ') || t('tools:studio.capture.none'),
            }),
          ]
        : []),
      t('tools:studio.capture.assumption'),
    ].join(' '),
  };
}
