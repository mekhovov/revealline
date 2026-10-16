import { boundedJSON, exactKeys, stableId } from '../../game/data-json.mjs';
import { WORLD_LIMITS, worldSHA256 } from './world-content.mjs';

const origin = 'https://raw.githubusercontent.com/mekhovov/revealline/';
// Expanded bounded catalogue with authored collision-visual support.
// Older feeds remain unchanged for their cached players.
const indexURL = origin + 'main/authoring/fpv-worlds/published/free-worlds-v2/index.json';
const check = (condition) => {
  if (!condition) throw new Error('Invalid world download.');
};

export function worldImportErrorCopy(error) {
  if (error?.code === 'world-library-full')
    return [
      'The installed world library is full. Existing worlds and recorded flights are kept. Export any edited world you want to keep, then review Remove for a world you choose to replace and retry. You can keep flying installed worlds.',
      'Бібліотеку встановлених світів заповнено. Наявні світи та записи польотів залишаться. Експортуйте змінений світ, який хочете зберегти, потім перегляньте «Вилучити» для світу, який вирішите замінити, і повторіть спробу. У встановлених світах можна й далі літати.',
    ];
  if (!['unsupported-world-extension', 'unsupported-ground-motion'].includes(error?.code))
    return null;
  return [
    'This SIM version does not support a required world feature. Open Flight practice, choose Check available practice, then Play available version. If that version still cannot import it, use a compatible pack. Prepare offline saves the version you opened.',
    'Ця версія SIM не підтримує потрібну можливість світу. Відкрийте «Практика польоту», виберіть «Перевірити доступну практику», а потім «Грати в доступну версію». Якщо імпорт усе ще неможливий, потрібен сумісний пакунок. Підготовка офлайн зберігає відкриту версію.',
  ];
}

function readIndex(bytes) {
  return boundedJSON(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
    maxBytes: 32768,
    maxNodes: 1024,
    maxArray: 32,
    maxString: 256,
  });
}

export function worldLibraryIndex(bytes) {
  const value = readIndex(bytes);
  exactKeys(value, ['format', 'worlds'], 'world library');
  check(value.format === 'FPVWorldLibrary.v1' && Array.isArray(value.worlds));
  const seen = new Set();
  return value.worlds.map((row) => {
    exactKeys(
      row,
      ['id', 'title', 'revision', 'commit', 'path', 'sha256', 'bytes', 'courses'],
      'world',
    );
    check(
      stableId(row.id) &&
        !seen.has(row.id) &&
        stableId(row.revision) &&
        typeof row.commit === 'string' &&
        typeof row.sha256 === 'string' &&
        typeof row.path === 'string' &&
        /^[a-f0-9]{40}$/.test(row.commit) &&
        /^[a-f0-9]{64}$/.test(row.sha256) &&
        /^authoring\/fpv-worlds\/(?:[a-z0-9_-]+\/)+[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.rlpack$/.test(
          row.path,
        ) &&
        Array.isArray(row.title) &&
        row.title.length === 2 &&
        row.title.every(
          (text) =>
            typeof text === 'string' &&
            text.trim() &&
            text.length <= 120 &&
            !/[\x00-\x1f\x7f]/.test(text),
        ) &&
        Number.isSafeInteger(row.bytes) &&
        row.bytes > 0 &&
        row.bytes <= WORLD_LIMITS.packBytes &&
        Number.isSafeInteger(row.courses) &&
        row.courses > 0 &&
        row.courses <= WORLD_LIMITS.courses,
    );
    seen.add(row.id);
    return { ...row, url: origin + row.commit + '/' + row.path };
  });
}

// One bounded page at a time. The mutable root only points to immutable,
// integrity-checked successor pages; older v1 readers keep their own feed.
export function worldLibraryPage(bytes) {
  const value = readIndex(bytes);
  if (value.format === 'FPVWorldLibrary.v1')
    return { worlds: worldLibraryIndex(bytes), next: null };
  exactKeys(value, ['format', 'worlds', 'next'], 'world library page');
  check(value.format === 'FPVWorldLibrary.v2');
  const worlds = worldLibraryIndex(
    new TextEncoder().encode(
      JSON.stringify({ format: 'FPVWorldLibrary.v1', worlds: value.worlds }),
    ),
  );
  if (value.next === null) return { worlds, next: null };
  const next = value.next;
  exactKeys(next, ['commit', 'path', 'sha256', 'bytes'], 'world library continuation');
  check(
    typeof next.commit === 'string' &&
      /^[a-f0-9]{40}$/.test(next.commit) &&
      typeof next.sha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(next.sha256) &&
      typeof next.path === 'string' &&
      /^authoring\/fpv-worlds\/published\/free-worlds-v2\/[a-z0-9_-]+\.json$/.test(next.path) &&
      Number.isSafeInteger(next.bytes) &&
      next.bytes > 0 &&
      next.bytes <= 32768,
  );
  return { worlds, next: { ...next, url: origin + next.commit + '/' + next.path } };
}

function read(url, bytes, signal, progress, sha256) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../fpv-worlds/worker.js', import.meta.url)),
      cancel = () => worker.postMessage({ type: 'world-cancel' }),
      finish = (error, value) => {
        signal.removeEventListener('abort', cancel);
        worker.terminate();
        if (error || signal.aborted) reject(error ?? signal.reason);
        else resolve(value);
      };
    worker.onerror = () => finish(new Error('World download unavailable.'));
    worker.onmessageerror = worker.onerror;
    worker.onmessage = ({ data }) => {
      if (data.type === 'world-progress') progress(data.bytes);
      else
        finish(data.type === 'world-done' ? null : new Error('World download failed.'), data.bytes);
    };
    signal.addEventListener('abort', cancel, { once: true });
    worker.postMessage({ type: 'world-read', url, bytes, sha256 });
  });
}

