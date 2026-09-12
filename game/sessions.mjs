import { createRun, releaseInputs } from './core/index.mjs';
import { resolveVersions, versionsForCampaign } from './core/versions.mjs';
import {
  createRecorder,
  exportReplay,
  recordRelease,
  verifyReplayAsync,
  takeReplayMasteryObserver,
  MAX_REPLAY_BYTES,
  MAX_REPLAY_TICKS,
} from './replay.mjs';
import { boundedJSON, exactKeys, stableId, required } from './data-json.mjs';
import { resolveMasteryDefinition } from './mastery.mjs';

export const SESSION_FORMAT = 'xonix-session.v1';
export const CONTINUOUS_SESSION_FORMAT = 'xonix-session.v2';
export const SESSION_STORAGE_BYTES = 2 * 1024 * 1024;
export const SESSION_IMPORT_BYTES = MAX_REPLAY_BYTES + 16384;
const canonical = (v) =>
  v === null || typeof v !== 'object'
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? `[${v.map(canonical).join(',')}]`
      : `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
          .join(',')}}`;
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const stamp = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
function metadata(session) {
  required(
    text(session.campaignKey, 300) &&
      stableId(session.themeId) &&
      stableId(session.bodyId) &&
      text(session.runId, 159),
    'Saved attempt identity is invalid.',
  );
  required(stamp(session.savedAt), 'Saved attempt date must be a valid UTC ISO timestamp.');
}
function continuationValue(value) {
  const owned = boundedJSON(value, { maxBytes: 1024 });
  exactKeys(owned, ['direction'], 'saved flight continuation');
  required(
    owned.direction === null || ['up', 'down', 'left', 'right'].includes(owned.direction),
    'Saved flight continuation must contain a cardinal direction or null.',
  );
  return owned;
}
function envelope(candidate) {
  required(
    candidate !== null && candidate !== undefined,
    'Choose a saved flight file or suspend an unfinished attempt first.',
  );
  const session = boundedJSON(candidate, {
    maxBytes: SESSION_IMPORT_BYTES,
    maxNodes: 3100000,
    maxDepth: 28,
    maxArray: MAX_REPLAY_TICKS,
    maxString: 262144,
  });
  exactKeys(
    session,
    [
      'format',
      'campaignKey',
      'themeId',
      'bodyId',
      'runId',
      'savedAt',
      'replay',
      ...(session.format === CONTINUOUS_SESSION_FORMAT ? ['continuation'] : []),
    ],
    'saved attempt',
  );
  required(
    [SESSION_FORMAT, CONTINUOUS_SESSION_FORMAT].includes(session.format),
    'Unsupported saved attempt format.',
  );
  if (session.format === CONTINUOUS_SESSION_FORMAT)
    session.continuation = continuationValue(session.continuation);
  metadata(session);
  required(
    session.replay !== null && typeof session.replay === 'object' && !Array.isArray(session.replay),
    'Saved attempt replay is missing.',
  );
  resolveVersions({
    levelVersion: session.replay.level?.version,
    ruleset: session.replay.ruleset,
    replayVersion: session.replay.version,
    checkpointAlgorithm: session.replay.checkpoint?.algorithm,
  });
  return session;
}

/** Owned metadata and simulation-pair preflight; does not verify a replay outcome. */
export const snapshotSession = envelope;

export function suspendSession({
  run,
  recorder,
  campaignKey,
  themeId,
  bodyId,
  runId,
  savedAt = new Date().toISOString(),
  continuation,
}) {
  if (!run || !['running', 'respawning'].includes(run.status))
    throw new Error('Only an unfinished attempt can be suspended.');
  metadata({ campaignKey, themeId, bodyId, runId, savedAt });
  required(
    recorder && typeof recorder === 'object',
    'This attempt has no recoverable input recording.',
  );
  const intent = continuation === undefined ? undefined : continuationValue(continuation);
  if (intent === undefined) {
    releaseInputs(run);
    recordRelease(recorder);
  }
  return {
    format: intent === undefined ? SESSION_FORMAT : CONTINUOUS_SESSION_FORMAT,
    campaignKey,
    themeId,
    bodyId,
    runId,
    savedAt,
    ...(intent === undefined ? {} : { continuation: intent }),
    replay: exportReplay(recorder, run),
  };
}

