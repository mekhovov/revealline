/** Describe observed failures without assigning blame or changing game state. */
export function coopFailureFeedback(run, event) {
  if (event?.cause === 'self-trail')
    return {
      cause: 'An unfinished line crossed itself.',
      advice: 'Close your loop on safe ground before crossing your own line.',
    };
  if (event?.cause === 'line-impact')
    return {
      cause: 'A travelling spark reached an unfinished cut.',
      advice: 'Intercept a nearby spark with Support or bank the cut sooner.',
    };
  if (event?.cause === 'enemy-trail' || event?.cause === 'enemy-player') {
    const hunter = run.enemies.some((enemy) => enemy.id === event.enemy && enemy.type === 'hunter');
    return {
      cause: `${hunter ? 'A Hunter' : 'A roaming enemy'} caught ${event.cause === 'enemy-trail' ? 'an unfinished line' : 'an exposed craft'}.`,
      advice: hunter
        ? 'Wait for the Hunter to recover, or use Support before the crossing.'
        : 'Try a shorter loop or slow nearby enemies with Support.',
    };
  }
  return {
    cause: event ? 'A craft was knocked down.' : 'Both craft need a rescue.',
    advice: 'Try smaller loops and keep a safe route back to your partner.',
  };
}

export function coopRetryFeedback(run, knockdowns = []) {
  const percent = (fraction) => (fraction * 100).toFixed(1).replace(/\.0$/, '');
  let progress;
  if (Object.hasOwn(run.level.goal, 'coverage')) {
    const goal = Math.ceil(run.level.goal.coverage * 10000 - 1e-9) / 100;
    progress = `${percent(run.coverage)}% revealed; goal ${goal}%.`;
  } else {
    const required = run.strongholds.filter((item) => run.level.goal.cores.includes(item.id));
    const anchors = required.flatMap((item) => item.anchors);
    progress = `${required.filter((item) => item.defeated).length} / ${required.length} required cores and ${anchors.filter((item) => item.captured).length} / ${anchors.length} anchors secured.`;
  }
  const feedback = (knockdowns.length ? knockdowns : [null]).map((event) =>
    coopFailureFeedback(run, event),
  );
  const causes = [...new Set(feedback.map((item) => item.cause))].join(' ');
  const advice = [...new Set(feedback.map((item) => item.advice))].join(' ');
  return `${progress} No team reserves remain. ${causes} Next try: ${advice}`;
}