export function mountWorldLibrary({ el, txt, parent, begin, install, fly }) {
  const root = el('section', undefined, 'world-catalogue'),
    heading = el('h2'),
    help = el('p'),
    tools = el('div', undefined, 'button-row'),
    search = el('input'),
    browse = el('button'),
    more = el('button'),
    cancel = el('button'),
    message = el('p'),
    cards = el('div', undefined, 'world-catalogue-cards'),
    home = el('span');
  root.id = 'optional-world-library';
  heading.id = 'world-catalogue-title';
  root.setAttribute('aria-labelledby', heading.id);
  search.type = 'search';
  message.setAttribute('role', 'status');
  home.hidden = true;
  tools.append(search, browse, cancel);
  root.append(heading, help, tools, message, cards, more);
  parent.previousElementSibling.before(home, root);
  browse.type = more.type = cancel.type = 'button';
  let operation = null,
    launching = false,
    closed = false,
    loaded = false,
    metadataRequested = false,
    epoch = 0,
    rows = [],
    saved = [],
    next = null,
    pages = new Set(),
    notice = ['', ''];
  const visible = () =>
    !closed &&
    !parent.ownerDocument.hidden &&
    !root.closest('[hidden]') &&
    (!root.closest('dialog') || root.closest('dialog').open);
  function show(...value) {
    notice = value;
    message.textContent = txt(...notice);
  }
  function paint() {
    heading.textContent = txt('More worlds to fly', 'Більше світів для польотів');
    help.textContent = txt(
      'Choose Play to download a world once and prepare a disarmed flight. Installed worlds stay on this device. Prepare the simulator offline separately.',
      'Натисніть «Грати», щоб один раз завантажити світ і підготувати політ із вимкненими двигунами. Встановлені світи залишаються на пристрої. Симулятор готується офлайн окремо.',
    );
    search.placeholder = txt('Find a world', 'Знайти світ');
    search.setAttribute('aria-label', search.placeholder);
    browse.textContent = loaded
      ? txt('Refresh worlds', 'Оновити світи')
      : txt('Browse worlds', 'Оглянути світи');
    more.textContent = txt('Load more worlds', 'Завантажити більше світів');
    cancel.textContent = txt('Cancel', 'Скасувати');
    message.textContent = txt(...notice);
    const active = parent.ownerDocument.activeElement,
      focusedWorld = active?.closest?.('[data-world]')?.dataset.world,
      busy = !!operation || launching;
    browse.disabled = more.disabled = busy;
    more.hidden = !next;
    cancel.hidden = !operation;
    cards.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase(txt('en', 'uk'));
    for (const row of rows.filter((row) =>
      row.title.some((title) => title.toLocaleLowerCase(txt('en', 'uk')).includes(query)),
    )) {
      const card = el('article', undefined, 'world-catalogue-card'),
        size =
          row.bytes < 1048576
            ? `${Math.ceil(row.bytes / 1024)} KiB`
            : `${(row.bytes / 1048576).toLocaleString(txt('en', 'uk'), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MiB`,
        stored = saved.some((item) => item.id === row.id && item.sha256 === row.sha256),
        play = el(
          'button',
          stored && !fly ? txt('Saved pack', 'Пакунок збережено') : txt('Play', 'Грати'),
        );
      card.dataset.world = row.id;
      play.type = 'button';
      play.disabled = busy || (stored && !fly);
      play.setAttribute('aria-label', `${txt('Play', 'Грати')}: ${txt(...row.title)}`);
      play.onclick = () => {
        if (closed || operation || launching) return;
        if (stored) void launch(row);
        else void run(row);
      };
      card.append(
        el('strong', txt(...row.title)),
        el(
          'p',
          `${txt(row.courses === 1 ? '1 challenge' : `${row.courses} challenges`, `Завдань: ${row.courses}`)} · ${stored ? txt('Installed', 'Встановлено') : `${txt('Download', 'Завантаження')} ${size}`}`,
        ),
        play,
      );
      cards.append(card);
      if (focusedWorld === row.id && !play.disabled) play.focus();
    }
    if (loaded && !cards.children.length)
      cards.append(el('p', txt('No matching worlds.', 'Відповідних світів немає.')));
  }
  async function launch(row) {
    if (!fly || !visible() || operation || launching) return;
    launching = true;
    paint();
    try {
      await fly(row);
    } catch {
      if (!closed)
        show(
          'This world could not open. Its saved pack is retained. Refresh worlds and try again.',
          'Не вдалося відкрити світ. Збережений пакунок залишено. Оновіть світи та повторіть.',
        );
    } finally {
      launching = false;
      if (!closed) paint();
    }
  }
  async function run(row = null, page = null) {
    if (closed || operation || launching) return;
    const controller = new AbortController(),
      signal = controller.signal,
      requestEpoch = epoch,
      doc = parent.ownerDocument;
    let committed = false,
      launchAfter = false,
      restoreFocus = true;
    operation = controller;
    metadataRequested = false;
    const trackFocus = (event) => {
      if (event.target !== doc.body && !root.contains(event.target)) restoreFocus = false;
    };
    doc.addEventListener('focusin', trackFocus);
    cancel.disabled = false;
    paint();
    // Automatic metadata discovery must not steal the chooser's existing focus.
    if (row || page) cancel.focus();
    show('Loading…', 'Завантаження…');
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const generation = row ? await begin() : null,
        source = row ?? page,
        url = source?.url ?? indexURL;
      signal.throwIfAborted();
      const bytes = await read(
        url,
        source?.bytes ?? 32768,
        signal,
        (size) => {
          if (row) show(`${size} / ${row.bytes} B`, `${size} / ${row.bytes} B`);
        },
        source?.sha256,
      );
      signal.throwIfAborted();
      if (source)
        check(bytes.length === source.bytes && (await worldSHA256(bytes)) === source.sha256);
      signal.throwIfAborted();
      if (row) {
        await install(bytes, row, {
          generation,
          signal,
          saved: () => {
            committed = true;
            saved = [...saved, row];
          },
          commit: () => {
            cancel.disabled = true;
            clearTimeout(timer);
            show('Saving…', 'Збереження…');
          },
        });
        if (closed) return;
        launchAfter = true;
        show('World installed. Ready to play.', 'Світ встановлено. Готовий до гри.');
      } else {
        const parsed = worldLibraryPage(bytes),
          prior = page ? rows : [],
          ids = new Set(prior.map((item) => item.id)),
          visited = page ? new Set(pages) : new Set();
        check(!visited.has(url));
        visited.add(url);
        check(prior.length + parsed.worlds.length <= 1024);
        for (const item of parsed.worlds) {
          check(!ids.has(item.id));
          ids.add(item.id);
        }
        check(!parsed.next || !visited.has(parsed.next.url));
        // Publish the complete page only after every row and continuation validates.
        rows = [...prior, ...parsed.worlds];
        next = parsed.next;
        pages = visited;
        loaded = true;
        show('Choose a world and Play.', 'Оберіть світ і натисніть «Грати».');
      }
    } catch (error) {
      if (!closed) {
        const compatibility = worldImportErrorCopy(error);
        if (committed)
          show(
            'World saved. Reload the SIM to refresh installed worlds.',
            'Світ збережено. Перезавантажте SIM, щоб оновити встановлені світи.',
          );
        else if (signal.aborted)
          show('Cancelled or timed out. Try again.', 'Скасовано або час вичерпано. Повторіть.');
        else if (compatibility) show(...compatibility);
        else
          show(
            'Download or save failed. Installed worlds are unchanged. Try again.',
            'Завантаження чи збереження не вдалося. Встановлені світи не змінено. Повторіть.',
          );
      }
    } finally {
      clearTimeout(timer);
      operation = null;
      doc.removeEventListener('focusin', trackFocus);
      if (!closed) {
        const restore =
          restoreFocus &&
          visible() &&
          (doc.activeElement === doc.body || root.contains(doc.activeElement));
        paint();
        if (restore && (row || page)) {
          const card = [...cards.children].find((node) => node.dataset.world === row?.id);
          (card?.querySelector('button') ?? (page && !more.hidden ? more : browse)).focus();
        }
      }
    }
    // A catalogue can reopen before its cancelled worker finishes. Honour only
    // that new metadata demand; never repeat a pack download or launch intent.
    if (metadataRequested && !loaded && visible()) void run();
    if (launchAfter && requestEpoch === epoch && !signal.aborted) await launch(row);
  }
  browse.onclick = () => run();
  more.onclick = () => {
    if (next) void run(null, next);
  };
  search.oninput = paint;
  cancel.onclick = () => {
    if (!cancel.disabled) operation?.abort();
  };
  paint();
  return {
    open(container = null) {
      if (closed) return;
      if (container) container.append(root);
      else home.after(root);
      if (!loaded) {
        if (!operation) void run();
        else if (operation.signal.aborted) metadataRequested = true;
      }
    },
    deactivate(container = null) {
      // Dialog close events are queued: the catalogue may already belong to a
      // different surface by the time its former container reports closing.
      if (container && !container.contains(root)) return;
      metadataRequested = false;
      epoch++;
      if (!cancel.disabled) operation?.abort();
    },
    refresh(records = saved) {
      saved = records;
      if (!closed) paint();
    },
    dispose() {
      closed = true;
      metadataRequested = false;
      epoch++;
      operation?.abort();
      home.remove();
      root.remove();
    },
  };
}
