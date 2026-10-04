import { boundedJSON, exactKeys, stableId } from '../../game/data-json.mjs';
import { WORLD_LIMITS, worldSHA256 } from './world-content.mjs';

const origin = 'https://raw.githubusercontent.com/mekhovov/revealline/';
// This endpoint only publishes packs supported by the surface-coating-v1 runtime.
// The original index remains compatible with already cached older players.
const indexURL = origin + 'main/authoring/fpv-worlds/published/surface-coating-v1/index.json';
const check = (condition) => {
  if (!condition) throw new Error('Invalid world download.');
};

export function worldImportErrorCopy(error) {
  if (!['unsupported-world-extension', 'unsupported-ground-motion'].includes(error?.code))
    return null;
  return [
    'This SIM version does not support a required world feature. Open Flight practice, choose Check available practice, then Play available version. If that version still cannot import it, use a compatible pack. Prepare offline saves the version you opened.',
    'Ця версія SIM не підтримує потрібну можливість світу. Відкрийте «Практика польоту», виберіть «Перевірити доступну практику», а потім «Грати в доступну версію». Якщо імпорт усе ще неможливий, потрібен сумісний пакунок. Підготовка офлайн зберігає відкриту версію.',
  ];
}

export function worldLibraryIndex(bytes) {
  const value = boundedJSON(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
    maxBytes: 8192,
    maxNodes: 128,
    maxArray: 4,
    maxString: 256,
  });
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

export function mountWorldLibrary({ el, txt, parent, begin, install }) {
  const root = el('section'),
    browse = el('button', txt('Browse optional worlds', 'Оглянути додаткові світи')),
    cancel = el('button', txt('Cancel', 'Скасувати')),
    message = el('p'),
    cards = el('div');
  root.id = 'optional-world-library';
  message.setAttribute('role', 'status');
  root.append(browse, cancel, message, cards);
  parent.previousElementSibling.before(root);
  browse.type = cancel.type = 'button';
  let operation = null,
    closed = false,
    rows = [],
    saved = [],
    notice = ['', ''];
  function show(...value) {
    notice = value;
    message.textContent = txt(...notice);
  }
  function paint() {
    browse.textContent = txt('Browse optional worlds', 'Оглянути додаткові світи');
    cancel.textContent = txt('Cancel', 'Скасувати');
    message.textContent = txt(...notice);
    browse.disabled = !!operation;
    cancel.hidden = !operation;
    cards.replaceChildren();
    for (const row of rows) {
      const card = el('div', undefined, 'proof-row challenge-info'),
        size =
          row.bytes < 1048576
            ? `${Math.ceil(row.bytes / 1024)} KiB`
            : `${(row.bytes / 1048576).toLocaleString(txt('en', 'uk'), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MiB`,
        stored = saved.some((item) => item.id === row.id && item.sha256 === row.sha256),
        download = el(
          'button',
          stored ? txt('Saved pack', 'Пакунок збережено') : txt('Download', 'Завантажити'),
        );
      card.dataset.world = row.id;
      download.type = 'button';
      download.disabled = !!operation || stored;
      download.onclick = () => run(row);
      card.append(
        el('strong', txt(...row.title)),
        el(
          'p',
          `${row.revision} · ${txt(row.courses === 1 ? '1 challenge' : `${row.courses} challenges`, `Завдань: ${row.courses}`)} · ${size}`,
        ),
        download,
      );
      cards.append(card);
    }
  }
  async function run(row) {
    if (closed || operation) return;
    const controller = new AbortController(),
      signal = controller.signal;
    let committed = false;
    operation = controller;
    cancel.disabled = false;
    paint();
    show('Loading…', 'Завантаження…');
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const generation = row ? await begin() : null;
      signal.throwIfAborted();
      const bytes = await read(
        row?.url ?? indexURL,
        row?.bytes ?? 8192,
        signal,
        (size) => {
          if (row) show(`${size} / ${row.bytes} B`, `${size} / ${row.bytes} B`);
        },
        row?.sha256,
      );
      signal.throwIfAborted();
      if (row) {
        check(bytes.length === row.bytes && (await worldSHA256(bytes)) === row.sha256);
        signal.throwIfAborted();
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
        show(
          'Pack saved. Prepare simulator offline separately. Keep a backup.',
          'Пакунок збережено. Симулятор готується автономно окремо. Зробіть копію.',
        );
      } else {
        rows = worldLibraryIndex(bytes);
        if (rows.length) show('Choose a world to download.', 'Оберіть світ для завантаження.');
        else show('No published worlds yet.', 'Опублікованих світів ще немає.');
      }
    } catch (error) {
      if (!closed) {
        const compatibility = worldImportErrorCopy(error);
        if (committed)
          show(
            'Pack saved. Reload to refresh Library.',
            'Пакунок збережено. Перезавантажте бібліотеку.',
          );
        else if (signal.aborted)
          show('Cancelled or timed out. Try again.', 'Скасовано або час вичерпано. Повторіть.');
        else if (compatibility) show(...compatibility);
        else
          show(
            'Download or save failed. Try again.',
            'Завантаження чи збереження не вдалося. Повторіть.',
          );
      }
    } finally {
      clearTimeout(timer);
      operation = null;
      if (!closed) paint();
    }
  }
  browse.onclick = () => run();
  cancel.onclick = () => {
    if (!cancel.disabled) operation?.abort();
  };
  paint();
  return {
    refresh(records = saved) {
      saved = records;
      if (!closed) paint();
    },
    dispose() {
      closed = true;
      operation?.abort();
      root.remove();
    },
  };
}
