import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';

export const AIRCRAFT_CHALLENGE_RULES = 'AircraftChallengeRules.v1';
export const AIRCRAFT_CHALLENGE_PROGRESS = 'AircraftChallengeProgress.v1';
export const AIRCRAFT_CHALLENGE_RECOVERY = 'AircraftChallengeRecovery.v1';
const clone = (value) => structuredClone(value);
const tick = (value) => Number.isSafeInteger(value) && value >= 0;
const capacityValid = (value) => Number.isFinite(value) && value >= 0.01 && value <= 100;
const small = (source) =>
  boundedJSON(source, { maxBytes: 4096, maxNodes: 100, maxArray: 0, maxDepth: 4, maxString: 80 });

/** Rules belong to an explicit attempt, never to a portable rates profile.
 * Absent rules stay absent so existing simulation identities remain unchanged. */
export function validateAircraftChallengeRules(source) {
  const rules = small(source);
  required(rules.format === AIRCRAFT_CHALLENGE_RULES, 'Unsupported aircraft challenge rules');
  if (rules.kind === 'timed-practice') {
    exactKeys(rules, ['format', 'kind', 'durationTicks'], 'Timed aircraft challenge');
    required(
      tick(rules.durationTicks) &&
        rules.durationTicks >= 1500 &&
        rules.durationTicks <= 180000 &&
        rules.durationTicks % 50 === 0,
      'Choose a whole-second challenge duration from 30 seconds to 60 minutes',
    );
  } else {
    exactKeys(
      rules,
      ['format', 'kind', 'takeoffHoldTicks', 'landingHoldTicks'],
      'Battery endurance challenge',
    );
    required(
      rules.kind === 'battery-endurance' &&
        rules.takeoffHoldTicks === 25 &&
        rules.landingHoldTicks === 50,
      'Unsupported battery endurance rules',
    );
  }
  return rules;
}

export function prepareAircraftChallenge(configuration, source) {
  if (source === null || source === undefined) return configuration;
  const rules = validateAircraftChallengeRules(source);
  required(
    configuration?.advanced?.aircraft?.format === 'AdvancedAircraft.v2',
    'Aircraft challenges require a physical aircraft setup',
  );
  const prepared = clone(configuration);
  prepared.challenge = rules;
  if (rules.kind === 'battery-endurance') prepared.advanced.aircraft.battery.depletion = true;
  return prepared;
}

const initialProgress = (rules) => ({
  format: AIRCRAFT_CHALLENGE_PROGRESS,
  rulesIdentity: dataIdentity(rules),
  missionTick: 0,
  elapsedTicks: 0,
  airborneTicks: 0,
  airborneRunTicks: 0,
  groundedRunTicks: 0,
  takeoffTick: null,
  result: null,
  scored: false,
});

/** Checkpoint progress is bounded resumption data, not proof of prior flight.
 * A complete challenge outcome is verified separately from a fresh replay. */
export function validateAircraftChallengeProgress(source, sourceRules) {
  const rules = validateAircraftChallengeRules(sourceRules);
  const progress = small(source);
  exactKeys(progress, Object.keys(initialProgress(rules)), 'Aircraft challenge progress');
  required(
    progress.format === AIRCRAFT_CHALLENGE_PROGRESS &&
      progress.rulesIdentity === dataIdentity(rules) &&
      progress.scored === false &&
      [
        'missionTick',
        'elapsedTicks',
        'airborneTicks',
        'airborneRunTicks',
        'groundedRunTicks',
      ].every((key) => tick(progress[key]) && progress[key] <= progress.missionTick) &&
      (progress.takeoffTick === null ||
        (tick(progress.takeoffTick) &&
          progress.takeoffTick > 0 &&
          progress.takeoffTick <= progress.missionTick)),
    'Invalid aircraft challenge progress',
  );
  const result = progress.result;
  if (result !== null) {
    exactKeys(
      result,
      ['reason', 'missionTick', 'elapsedTicks', 'airborneTicks'],
      'Challenge result',
    );
    required(
      tick(result.missionTick) &&
        result.missionTick > 0 &&
        result.missionTick <= progress.missionTick &&
        result.elapsedTicks === progress.elapsedTicks &&
        result.airborneTicks === progress.airborneTicks,
      'Invalid aircraft challenge result',
    );
  }
  if (rules.kind === 'timed-practice') {
    required(
      progress.elapsedTicks === Math.min(progress.missionTick, rules.durationTicks) &&
        progress.airborneTicks === 0 &&
        progress.airborneRunTicks === 0 &&
        progress.groundedRunTicks === 0 &&
        progress.takeoffTick === null &&
        (progress.missionTick < rules.durationTicks
          ? result === null
          : result?.reason === 'time-elapsed' && result.missionTick === rules.durationTicks),
      'Timed challenge progress differs from its accepted clock',
    );
  } else {
    const through = result?.missionTick ?? progress.missionTick;
    required(
      progress.airborneRunTicks <= rules.takeoffHoldTicks &&
        progress.groundedRunTicks <= rules.landingHoldTicks &&
        progress.airborneTicks <= progress.elapsedTicks &&
        (result === null || ['landed', 'battery-empty'].includes(result.reason)),
      'Invalid endurance challenge counters',
    );
    if (progress.takeoffTick === null) {
      required(
        progress.elapsedTicks === 0 &&
          progress.airborneTicks === 0 &&
          progress.airborneRunTicks < rules.takeoffHoldTicks &&
          progress.groundedRunTicks === 0 &&
          (result === null || result.reason === 'battery-empty'),
        'Invalid challenge progress before takeoff',
      );
    } else {
      required(
        progress.airborneRunTicks === rules.takeoffHoldTicks &&
          progress.elapsedTicks === through - progress.takeoffTick + 1 &&
          progress.airborneTicks >= rules.takeoffHoldTicks &&
          progress.elapsedTicks >= progress.airborneTicks + progress.groundedRunTicks &&
          (result?.reason === 'landed'
            ? progress.groundedRunTicks === rules.landingHoldTicks
            : result !== null || progress.groundedRunTicks < rules.landingHoldTicks),
        'Invalid challenge progress after takeoff',
      );
    }
  }
  return progress;
}

