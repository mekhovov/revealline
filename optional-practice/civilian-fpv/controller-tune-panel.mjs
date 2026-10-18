import {
  CONTROLLER_TUNE_LIBRARY_BYTES,
  CONTROLLER_TUNE_LIBRARY_KEY,
  controllerTuneCompatibility,
  controllerTuneContext,
  createControllerTuneLibraryStore,
  validateControllerTune,
  validateControllerTuneLibrary,
} from './controller-tune-library.mjs';
import { exportJSONFile } from '../../game/platform.mjs';

const clone = (value) => structuredClone(value);
const newId = () =>
  `controller-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

/** An independent library surface: browsing never edits a setup, and saving a
 * reusable tune never writes the setup library. Host owns the complete draft. */
export function createControllerTunePanel({
  document: doc,
  window: win,
  locale = () => 'en',
  getConfiguration,
  onUse = () => {},
  report = () => {},
  platformOptions = {},
  store: suppliedStore,
} = {}) {
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    // Read-only and denied storage still allow inspecting and exporting a tune.
  }
  const store =
    suppliedStore ?? createControllerTuneLibraryStore({ storage, locks: win.navigator?.locks });
  const bindings = [],
    removers = [],
    buttons = [];
  const t = (en, uk) => (locale() === 'uk' ? uk : en);
  const root = doc.createElement('section');
  root.className = 'controller-tune-panel';
  let disposed = false,
    busy = false,
    stale = false,
    generation = 0,
    pendingImport = null,
    confirmDelete = false;
  let selectedId = '',
    selectedRevision = null;
  const el = (tag, parent = root, text) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  };
  const label = (node, en, uk) => {
    bindings.push(() => {
      node.textContent = t(en, uk);
    });
    node.textContent = t(en, uk);
    return node;
  };
  const listen = (node, event, handler) => {
    node.addEventListener(event, handler);
    removers.push(() => node.removeEventListener(event, handler));
  };
  const status = el('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const fail = (failure) => {
    if (disposed) return;
    status.textContent = failure.message;
    report(failure);
  };
  const field = (en, uk, tag = 'input', parent = root) => {
    const wrap = el('label', parent);
    label(el('span', wrap), en, uk);
    const input = el(tag, wrap);
    input.dataset.search = `${en} ${uk} controller tune PID P I D FF feedforward filters контролер налаштування коефіцієнти випередження фільтри`;
    bindings.push(() => input.setAttribute('aria-label', t(en, uk)));
    input.setAttribute('aria-label', t(en, uk));
    if (tag === 'input') input.type = 'text';
    return input;
  };
  const button = (en, uk, run, parent = root) => {
    const node = label(el('button', parent), en, uk);
    node.type = 'button';
    buttons.push(node);
    listen(node, 'click', () => {
      if (disposed || busy || node.disabled) return;
      const epoch = generation;
      busy = true;
      for (const action of buttons) action.disabled = true;
      void Promise.resolve()
        .then(() => {
          if (!disposed && epoch === generation) return run();
        })
        .catch((failure) => {
          if (epoch === generation) fail(failure);
        })
        .finally(() => {
          busy = false;
          if (!disposed) refresh();
        });
    });
    return node;
  };
  function configuration() {
    const source = getConfiguration?.();
    const advanced = source?.advanced ?? (source?.aircraft && source?.controller ? source : null);
    return { advanced, context: controllerTuneContext(advanced) };
  }
  function currentRecord() {
    const current = store.snapshot().tunes.find((item) => item.id === selectedId);
    if (!current) return null;
    return selectedRevision === null
      ? current
      : (current.history.find((item) => item.revision === selectedRevision) ?? null);
  }
  const title = label(el('h3'), 'Controller tunes', 'Налаштування контролера');
  root.insertBefore(title, status);
  label(
    el('p'),
    'Reusable SIM PID and filter snapshots. Use copies values into this draft. Saving a tune is separate from saving a setup.',
    'Багаторазові знімки PID і фільтрів SIM. Використання копіює значення в чернетку. Налаштування контролера зберігаються окремо від конфігурації дрона.',
  );
  const chooser = field('Saved controller tune', 'Збережене налаштування контролера', 'select');
  const history = field('Tune revision', 'Версія налаштування', 'select');
  const preview = el('div');
  preview.className = 'controller-tune-preview';
  preview.setAttribute('aria-live', 'polite');
  const use = button('Use in draft', 'Використати в чернетці', () => {
    const record = currentRecord();
    const { context } = configuration();
    const compatibility = record && controllerTuneCompatibility(record, context);
    if (!compatibility?.compatible)
      throw new TypeError(
        t(
          'This tune is incompatible with the setup.',
          'Це налаштування несумісне з конфігурацією.',
        ),
      );
    onUse(clone(record.controller), {
      id: selectedId,
      revision: record.revision,
      name: record.name,
      compatibility,
    });
    status.textContent = t(
      'Controller values copied into the draft. Save the setup separately.',
      'Значення контролера скопійовано в чернетку. Збережіть конфігурацію окремо.',
    );
  });
  const name = field('New controller tune name', 'Назва нового налаштування контролера');
  name.maxLength = 120;
  const save = button(
    'Save draft as controller tune',
    'Зберегти чернетку як налаштування контролера',
    async () => {
      const { advanced, context } = configuration();
      if (!context)
        throw new TypeError(
          t(
            'This setup has no supported SIM controller.',
            'Ця конфігурація не має підтримуваного контролера SIM.',
          ),
        );
      const id = newId();
      await store.saveTune(
        {
          id,
          name: name.value,
          family: context.family,
          sourceAircraft: context.sourceAircraft,
          controller: advanced.controller,
        },
        store.snapshot().revision,
      );
      if (disposed) return;
      selectedId = id;
      selectedRevision = null;
      status.textContent = t(
        'Controller tune saved. Your setup draft is unchanged.',
        'Налаштування контролера збережено. Чернетку конфігурації не змінено.',
      );
    },
  );
  const rename = field(
    'Rename selected controller tune',
    'Перейменувати вибране налаштування контролера',
  );
  rename.maxLength = 120;
  const renameAction = button(
    'Rename controller tune',
    'Перейменувати налаштування контролера',
    async () => {
      await store.renameTune(selectedId, rename.value, store.snapshot().revision);
      selectedRevision = null;
      status.textContent = t(
        'Tune renamed. Applied setups are unchanged.',
        'Налаштування перейменовано. Застосовані конфігурації не змінено.',
      );
    },
  );
  const revert = button(
    'Restore this tune revision',
    'Відновити цю версію налаштування',
    async () => {
      await store.revertTune(selectedId, selectedRevision, store.snapshot().revision);
      selectedRevision = null;
      status.textContent = t(
        'Saved tune revision restored. Applied setups are unchanged.',
        'Збережену версію налаштування відновлено. Застосовані конфігурації не змінено.',
      );
    },
  );
  const remove = button('Delete controller tune', 'Видалити налаштування контролера', () => {
    confirmDelete = true;
  });
  const deleteNotice = label(
    el('p'),
    'Delete only this reusable tune? Setups keep their applied controller values.',
    'Видалити лише це багаторазове налаштування? Конфігурації збережуть застосовані значення контролера.',
  );
  const confirm = button(
    'Confirm tune deletion',
    'Підтвердити видалення налаштування',
    async () => {
      await store.removeTune(selectedId, store.snapshot().revision);
      selectedId = '';
      selectedRevision = null;
      confirmDelete = false;
      status.textContent = t(
        'Controller tune deleted. Applied setups are unchanged.',
        'Налаштування контролера видалено. Застосовані конфігурації не змінено.',
      );
    },
  );
  const cancelDelete = button('Keep controller tune', 'Залишити налаштування контролера', () => {
    confirmDelete = false;
  });
  const transfer = el('details');
  label(
    el('summary', transfer),
    'Controller-tune import, export and backup',
    'Імпорт, експорт і резервна копія налаштувань контролера',
  );
  label(
    el('p', transfer),
    'These files contain SIM controller tunes only. Setup backups and Betaflight rate imports remain separate.',
    'Ці файли містять лише налаштування контролера SIM. Резервні копії конфігурацій та імпорт рейтів Betaflight виконуються окремо.',
  );
  const format = field('Controller import format', 'Формат імпорту контролера', 'select', transfer);
  for (const [value, en, uk] of [
    ['tune', 'One portable controller tune', 'Одне переносне налаштування контролера'],
    ['backup', 'Reusable tune library backup', 'Резервна копія бібліотеки налаштувань'],
  ]) {
    const option = label(el('option', format), en, uk);
    option.value = value;
  }
  format.value = 'tune';
  const text = field('Controller tune JSON', 'JSON налаштувань контролера', 'textarea', transfer);
  text.rows = 6;
  text.spellcheck = false;
  const file = field('Controller tune file', 'Файл налаштувань контролера', 'input', transfer);
  file.type = 'file';
  file.accept = '.json,application/json';
  const importPreview = el('p', transfer);
  importPreview.setAttribute('aria-live', 'polite');
  function clearImport() {
    generation++;
    pendingImport = null;
    importPreview.textContent = '';
    applyImport.disabled = true;
  }
  listen(text, 'input', clearImport);
  listen(format, 'change', clearImport);
  listen(file, 'change', () => {
    clearImport();
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > CONTROLLER_TUNE_LIBRARY_BYTES) {
      fail(
        new TypeError(
          t('Controller tune file exceeds 512 KiB.', 'Файл налаштувань перевищує 512 КіБ.'),
        ),
      );
      return;
    }
    const epoch = generation;
    void selected
      .text()
      .then((value) => {
        if (disposed || epoch !== generation) return;
        text.value = value;
        status.textContent = t(
          'File loaded. Review it before saving.',
          'Файл завантажено. Перегляньте його перед збереженням.',
        );
      })
      .catch((failure) => {
        if (epoch === generation) fail(failure);
      });
  });
  const previewImport = button(
    'Review controller import',
    'Переглянути імпорт контролера',
    () => {
      const kind = format.value;
      const value =
        kind === 'backup'
          ? validateControllerTuneLibrary(text.value)
          : validateControllerTune(text.value);
      pendingImport = { kind, value, revision: store.snapshot().revision };
      if (kind === 'backup') {
        importPreview.textContent = t(
          `Replace the reusable tune library with ${value.tunes.length} tunes: ${value.tunes.map((item) => item.name).join(', ') || 'empty library'}. Applied setups will keep their controller values.`,
          `Замінити бібліотеку багаторазових налаштувань: ${value.tunes.length}, ${value.tunes.map((item) => item.name).join(', ') || 'порожня бібліотека'}. Застосовані конфігурації збережуть значення контролера.`,
        );
      } else {
        const compatibility = controllerTuneCompatibility(value, configuration().context);
        importPreview.textContent = `${value.name} · ${value.family} · ${value.controller.format}. ${compatibility.compatible ? t('Save as a new tune; use in draft separately.', 'Збережіть як нове налаштування; використайте в чернетці окремо.') : t('Can be saved, but is incompatible with this setup.', 'Можна зберегти, але це налаштування несумісне з поточною конфігурацією.')}`;
      }
    },
    transfer,
  );
  const applyImport = button(
    'Save reviewed controller import',
    'Зберегти переглянутий імпорт контролера',
    async () => {
      const reviewed = pendingImport;
      if (!reviewed) return;
      if (reviewed.kind === 'backup') await store.restore(reviewed.value, reviewed.revision);
      else {
        const id = newId();
        await store.importTune(reviewed.value, { id }, reviewed.revision);
        selectedId = id;
      }
      selectedRevision = null;
      pendingImport = null;
      importPreview.textContent = '';
      status.textContent = t(
        'Controller import saved. No setup was changed.',
        'Імпорт контролера збережено. Жодну конфігурацію не змінено.',
      );
    },
    transfer,
  );
  const exportTune = button(
    'Export selected controller tune',
    'Експортувати вибране налаштування контролера',
    () => {
      text.value = store.exportTune(selectedId);
      format.value = 'tune';
      clearImport();
      status.textContent = t(
        'Portable tune ready in the text field.',
        'Переносне налаштування готове в текстовому полі.',
      );
    },
    transfer,
  );
  button(
    'Export reusable tune backup',
    'Експортувати резервну копію налаштувань',
    () => {
      text.value = store.exportOriginal() ?? store.export();
      format.value = 'backup';
      clearImport();
      status.textContent = t(
        'Reusable tune backup ready in the text field.',
        'Резервна копія налаштувань готова в текстовому полі.',
      );
    },
    transfer,
  );
  button(
    'Download controller JSON',
    'Завантажити JSON контролера',
    async () => {
      const value =
        format.value === 'backup'
          ? validateControllerTuneLibrary(text.value)
          : validateControllerTune(text.value);
      const result = await exportJSONFile(
        value,
        format.value === 'backup' ? 'fpv-controller-tunes-backup.json' : 'fpv-controller-tune.json',
        {
          locationRef: win.location,
          documentRef: doc,
          URLImpl: win.URL,
          BlobImpl: win.Blob,
          schedule: win.setTimeout?.bind(win),
          ...platformOptions,
        },
      );
      if (!disposed)
        status.textContent =
          result.status === 'cancelled'
            ? t(
                'Export cancelled. Text remains available.',
                'Експорт скасовано. Текст залишається доступним.',
              )
            : t(
                'Export requested. Check the destination.',
                'Експорт запитано. Перевірте місце призначення.',
              );
    },
    transfer,
  );
  button('Reload controller tune library', 'Оновити бібліотеку налаштувань контролера', () => {
    store.refresh();
    stale = false;
    pendingImport = null;
    importPreview.textContent = '';
    confirmDelete = false;
    status.textContent =
      store.status().error ??
      t(
        'Controller library reloaded. Setup draft and pasted text are unchanged.',
        'Бібліотеку контролера оновлено. Чернетку конфігурації та вставлений текст не змінено.',
      );
  });
  listen(chooser, 'change', () => {
    selectedId = chooser.value;
    selectedRevision = null;
    confirmDelete = false;
    rename.value = store.snapshot().tunes.find((item) => item.id === selectedId)?.name ?? '';
    refresh();
  });
  listen(history, 'change', () => {
    selectedRevision = history.value === 'current' ? null : Number(history.value);
    confirmDelete = false;
    refresh();
  });
  listen(win, 'storage', (event) => {
    if (event.key !== CONTROLLER_TUNE_LIBRARY_KEY && event.key !== null) return;
    stale = true;
    status.textContent = t(
      'Another tab changed controller tunes. Reload this library before saving. The setup draft is unchanged.',
      'Інша вкладка змінила налаштування контролера. Оновіть бібліотеку перед збереженням. Чернетку конфігурації не змінено.',
    );
    refresh();
  });

  function refresh() {
    if (disposed) return;
    for (const bind of bindings) bind();
    const library = store.snapshot();
    const selected = library.tunes.find((item) => item.id === selectedId);
    if (!selected && library.tunes.length) {
      selectedId = library.tunes[0].id;
      selectedRevision = null;
    }
    chooser.replaceChildren();
    for (const item of library.tunes) {
      const option = el('option', chooser, item.name);
      option.value = item.id;
    }
    chooser.value = selectedId;
    const saved = library.tunes.find((item) => item.id === selectedId);
    history.replaceChildren();
    const latest = el('option', history, t('Current saved tune', 'Поточне збережене налаштування'));
    latest.value = 'current';
    for (const item of saved?.history ?? []) {
      const option = el(
        'option',
        history,
        `${t('Revision', 'Версія')} ${item.revision}: ${item.name}`,
      );
      option.value = String(item.revision);
    }
    history.value = selectedRevision === null ? 'current' : String(selectedRevision);
    let context = null;
    try {
      context = configuration().context;
    } catch {
      /* Invalid draft text must remain editable in the host. */
    }
    const record = currentRecord();
    const compatibility = record ? controllerTuneCompatibility(record, context) : null;
    preview.replaceChildren();
    if (record) {
      el('p', preview, `${record.name} · ${record.family} · ${record.controller.format}`);
      el(
        'p',
        preview,
        compatibility.compatible
          ? compatibility.responseUntested
            ? t(
                'Response untested on this aircraft. Gains are copied exactly.',
                'Реакцію на цьому дроні не перевірено. Коефіцієнти копіюються без змін.',
              )
            : t(
                'Saved for the same aircraft configuration.',
                'Збережено для такої самої конфігурації дрона.',
              )
          : t(
              'Inactive: this setup uses a different or unavailable controller family.',
              'Неактивне: ця конфігурація має іншу або недоступну родину контролера.',
            ),
      );
      const table = el('table', preview);
      const caption = el(
        'caption',
        table,
        t('Controller gains in SIM units', 'Коефіцієнти контролера в одиницях SIM'),
      );
      caption.className = 'tuning-help';
      const head = el('tr', el('thead', table));
      for (const name of [
        t('Axis', 'Вісь'),
        'P · N·m/(rad/s)',
        'I · N·m/rad',
        'D · N·m/(rad/s²)',
        'FF · N·m/(rad/s²)',
      ])
        el('th', head, name).setAttribute('scope', 'col');
      const body = el('tbody', table);
      for (const [axis, en, uk] of [
        ['roll', 'Roll', 'Крен'],
        ['pitch', 'Pitch', 'Тангаж'],
        ['yaw', 'Yaw', 'Рискання'],
      ]) {
        const row = el('tr', body);
        el('th', row, t(en, uk)).setAttribute('scope', 'row');
        for (const key of ['p', 'i', 'd', 'feedforward'])
          el('td', row, String(record.controller.gains[axis][key]));
      }
    } else
      el(
        'p',
        preview,
        t(
          'No reusable controller tunes yet. Save the current draft to create one.',
          'Багаторазових налаштувань ще немає. Збережіть поточну чернетку, щоб створити перше.',
        ),
      );
    for (const action of buttons) action.disabled = busy;
    const cannotWrite = busy || stale || store.status().blocked;
    use.disabled = busy || !compatibility?.compatible;
    save.disabled = cannotWrite || !context || library.tunes.length >= 32;
    renameAction.disabled = cannotWrite || !saved;
    remove.disabled = cannotWrite || !saved;
    confirm.disabled = cannotWrite || !saved || !confirmDelete;
    revert.disabled = cannotWrite || selectedRevision === null;
    exportTune.disabled = busy || !saved;
    applyImport.disabled =
      busy ||
      stale ||
      !pendingImport ||
      (store.status().blocked && pendingImport.kind !== 'backup');
    previewImport.disabled = busy;
    chooser.disabled = busy || library.tunes.length === 0;
    history.disabled = busy || !saved || saved.history.length === 0;
    deleteNotice.hidden = confirm.hidden = cancelDelete.hidden = !confirmDelete;
    if (store.status().blocked && !status.textContent) status.textContent = store.status().error;
  }
  refresh();
  return {
    root,
    refresh,
    invalidate() {
      if (disposed) return;
      clearImport();
      confirmDelete = false;
      refresh();
    },
    dispose() {
      disposed = true;
      generation++;
      for (const remove of removers) remove();
      root.remove();
    },
  };
}
