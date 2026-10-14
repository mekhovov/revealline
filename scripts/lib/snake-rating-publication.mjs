/** A winning journal qualifies a route; it cannot approve a new reward budget. */
export function requirePublishedSnakeCalibration(candidate, published) {
  const accepted = published.get(candidate.key);
  if (!accepted)
    throw new Error(
      `Unreviewed Snake rating setup: ${candidate.key}. Keep completion-only until a budget is separately reviewed.`,
    );
  for (const field of [
    'levelId',
    'mode',
    'pace',
    'seed',
    'levelIdentity',
    'goldMoves',
    'silverMoves',
    'referenceMoves',
  ])
    if (candidate[field] !== accepted[field])
      throw new Error(
        `Published Snake rating ${field} would change for ${candidate.key}; qualification cannot revise approved budgets.`,
      );
  return candidate;
}

export function requireCompleteSnakeCalibrations(rows, published) {
  for (const key of published.keys())
    if (!rows.has(key))
      throw new Error(
        `Published Snake rating evidence is missing for ${key}; existing budgets must not be deleted.`,
      );
}