/** Consume precisely one accepted 50 Hz mission interval at a time. No render
 * timestamps, wall clocks, fixed aircraft heights, or recording budgets enter it. */
export function createAircraftChallengeProgress(sourceRules, { capacityAh } = {}) {
  const rules = validateAircraftChallengeRules(sourceRules);
  if (rules.kind === 'battery-endurance')
    required(capacityValid(capacityAh), 'Endurance requires the frozen aircraft battery capacity');
  let progress = initialProgress(rules);
  const snapshot = () => clone(progress);
  function complete(reason) {
    progress.result = {
      reason,
      missionTick: progress.missionTick,
      elapsedTicks: progress.elapsedTicks,
      airborneTicks: progress.airborneTicks,
    };
  }
  return {
    snapshot,
    restore(source) {
      progress = validateAircraftChallengeProgress(source, rules);
      return snapshot();
    },
    advance(telemetry) {
      const nextTick = telemetry?.missionTick;
      required(tick(nextTick), 'Challenge requires an accepted mission tick');
      if (nextTick === progress.missionTick) return snapshot();
      required(nextTick === progress.missionTick + 1, 'Challenge mission intervals are missing');
      if (rules.kind === 'battery-endurance')
        required(
          typeof telemetry.contact?.grounded === 'boolean' &&
            Number.isFinite(telemetry.usedAh) &&
            telemetry.usedAh >= 0 &&
            telemetry.usedAh <= capacityAh,
          'Endurance requires full-aircraft contacts and actual consumed battery charge',
        );
      progress.missionTick = nextTick;
      if (progress.result) return snapshot();
      if (rules.kind === 'timed-practice') {
        progress.elapsedTicks = nextTick;
        if (nextTick === rules.durationTicks) complete('time-elapsed');
      } else {
        const grounded = telemetry.contact.grounded;
        if (progress.takeoffTick === null) {
          progress.airborneRunTicks = grounded ? 0 : progress.airborneRunTicks + 1;
          if (progress.airborneRunTicks === rules.takeoffHoldTicks) {
            progress.takeoffTick = nextTick - rules.takeoffHoldTicks + 1;
            progress.airborneTicks = rules.takeoffHoldTicks;
          }
        } else {
          progress.groundedRunTicks = grounded ? progress.groundedRunTicks + 1 : 0;
          if (!grounded) progress.airborneTicks++;
        }
        if (progress.takeoffTick !== null)
          progress.elapsedTicks = nextTick - progress.takeoffTick + 1;
        if (telemetry.usedAh === capacityAh) complete('battery-empty');
        else if (progress.groundedRunTicks === rules.landingHoldTicks) complete('landed');
      }
      return snapshot();
    },
  };
}

function physicalRecovery(session) {
  required(
    ['AircraftCourseRecovery.v1', 'AdvancedRegionalRecovery.v2'].includes(session?.format),
    'Unsupported challenge recovery session',
  );
  const physical = session.physical ?? session.simulation;
  required(
    physical?.format === 'AdvancedAircraftSnapshot.v1' &&
      tick(physical.checkpoint?.state?.missionTick),
    'Challenge recovery requires an aircraft checkpoint',
  );
  return physical;
}

// The inner session verifies its own complete physics/replay payload. This
// checksum binds only the small challenge state to that verified physics hash.
function recoveryChecksum(packet) {
  const physical = physicalRecovery(packet.session);
  return dataIdentity({
    format: packet.format,
    rules: packet.rules,
    progress: packet.progress,
    sessionFormat: packet.session.format,
    identity: physical.identity,
    hash: physical.hash,
    missionTick: physical.checkpoint.state.missionTick,
  });
}

