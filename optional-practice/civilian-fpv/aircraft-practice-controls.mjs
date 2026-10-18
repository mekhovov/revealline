import { boundedJSON, exactKeys, required } from '../../game/data-json.mjs';
import { exportJSONFile } from '../../game/platform.mjs';
import { mountAircraftArchiveControls } from './aircraft-archive-controls.mjs';

export const AIRCRAFT_RECOVERY_BYTES = 44 * 1024 * 1024;
const DATABASE = 'revealline.fpv.aircraft-recovery.v1';
const STORE = 'recovery';
const bounds = {
  maxBytes: AIRCRAFT_RECOVERY_BYTES,
  maxNodes: 4000000,
  maxArray: 500000,
  maxString: 16 * 1024 * 1024,
  maxDepth: 48,
};
const abortError = () => new DOMException('Recovery operation cancelled', 'AbortError');
const tickValid = (tick) => Number.isSafeInteger(tick) && tick >= 0;
export function aircraftRecoveryTick(data) {
  if (data?.format === 'AircraftChallengeRecovery.v1') {
    required(
      data.session?.format !== 'AircraftChallengeRecovery.v1',
      'Nested challenge recovery is unsupported',
    );
    const missionTick = aircraftRecoveryTick(data.session);
    required(
      data.progress?.missionTick === missionTick,
      'Challenge and physics recovery clocks do not match',
    );
    return missionTick;
  }
  const tick =
    data?.physical?.checkpoint?.state?.missionTick ??
    data?.simulation?.checkpoint?.state?.missionTick;
  required(tickValid(tick), 'Recovery must identify its accepted mission tick');
  if (data.mission?.state)
    required(data.mission.state.ticks === tick, 'Recovery mission and physics do not match');
  return tick;
}

/** One atomic slot per host. A failed replacement leaves the prior checkpoint
 * untouched. Large snapshots never enter localStorage or a growing archive. */
export function createAircraftRecoveryStore({
  indexedDB = globalThis.indexedDB,
  key = 'academy',
} = {}) {
  required(['academy', 'world'].includes(key), 'Unknown aircraft recovery host');
  let opening = null,
    database = null,
    closed = false;
  const active = new Set();
  function open() {
    if (closed) return Promise.reject(abortError());
    if (!indexedDB) return Promise.reject(new Error('Checkpoint storage is unavailable'));
    if (database) return Promise.resolve(database);
    if (!opening)
      opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        let rejected = false;
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE))
            request.result.createObjectStore(STORE);
        };
        request.onblocked = () => {
          rejected = true;
          reject(new Error('Checkpoint storage is blocked by another tab'));
        };
        request.onerror = () => {
          rejected = true;
          reject(request.error ?? new Error('Checkpoint storage failed to open'));
        };
        request.onsuccess = () => {
          if (closed || rejected) {
            request.result.close();
            reject(abortError());
            return;
          }
          database = request.result;
          database.onversionchange = () => {
            database?.close();
            database = null;
            opening = null;
          };
          resolve(database);
        };
      }).catch((error) => {
        opening = null;
        throw error;
      });
    return opening;
  }
  async function transaction(mode, operation, signal) {
    signal?.throwIfAborted();
    const db = await open();
    signal?.throwIfAborted();
    if (closed) throw abortError();
    return new Promise((resolve, reject) => {
      let tx,
        value,
        complete = false;
      const finish = (failure) => {
        if (complete) return;
        complete = true;
        signal?.removeEventListener('abort', cancel);
        active.delete(cancel);
        if (failure) reject(failure);
        else resolve(value);
      };
      const cancel = () => {
        try {
          tx?.abort();
        } catch {}
        finish(abortError());
      };
      try {
        tx = db.transaction(STORE, mode);
        active.add(cancel);
        signal?.addEventListener('abort', cancel, { once: true });
        tx.oncomplete = () => finish();
        tx.onabort = tx.onerror = () =>
          finish(tx.error ?? new Error('Checkpoint storage transaction failed'));
        const request = operation(tx.objectStore(STORE));
        request.onsuccess = () => {
          value = request.result;
        };
      } catch (error) {
        try {
          tx?.abort();
        } catch {}
        finish(error);
      }
    });
  }
  return {
    async save(source, { signal } = {}) {
      signal?.throwIfAborted();
      const data = boundedJSON(source, bounds),
        missionTick = aircraftRecoveryTick(data);
      const payload = JSON.stringify(data);
      await transaction(
        'readwrite',
        (store) =>
          store.put({ format: 'AircraftRecoverySlot.v1', host: key, missionTick, payload }, key),
        signal,
      );
      return { missionTick, bytes: new TextEncoder().encode(payload).byteLength };
    },
    async load({ signal } = {}) {
      const saved = await transaction('readonly', (store) => store.get(key), signal);
      if (saved === undefined) return null;
      exactKeys(saved, ['format', 'host', 'missionTick', 'payload'], 'Stored recovery');
      required(
        saved.format === 'AircraftRecoverySlot.v1' &&
          saved.host === key &&
          tickValid(saved.missionTick) &&
          typeof saved.payload === 'string',
        'Invalid stored recovery',
      );
      const data = boundedJSON(saved.payload, bounds);
      required(
        aircraftRecoveryTick(data) === saved.missionTick,
        'Stored recovery tick does not match',
      );
      return { missionTick: saved.missionTick, data };
    },
    close() {
      if (closed) return;
      closed = true;
      for (const cancel of active) cancel();
      database?.close();
      database = null;
    },
  };
}

