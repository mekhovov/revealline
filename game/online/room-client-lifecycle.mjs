import { roomControls } from './room-controls.mjs';
export { ROOM_CONTROL_PROTOCOL } from './room-controls.mjs';

/** Native endpoints require their own approved host policy. A Capacitor hostname
 * of localhost is not a browser development origin. */
export function roomServiceEndpoint(location, configured = '') {
  if (!['http:', 'https:'].includes(location?.protocol)) return null;
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  if (!configured) return local && location.protocol === 'http:' ? 'http://127.0.0.1:8783' : null;
  try {
    const url = new URL(configured);
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !(
        url.protocol === 'https:' ||
        (local &&
          location.protocol === 'http:' &&
          url.protocol === 'http:' &&
          ['127.0.0.1', 'localhost'].includes(url.hostname))
      )
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function terminalRoomError(error) {
  return [
    'SEAT_UNAVAILABLE',
    'ROOM_UNAVAILABLE',
    'ROOM_IDENTITY_MISMATCH',
    'ROOM_PROTOCOL_MISMATCH',
    'ORIGIN_NOT_ALLOWED',
  ].includes(error?.code);
}

/** Artwork preparation must not hold the snapshot poll open after suspension.
 * Fetches share this signal; uninterruptible decodes lose their painter owner
 * immediately, so late completion cannot retain assets or replace a new room. */
export async function prepareRoomBoardPainters(prepare, { signal, timeoutMs = 8000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000)
    throw new TypeError('Room artwork preparation needs a bounded deadline.');
  const controller = new AbortController(),
    painters = [],
    dispose = (painter) => {
      try {
        painter?.dispose?.();
      } catch {
        // Continue retiring other boards even if one presentation cleanup fails.
      }
    };
  let accepting = true,
    completed = false;
  const cancelled = new Promise((resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {
      once: true,
    });
  });
  const abort = () =>
    controller.abort(new DOMException('Room artwork preparation cancelled.', 'AbortError'));
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(
    () =>
      controller.abort(
        Object.assign(new Error('Room artwork preparation timed out. Reconnect to try again.'), {
          code: 'ROOM_ARTWORK_TIMEOUT',
        }),
      ),
    timeoutMs,
  );
  try {
    await Promise.race([
      cancelled,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw controller.signal.reason;
        return prepare({
          signal: controller.signal,
          retain(painter) {
            if (!accepting || controller.signal.aborted) {
              dispose(painter);
              throw (
                controller.signal.reason ??
                new DOMException('Room artwork preparation retired.', 'AbortError')
              );
            }
            painters.push(painter);
            return painter;
          },
        });
      }),
    ]);
    if (controller.signal.aborted) throw controller.signal.reason;
    completed = true;
    return painters;
  } finally {
    accepting = false;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
    if (!completed) {
      abort();
      painters.forEach(dispose);
    }
  }
}

/** Owns browser control activation, never simulation or authoritative outcomes.
 * A sent sequence is consumed even if its response is lost. Pending controls
 * cannot cross a pause, reconnect, new seat or rematch boundary. */
export function createRoomClientLifecycle({ sendInput, onError = () => {}, maxPending = 8 }) {
  if (!Number.isInteger(maxPending) || maxPending < 1 || maxPending > 8)
    throw new TypeError('Room input queue must contain one to eight controls.');
  let owner = null,
    generation = null,
    activation = null,
    sequence = 0,
    epoch = 0,
    phase = 'idle',
    status = null,
    pauseRequired = false,
    pending = [],
    sending = null;
  const canPlay = () => phase === 'connected' && status === 'playing';
  function retire() {
    epoch++;
    pending = [];
    const old = sending;
    sending = null;
    old?.controller.abort();
  }
  function suspend() {
    if (!owner || phase === 'abandoned') return;
    retire();
    phase = 'recovering';
    pauseRequired = true;
  }
  function pump() {
    if (sending || !canPlay() || !pending.length) return;
    const entry = pending.shift();
    const operation = { epoch, owner, controller: new AbortController() };
    sending = operation;
    const input = { ...entry, generation, activation, sequence: ++sequence };
    Promise.resolve()
      .then(() => {
        if (sending !== operation || operation.epoch !== epoch) return;
        return sendInput(input, operation.owner, operation.controller.signal);
      })
      .catch((error) => {
        if (sending !== operation || operation.epoch !== epoch) return;
        suspend();
        onError(error, operation.owner);
      })
      .finally(() => {
        if (sending !== operation) return;
        sending = null;
        pump();
      });
  }
  return Object.freeze({
    own(value, { restoring = false } = {}) {
      retire();
      owner = value;
      generation = null;
      activation = null;
      sequence = 0;
      status = null;
      phase = 'connecting';
      pauseRequired = restoring;
    },
    release() {
      retire();
      owner = null;
      generation = null;
      activation = null;
      sequence = 0;
      status = null;
      phase = 'idle';
      pauseRequired = false;
    },
    abandon() {
      retire();
      phase = 'abandoned';
      pauseRequired = false;
    },
    suspend,
    // Only a completed shared Pause request clears this latch; an old playing
    // snapshot, successful heartbeat or restored page never resumes controls.
    pauseAcknowledged(token) {
      if (token !== epoch || phase === 'abandoned') return false;
      pauseRequired = false;
      return true;
    },
    accept(snapshot, token) {
      if (!owner || token !== epoch || pauseRequired || phase === 'abandoned') return false;
      const acknowledged = snapshot.seats[owner.seat].acknowledged;
      if (generation !== snapshot.generation) {
        retire();
        generation = snapshot.generation;
        sequence = acknowledged;
      } else sequence = Math.max(sequence, acknowledged);
      if (activation !== snapshot.controlActivation) {
        retire();
        // The old activation can no longer admit a delayed request. Rebase to
        // the server acknowledgement, including any timed-out accepted input.
        sequence = acknowledged;
      }
      activation = snapshot.controlActivation;
      if (snapshot.status !== 'playing' && (canPlay() || sending || pending.length)) retire();
      status = snapshot.status;
      phase = status === 'abandoned' ? 'abandoned' : 'connected';
      return true;
    },
    submit(control) {
      if (!canPlay()) return false;
      if (pending.length + (sending ? 1 : 0) >= maxPending) {
        const error = Object.assign(new Error('Room controls are waiting for the connection.'), {
          code: 'INPUT_BACKLOG',
        });
        suspend();
        onError(error, owner);
        return false;
      }
      pending.push(roomControls(control));
      pump();
      return true;
    },
    canPlay,
    snapshot: () => ({
      phase,
      status,
      epoch,
      pauseRequired,
      generation,
      sequence,
      pending: pending.length + (sending ? 1 : 0),
    }),
  });
}