/** A host-compatible facade: completed objectives leave the underlying flight
 * active. Restoring resumes saved progress; only a newly constructed session
 * starts a fresh challenge and battery. */
export function withAircraftChallenge(session, { rules: sourceRules, capacityAh } = {}) {
  if (sourceRules === null || sourceRules === undefined) return session;
  const rules = validateAircraftChallengeRules(sourceRules);
  const progress = createAircraftChallengeProgress(rules, { capacityAh });
  required(
    (session.snapshot().advancedTelemetry?.missionTick ?? 0) === 0,
    'Select a challenge before starting the aircraft session',
  );
  let stepping = null,
    checkpointing = null,
    checkpointKind = null,
    disposed = false;
  const wrapped = Object.fromEntries(
    Object.entries(session).map(([key, value]) => [
      key,
      typeof value === 'function' ? value.bind(session) : value,
    ]),
  );
  Object.defineProperty(wrapped, 'identity', {
    enumerable: true,
    get: () => session.identity,
  });
  const snapshot = () => ({ ...session.snapshot(), challenge: progress.snapshot() });
  Object.assign(wrapped, {
    snapshot,
    challengeRules: () => clone(rules),
    async prepare(...args) {
      await session.prepare(...args);
      return snapshot();
    },
    arm(...args) {
      if (!disposed && checkpointKind !== 'restore') return session.arm(...args);
    },
    step(...args) {
      if (stepping) return stepping;
      if (disposed || checkpointing) return Promise.resolve(snapshot());
      stepping = (async () => {
        const state = await session.step(...args);
        if (!disposed) {
          const telemetry = state?.advancedTelemetry ?? session.snapshot().advancedTelemetry;
          if (telemetry) progress.advance(telemetry);
        }
        return snapshot();
      })().finally(() => {
        stepping = null;
      });
      return stepping;
    },
    stepPending: () => Boolean(stepping || checkpointing || session.stepPending?.()),
    exportRecovery() {
      if (checkpointing) return checkpointing.then(() => wrapped.exportRecovery());
      const pendingStep = stepping;
      checkpointKind = 'save';
      checkpointing = (async () => {
        await pendingStep;
        required(!disposed, 'Aircraft challenge was closed');
        const saved = await session.exportRecovery();
        const physical = physicalRecovery(saved);
        const current = progress.snapshot();
        required(
          current.missionTick === physical.checkpoint.state.missionTick &&
            dataIdentity(physical.config?.configuration?.challenge) === dataIdentity(rules),
          'Challenge recovery configuration or mission boundary differs',
        );
        const packet = {
          format: AIRCRAFT_CHALLENGE_RECOVERY,
          rules: clone(rules),
          progress: current,
          session: saved,
        };
        return { ...packet, checksum: recoveryChecksum(packet) };
      })().finally(() => {
        checkpointing = null;
        checkpointKind = null;
      });
      return checkpointing;
    },
    restoreRecovery(source, { signal } = {}) {
      required(!checkpointing && !disposed, 'An aircraft challenge checkpoint is already pending');
      const pendingStep = stepping;
      checkpointKind = 'restore';
      checkpointing = (async () => {
        await pendingStep;
        signal?.throwIfAborted();
        required(!disposed, 'Aircraft challenge was closed');
        const packet = boundedJSON(source, {
          maxBytes: 44 * 1024 * 1024,
          maxNodes: 4000000,
          maxArray: 786432,
          maxString: 16 * 1024 * 1024,
          maxDepth: 48,
        });
        exactKeys(
          packet,
          ['format', 'rules', 'progress', 'session', 'checksum'],
          'Challenge recovery',
        );
        const candidate = createAircraftChallengeProgress(rules, { capacityAh });
        candidate.restore(packet.progress);
        const physical = physicalRecovery(packet.session);
        required(
          packet.format === AIRCRAFT_CHALLENGE_RECOVERY &&
            dataIdentity(validateAircraftChallengeRules(packet.rules)) === dataIdentity(rules) &&
            dataIdentity(physical.config?.configuration?.challenge) === dataIdentity(rules) &&
            packet.progress.missionTick === physical.checkpoint.state.missionTick &&
            (rules.kind !== 'battery-endurance' ||
              (physical.config.aircraft?.battery?.capacityAh === capacityAh &&
                physical.config.aircraft.battery.depletion === true)) &&
            packet.checksum === recoveryChecksum(packet),
          'Aircraft challenge recovery rules, progress, or checksum differs',
        );
        await session.restoreRecovery(packet.session, { signal });
        required(!disposed, 'Aircraft challenge was closed');
        progress.restore(candidate.snapshot());
        return snapshot();
      })().finally(() => {
        checkpointing = null;
        checkpointKind = null;
      });
      return checkpointing;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await session.dispose();
      await stepping?.catch(() => {});
      await checkpointing?.catch(() => {});
    },
  });
  return wrapped;
}
