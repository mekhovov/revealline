import { createOfficialDownloads } from '../official-downloads.mjs';

export const COMPANY_ACTOR_VOICE_LIMITS = Object.freeze({ files: 48, bytes: 2 * 1024 * 1024 });

/** Non-executable, immutable originals. Download ownership shares the existing
 * official cache, so removing one edition cannot reclaim another edition's files. */
export function createCompanyActorVoiceDelivery({
  recordings,
  baseURL,
  fetch,
  onChange = () => {},
  store = null,
} = {}) {
  const root = new URL('../../../', baseURL),
    files = new Map(),
    identities = new Set();
  if (!['https:', 'http:'].includes(root.protocol)) return null;
  if (!Array.isArray(recordings) || recordings.length > COMPANY_ACTOR_VOICE_LIMITS.files)
    throw new TypeError('Invalid Company actor recording catalogue.');
  let bytes = 0;
  for (const recording of recordings) {
    const identity = `${recording.lineId}|${recording.locale}`;
    if (
      !/^humanoid-actors\.v1\/[a-z-]+\/(?:notice|caught)$/.test(recording.lineId) ||
      !['en', 'uk'].includes(recording.locale) ||
      !/^actors-v1\/actor-[a-z-]+-(?:notice|caught)-(?:en|uk)\.m4a$/.test(recording.file) ||
      !recording.file.endsWith(`-${recording.locale}.m4a`) ||
      recording.mime !== 'audio/mp4' ||
      !/^[a-f0-9]{64}$/.test(recording.sha256) ||
      !Number.isSafeInteger(recording.bytes) ||
      recording.bytes < 1 ||
      identities.has(identity) ||
      files.has(recording.sha256)
    )
      throw new TypeError('Invalid Company actor recording.');
    identities.add(identity);
    bytes += recording.bytes;
    files.set(
      recording.sha256,
      Object.freeze({
        path: `game/audio/reactions/${recording.file}`,
        bytes: recording.bytes,
        sha256: recording.sha256,
        mime: recording.mime,
        locale: recording.locale,
      }),
    );
  }
  if (bytes > COMPANY_ACTOR_VOICE_LIMITS.bytes)
    throw new TypeError('Company actor recordings exceed the 2 MiB budget.');
  // Constructing this owner never touches storage or starts a request.
  store ??= createOfficialDownloads({ origin: root.origin, fetch });
  const group = (locale) => `company-actor-voices:${locale}`;
  const selected = (locale) => {
    if (!['en', 'uk'].includes(locale)) throw new TypeError('Choose English or Ukrainian voices.');
    return [...files.values()].filter((file) => file.locale === locale);
  };
  const descriptors = ['en', 'uk'].map((locale) =>
    Object.freeze({
      locale,
      files: selected(locale).length,
      bytes: selected(locale).reduce((total, file) => total + file.bytes, 0),
    }),
  );
  const api = Object.freeze({
    packs: Object.freeze(descriptors),
    async read(recording, { signal } = {}) {
      signal?.throwIfAborted();
      const file = files.get(recording.sha256);
      if (!file || file.bytes !== recording.bytes) return null;
      try {
        const blob = await store.read(file.sha256);
        signal?.throwIfAborted();
        return blob?.size === file.bytes ? await blob.arrayBuffer() : null;
      } catch {
        signal?.throwIfAborted();
        // Offline storage is optional; ordinary online originals still work.
        return null;
      }
    },
    async status(locale, { signal } = {}) {
      const report = await store.inspect(selected(locale), { verify: true, signal });
      const owned = (await store.states()).some(
        (state) => state.edition === root.href && state.group === group(locale),
      );
      signal?.throwIfAborted();
      return { ...report, owned };
    },
    async download(locale, { signal, onProgress } = {}) {
      const report = await store.download({
        edition: root.href,
        group: group(locale),
        files: selected(locale),
        baseURL: root,
        signal,
        onProgress,
      });
      onChange();
      return report;
    },
    async remove(locale) {
      selected(locale);
      await store.remove(root.href, group(locale));
      onChange();
    },
    attach: (options) => attachActorVoiceDownloads({ ...options, delivery: api }),
  });
  return api;
}

const copy = {
  title: ['Offline enemy voices', 'Озвучення ворогів офлайн'],
  note: [
    'Optional generated recordings. Captions, pilot voices and your replacement recordings remain available.',
    'Додаткові синтезовані записи. Субтитри, голоси пілотів і ваші замінені записи залишаються доступними.',
  ],
  en: ['English', 'Англійська'],
  uk: ['Ukrainian', 'Українська'],
  download: ['Download / repair', 'Завантажити / відновити'],
  remove: ['Remove download', 'Видалити завантаження'],
  cancel: ['Cancel download', 'Скасувати завантаження'],
  idle: [
    'Available online; download for offline speech.',
    'Доступно онлайн; завантажте для озвучення офлайн.',
  ],
  ready: ['Verified for offline speech.', 'Перевірено для озвучення офлайн.'],
  partial: [
    'Partly downloaded; resume to complete.',
    'Завантажено частково; продовжте для завершення.',
  ],
  loading: ['Downloading…', 'Завантаження…'],
  removing: ['Removing this edition’s download…', 'Видалення завантаження цього видання…'],
  cancelled: [
    'Download cancelled. Saved clips can be resumed.',
    'Завантаження скасовано. Збережені записи можна дозавантажити.',
  ],
  error: [
    'Unavailable. Reconnect or free device storage and retry.',
    'Недоступно. Відновіть з’єднання або звільніть сховище й повторіть.',
  ],
};

