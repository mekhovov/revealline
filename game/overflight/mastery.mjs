import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { overflightRecordContext } from './records.mjs';
import { overflightHuntRecordContext } from './raid-records.mjs';
import { overflightRaidVariantRecord } from './raid-variants.mjs';
import { overflightWorldDefinition } from './worlds.mjs';

export const OVERFLIGHT_MASTERY_FORMAT = 'overflight-world-mastery.v1';
const MAX_ENTRIES = 256;
const finite = (value) => Number.isFinite(value) && value >= 0;
const flags = ['complete', 'intact', 'technique'];

/** Measured outcomes only: selecting a particular upgrade never earns mastery. */
export function overflightRunReport(run) {
  const times = (run.progression?.history ?? []).map(({ time }) => time).filter(finite);
  const gaps = times.map((time, index) => time - (times[index - 1] ?? 0));
  const variant = run.raidVariant;
  const complete =
    run.phase === 'won' && (!variant || variant.id !== 'marathon' || variant.status === 'banked');
  const caches = run.stats.cachesClaimed ?? 0;
  const engagements = run.riy?.engagements ?? 0;
  const bestChain =
    variant?.id === 'marathon'
      ? Math.max(variant.bestChain, run.hunt.bestChain)
      : (run.hunt?.bestChain ?? 0);
  const technique = run.hunt ? 'chain' : run.riy ? 'focus' : 'supply';
  const progress = technique === 'chain' ? bestChain : technique === 'focus' ? engagements : caches;
  const goal = technique === 'chain' ? 10 : technique === 'focus' ? 3 : 1;
  return {
    outcome: run.phase,
    time: variant?.id === 'marathon' ? variant.totalTime : run.time,
    kills: variant?.id === 'marathon' ? variant.totals.kills : run.stats.kills,
    damageTaken: variant?.id === 'marathon' ? variant.totals.damageTaken : run.stats.damageTaken,
    airframesLost: run.airframes - run.airframesRemaining,
    upgrades: (run.progression?.history ?? []).map(({ id }) => id),
    damageCauses: { ...(run.stats.damageCauses ?? {}) },
    salvageEarned: run.stats.xpEarned ?? 0,
    salvageCollected: run.stats.xpCollected ?? 0,
    salvageRemaining: run.stats.xpOnGround ?? 0,
    choices: times.length,
    longestChoiceGap: Math.max(0, ...gaps),
    sinceLastChoice: Math.max(0, run.time - (times.at(-1) ?? 0)),
    technique,
    techniqueProgress: progress,
    techniqueGoal: goal,
    mastery: {
      complete,
      intact: complete && run.airframesRemaining === run.airframes,
      technique: complete && progress >= goal,
    },
  };
}

function contextOf(run) {
  const snapshot = run.raidVariant ? overflightRaidVariantRecord(run) : run;
  if (!snapshot) return null;
  return {
    // Mastery follows authored encounters. An independently selected world skin
    // must not create a different achievement history for identical play rules.
    world:
      run.compiled.battlefield?.world ??
      overflightWorldDefinition(run.compiled.encounterProfile?.replace(/\.v\d+$/, ''))?.id ??
      'legacy',
    mode:
      run.raidVariant?.id ??
      (run.hunt ? 'overflight-hunt' : run.riy ? 'overflight-riy' : 'overflight'),
    // Established record context already separates rules, seed and gameplay
    // settings, and deliberately omits quality, gore and cosmetic appearance.
    rules: run.hunt ? overflightHuntRecordContext(snapshot) : overflightRecordContext(snapshot),
  };
}

function validateReport(report) {
  required(
    report && ['won', 'lost'].includes(report.outcome),
    'Only completed runs enter mastery.',
  );
  for (const field of [
    'time',
    'kills',
    'damageTaken',
    'airframesLost',
    'salvageEarned',
    'salvageCollected',
    'salvageRemaining',
    'choices',
    'longestChoiceGap',
    'sinceLastChoice',
    'techniqueProgress',
    'techniqueGoal',
  ])
    required(finite(report[field]), `Invalid mastery ${field}.`);
  required(['supply', 'focus', 'chain'].includes(report.technique), 'Invalid technique.');
  required(
    Array.isArray(report.upgrades) &&
      report.upgrades.length <= 64 &&
      report.upgrades.every((id) => typeof id === 'string' && id.length <= 100),
    'Invalid mastery upgrade history.',
  );
  for (const [cause, value] of Object.entries(report.damageCauses ?? {}))
    required(
      ['contact', 'lane', 'fan', 'ground'].includes(cause) && finite(value),
      'Invalid mastery damage cause.',
    );
  exactKeys(report.mastery, flags, 'Mastery goals');
  for (const flag of flags)
    required(typeof report.mastery[flag] === 'boolean', 'Invalid mastery goal.');
}

