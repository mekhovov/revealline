import { openRegionalLibrary } from './regional-delivery.mjs';

// Original, reviewed sources are pinned to an immutable published commit.
export const REGIONAL_LIBRARY_PINS = Object.freeze([
  {
    id: 'urban-earthworks-study',
    title: {
      en: 'Urban earthworks — regional preview',
      uk: 'Міські земляні споруди — огляд регіону',
    },
    description: {
      en: '384 × 384 m · original architectural blockout · unscored free flight. An early regional preview, with buildings, passages and open ground.',
      uk: '384 × 384 м · авторський макет забудови · вільний політ без заліку. Ранній огляд регіону з будівлями, проходами та відкритою місцевістю.',
    },
    bytes: 1455090,
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/9d97e70c18729c3f399b90610380274e50d7d0df/authoring/fpv-worlds/regions/urban-bando/delivery-review-r1/delivery.json',
      bytes: 6615,
      sha256: '1ba27d2242d61d61c0552564d75baa5f3e313e63a78c2ef434f63cdc7dbab94c',
    },
  },
]);

/** Regional installations stay separate from scored WorldPack courses. */
export function mountRegionalLibrary({
  el,
  txt,
  parent,
  fly,
  window: win = globalThis.window,
  pins = REGIONAL_LIBRARY_PINS,
  openLibrary = openRegionalLibrary,
}) {
  const root = el('section', undefined, 'world-catalogue'),
    heading = el('h2'),
    help = el('p'),
    message = el('p'),
    cards = el('div', undefined, 'world-catalogue-cards'),
    tools = el('div', undefined, 'button-row'),
    refresh = el('button'),
    cancel = el('button'),
    home = el('span');
  root.id = 'regional-world-library';
  heading.id = 'regional-world-library-title';
  root.setAttribute('aria-labelledby', heading.id);
  message.setAttribute('role', 'status');
  home.hidden = true;
  refresh.type = cancel.type = 'button';
  tools.append(refresh, cancel);
  root.append(heading, help, tools, message, cards);
  parent.before(home, root);
  let closed = false,
    operation = null,
    epoch = 0,
    records = [],
    pendingRefresh = false,
    removal = null,
    notice = ['', ''],
    database = null;
  const dbReady = Promise.resolve().then(() => openLibrary({ indexedDB: win.indexedDB }));
  // A missing browser store remains a visible, recoverable state, never an unhandled rejection.
  dbReady.then(
    (value) => {
      database = value;
      if (closed) value.close();
    },
    () => {
      if (!closed)
        show(
          'Device storage is unavailable. Reload the SIM to retry.',
          'Сховище пристрою недоступне. Перезавантажте SIM і повторіть.',
        );
    },
  );
  const visible = () =>
    !closed &&
    !parent.ownerDocument.hidden &&
    !root.closest('[hidden]') &&
    (!root.closest('dialog') || root.closest('dialog').open);
  const title = (value) => txt(value.en, value.uk);
  const size = (bytes) =>
    bytes < 1048576
      ? `${Math.ceil(bytes / 1024)} KiB`
      : `${(bytes / 1048576).toLocaleString(txt('en', 'uk'), { maximumFractionDigits: 1 })} MiB`;
  function show(...copy) {
    notice = copy;
    message.textContent = txt(...copy);
  }
  function action(text, callback, disabled = false) {
    const button = el('button', text);
    button.type = 'button';
    button.disabled = disabled;
    button.onclick = callback;
    return button;
  }
  function waitFor(value, signal) {
    return new Promise((resolve, reject) => {
      const cancel = () => reject(signal.reason);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      Promise.resolve(value)
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', cancel));
    });
  }
  function paint() {
    if (closed) return;
    heading.textContent = txt('Regional free flight', 'Вільний політ у регіонах');
    help.textContent = txt(
      'Download a region once, then choose Fly. Regions are unscored practice areas. Save the simulator offline separately; this download saves the scenery.',
      'Завантажте регіон один раз і виберіть «Летіти». Це тренувальні зони без заліку. Симулятор готується офлайн окремо; тут зберігається місцевість.',
    );
    refresh.textContent = txt('Refresh saved regions', 'Оновити збережені регіони');
    cancel.textContent = txt('Cancel', 'Скасувати');
    refresh.disabled = Boolean(operation);
    cancel.hidden = !operation;
    message.textContent = txt(...notice);
    const focused = parent.ownerDocument.activeElement,
      focusKey = focused?.closest?.('[data-region-key]')?.dataset.regionKey,
      focusAction = focused?.dataset.regionAction;
    cards.replaceChildren();
    const offered = new Set(pins.map((row) => row.pin.sha256));
    const rows = [
      ...pins.map((row) => ({
        ...row,
        saved: records.find((saved) => saved.sha256 === row.pin.sha256 && saved.id === row.id),
      })),
      ...records
        .filter((row) => !offered.has(row.sha256))
        .map((saved) => ({ id: saved.id, title: saved.descriptor.title, saved })),
    ];
    for (const row of rows) {
      const saved = row.saved,
        hash = saved?.sha256 ?? row.pin.sha256,
        card = el('article', undefined, 'world-catalogue-card'),
        name = saved?.descriptor.title ?? row.title,
        buttons = el('div', undefined, 'button-row');
      card.dataset.regionKey = hash;
      card.append(el('strong', title(name)));
      if (row.description) card.append(el('p', title(row.description)));
      card.append(
        el(
          'p',
          saved
            ? `${txt('Saved for offline flight', 'Збережено для польоту офлайн')} · ${size(saved.bytes)} · ${saved.descriptor.revision}`
            : txt(
                `Optional scenery download${row.bytes ? ` · ${size(row.bytes)}` : ''} · unscored`,
                `Окреме завантаження місцевості${row.bytes ? ` · ${size(row.bytes)}` : ''} · без заліку`,
              ),
        ),
      );
      if (saved) {
        const play = action(txt('Fly', 'Летіти'), () => run('fly', row), Boolean(operation));
        play.dataset.regionAction = 'fly';
        play.setAttribute('aria-label', `${txt('Fly', 'Летіти')}: ${title(name)}`);
        const remove = action(
          txt('Remove saved region', 'Вилучити збережений регіон'),
          () => run('review-remove', row),
          Boolean(operation),
        );
        remove.dataset.regionAction = 'remove';
        buttons.append(play, remove);
      } else {
        const download = action(
          txt('Download region', 'Завантажити регіон'),
          () => run('install', row),
          Boolean(operation),
        );
        download.dataset.regionAction = 'install';
        download.setAttribute('aria-label', `${txt('Download', 'Завантажити')}: ${title(name)}`);
        buttons.append(download);
      }
      card.append(buttons);
      if (removal?.id === row.id && removal.viewHash === hash) {
        card.append(
          el(
            'p',
            txt(
              `Remove all ${removal.revisions.length} saved revision(s) of this region (${size(removal.bytes)})? You can download available revisions again.`,
              `Вилучити всі збережені версії цього регіону (${removal.revisions.length}; ${size(removal.bytes)})? Доступні версії можна завантажити знову.`,
            ),
          ),
        );
        const confirm = action(
          txt('Remove these downloads', 'Вилучити ці завантаження'),
          () => run('remove', row),
          Boolean(operation),
        );
        confirm.dataset.regionAction = 'confirm-remove';
        card.append(
          confirm,
          action(
            txt('Keep region', 'Залишити регіон'),
            () => {
              removal = null;
              paint();
            },
            Boolean(operation),
          ),
        );
      }
      cards.append(card);
      if (focusKey === hash)
        (
          card.querySelector(`[data-region-action="${focusAction}"]`) ??
          card.querySelector('button')
        )?.focus();
    }
    if (!rows.length)
      cards.append(
        el(
          'p',
          txt(
            'No regional downloads are available in this version yet.',
            'У цій версії ще немає доступних регіонів.',
          ),
        ),
      );
  }
  async function run(kind, row = null) {
    if (closed || operation) return;
    const controller = new AbortController(),
      signal = controller.signal,
      requestEpoch = epoch;
    const doc = parent.ownerDocument;
    let restoreFocus = Boolean(row);
    const trackFocus = (event) => {
      if (event.target !== doc.body && !root.contains(event.target)) restoreFocus = false;
    };
    doc.addEventListener('focusin', trackFocus);
    operation = controller;
    if (kind === 'refresh') show('', '');
    paint();
    const timer = win.setTimeout(() => controller.abort(), 120000);
    let committed = false;
    try {
      const store = await waitFor(dbReady, signal);
      signal.throwIfAborted();
      if (kind === 'install') {
        show('Checking regional download…', 'Перевірка завантаження регіону…');
        const options = {
          pageURL: win.location.href,
          signal,
          onProgress(value) {
            if (closed || requestEpoch !== epoch) return;
            if (value.phase === 'commit') {
              cancel.disabled = true;
              show('Saving verified region…', 'Збереження перевіреного регіону…');
            } else
              show(
                `Preparing region: ${size(value.loadedBytes)} / ${size(value.totalBytes)}`,
                `Підготовка регіону: ${size(value.loadedBytes)} / ${size(value.totalBytes)}`,
              );
          },
        };
        const inspected = await store.inspect(row.pin, options);
        if (inspected.descriptor.id !== row.id)
          throw new Error('Regional catalogue identity mismatch');
        signal.throwIfAborted();
        await store.install(row.pin, options);
        committed = true;
        records = await store.list({ includeRevisions: true });
        show(
          'Region saved. Choose Fly when you are ready.',
          'Регіон збережено. Виберіть «Летіти», коли будете готові.',
        );
      } else if (kind === 'fly') {
        show('Checking saved scenery…', 'Перевірка збереженої місцевості…');
        const configuration = await waitFor(
          store.load(row.id, { sha256: row.saved.sha256 }),
          signal,
        );
        signal.throwIfAborted();
        if (requestEpoch === epoch && visible())
          await fly(configuration, row.saved, {
            isCurrent: () => requestEpoch === epoch && visible() && !signal.aborted,
          });
      } else if (kind === 'review-remove') {
        const reviewed = await waitFor(store.removalSnapshot(row.id), signal);
        if (!reviewed) throw new Error('Regional revision is no longer installed');
        removal = { ...reviewed, viewHash: row.saved.sha256 };
        signal.throwIfAborted();
      } else if (kind === 'remove') {
        if (!removal || removal.id !== row.id) throw new Error('Review removal again');
        cancel.disabled = true;
        await store.remove(row.id, { expectedGeneration: removal.generation });
        committed = true;
        removal = null;
        records = await waitFor(store.list({ includeRevisions: true }), signal);
        show('Saved region removed.', 'Збережений регіон вилучено.');
      } else {
        records = await waitFor(store.list({ includeRevisions: true }), signal);
        removal = null;
      }
    } catch {
      if (kind === 'remove') removal = null;
      if (!closed && requestEpoch === epoch) {
        if (committed)
          show(
            'Saved changes are retained. Refresh saved regions.',
            'Зміни збережено. Оновіть список регіонів.',
          );
        else if (signal.aborted)
          show(
            'Cancelled. Existing downloads are retained.',
            'Скасовано. Наявні завантаження збережено.',
          );
        else
          show(
            'Could not complete this action. Existing downloads are retained; refresh and retry.',
            'Не вдалося виконати дію. Наявні завантаження збережено; оновіть список і повторіть.',
          );
      }
    } finally {
      win.clearTimeout(timer);
      operation = null;
      cancel.disabled = false;
      doc.removeEventListener('focusin', trackFocus);
      if (!closed) {
        paint();
        if (restoreFocus && requestEpoch === epoch && visible()) {
          const hash = row.saved?.sha256 ?? row.pin?.sha256;
          const card = [...cards.children].find((item) => item.dataset.regionKey === hash);
          (
            card?.querySelector(
              kind === 'review-remove' ? '[data-region-action="confirm-remove"]' : 'button',
            ) ?? refresh
          ).focus();
        }
        if (pendingRefresh && visible()) {
          pendingRefresh = false;
          void run('refresh');
        }
      }
    }
  }
  refresh.onclick = () => run('refresh');
  cancel.onclick = () => {
    if (!cancel.disabled) operation?.abort();
  };
  paint();
  return {
    open(container = null) {
      if (closed) return;
      if (container) container.append(root);
      else home.after(root);
      if (operation) pendingRefresh = true;
      else void run('refresh');
    },
    deactivate(container = null) {
      if (container && !container.contains(root)) return;
      epoch++;
      pendingRefresh = false;
      removal = null;
      operation?.abort();
    },
    refresh() {
      paint();
    },
    dispose() {
      closed = true;
      epoch++;
      operation?.abort();
      database?.close();
      home.remove();
      root.remove();
    },
  };
}