export async function restoreSession(
  candidate,
  { campaign, campaignKey, signal, onProgress, masteryDefinition } = {},
) {
  // Snapshot the entire bounded envelope before the first await. Replay checks
  // alone cannot protect outer metadata or later reads from caller mutation.
  const session = envelope(candidate);
  if (session.campaignKey !== campaignKey)
    throw new Error('This saved attempt belongs to a different campaign or rules revision.');
  const installed = boundedJSON(campaign);
  const versions = versionsForCampaign(installed);
  required(
    session.replay.ruleset === versions.ruleset,
    'Saved attempt and installed campaign simulation versions differ.',
  );
  const mastery =
    masteryDefinition === undefined
      ? undefined
      : {
          definition: resolveMasteryDefinition(masteryDefinition),
          campaignId: installed.id,
          campaignKey: session.campaignKey,
          runId: session.runId,
        };
  const checked = await verifyReplayAsync(session.replay, { signal, onProgress, mastery });
  // A final progress callback can cancel after the verifier's last yield.
  if (signal?.aborted) {
    const error = new Error('Saved attempt verification cancelled.');
    error.name = 'AbortError';
    throw error;
  }
  if (!checked.match)
    throw new Error('Saved attempt verification failed. The current game is unchanged.');
  if (!['running', 'respawning'].includes(checked.state.status))
    throw new Error('This attempt has already ended.');
  const level = installed.levels.find((l) => l.id === checked.state.levelId);
  if (!level) throw new Error('Install the matching campaign pack before loading this attempt.');
  const expected = createRun(level, {
    ...session.replay.options,
    classRecipes: installed.classRecipes,
  });
  if (
    canonical(expected.level) !== canonical(checked.state.level) ||
    canonical(expected.classRecipes ?? installed.classRecipes) !==
      canonical(session.replay.options.classRecipes)
  )
    throw new Error('Saved rules differ from the installed campaign.');
  const recorder = createRecorder(
    session.replay.level,
    session.replay.options,
    session.replay.build,
  );
  recorder.segments = structuredClone(session.replay.segments);
  recorder.ticks = session.replay.ticks;
  recorder.releaseAfter = session.replay.releaseAfter;
  if (session.format === SESSION_FORMAT) {
    releaseInputs(checked.state);
    recordRelease(recorder);
  }
  const { replay: _replay, ...identity } = session;
  if (mastery === undefined) return { session: identity, run: checked.state, recorder };
  // Take only after installed map/roster checks. This in-memory continuation
  // rebuilds preview progress; it is never serialized into the saved envelope.
  const masteryObserver = takeReplayMasteryObserver(checked);
  required(masteryObserver, 'Saved equipment-goal observation could not be reconstructed.');
  return { session: identity, run: checked.state, recorder, masteryObserver };
}

export function saveSession(storage, key, session) {
  let text;
  try {
    text = JSON.stringify(envelope(session));
  } catch (error) {
    return {
      ok: false,
      warning: `The saved attempt is invalid; your previous saved attempt is kept. ${error.message}`,
    };
  }
  if (new TextEncoder().encode(text).length > SESSION_STORAGE_BYTES)
    return {
      ok: false,
      warning:
        'This attempt exceeds the local save budget. Export it to a file; your previous saved attempt is kept.',
    };
  try {
    storage.setItem(key, text);
    return { ok: true, warning: '' };
  } catch {
    return {
      ok: false,
      warning: 'Browser storage is full or unavailable. Export the attempt to keep it.',
    };
  }
}
