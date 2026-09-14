const medalNames = Object.freeze({ 1: 'BRONZE', 2: 'SILVER', 3: 'GOLD' });

/** Display projection: a picture's best-score run and level mastery are different records. */
export function collectionResultLabels(item, library) {
  const clear = library.campaigns?.[item.campaignKey]?.clears?.[item.levelId];
  const bestMedal = Number.isInteger(clear?.medals) ? (medalNames[clear.medals] ?? null) : null;
  const score = item.score.toLocaleString();
  const scoreRun = `${score} points · ${item.medal.toUpperCase()}${Number.isFinite(item.time) ? ` · ${item.time.toFixed(2)}s` : ''}`;
  return Object.freeze({
    card: `Picture best ${score} points${bestMedal ? ` · Level best ${bestMedal}` : ` · Score run ${item.medal.toUpperCase()}`}`,
    detail: `Best picture score: ${scoreRun}${bestMedal ? ` · Level best medal: ${bestMedal}` : ''}`,
  });
}
