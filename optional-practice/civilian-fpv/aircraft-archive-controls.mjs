import { exportJSONFile } from '../../game/platform.mjs';
import { createAircraftArchiveStore } from './aircraft-archive.mjs';
import {
  verifyAircraftArchiveInWorker,
  verifyAircraftCourseArchiveInWorker,
} from './aircraft-archive-verifier.mjs';

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
  onReference = () => false,
  key = 'academy',
  platformOptions = {},
  workerURL,
  store: suppliedStore,
  exportFile = exportJSONFile,
  verify = verifyAircraftArchiveInWorker,
  verifyCourse = verifyAircraftCourseArchiveInWorker,
  makeId = () => globalThis.crypto.randomUUID(),
} = {}) {
  const doc = parent.ownerDocument;
  const store = suppliedStore ?? createAircraftArchiveStore({ indexedDB: win?.indexedDB });
  const root = doc.createElement('section');
  root.className = 'aircraft-archive-controls';
  root.hidden = true;
  const heading = doc.createElement('h3'),
    status = doc.createElement('p'),
    inventoryStatus = doc.createElement('p'),
    result = doc.createElement('p'),
    courseHelp = doc.createElement('p'),
    explanation = doc.createElement('p'),
    select = doc.createElement('select');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  result.setAttribute('role', 'status');
  inventoryStatus.setAttribute('role', 'status');
  root.append(heading, status, explanation, inventoryStatus, select, courseHelp, result);
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
    rowsLocale = null,
    inventoryError = null,
    lastPollTick = -1,
    listLoaded = false,
    activeCourse = null,
    courseView = null;
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
  const generation = () =>
    (state?.archiveStatus ?? state?.advancedTelemetry?.archiveStatus)?.generation;
  const courseTitle = (course) =>
    course?.locales?.[locale()]?.title ?? course?.locales?.en?.title ?? course?.id ?? '';
  const setResult = (text) => {
    if (result.textContent !== text) result.textContent = text;
  };
  const applyReference = (session, value) => {
    try {
      return onReference(session, value) === true;
    } catch {
      return false;
    }
  };
  function clearCourse() {
    if (!courseView) return;
    if (courseView.referenceSelected) applyReference(courseView.session, null);
    operation?.controller.abort();
    courseView = null;
    setResult('');
  }
  function referenceMatches() {
    try {
      const report = courseView?.report;
      if (
        !courseView?.valid() ||
        !report?.physics?.verified ||
        report.physics.verificationScope !== 'complete-session' ||
        !report.course?.verified ||
        report.course.missionHz !== 50
      )
        return false;
      const actual = owner?.referenceIdentity?.(),
        expected = report.course.referenceIdentity;
      return ['configurationClass', 'terrainIdentity'].every(
        (key) => /^[0-9a-f]{16}$/.test(actual?.[key]) && actual[key] === expected?.[key],
      );
    } catch {
      return false;
    }
  }
  function renderCourse() {
    if (!courseView) return;
    const { name, course, mode, phase, report, error } = courseView;
    const subject = `${name} · ${courseTitle(course)}${mode ? ` · ${mode === 'acro' ? 'Acro' : mode === 'angle' || mode === 'self-level' ? t('Self-level', 'Самовирівнювання') : mode}` : ''}. `;
    let text;
    if (error)
      text =
        error.name === 'AbortError'
          ? t('Course verification cancelled.', 'Перевірку курсу скасовано.')
          : `${t('Could not verify course', 'Не вдалося перевірити курс')}: ${error.message}`;
    else if (!report)
      text =
        phase === 'course'
          ? t('Checking recorded course objectives…', 'Перевірка записаних завдань курсу…')
          : t('Verifying recorded physics…', 'Перевірка записаної фізики…');
    else if (report.course.verified)
      text = `${t('Recorded course completion verified', 'Завершення курсу в записі перевірено')}: ${(report.course.completedAtTick / report.course.missionHz).toFixed(2)} ${t('s', 'с')}. ${t('Unscored. The current flight is unchanged.', 'Без заліку. Поточний політ не змінено.')}`;
    else {
      const reason = report.course.reason;
      text = `${t('Recorded physics verified. Course completion not verified.', 'Записану фізику перевірено. Завершення курсу не підтверджено.')} ${
        reason === 'incomplete-course'
          ? t('The course was not completed in this archive.', 'Курс не завершено в цьому архіві.')
          : reason === 'course-needs-complete-reset-session'
            ? t(
                'A complete session from reset is required; this archive is a clip.',
                'Потрібна повна сесія від початку; цей архів є фрагментом.',
              )
            : reason === 'course-identity-mismatch'
              ? t(
                  'This archive belongs to a different course or revision.',
                  'Цей архів належить до іншого курсу або його версії.',
                )
              : `${t('Unsupported course or recording', 'Непідтримуваний курс або запис')}: ${reason}`
      } ${t('Unscored.', 'Без заліку.')}`;
    }
    setResult(subject + text);
  }
  function renderRows() {
    rowsLocale = locale();
    const selected = select.value;
    select.replaceChildren();
    for (const row of rows) {
      const option = doc.createElement('option');
      option.value = row.id;
      option.textContent = `${row.name || row.host} · ${clock(row.startTick)}–${clock(row.endTick)} · ${row.state === 'ended' ? t('finished', 'завершено') : t('open / incomplete', 'відкрито / неповний')}`;
      select.append(option);
    }
    select.value = rows.some((row) => row.id === selected) ? selected : (rows[0]?.id ?? '');
  }
  function paint() {
    if (rowsLocale !== locale()) renderRows();
    heading.textContent = t('Saved flight sessions', 'Збережені льотні сесії');
    explanation.textContent = t(
      'Sessions save locally after flight begins, up to 32 MiB each, 128 MiB total and 16 sessions. Nothing is deleted automatically. Finish an archive to save its final segment; flying can continue. All aircraft archives are unscored.',
      'Сесії зберігаються на пристрої після початку польоту: до 32 МіБ кожна, 128 МіБ загалом і 16 сесій. Автоматичного видалення немає. Завершіть архів, щоб зберегти останній сегмент; політ можна продовжити. Усі архіви дронів без заліку.',
    );
    const saved = context?.manifest,
      reason =
        context?.error === 'Aircraft archive storage is full; delete an archive to make space'
          ? t(context.error, 'Сховище архівів заповнене; видаліть архів, щоб звільнити місце')
          : context?.error;
    status.textContent = context?.error
      ? `${t('Archive stopped; flying continues', 'Архівування зупинено; політ триває')}. ${t('Saved through', 'Збережено до')} ${clock(saved?.endTick)}. ${reason}`
      : context?.stopped
        ? `${t('Archive finished through', 'Архів завершено до')} ${clock(saved?.endTick)}.`
        : saved
          ? `${t('Archiving on this device', 'Архівування на цьому пристрої')}. ${t('Saved through', 'Збережено до')} ${clock(saved.endTick)}.`
          : context
            ? t(
                'Ready to archive when flight begins.',
                'Готово до архівування після початку польоту.',
              )
            : t('Preparing local archive…', 'Підготовка локального архіву…');
    inventoryStatus.hidden = !inventoryError;
    inventoryStatus.textContent = inventoryError
      ? `${t(
          'Could not load saved sessions. The list may be incomplete. Use Refresh saved sessions to try again.',
          'Не вдалося завантажити збережені сесії. Поточний список може бути неповним. Спробуйте ще раз кнопкою «Оновити збережені сесії».',
        )} ${inventoryError}`
      : '';
    select.setAttribute('aria-label', t('Saved session archive', 'Архів збереженої сесії'));
    finish.textContent = t('Finish current archive', 'Завершити поточний архів');
    refresh.textContent = t('Refresh saved sessions', 'Оновити збережені сесії');
    download.textContent = t('Export selected archive', 'Експортувати вибраний архів');
    verifyButton.textContent = t('Verify selected archive', 'Перевірити вибраний архів');
    courseButton.textContent = t('Verify course completion', 'Перевірити завершення курсу');
    referenceButton.textContent = courseView?.referenceSelected
      ? t('Clear split reference', 'Прибрати орієнтир часу')
      : t('Use as split reference', 'Використати як орієнтир часу');
    referenceButton.hidden = !courseView?.report?.course?.verified;
    courseHelp.textContent = activeCourse
      ? `${t('Check the selected archive against this frozen course', 'Перевірити вибраний архів за цією версією курсу')}: ${courseTitle(activeCourse)}. ${t('Uses the recorded aircraft, settings and mode. Static hold, gate and landing objectives only; unscored.', 'Використовує записані дрон, налаштування та режим. Лише статичні завдання утримання, воріт і посадки; без заліку.')}`
      : t(
          'Course completion checks are available in Academy and World course practice. Physics verification remains available here.',
          'Перевірка завершення курсу доступна у практиці курсів Академії та Світу. Перевірка фізики тут доступна.',
        );
    remove.textContent = t('Delete selected local archive', 'Видалити вибраний локальний архів');
    importText.textContent = t('Import session archive', 'Імпортувати архів сесії');
    file.setAttribute('aria-label', importText.textContent);
    cancel.textContent = t('Cancel archive operation', 'Скасувати операцію з архівом');
    cancel.hidden = !operation;
    for (const node of buttons) node.disabled = Boolean(operation);
    finish.disabled ||= !context?.manifest || Boolean(context?.stopped);
    for (const node of [download, verifyButton, remove]) node.disabled ||= !select.value;
    courseButton.disabled ||= !select.value || !activeCourse;
    referenceButton.disabled ||= !courseView?.referenceSelected && !referenceMatches();
    select.disabled = Boolean(operation);
    file.disabled = Boolean(operation);
    renderCourse();
    if (!referenceButton.hidden)
      courseHelp.textContent += ` ${
        referenceMatches()
          ? t(
              'Compatible unscored split reference. Resume to compare; restarting requires selecting the reference again.',
              'Сумісний орієнтир часу без заліку. Продовжте політ для порівняння; після перезапуску виберіть орієнтир знову.',
            )
          : t(
              'Split reference unavailable: aircraft, controller, course or terrain settings differ, or the flight is not ready.',
              'Орієнтир часу недоступний: відрізняються налаштування дрона, контролера, курсу чи місцевості, або політ не готовий.',
            )
      }`;
  }
  async function refreshRows(signal) {
    let next;
    try {
      next = await store.list({ signal });
    } catch (error) {
      if (!disposed && error.name !== 'AbortError') {
        inventoryError = error.message;
        paint();
      }
      throw error;
    }
    signal?.throwIfAborted();
    if (disposed) return;
    rows = next;
    inventoryError = null;
    listLoaded = true;
    renderRows();
    paint();
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
          startTick: envelope.origin.startTick,
          manifest: null,
          stopped: false,
          error: null,
        };
        context = ctx;
      }
      if (context.stopped) return;
      if (!context.manifest) {
        // Preparing a paused aircraft or restoring its exact starting checkpoint
        // is not a flight. Retain only an in-memory cursor until simulation progress
        // exists; the recorder still owns the original checkpoint and full tail.
        if (!envelope.segment && envelope.latestTick <= context.startTick) return;
        const ctx = context;
        ctx.manifest = await store.begin(
          {
            id: ctx.id,
            host: key,
            identity: envelope.identity,
            config: envelope.config,
            origin: envelope.origin,
            name: `${key === 'academy' ? t('Academy', 'Академія') : key === 'arena' ? t('Advanced practice', 'Розширена практика') : t('World', 'Світ')} · ${new Date().toISOString()}`,
          },
          { signal },
        );
        if (!current(session)) throw cancelled();
      }
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
  async function run(action, valid = null) {
    if (disposed || operation || root.hidden) return;
    if (!valid) clearCourse();
    const job = { controller: new AbortController() };
    operation = job;
    result.textContent = t('Preparing…', 'Підготовка…');
    paint();
    try {
      await work?.promise;
      job.controller.signal.throwIfAborted();
      if (valid && !valid()) throw cancelled();
      await action(job.controller.signal);
    } catch (error) {
      if (!disposed && operation === job && (!valid || valid())) {
        if (valid) courseView.error = error;
        else
          result.textContent =
            error.name === 'AbortError'
              ? t('Archive operation cancelled.', 'Операцію з архівом скасовано.')
              : `${t('Could not complete', 'Не вдалося завершити')}: ${error.message}`;
      }
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
  const refresh = button(() =>
    run(async (signal) => {
      await refreshRows(signal);
      result.textContent = t('Saved sessions refreshed.', 'Список збережених сесій оновлено.');
    }),
  );
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
      if (verified.challenge)
        result.textContent += ` ${
          verified.challenge.verified
            ? t(
                'Challenge outcome independently verified. Unscored.',
                'Результат випробування незалежно перевірено. Без заліку.',
              )
            : verified.challenge.reason === 'checkpoint-origin'
              ? t(
                  'Earlier challenge progress cannot be verified from this clip.',
                  'Попередній прогрес випробування неможливо перевірити за цим фрагментом.',
                )
              : t(
                  'The challenge was not completed in this archive.',
                  'Випробування не було завершено в цьому архіві.',
                )
        }`;
    }),
  );
  const courseButton = button(() => {
    if (!activeCourse || !select.value) return;
    clearCourse();
    const session = owner,
      archiveGeneration = generation(),
      id = select.value;
    const view = {
      session,
      name: rows.find((row) => row.id === id)?.name ?? id,
      course: structuredClone(activeCourse),
      valid: () =>
        courseView === view &&
        current(session) &&
        generation() === archiveGeneration &&
        select.value === id,
    };
    courseView = view;
    return run(async (signal) => {
      await onPause();
      signal.throwIfAborted();
      if (!view.valid()) throw cancelled();
      const packet = await store.exportPackage(id, { signal });
      signal.throwIfAborted();
      if (!view.valid()) throw cancelled();
      view.mode = packet.manifest.config?.response?.mode;
      const report = await verifyCourse(packet, view.course, {
        signal,
        Worker: win?.Worker,
        ...(workerURL ? { workerURL } : {}),
        onProgress: ({ phase }) => {
          if (!signal.aborted && view.valid() && courseView === view) {
            view.phase = phase;
            renderCourse();
          }
        },
      });
      signal.throwIfAborted();
      if (!view.valid() || courseView !== view) throw cancelled();
      view.report = report;
    }, view.valid);
  });
  const referenceButton = button(() => {
    if (!courseView?.referenceSelected && !referenceMatches()) return;
    const view = courseView;
    const value = view.referenceSelected
      ? null
      : {
          name: String(view.name).slice(0, 120),
          rows: structuredClone(view.report.course.splits),
        };
    if (applyReference(owner, value)) view.referenceSelected = value !== null;
    paint();
  });
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
      if (disposed) return;
      // Only this deletion is confirmed. A failed subsequent list read must not
      // obscure its committed outcome or imply that the remaining rows survived.
      rows = rows.filter((entry) => entry.id !== row.id);
      renderRows();
      const deleted = t('Selected local archive deleted.', 'Вибраний локальний архів видалено.');
      try {
        await refreshRows(signal);
      } catch (error) {
        if (!disposed)
          result.textContent = `${deleted} ${
            error.name === 'AbortError'
              ? t('Refreshing saved sessions was cancelled.', 'Оновлення списку сесій скасовано.')
              : `${t(
                  'Could not refresh the remaining sessions. Their current status is unknown.',
                  'Не вдалося оновити решту сесій. Їхній поточний стан невідомий.',
                )} ${error.message}`
          }`;
        return;
      }
      if (!disposed) result.textContent = deleted;
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
  listen(select, 'change', () => {
    clearCourse();
    paint();
  });
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
        try {
          activeCourse = session?.course?.() ?? null;
        } catch {
          activeCourse = null;
        }
        context = null;
        lastPollTick = -1;
      }
      state = next;
      if (courseView && !courseView.valid()) clearCourse();
      const archive = state?.archiveStatus ?? state?.advancedTelemetry?.archiveStatus;
      root.hidden =
        typeof session?.readSealedSegment !== 'function' ||
        !archive ||
        state?.reason === 'preparing-aircraft';
      if (!root.hidden && !work && !operation) {
        if (!listLoaded) {
          listLoaded = true;
          void refreshRows().catch(() => {
            /* The visible inventory error remains until an explicit refresh. */
          });
        }
        const tick = state?.ticks ?? 0;
        if (
          !context ||
          (archive?.generation !== undefined && archive.generation !== context.generation) ||
          (!context.stopped &&
            ((!context.manifest && archive?.latestTick > context.startTick) ||
              archive?.lastSealedIndex > context.afterIndex ||
              tick - lastPollTick >= 50))
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
      clearCourse();
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
