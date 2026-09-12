import {
  STEADY_SIGNAL,
  SUPPLY_LINE,
  SAFE_RETURN,
  MASTERY_DEFINITION_VERSION,
  EQUIPMENT_MASTERY_DEFINITION_VERSION,
  masteryDefinitionIdentity,
} from '../mastery.mjs';

// Register the reviewed built-in content explicitly. Reusing campaign/map IDs
// in an edited pack must not silently opt that different board into this goal.
const HOMEWARD_CONTENT = Object.freeze({
  campaignKey: 'homeward-skies/1/0d01f5687b3c38ff',
  levelRevision: '1',
  rosterHash: 'roster-v1-e159e435',
  ruleset: 'xonix-core.v2',
});
const REGISTRATIONS = [
  [STEADY_SIGNAL, 'level-v1-5983ec4eaf745012'],
  [SUPPLY_LINE, 'level-v1-f1c1d86b070b5419'],
  [SAFE_RETURN, 'level-v1-03b703a6160004fc'],
].map(([definition, levelIdentity]) =>
  Object.freeze({
    ...HOMEWARD_CONTENT,
    definition,
    levelIdentity,
    definitionIdentity: masteryDefinitionIdentity(definition),
  }),
);
const registrationFor = (key, levelId) =>
  REGISTRATIONS.find((entry) => entry.campaignKey === key && entry.definition.levelId === levelId);

/** Sidecar registration keeps optional goals out of old map and score identity. */
export function masteryFor(actualCampaignKey, levelId) {
  return registrationFor(actualCampaignKey, levelId)?.definition ?? null;
}

const friendly = (id) =>
  ({
    'west-supply': 'West pad',
    'south-supply': 'South pad',
    'west-emitter': 'West signal region',
    'south-emitter': 'South signal region',
    'south-hangar': 'south hangar',
    'cable-cutter': 'cable cutter',
    carrier: 'Heavy carrier',
  })[id] || id.replaceAll('-', ' ');
const mark = (satisfied) => (satisfied ? '✓' : '○');
function equipmentLines(definition, preview) {
  const progress = (type) => preview?.predicates?.find((item) => item.type === type);
  const lines = [];
  // The clean finish follows the equipment action in the reading order.
  for (const predicate of [...definition.all].sort(
    (a, b) => Number(a.type === 'clean-win') - Number(b.type === 'clean-win'),
  )) {
    const current = progress(predicate.type);
    if (predicate.type === 'supply-pickups')
      for (const id of predicate.padIds) {
        const collected = current?.collectedPadIds?.includes(id) === true;
        lines.push(
          `${mark(collected)} ${friendly(id)}: ${collected ? 'collected' : 'collect supplies'}`,
        );
      }
    else if (predicate.type === 'suppressed-region-crossings')
      for (const region of predicate.regions) {
        const value = current?.regions?.find((item) => item.zoneId === region.zoneId);
        const banked = value?.bestClosedCells ?? 0;
        const pending = value?.pendingCells ?? 0;
        lines.push(
          `${mark(banked >= region.minCells)} ${friendly(region.zoneId)}: ${Math.min(banked, region.minCells)} / ${region.minCells} suppressed cells in one closed cut${pending > banked ? `; ${pending} on your open line — return to bank them` : ''}`,
        );
      }
    else if (predicate.type === 'hangar-switch')
      lines.push(
        `${mark(current?.satisfied)} ${current?.satisfied ? 'Switched' : 'Switch'} to ${friendly(predicate.classId)} at the ${friendly(predicate.hangarId)}`,
      );
    else if (predicate.type === 'live-cut-impact') {
      const phase = current?.phase ?? 'not-started';
      lines.push(
        `${mark(phase === 'returned')} ${
          phase === 'returned'
            ? 'Qualifying pulse complete; craft returned safely'
            : phase === 'awaiting-return'
              ? 'Qualifying pulse landed; wait for the craft to return'
              : `During a cut of ${predicate.minTrailCells}+ cells, pulse the ${friendly(predicate.actorId)} and return safely`
        }`,
      );
    } else if (predicate.type === 'clean-win')
      lines.push(
        `${mark(current?.satisfied)} ${preview?.cleanSoFar === false ? 'Life lost; retry for this seal' : current?.satisfied ? 'Finished without losing a life' : 'Finish without losing a life'}`,
      );
  }
  if (!definition.all.some((predicate) => predicate.type === 'clean-win'))
    lines.push(
      `${mark(preview?.status === 'won')} ${preview?.status === 'won' ? 'Mission complete' : 'Finish the mission to earn the seal'}`,
    );
  return lines;
}

export function masteryText(
  definition,
  preview,
  { practice = false, award = null, compact = false } = {},
) {
  if (!definition) return '';
  const unearnedDetails =
    definition.version === EQUIPMENT_MASTERY_DEFINITION_VERSION &&
    award?.status === 'unqualified' &&
    !compact;
  if (award?.message && !unearnedDetails)
    return ['earned', 'session'].includes(award.status)
      ? award.message
      : `${definition.name} · ${award.message}`;
  if (definition.version === EQUIPMENT_MASTERY_DEFINITION_VERSION) {
    if (compact) {
      const find = (type) => preview?.predicates?.find((item) => item.type === type);
      const pickups = definition.all.find((item) => item.type === 'supply-pickups');
      const lines = pickups
        ? [
            `Pads ${find('supply-pickups')?.collectedPadIds?.length ?? 0} / ${pickups.padIds.length}`,
            `closed signal regions ${find('suppressed-region-crossings')?.regions?.filter((item) => item.satisfied).length ?? 0} / ${definition.all.find((item) => item.type === 'suppressed-region-crossings').regions.length}`,
            `carrier switch ${find('hangar-switch')?.satisfied ? 'complete' : 'pending'}`,
          ]
        : [
            {
              'not-started': 'Pulse during a live cut, then return safely',
              'awaiting-return': 'Qualifying pulse landed; craft returning',
              returned: 'Qualifying pulse and return complete',
            }[find('live-cut-impact')?.phase ?? 'not-started'],
            preview?.cleanSoFar === false ? 'life lost; retry for the seal' : 'no lives lost',
          ];
      return `${practice ? 'Practice goal' : 'Optional seal'} · ${definition.name}: ${lines.join(' · ')}. Pause for the full checklist.`;
    }
    return [
      `${practice ? 'Practice goal' : 'Optional seal'} · ${definition.name}`,
      ...(unearnedDetails ? [award.message] : []),
      ...equipmentLines(definition, preview),
    ].join('\n');
  }
  if (definition.version !== MASTERY_DEFINITION_VERSION) return '';
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
  const registration = registrationFor(item.campaignKey, item.levelId);
  const currentDefinition = registration && identity === registration.definitionIdentity;
  return matches.map((record) => ({
    name:
      currentDefinition &&
      record.definitionId === definition.id &&
      record.definitionRevision === definition.revision &&
      record.definitionHash === identity &&
      record.levelIdentity === registration.levelIdentity &&
      record.levelRevision === registration.levelRevision &&
      record.setup.rosterHash === registration.rosterHash &&
      record.setup.ruleset === registration.ruleset
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
