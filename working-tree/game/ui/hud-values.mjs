/** Presentation only: never write the formatted label back into run data. */
export function soloScoreLabel(score) {
  // Match result-number precision, omitting grouping in the compact HUD.
  const label = score.toLocaleString(undefined, {
    useGrouping: false,
    maximumFractionDigits: 3,
  });
  return Number.isInteger(score) ? label.padStart(5, '0') : label;
}
