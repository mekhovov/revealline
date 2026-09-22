import {
  restoreSession,
  saveSession,
  snapshotSession,
  suspendSession,
  SESSION_STORAGE_BYTES,
} from '../sessions.mjs';
import { authoritativeCheckpoint, exportReplay } from '../replay.mjs';
import { canonicalJSON } from '../data-json.mjs';

const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Course entry was cancelled.', 'AbortError');
};

/** Retain a paused real flight before navigating away. The host freezes input
 * without autosaving before calling this function. It owns the writer/context
 * checks and the existing backup lock; this helper never navigates or adopts
 * the reconstructed run. Ready/terminal callers need no checkpoint handoff.
 */
export async function retainFlightForFirstFlight({
  run,
  recorder,
  campaign,
  campaignKey,
  themeId,
  bodyId,
  runId,
  continuation,
  presentationPins,
  visualThemePin,
  mediaIdentityCatalog,
  storage,
  sessionKey,
  withStorageLock,
  assertCurrent,
  assertWritable,
  signal,
  onProgress,
}) {
  if (
    !run ||
    !['running', 'respawning'].includes(run.status) ||
    typeof storage?.getItem !== 'function' ||
    typeof storage?.setItem !== 'function' ||
    typeof sessionKey !== 'string' ||
    !sessionKey ||
    typeof withStorageLock !== 'function' ||
    typeof assertCurrent !== 'function' ||
    typeof assertWritable !== 'function'
  )
    throw new TypeError('Course entry needs an unfinished flight and checked storage adapters.');

  function current() {
    abort(signal);
    assertCurrent();
  }
  let previous;
  await withStorageLock(async () => {
    current();
    await assertWritable();
    current();
    previous = storage.getItem(sessionKey);
    if (previous !== null) {
      if (
        typeof previous !== 'string' ||
        new TextEncoder().encode(previous).length > SESSION_STORAGE_BYTES
      )
        throw new Error('The existing saved flight cannot be read safely. Its bytes were kept.');
      try {
        snapshotSession(JSON.parse(previous));
      } catch {
        throw new Error(
          'The existing saved flight is unreadable or unsupported. Its bytes were kept.',
        );
      }
    }
  });
  current();
  const session = suspendSession({
    run,
    recorder,
    campaignKey,
    themeId,
    bodyId,
    runId,
    continuation,
    presentationPins,
    ...(visualThemePin !== undefined ? { visualThemePin } : {}),
  });
  const checkpoint = canonicalJSON(authoritativeCheckpoint(run));
  const recording = canonicalJSON(session.replay);
  const restored = await restoreSession(session, {
    campaign,
    campaignKey,
    signal,
    onProgress,
    mediaIdentityCatalog,
  });
  current();
  if (canonicalJSON(authoritativeCheckpoint(restored.run)) !== checkpoint)
    throw new Error('The saved flight did not reconstruct the current checkpoint.');

  await withStorageLock(async () => {
    current();
    await assertWritable();
    current();
    if (
      canonicalJSON(authoritativeCheckpoint(run)) !== checkpoint ||
      canonicalJSON(exportReplay(recorder, run)) !== recording
    )
      throw new Error('The flight changed while preparing the course. It remains open here.');
    if (storage.getItem(sessionKey) !== previous)
      throw new Error('The saved flight changed elsewhere. Course entry was cancelled.');
    const saved = saveSession(storage, sessionKey, session);
    if (!saved.ok) throw new Error(saved.warning);
    current();
    let readback;
    try {
      readback = snapshotSession(JSON.parse(storage.getItem(sessionKey)));
    } catch {
      throw new Error('The new saved flight could not be read back. This flight is still paused.');
    }
    if (canonicalJSON(readback) !== canonicalJSON(session))
      throw new Error('The saved flight readback did not match. This flight is still paused.');
  });
  current();
  return { session, checkpoint: authoritativeCheckpoint(restored.run) };
}
