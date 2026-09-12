import { difficultyAccess } from './difficulty-access.mjs';
import { campaignSelection } from './continuation.mjs';
import { canPlay, appearanceMilestones, unlockedBodies, achievements } from './progress.mjs';
import { resolveCampaignDifficulty } from './campaign-difficulty.mjs';
import { normalizedLevel } from './core/level.mjs';
import { FIXED_DT } from './core/registry.mjs';

/** Cache a read-only access view when content or the adopted progress map changes.
 * This projection never becomes persisted progress or a source of score awards.
 */
export function createDifficultyNavigation() {
  const views = new WeakMap();
  function access(entry, campaigns) {
    if (!entry?.baseCampaign || !entry.difficulty) return null;
    const cached = views.get(entry.baseCampaign);
    if (cached?.campaigns === campaigns) return cached.access;
    const result = difficultyAccess(entry.baseCampaign, campaigns);
    views.set(entry.baseCampaign, { campaigns, access: result });
    return result;
  }
  return Object.freeze({
    access,
    selection(entry, campaigns, progress, { levelId } = {}) {
      const shared = access(entry, campaigns);
      if (!shared) return campaignSelection(progress, entry.campaign, { levelId });
      const explicit = entry.campaign.levels.findIndex((level) => level.id === levelId);
      return Object.freeze({
        complete: shared.complete,
        completed: shared.count,
        total: shared.total,
        overview: explicit < 0 && shared.complete,
        levelIndex:
          explicit >= 0 ? explicit : (shared.nextLevelIndex ?? entry.campaign.levels.length - 1),
        explicit: explicit >= 0,
      });
    },
    playable(entry, campaigns, progress, index) {
      const shared = access(entry, campaigns);
      return shared
        ? shared.levels[index]?.playable === true
        : canPlay(progress, entry.campaign, index);
    },
    bodies(entry, campaigns, progress) {
      const shared = access(entry, campaigns);
      return shared ? new Set(shared.unlockedBodyIds) : unlockedBodies(progress, entry.campaign);
    },
    milestones(entry, campaigns, progress) {
      return access(entry, campaigns)?.milestones ?? appearanceMilestones(progress, entry.campaign);
    },
    achievements(entry, campaigns, progress) {
      const shared = access(entry, campaigns);
      return achievements(progress, entry.campaign).map((item) => {
        if (!shared) return item;
        const earned = {
          'first-light': shared.count >= 1,
          pathfinder: shared.count >= Math.min(4, shared.total),
          'last-light': shared.complete,
        };
        return Object.hasOwn(earned, item.id)
          ? { ...item, earned: earned[item.id], scope: 'shared' }
          : { ...item, scope: entry.difficulty };
      });
    },
  });
}

export const difficultyLabel = (entry) =>
  entry?.difficulty === 'gentle' ? 'Gentle' : entry?.difficulty === 'standard' ? 'Standard' : '';

/** Preference changes choose the next attempt; they never convert a live run. */
export function difficultyCue({ entry, nextMode, started, recovering = false, practice = false }) {
  resolveCampaignDifficulty(nextMode);
  const current = difficultyLabel(entry);
  if (practice || !current)
    return Object.freeze({
      available: false,
      current: '',
      copy: 'Difficulty applies to authored campaigns. This activity keeps its own rules.',
      retry: '',
    });
  const next = nextMode === 'gentle' ? 'Gentle' : 'Standard';
  const pending = current !== next && (started || recovering);
  return Object.freeze({
    available: true,
    current,
    copy: pending
      ? `This flight stays ${current}. ${next} starts on your next fresh attempt. Resume and Load keep the saved flight’s difficulty.`
      : current !== next
        ? `This prepared flight starts on ${current}. Your saved choice for later fresh attempts is ${next}. Changing this setting replaces the prepared attempt.`
        : `${current}: ${current === 'Gentle' ? 'at least five lives, slower moving enemies and no mission or cut deadline' : 'the authored lives, hazards and deadlines'}. Both difficulties unlock the same pictures, missions and appearances; scores and medals stay separate. Equipment seals require Standard.`,
    retry: pending
      ? `Retry starts this map from the beginning on ${next}. Your current flight remains ${current} until then.`
      : '',
  });
}

/** Describe only actual changes on the selected authored map, in player terms. */
export function difficultyRuleComparison(standardLevel, gentleLevel) {
  const standard = normalizedLevel(standardLevel),
    gentle = normalizedLevel(gentleLevel);
  const seconds = (value) => `${Number(value.toFixed(2))}s`;
  const limit = (value) => (value ? seconds(value) : 'none');
  const rows = [
    `Starting lives: Standard ${standard.rules.lives} · Gentle ${gentle.rules.lives}.`,
    `Mission deadline: Standard ${limit(standard.rules.timeLimitSeconds)} · Gentle ${limit(gentle.rules.timeLimitSeconds)}.`,
    `Cut deadline: Standard ${limit(standard.rules.cutTimeLimitSeconds)} · Gentle ${limit(gentle.rules.cutTimeLimitSeconds)}.`,
    `Maximum line: Standard ${standard.rules.maxTrailCells ? `${standard.rules.maxTrailCells} cells` : 'unlimited'} · Gentle ${gentle.rules.maxTrailCells ? `${gentle.rules.maxTrailCells} cells` : 'unlimited'}.`,
  ];
  if (
    standard.enemies.some(
      (enemy) =>
        enemy.type === 'border-patrol' ||
        (enemy.type === 'bouncer' && (enemy.vx !== 0 || enemy.vy !== 0)),
    )
  )
    rows.push('Moving field enemies and border patrols travel 40% slower on Gentle.');
  for (const enemy of standard.enemies.filter((enemy) => enemy.type === 'lane-boss')) {
    const changed = gentle.enemies.find((candidate) => candidate.id === enemy.id);
    rows.push(
      `Lane warning: Standard ${seconds(enemy.warningSeconds ?? 1.5)} · Gentle ${seconds(changed.warningSeconds)}. Lane cycle: Standard ${seconds(enemy.period ?? 6)} · Gentle ${seconds(changed.period)}.`,
    );
  }
  if (standard.encounter && gentle.encounter) {
    for (const [stage, key, label] of [
      ['shielded', 'warningTicks', 'Sentinel lane warning'],
      ['shielded', 'restTicks', 'Sentinel rest'],
      ['exposed', 'warningTicks', 'Sentinel opening warning'],
      ['exposed', 'openTicks', 'Sentinel opening'],
    ])
      rows.push(
        `${label}: Standard ${seconds(standard.encounter[stage][key] * FIXED_DT)} · Gentle ${seconds(gentle.encounter[stage][key] * FIXED_DT)}.`,
      );
  }
  rows.push(
    'The picture, coverage target, required objectives, craft speed and equipment abilities stay the same. Contact can still cost a life.',
  );
  return Object.freeze(rows);
}