export function validateOverflightMastery(source) {
  const state = boundedJSON(source, {
    maxBytes: 768 * 1024,
    maxNodes: 45000,
    maxDepth: 8,
    maxArray: 64,
  });
  exactKeys(state, ['format', 'entries'], 'World mastery');
  required(state.format === OVERFLIGHT_MASTERY_FORMAT, 'Unsupported mastery format.');
  required(
    state.entries &&
      typeof state.entries === 'object' &&
      !Array.isArray(state.entries) &&
      Object.keys(state.entries).length <= MAX_ENTRIES,
    'Invalid mastery entries.',
  );
  for (const [key, entry] of Object.entries(state.entries)) {
    exactKeys(entry, ['context', 'achieved', 'last', 'order'], 'World mastery entry');
    required(
      entry.order === undefined || (Number.isSafeInteger(entry.order) && entry.order >= 0),
      'Invalid mastery retention order.',
    );
    exactKeys(entry.context, ['world', 'mode', 'rules'], 'World mastery context');
    required(
      entry.context.world === 'legacy' || !!overflightWorldDefinition(entry.context.world),
      'Invalid mastery world.',
    );
    required(
      ['overflight', 'overflight-riy', 'overflight-hunt', 'time-attack', 'marathon'].includes(
        entry.context.mode,
      ),
      'Invalid mastery mode.',
    );
    required(dataIdentity(entry.context) === key, 'Mastery context differs.');
    exactKeys(entry.achieved, flags, 'Mastery achievements');
    for (const flag of flags)
      required(typeof entry.achieved[flag] === 'boolean', 'Invalid mastery achievement.');
    validateReport(entry.last);
  }
  return state;
}

/** Separate shared-profile sidecar. Existing score records and backups are untouched. */
export function createOverflightMastery({ backend, ...options } = {}) {
  const store =
    backend ??
    createProfileRecordBackend({
      key: OVERFLIGHT_MASTERY_FORMAT,
      empty: () => ({ format: OVERFLIGHT_MASTERY_FORMAT, entries: {} }),
      validate: validateOverflightMastery,
      ...options,
    });
  const session = new Map();
  const recorded = new WeakMap();
  let closed = false;
  const merge = (saved, local, report, context) => ({
    context,
    achieved: Object.fromEntries(
      flags.map((flag) => [
        flag,
        !!(saved?.achieved[flag] || local?.achieved[flag] || report.mastery[flag]),
      ]),
    ),
    last: report,
  });
  async function write(run) {
    required(!closed && !run.review && !run.fixture, 'Review runs cannot set mastery.');
    const context = contextOf(run);
    if (!context) return null;
    const report = overflightRunReport(run);
    validateReport(report);
    const key = dataIdentity(context);
    let previous = session.get(key)?.last ?? null;
    let entry = merge(null, session.get(key), report, context);
    let durable = false;
    try {
      const saved = validateOverflightMastery(await store.read()).entries[key];
      previous ??= saved?.last ?? null;
      entry = merge(saved, session.get(key), report, context);
      const state = await store.update((source) => {
        const current = validateOverflightMastery(source);
        // Persist write order explicitly: a profile export may sort object keys.
        // Legacy entries have no order, so use their stable identity as a tie-break.
        const retained = Object.entries(current.entries)
          .filter(([id]) => id !== key)
          .sort(
            ([a, left], [b, right]) => (left.order ?? 0) - (right.order ?? 0) || (a < b ? -1 : 1),
          )
          .slice(-(MAX_ENTRIES - 1));
        const updated = merge(current.entries[key], entry, report, context);
        current.entries = Object.fromEntries(
          [...retained, [key, updated]].map(([id, value], order) => [id, { ...value, order }]),
        );
        return validateOverflightMastery(current);
      });
      entry = validateOverflightMastery(state).entries[key];
      durable = true;
    } catch {
      /* Continue showing clearly session-only achievements when storage is unavailable. */
    }
    session.delete(key);
    session.set(key, entry);
    if (session.size > MAX_ENTRIES) session.delete(session.keys().next().value);
    return { ...structuredClone(entry), previous, durable };
  }
  return {
    record(run) {
      if (!recorded.has(run)) {
        // A completed Marathon contract is still pending until bank/continue.
        if (
          run.raidVariant?.id === 'marathon' &&
          !['banked', 'lost'].includes(run.raidVariant.status)
        )
          return Promise.resolve(null);
        recorded.set(run, write(run));
      }
      return recorded.get(run);
    },
    dispose() {
      closed = true;
      session.clear();
      store.close?.();
    },
  };
}
