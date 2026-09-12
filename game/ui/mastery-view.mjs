import { STEADY_SIGNAL, masteryDefinitionIdentity } from '../mastery.mjs';

// Register the reviewed built-in content explicitly. Reusing campaign/map IDs
// in an edited pack must not silently opt that different board into this goal.
const STEADY_SIGNAL_CONTENT = Object.freeze({
  campaignKey: 'homeward-skies/1/0d01f5687b3c38ff',
  levelIdentity: 'level-v1-5983ec4eaf745012',
  levelRevision: '1',
  rosterHash: 'roster-v1-e159e435',
  ruleset: 'xonix-core.v2',
});
const STEADY_SIGNAL_IDENTITY = masteryDefinitionIdentity(STEADY_SIGNAL);

/** Sidecar registration keeps optional goals out of old map and score identity. */
export function masteryFor(actualCampaignKey, levelId) {
  return actualCampaignKey === STEADY_SIGNAL_CONTENT.campaignKey &&
    levelId === STEADY_SIGNAL.levelId
    ? STEADY_SIGNAL
    : null;
}

export function masteryText(definition, preview, { practice = false, award = null } = {}) {
  if (!definition) return '';
  if (award?.message)
    return ['earned', 'session'].includes(award.status)
      ? award.message
      : `${definition.name} · ${award.message}`;
  const required = definition.all.find((item) => item.type === 'resistant-cut-cells').minCells;
  const committed = preview?.bestClosedCutCells ?? 0;
  const pending = preview?.pendingCutCells ?? 0;
  const clean = preview?.cleanSoFar !== false;
  const route = preview?.qualified
    ? 'Route complete'
    : `${Math.min(committed, required)} / ${required} interference cells in one closed cut`;
  return `${practice ? 'Practice goal' : 'Optional seal'} · ${definition.name}: ${route}${pending > committed ? ` · ${pending} on your open line; return to safety to bank them` : ''} · ${clean ? 'no lives lost' : 'life lost; retry for the seal'}.`;
}

export function pictureMasteries(records, item, definition, recipes = []) {
  const matches = (records ?? []).filter(
    (record) => record.campaignKey === item.campaignKey && record.levelId === item.levelId,
  );
  const identity = definition ? masteryDefinitionIdentity(definition) : null;
  const currentDefinition =
    masteryFor(item.campaignKey, item.levelId) !== null && identity === STEADY_SIGNAL_IDENTITY;
  return matches.map((record) => ({
    name:
      currentDefinition &&
      record.definitionId === definition.id &&
      record.definitionRevision === definition.revision &&
      record.definitionHash === identity &&
      record.levelIdentity === STEADY_SIGNAL_CONTENT.levelIdentity &&
      record.levelRevision === STEADY_SIGNAL_CONTENT.levelRevision &&
      record.setup.rosterHash === STEADY_SIGNAL_CONTENT.rosterHash &&
      record.setup.ruleset === STEADY_SIGNAL_CONTENT.ruleset
        ? definition.name
        : `Archived seal: ${record.definitionId}`,
    route: record.setup.classHistory
      .map((entry) => recipes.find((recipe) => recipe.id === entry.classId)?.label || entry.classId)
      .join(' → '),
    steering: record.setup.turnPolicy === 'grid-center' ? 'Grid + buffer' : 'Immediate',
    seed: record.setup.seed,
    earnedAt: record.earnedAt,
  }));
}