/** A small part of the existing Sound settings, never a new audio owner. */
export function attachActorVoiceDownloads({
  container,
  delivery,
  document: doc = container?.ownerDocument,
  getLocale = () => 'en',
} = {}) {
  const tr = (key) => copy[key][getLocale() === 'uk' ? 1 : 0];
  const create = (tag) => doc.createElement(tag);
  const section = create('fieldset'),
    title = create('legend'),
    note = create('p');
  section.dataset.actorVoiceDownloads = 'true';
  section.append(title, note);
  container.append(section);
  let closed = false,
    revision = 0,
    operation = null;
  const rows = delivery.packs
    .filter((pack) => pack.files)
    .map((pack) => {
      const row = create('div'),
        label = create('p'),
        download = create('button'),
        remove = create('button'),
        status = create('p');
      row.dataset.actorVoiceLocale = pack.locale;
      row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;min-width:0;';
      label.style.cssText = status.style.cssText = 'flex-basis:100%;margin:.4rem 0;';
      download.type = remove.type = 'button';
      download.dataset.actorVoiceDownload = pack.locale;
      remove.dataset.actorVoiceRemove = pack.locale;
      status.setAttribute('role', 'status');
      row.append(label, download, remove, status);
      section.append(row);
      return { ...pack, label, download, remove, status, state: 'idle', owned: false };
    });
  const cancel = create('button');
  cancel.type = 'button';
  cancel.dataset.actorVoiceCancel = 'true';
  section.append(cancel);
  function render() {
    if (closed) return;
    title.textContent = tr('title');
    note.textContent = tr('note');
    cancel.textContent = tr('cancel');
    cancel.hidden = !operation?.controller;
    for (const row of rows) {
      row.label.textContent = `${tr(row.locale)} · ${row.files} · ${(row.bytes / 1024).toFixed(0)} KiB`;
      row.download.textContent = `${tr('download')} · ${tr(row.locale)}`;
      row.remove.textContent = `${tr('remove')} · ${tr(row.locale)}`;
      row.download.disabled = !!operation;
      row.remove.disabled = !!operation || !row.owned;
      row.status.textContent = tr(row.state);
    }
  }
  async function refresh() {
    const current = ++revision;
    render();
    await Promise.all(
      rows.map(async (row) => {
        try {
          const state = await delivery.status(row.locale);
          if (closed || operation || current !== revision) return;
          row.owned = state.owned;
          row.state = state.ready ? 'ready' : state.readyBytes ? 'partial' : 'idle';
        } catch {
          if (!closed && !operation && current === revision) row.state = 'error';
        }
      }),
    );
    if (current === revision) render();
  }
  async function run(row, removing = false) {
    if (closed || operation) return;
    revision++;
    const owned = { controller: removing ? null : new AbortController() };
    operation = owned;
    row.state = removing ? 'removing' : 'loading';
    render();
    let failure = null;
    try {
      if (removing) await delivery.remove(row.locale);
      else await delivery.download(row.locale, { signal: owned.controller.signal });
    } catch (error) {
      failure = error?.name === 'AbortError' ? 'cancelled' : 'error';
    } finally {
      if (operation === owned) operation = null;
      if (!closed) {
        await refresh();
        if (failure) {
          row.state = failure;
          render();
        }
      }
    }
  }
  const abort = () => operation?.controller?.abort();
  cancel.onclick = abort;
  for (const row of rows) {
    row.download.onclick = () => void run(row);
    row.remove.onclick = () => void run(row, true);
  }
  // Snake mounts its settings into the shared dialog after creating reactions.
  // Resolve ownership at close time instead of retaining the original parent.
  const target = doc.defaultView;
  const dialogClosed = (event) => {
    if (event.target?.contains?.(section)) abort();
  };
  const visibility = () => {
    if (doc.hidden) abort();
  };
  doc.addEventListener('close', dialogClosed, true);
  doc.addEventListener('visibilitychange', visibility);
  target?.addEventListener('pagehide', abort);
  void refresh();
  return Object.freeze({
    refresh: render,
    dispose() {
      closed = true;
      revision++;
      abort();
      doc.removeEventListener('close', dialogClosed, true);
      doc.removeEventListener('visibilitychange', visibility);
      target?.removeEventListener('pagehide', abort);
      section.remove();
    },
  });
}
