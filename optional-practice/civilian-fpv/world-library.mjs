import { boundedJSON, exactKeys, stableId } from '../../game/data-json.mjs';
import { WORLD_LIMITS, worldSHA256 } from './world-content.mjs';

const origin = 'https://raw.githubusercontent.com/mekhovov/revealline/';
const indexURL = origin + 'main/authoring/fpv-worlds/published/index.json';
const check = (condition) => {
  if (!condition) throw new Error('Invalid world download.');
};

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

async function read(url, limit, signal, progress) {
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  });
  check(response.ok);
  const advertised = response.headers.get('content-length');
  check(
    !advertised || (Number.isSafeInteger(+advertised) && +advertised >= 0 && +advertised <= limit),
  );
  const reader = response.body?.getReader();
  check(reader);
  const bytes = new Uint8Array(limit);
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      check(size + value.byteLength <= limit);
      bytes.set(value, size);
      size += value.byteLength;
      progress(size);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return bytes.subarray(0, size);
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
      const card = el('div', undefined, 'proof-row'),
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
        el('small', `${row.revision} · ${row.courses} · ${row.bytes} B`),
        download,
      );
      cards.append(card);
    }
  }
  async function run(row) {
    if (closed || operation) return;
    const controller = new AbortController(),
      signal = controller.signal;
    operation = controller;
    cancel.disabled = false;
    paint();
    show('Loading…', 'Завантаження…');
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const generation = row ? await begin() : null;
      signal.throwIfAborted();
      const bytes = await read(row?.url ?? indexURL, row?.bytes ?? 8192, signal, (size) => {
        if (row) show(`${size} / ${row.bytes} B`, `${size} / ${row.bytes} B`);
      });
      signal.throwIfAborted();
      if (row) {
        check(bytes.length === row.bytes && (await worldSHA256(bytes)) === row.sha256);
        signal.throwIfAborted();
        await install(bytes, row, {
          generation,
          signal,
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
    } catch {
      if (!closed) {
        if (signal.aborted)
          show('Cancelled or timed out. Try again.', 'Скасовано або час вичерпано. Повторіть.');
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
