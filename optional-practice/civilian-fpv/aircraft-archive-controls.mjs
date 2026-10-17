import { exportJSONFile } from '../../game/platform.mjs';
import { createAircraftArchiveStore } from './aircraft-archive.mjs';
import { verifyAircraftArchiveInWorker } from './aircraft-archive-verifier.mjs';

const PACKAGE_BYTES = 32 * 1024 * 1024;
const cancelled = () => new DOMException('Archive operation cancelled', 'AbortError');
const clock = (tick) => {
  const seconds = Math.floor((tick ?? 0) / 50);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Archive storage is optional and never owns the flight clock. There is one
 * pending segment operation; falling behind stops archival rather than growing
 * a queue or preventing an accepted physics step. */
export function mountAircraftArchiveControls({
  parent,
  window: win = globalThis.window,
  locale = () => 'en',
  getSession,
  onPause = () => {},
  key = 'academy',
  platformOptions = {},
  workerURL,
  store: suppliedStore,
  exportFile = exportJSONFile,
  verify = verifyAircraftArchiveInWorker,
  makeId = () => globalThis.crypto.randomUUID(),
} = {}) {
  const doc = parent.ownerDocument;
  const store = suppliedStore ?? createAircraftArchiveStore({ indexedDB: win?.indexedDB });
  const root = doc.createElement('section');
  root.className = 'aircraft-archive-controls';
  root.hidden = true;
  const heading = doc.createElement('h3'),
    status = doc.createElement('p'),
    result = doc.createElement('p'),
    explanation = doc.createElement('p'),
    select = doc.createElement('select');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  result.setAttribute('role', 'status');
  root.append(heading, status, explanation, select, result);
  parent.append(root);
  const removers = [],
    buttons = [];
  const retirements = new Set();
  let disposed = false,
    owner = null,
    context = null,
    state = null,
    work = null,
    operation = null,
    rows = [],
    lastPollTick = -1,
    listLoaded = false;
  const t = (en, uk) => (locale() === 'uk' ? uk : en);
  const listen = (node, event, fn) => {
    node.addEventListener(event, fn);
    removers.push(() => node.removeEventListener(event, fn));
  };
  const button = (fn) => {
    const node = doc.createElement('button');
    node.type = 'button';
    root.append(node);
    buttons.push(node);
    listen(node, 'click', () => {
      if (!disposed && !operation) void fn();
    });
    return node;
  };
  const current = (session) => !disposed && getSession() === session && owner === session;
  function renderRows() {
    const selected = select.value;
    select.replaceChildren();
    for (const row of rows) {
      const option = doc.createElement('option');
      option.value = row.id;
      option.textContent = `${row.name || row.host} · ${clock(row.startTick)}–${clock(row.endTick)} · ${row.state === 'ended' ? t('finished', 'завершено') : t('open / incomplete', 'відкрито / неповний')}`;
      select.append(option);
    }
    if (rows.some((row) => row.id === selected)) select.value = selected;
  }
  function paint() {
    heading.textContent = t('Saved flight sessions', 'Збережені льотні сесії');
    explanation.textContent = t(
      'Sessions save locally up to 32 MiB each, 128 MiB total and 16 sessions. Nothing is deleted automatically. Finish an archive to save its final segment; flying can continue. All aircraft archives are unscored.',
      'Сесії зберігаються на пристрої: до 32 МіБ кожна, 128 МіБ загалом і 16 сесій. Автоматичного видалення немає. Завершіть архів, щоб зберегти останній сегмент; політ можна продовжити. Усі архіви дронів без заліку.',
    );
    const saved = context?.manifest;
    status.textContent = context?.error
      ? `${t('Archive stopped; flying continues', 'Архівування зупинено; політ триває')}. ${t('Saved through', 'Збережено до')} ${clock(saved?.endTick)}. ${context.error}`
      : context?.stopped
        ? `${t('Archive finished through', 'Архів завершено до')} ${clock(saved?.endTick)}.`
        : saved
          ? `${t('Archiving on this device', 'Архівування на цьому пристрої')}. ${t('Saved through', 'Збережено до')} ${clock(saved.endTick)}.`
          : t('Preparing local archive…', 'Підготовка локального архіву…');
    select.setAttribute('aria-label', t('Saved session archive', 'Архів збереженої сесії'));
    finish.textContent = t('Finish current archive', 'Завершити поточний архів');
    refresh.textContent = t('Refresh saved sessions', 'Оновити збережені сесії');
    download.textContent = t('Export selected archive', 'Експортувати вибраний архів');
    verifyButton.textContent = t('Verify selected archive', 'Перевірити вибраний архів');
    remove.textContent = t('Delete selected local archive', 'Видалити вибраний локальний архів');
    importText.textContent = t('Import session archive', 'Імпортувати архів сесії');
    file.setAttribute('aria-label', importText.textContent);
    cancel.textContent = t('Cancel archive operation', 'Скасувати операцію з архівом');
    cancel.hidden = !operation;
    for (const node of buttons) node.disabled = Boolean(operation);
    finish.disabled ||= !context?.manifest || Boolean(context?.stopped);
    for (const node of [download, verifyButton, remove]) node.disabled ||= !select.value;
    select.disabled = Boolean(operation);
    file.disabled = Boolean(operation);
  }
  async function refreshRows(signal) {
    rows = await store.list({ signal });
    signal?.throwIfAborted();
    if (disposed) return;
    listLoaded = true;
    renderRows();
  }
  async function interrupt(ctx, reason, signal) {
    if (!ctx?.manifest || ctx.manifest.state !== 'open') return;
    ctx.manifest = await store.finish(
      ctx.id,
      {
        reason,
        endTick: ctx.manifest.endTick,
        finalHash: ctx.manifest.finalHash,
      },
      { expectedRevision: ctx.manifest.revision, signal },
    );
    ctx.stopped = true;
  }
  function retire(ctx, pending) {
    if (!ctx || ctx.stopped) return;
    // At most sixteen saved manifests exist. This closes their small metadata
    // records after the one pending segment write; it never captures a new tail.
    const task = Promise.resolve(pending?.promise)
      .then(() => interrupt(ctx, 'interrupted'))
      .catch(() => {
        /* An unclosed manifest remains explicitly incomplete. */
      })
      .finally(() => retirements.delete(task));
    retirements.add(task);
  }
  async function consume(session, signal, { finishAt = null } = {}) {
    for (let count = 0; count < 4; count++) {
      signal.throwIfAborted();
      if (!current(session)) throw cancelled();
      let envelope = await session.readSealedSegment(context?.afterIndex ?? -1);
      signal.throwIfAborted();
      if (!current(session)) throw cancelled();
      if (context && context.generation !== envelope.generation) {
        await interrupt(context, 'interrupted', signal);
        context = null;
        envelope = await session.readSealedSegment(-1);
        signal.throwIfAborted();
        if (!current(session)) throw cancelled();
      }
      if (!context) {
        const initialCursor =
          envelope.origin.kind === 'checkpoint' ? Math.max(-1, envelope.earliestIndex - 1) : -1;
        if (initialCursor !== -1) {
          envelope = await session.readSealedSegment(initialCursor);
          signal.throwIfAborted();
          if (!current(session)) throw cancelled();
        }
        const ctx = {
          id: makeId(),
          session,
          generation: envelope.generation,
          afterIndex: initialCursor,
          manifest: null,
          stopped: false,
          error: null,
        };
        context = ctx;
        ctx.manifest = await store.begin(
          {
            id: ctx.id,
            host: key,
            identity: envelope.identity,
            config: envelope.config,
            origin: envelope.origin,
            name: `${key === 'academy' ? 'Academy' : 'World'} · ${new Date().toISOString()}`,
          },
          { signal },
        );
        if (!current(session)) throw cancelled();
      }
      if (context.stopped) return;
      if (envelope.gap) {
        await interrupt(context, 'gap', signal);
        throw new Error(t('A recording segment was missed.', 'Пропущено сегмент запису.'));
      }
      if (!envelope.segment || (finishAt !== null && envelope.segment.index > finishAt)) return;
      const ctx = context;
      ctx.manifest = await store.append(ctx.id, envelope.segment, {
        expectedRevision: ctx.manifest.revision,
        signal,
      });
      ctx.afterIndex = envelope.segment.index;
      if (!current(session) || context !== ctx) throw cancelled();
      if (finishAt !== null && ctx.afterIndex >= finishAt) return;
    }
  }
  function background(session) {
    if (work || operation || context?.stopped) return;
    const job = { controller: new AbortController(), promise: null };
    work = job;
    job.promise = consume(session, job.controller.signal)
      .catch((error) => {
        if (current(session) && error.name !== 'AbortError') {
          context ??= {
            session,
            manifest: null,
            generation:
              state?.archiveStatus?.generation ??
              state?.advancedTelemetry?.archiveStatus?.generation,
          };
          context.error = error.message;
          context.stopped = true;
        }
      })
      .finally(() => {
        if (work === job) work = null;
        if (!disposed) paint();
      });
  }
  async function run(action) {
    if (disposed || operation || root.hidden) return;
    const job = { controller: new AbortController() };
    operation = job;
    result.textContent = t('Preparing…', 'Підготовка…');
    paint();
    try {
      await work?.promise;
      job.controller.signal.throwIfAborted();
      await action(job.controller.signal);
    } catch (error) {
      if (!disposed && operation === job)
        result.textContent =
          error.name === 'AbortError'
            ? t('Archive operation cancelled.', 'Операцію з архівом скасовано.')
            : `${t('Could not complete', 'Не вдалося завершити')}: ${error.message}`;
    } finally {
      if (operation === job) operation = null;
      if (!disposed) paint();
    }
  }
  const finish = button(() =>
    run(async (signal) => {
      const session = getSession();
      await onPause();
      await consume(session, signal);
      if (!context?.manifest || context.stopped) return;
      const envelope = await session.finalizeArchive(context.afterIndex);
      signal.throwIfAborted();
      if (!current(session) || envelope.generation !== context.generation) throw cancelled();
      await consume(session, signal, { finishAt: envelope.finalizedThroughIndex });
      if (context.stopped || context.afterIndex !== envelope.finalizedThroughIndex)
        throw new Error(t('Archive tail is incomplete.', 'Кінець архіву неповний.'));
      await interrupt(context, 'ended', signal);
      result.textContent = t(
        'Archive finished. The flight remains paused.',
        'Архів завершено. Політ залишається на паузі.',
      );
      await refreshRows(signal);
      select.value = context.id;
    }),
  );
  const refresh = button(() => run((signal) => refreshRows(signal)));
  const download = button(() =>
    run(async (signal) => {
      const packet = await store.exportPackage(select.value, { signal });
      signal.throwIfAborted();
      const outcome = await exportFile(packet, 'aircraft-session-archive.json', {
        documentRef: doc,
        locationRef: win?.location,
        ...platformOptions,
      });
      result.textContent =
        outcome?.status === 'cancelled'
          ? t('Export cancelled.', 'Експорт скасовано.')
          : t(
              'Export requested. Check the selected destination.',
              'Експорт запитано. Перевірте вибране місце призначення.',
            );
    }),
  );
  const verifyButton = button(() =>
    run(async (signal) => {
      const packet = await store.exportPackage(select.value, { signal });
      const verified = await verify(packet, {
        signal,
        Worker: win?.Worker,
        ...(workerURL ? { workerURL } : {}),
        onProgress: () => {
          if (!disposed)
            result.textContent = t('Verifying recorded physics…', 'Перевірка записаної фізики…');
        },
      });
      signal.throwIfAborted();
      result.textContent =
        verified.verificationScope === 'complete-session'
          ? t(
              'Complete session physics verified from reset. Unscored.',
              'Фізику повної сесії перевірено від початкового стану. Без заліку.',
            )
          : t(
              'Clip physics verified from its starting checkpoint. This does not verify an earlier flight. Unscored.',
              'Фізику фрагмента перевірено від початкової точки. Це не перевіряє попередній політ. Без заліку.',
            );
    }),
  );
  const remove = button(() =>
    run(async (signal) => {
      const row = rows.find((entry) => entry.id === select.value);
      if (!row) return;
      if (context?.id === row.id && !context.stopped)
        throw new Error(
          t(
            'Finish the current archive before deleting it.',
            'Завершіть поточний архів перед видаленням.',
          ),
        );
      if (
        !win?.confirm?.(
          t(
            'Delete this local archive? Export it first if you want to keep it.',
            'Видалити цей локальний архів? Спочатку експортуйте його, якщо хочете зберегти.',
          ),
        )
      )
        return;
      signal.throwIfAborted();
      await store.delete(row.id, { expectedRevision: row.revision, signal });
      await refreshRows(signal);
      result.textContent = t('Local archive deleted.', 'Локальний архів видалено.');
    }),
  );
  const label = doc.createElement('label'),
    importText = doc.createElement('span'),
    file = doc.createElement('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  label.append(importText, file);
  root.append(label);
  listen(file, 'change', () => {
    const selected = file.files?.[0];
    file.value = '';
    if (!selected || operation || disposed) return;
    void run(async (signal) => {
      if (!Number.isFinite(selected.size) || selected.size <= 0 || selected.size > PACKAGE_BYTES)
        throw new Error(t('Archive file exceeds 32 MiB.', 'Файл архіву перевищує 32 МіБ.'));
      const text = await selected.text();
      signal.throwIfAborted();
      const manifest = await store.importPackage(text, { id: makeId(), signal });
      await refreshRows(signal);
      select.value = manifest.id;
      result.textContent = t(
        'Archive imported. Verify it to check recorded physics.',
        'Архів імпортовано. Перевірте записану фізику.',
      );
    });
  });
  const cancel = doc.createElement('button');
  cancel.type = 'button';
  root.append(cancel);
  listen(cancel, 'click', () => operation?.controller.abort());
  listen(select, 'change', paint);
  paint();
  return {
    root,
    update(next) {
      if (disposed) return;
      const session = getSession();
      if (session !== owner) {
        work?.controller.abort();
        operation?.controller.abort();
        retire(context, work);
        owner = session;
        context = null;
        lastPollTick = -1;
      }
      state = next;
      const archive = state?.archiveStatus ?? state?.advancedTelemetry?.archiveStatus;
      root.hidden =
        typeof session?.readSealedSegment !== 'function' ||
        !archive ||
        state?.reason === 'preparing-aircraft';
      if (!root.hidden && !work && !operation) {
        if (!listLoaded) {
          listLoaded = true;
          void refreshRows().catch(() => {
            /* The active writer reports storage errors. */
          });
        }
        const tick = state?.ticks ?? 0;
        if (
          !context ||
          (archive?.generation !== undefined && archive.generation !== context.generation) ||
          (!context.stopped &&
            (archive?.lastSealedIndex > context.afterIndex || tick - lastPollTick >= 50))
        ) {
          if (
            archive?.generation !== undefined &&
            archive.generation !== context?.generation &&
            context?.stopped
          )
            context = null;
          lastPollTick = tick;
          background(session);
        }
      }
      paint();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      work?.controller.abort();
      operation?.controller.abort();
      retire(context, work);
      for (const fn of removers) fn();
      void Promise.allSettled([...retirements]).finally(() => store.close?.());
      root.remove();
    },
  };
}
