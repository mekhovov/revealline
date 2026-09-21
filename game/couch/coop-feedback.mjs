import { coopGroundName } from './coop-ground.mjs';
import { isJourneyTeamLevel } from '../coop/foundations.mjs';
import { foundationCaptionForCell } from '../ui/foundation-feedback.mjs';

/** Team stores its accepted return cell directly; joint/assisted banking is not
 * a physical foundation return. Keep the same explanation as Solo and Versus. */
export function coopFoundationReturnCaption(run, events = run.events) {
  if (!isJourneyTeamLevel(run.level) || run.status !== 'running') return '';
  for (const event of events) {
    if (event.type !== 'cut.closed' || event.reason !== 'return') continue;
    const player = run.players[event.player];
    if (!player || player.status !== 'active') continue;
    const caption = foundationCaptionForCell(run.level.safeRects, player.cellIndex, run.width);
    if (caption) return caption;
  }
  return '';
}

/** Describe observed failures without assigning blame or changing game state. */
export function coopFailureFeedback(run, event) {
  if (event?.cause === 'lethal-terrain')
    return {
      cause: 'Unclaimed lethal field caught a craft.',
      advice: 'Enclose the crossed field before entering it. Support affects enemies, not terrain.',
    };
  if (event?.cause === 'self-trail')
    return {
      cause: 'An unfinished line crossed itself.',
      advice: `Close your loop on ${coopGroundName(run.level)} before crossing your own line.`,
    };
  if (event?.cause === 'line-impact')
    return {
      cause: 'A travelling spark reached an unfinished cut.',
      advice: 'Intercept a nearby spark with Support or bank the cut sooner.',
    };
  if (event?.cause === 'enemy-trail' || event?.cause === 'enemy-player') {
    const hunter = run.enemies.some((enemy) => enemy.id === event.enemy && enemy.type === 'hunter');
    if (run.enemies.some((enemy) => enemy.id === event.enemy && enemy.type === 'claimed-rover'))
      return {
        cause: `An active reclaimed-ground roamer caught ${event.cause === 'enemy-trail' ? 'an unfinished line' : 'a craft'}.`,
        advice:
          'Reclaimed ground closes cuts but does not protect you from roamers. Keep an escape corridor or use Support to slow one.',
      };
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

export function coopRoamerCaption(event) {
  if (event.type === 'rover.warning')
    return 'Roamer waking: one active second to move away. Keep a reclaimed escape corridor.';
  if (event.type === 'rover.activated')
    return 'Roamer active on reclaimed ground. Watch both craft; Support can slow it.';
  return null;
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
