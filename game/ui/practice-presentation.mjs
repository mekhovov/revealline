const shown = Object.freeze({ showCombatScrap: true });
const hidden = Object.freeze({ showCombatScrap: false });

/** One practice launch's cosmetic choice. It is deliberately outside scenario,
 * replay and persisted display schemas. Ambiguous input keeps the usual view. */
export function readPracticePresentation(search, { practice = false } = {}) {
  if (practice !== true) return shown;
  const params = new URLSearchParams(search);
  if (params.getAll('practice').length !== 1 || params.get('practice') !== '1') return shown;
  const values = params.getAll('preview-remains');
  return values.length === 1 && values[0] === 'hide' ? hidden : shown;
}