const secondsText = (value) => {
  if (!Number.isFinite(value)) return '—';
  const hundredths = Math.max(0, Math.round(value * 100));
  const seconds = Math.floor(hundredths / 100);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
};

/** Paused-screen controls also receive each live paint for bounded autosave.
 * Persistence never owns the flight clock or pauses on failure. */
export function mountAircraftPracticeControls({
  parent,
  window: win = globalThis.window,
  locale = () => 'en',
  getSession,
  onPause = () => {},
  onRestored = () => {},
  onReference = () => false,
  key = 'academy',
  platformOptions = {},
  workerURL,
  store: suppliedStore,
  exportFile = exportJSONFile,
} = {}) {
  const doc = parent.ownerDocument;
  const store = suppliedStore ?? createAircraftRecoveryStore({ indexedDB: win?.indexedDB, key });
  const root = doc.createElement('section');
  root.className = 'aircraft-practice-controls';
  root.hidden = true;
  parent.append(root);
  const t = (en, uk) => (locale() === 'uk' ? uk : en);
  const heading = doc.createElement('h3'),
    status = doc.createElement('p'),
    operationStatus = doc.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  operationStatus.setAttribute('role', 'status');
  root.append(heading, status, operationStatus);
  const controls = [],
    removers = [];
  let disposed = false,
    operationMessage = () => '',
    owner = null,
    state = null,
    lastAttempt = -1,
    durableTick = null,
    storageError = null,
    pendingSave = null,
    operation = null;
  function listen(node, event, callback) {
    node.addEventListener(event, callback);
    removers.push(() => node.removeEventListener(event, callback));
  }
  function button(action) {
    const node = doc.createElement('button');
    node.type = 'button';
    root.append(node);
    controls.push(node);
    listen(node, 'click', () => {
      if (!disposed && !operation) void action();
    });
    return node;
  }
  const same = (session) => !disposed && getSession() === session && owner === session;
  function paint() {
    const message = operationMessage();
    if (operationStatus.textContent !== message) operationStatus.textContent = message;
    heading.textContent = t('Practice clips & recovery', 'Записи практики й відновлення');
    exportClip.textContent = t('Export recent clip', 'Експортувати останній запис');
    exportRecovery.textContent = t('Export recovery checkpoint', 'Експортувати точку відновлення');
    restore.textContent = t('Restore last saved checkpoint', 'Відновити останню збережену точку');
    fileLabel.firstChild.textContent = t(
      'Import recovery checkpoint',
      'Імпортувати точку відновлення',
    );
    file.setAttribute(
      'aria-label',
      t('Import recovery checkpoint', 'Імпортувати точку відновлення'),
    );
    cancel.textContent = t('Cancel recovery', 'Скасувати відновлення');
    cancel.hidden = !operation?.cancellable;
    for (const node of controls) node.disabled = Boolean(operation);
    file.disabled = Boolean(operation);
    const recording = state?.recordingStatus ?? state?.advancedTelemetry?.recordingStatus;
    const range =
      recording?.retainedFromSeconds !== null &&
      Number.isFinite(recording?.retainedFromSeconds) &&
      Number.isFinite(recording?.retainedThroughSeconds)
        ? `${secondsText(recording.retainedFromSeconds)}–${secondsText(recording.retainedThroughSeconds)}`
        : t('unavailable', 'недоступно');
    const recoverable = durableTick === null ? recording?.lastRecoverableSeconds : durableTick / 50;
    const storage = storageError
      ? t('Storage unavailable; flying continues.', 'Сховище недоступне; політ триває.')
      : pendingSave
        ? t('Saving checkpoint…', 'Збереження точки…')
        : Number.isFinite(recoverable)
          ? t('Checkpoint saved.', 'Точку збережено.')
          : t(
              'No checkpoint saved for this flight yet.',
              'Для цього польоту ще немає збереженої точки.',
            );
    status.textContent = `${t('Recent clip', 'Останній запис')}: ${range}. ${t('Last durable checkpoint', 'Остання надійно збережена точка')}: ${Number.isFinite(recoverable) ? secondsText(recoverable) : '—'}. ${storage}`;
  }
  async function report(session, update) {
    if (typeof session.reportPersistence !== 'function') return;
    try {
      await session.reportPersistence(update);
    } catch {
      /* Reporting must never own flight progress. */
    }
  }
  function cancelSave() {
    pendingSave?.controller.abort();
  }
  function cancelOperation() {
    const cancelled = operation;
    cancelled?.controller.abort();
    if (cancelled) {
      operation = null;
      operationMessage = () => t('Recovery cancelled.', 'Відновлення скасовано.');
      if (!disposed) paint();
    }
  }
  async function run(action, { cancellable = false } = {}) {
    const session = getSession();
    if (!same(session) || operation || root.hidden) return;
    cancelSave();
    const job = { controller: new AbortController(), cancellable };
    operation = job;
    operationMessage = () => t('Preparing…', 'Підготовка…');
    paint();
    try {
      await action(session, job.controller.signal);
    } catch (error) {
      if (same(session) && operation === job)
        operationMessage = () =>
          error.name === 'AbortError'
            ? t('Recovery cancelled.', 'Відновлення скасовано.')
            : `${t('Could not complete', 'Не вдалося завершити')}: ${error.message}`;
    } finally {
      if (operation === job) operation = null;
      if (!disposed) paint();
    }
  }
  async function download(session, signal, read, name) {
    const data = await read();
    signal.throwIfAborted();
    if (!same(session)) throw abortError();
    const result = await exportFile(data, name, {
      documentRef: doc,
      locationRef: win?.location,
      ...platformOptions,
    });
    if (!same(session)) return;
    operationMessage = () =>
      result?.status === 'cancelled'
        ? t('Export cancelled.', 'Експорт скасовано.')
        : t(
            'Export requested. Check the selected destination.',
            'Експорт запитано. Перевірте вибране місце призначення.',
          );
  }
  const exportClip = button(() =>
    run((session, signal) =>
      download(session, signal, () => session.recording(), 'aircraft-practice-clip.json'),
    ),
  );
  const exportRecovery = button(() =>
    run((session, signal) =>
      download(session, signal, () => session.exportRecovery(), 'aircraft-practice-recovery.json'),
    ),
  );
  async function restoreData(session, data, signal) {
    signal.throwIfAborted();
    if (!same(session)) throw abortError();
    await onPause();
    signal.throwIfAborted();
    if (!same(session)) throw abortError();
    await session.restoreRecovery(data, { signal });
    signal.throwIfAborted();
    if (!same(session)) throw abortError();
    state = session.snapshot();
    try {
      onRestored(session, state);
    } catch {
      /* Optional observations cannot fail a committed restore. */
    }
    lastAttempt = state.ticks ?? 0;
    durableTick = null;
    operationMessage = () =>
      t(
        'Checkpoint restored. The flight remains paused; arm when ready.',
        'Точку відновлено. Політ залишається на паузі; запустіть двигуни, коли будете готові.',
      );
  }
  const restore = button(() =>
    run(
      async (session, signal) => {
        const saved = await store.load({ signal });
        if (!saved)
          throw new Error(
            t('No saved checkpoint is available.', 'Немає збереженої точки відновлення.'),
          );
        await restoreData(session, saved.data, signal);
        durableTick = saved.missionTick;
        await report(session, { savedThroughMission: saved.missionTick });
      },
      { cancellable: true },
    ),
  );
  const fileLabel = doc.createElement('label');
  fileLabel.append(doc.createTextNode(''));
  const file = doc.createElement('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  fileLabel.append(file);
  root.append(fileLabel);
  listen(file, 'change', () => {
    const selected = file.files?.[0];
    file.value = '';
    if (!selected || operation || disposed) return;
    void run(
      async (session, signal) => {
        required(
          Number.isFinite(selected.size) &&
            selected.size > 0 &&
            selected.size <= AIRCRAFT_RECOVERY_BYTES,
          t('Recovery file exceeds 44 MiB.', 'Файл відновлення перевищує 44 МіБ.'),
        );
        const text = await selected.text();
        signal.throwIfAborted();
        const data = boundedJSON(text, bounds);
        aircraftRecoveryTick(data);
        await restoreData(session, data, signal);
      },
      { cancellable: true },
    );
  });
  const cancel = doc.createElement('button');
  cancel.type = 'button';
  root.append(cancel);
  listen(cancel, 'click', cancelOperation);
  async function autosave(session, ticks) {
    const job = { controller: new AbortController(), session };
    pendingSave = job;
    lastAttempt = ticks;
    paint();
    try {
      const data = await session.exportRecovery();
      job.controller.signal.throwIfAborted();
      if (!same(session)) throw abortError();
      const saved = await store.save(data, { signal: job.controller.signal });
      if (!same(session)) return;
      durableTick = saved.missionTick;
      storageError = null;
      await report(session, { savedThroughMission: saved.missionTick });
    } catch (error) {
      if (same(session) && error.name !== 'AbortError') {
        storageError = error.message;
        await report(session, { error: error.message });
      }
    } finally {
      if (pendingSave === job) pendingSave = null;
      if (!disposed) paint();
    }
  }
  const archives = mountAircraftArchiveControls({
    parent: root,
    window: win,
    locale,
    getSession,
    onPause,
    onReference,
    key,
    platformOptions,
    workerURL,
    exportFile,
  });
  paint();
  return {
    root,
    update(next) {
      if (disposed) return;
      const session = getSession();
      if (session !== owner) {
        cancelSave();
        cancelOperation();
        owner = session;
        lastAttempt = -1;
        durableTick = null;
        storageError = null;
        operationMessage = () => '';
      }
      state = next;
      archives.update(next);
      root.hidden = !(
        session &&
        (typeof session.aircraft === 'function' || Number.isFinite(next?.aircraftRadiusMm))
      );
      const ticks = next?.ticks;
      if (tickValid(ticks) && ticks < lastAttempt) lastAttempt = ticks;
      paint();
      if (
        !root.hidden &&
        !operation &&
        !pendingSave &&
        typeof session.exportRecovery === 'function' &&
        tickValid(ticks) &&
        ticks >= 250 &&
        (lastAttempt < 0 || ticks - lastAttempt >= 250)
      )
        void autosave(session, ticks);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelSave();
      cancelOperation();
      for (const remove of removers) remove();
      store.close?.();
      archives.dispose();
      root.remove();
    },
  };
}
