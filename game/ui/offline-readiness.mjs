import { localizedText, t } from '../i18n/index.mjs';

/** Readiness is a dated observation of this storage context, not an installation
 * promise. A changed selection or a hidden page invalidates that observation. */
export function attachOfflineReadiness({ root, onRecheck, document: doc = globalThis.document }) {
  let generation = 0;
  const state = {
    fresh: false,
    checking: false,
    busy: true,
    available: true,
    installed: false,
    runtime: 'unknown',
    content: null,
    launcher: 'unknown',
    bookmark: false,
    selection: 'unknown',
    retained: null,
    sim: null,
    music: null,
  };
  const rows = new Map();
  const make = (tag, id) => {
    const element = doc.createElement(tag);
    element.id = id;
    return element;
  };
  const summary = make('p', 'offline-readiness-status');
  summary.setAttribute('role', 'status');
  const list = make('dl', 'offline-readiness-list');
  list.className = 'offline-readiness-list';
  for (const id of [
    'context',
    'runtime',
    'content',
    'launcher',
    'selection',
    'sim',
    'music',
    'retention',
  ]) {
    const row = doc.createElement('div'),
      label = doc.createElement('dt'),
      value = make('dd', `offline-readiness-${id}`);
    localizedText(label, () => t(`interface:readiness.${id}`));
    rows.set(id, value);
    row.append(label, value);
    list.append(row);
  }
  const check = make('button', 'offline-readiness-check');
  check.type = 'button';
  localizedText(check, () => t('interface:readiness.recheck'));
  check.onclick = () => {
    if (!check.disabled) return onRecheck();
  };
  const note = doc.createElement('p');
  localizedText(note, () => t('interface:readiness.note'));
  root.append(summary, list, check, note);
  function render() {
    const observed = state.fresh && !state.checking;
    const status = (value) =>
      !observed
        ? 'notChecked'
        : value === 'ready'
          ? 'verified'
          : value === 'waiting'
            ? 'waiting'
            : 'needsDownload';
    const keys = {
      context: state.installed ? 'contextInstalled' : 'contextBrowser',
      runtime: status(state.runtime),
      content: !observed ? 'notChecked' : state.content === true ? 'verified' : 'needsDownload',
      launcher: state.bookmark ? 'bookmarkLauncher' : status(state.launcher),
      selection: observed ? `selection.${state.selection}` : 'notChecked',
      retention: !observed
        ? 'retentionUnknown'
        : state.retained === true
          ? 'retained'
          : state.retained === false
            ? 'notRetained'
            : 'retentionUnknown',
    };
    for (const [id, key] of Object.entries(keys))
      localizedText(rows.get(id), () => t(`interface:readiness.${key}`));
    for (const id of ['sim', 'music']) {
      const value = state[id];
      localizedText(rows.get(id), () =>
        observed && value
          ? t(`interface:readiness.${id}${value.total ? 'Count' : 'Absent'}`, value)
          : t('interface:readiness.notChecked'),
      );
    }
    const ready =
      observed &&
      state.runtime === 'ready' &&
      state.content === true &&
      (state.bookmark || state.launcher === 'ready');
    const key = !state.available
      ? 'unavailable'
      : state.checking
        ? 'checking'
        : !observed
          ? 'stale'
          : ready
            ? 'filesReady'
            : 'incomplete';
    root.dataset.state = key;
    localizedText(summary, () => t(`interface:readiness.${key}`));
    check.disabled = !state.available || state.busy || state.checking;
  }
  render();
  return {
    update(fields) {
      Object.assign(state, fields);
      render();
    },
    begin() {
      const token = ++generation;
      state.fresh = false;
      state.checking = true;
      render();
      return token;
    },
    complete(token, observation) {
      if (token !== generation) return false;
      Object.assign(state, observation, { fresh: true, checking: false });
      render();
      return true;
    },
    fail(token) {
      if (token !== generation) return;
      state.fresh = false;
      state.checking = false;
      render();
    },
    invalidate() {
      generation++;
      state.fresh = false;
      state.checking = false;
      render();
    },
  };
}
