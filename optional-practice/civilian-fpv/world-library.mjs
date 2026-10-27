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

export function mountWorldLibrary({
  el,
  txt,
  parent,
  begin,
  install,
  fly,
  initialRows = [],
  onChange = () => {},
}) {
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
    discovery = null,
    discoveryController = null,
    rows = initialRows.map((row) => ({ ...row, url: origin + row.commit + '/' + row.path })),
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
        rows = [
          ...prior,
          ...parsed.worlds.map((row) => ({
            ...row,
            levels: initialRows.find((known) => known.sha256 === row.sha256)?.levels,
          })),
        ];
        onChange();
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
    refreshMissions() {
      if (closed) return Promise.resolve();
      if (discovery) return discovery;
      const controller = new AbortController();
      discoveryController = controller;
      const timer = setTimeout(() => controller.abort(), 120000);
      discovery = (async () => {
        const discovered = [],
          seen = new Set();
        let page = null;
        do {
          const url = page?.url ?? indexURL;
          check(!seen.has(url));
          seen.add(url);
          const bytes = await read(
            url,
            page?.bytes ?? 32768,
            controller.signal,
            () => {},
            page?.sha256,
          );
          if (page)
            check(bytes.length === page.bytes && (await worldSHA256(bytes)) === page.sha256);
          const parsed = worldLibraryPage(bytes);
          check(discovered.length + parsed.worlds.length <= 1024);
          for (const row of parsed.worlds) {
            check(!discovered.some((prior) => prior.id === row.id));
            discovered.push({
              ...row,
              levels: initialRows.find((known) => known.sha256 === row.sha256)?.levels,
            });
          }
          page = parsed.next;
        } while (page);
        controller.signal.throwIfAborted();
        if (!closed) {
          rows = discovered;
          loaded = true;
          onChange();
          paint();
        }
      })().finally(() => {
        clearTimeout(timer);
        discovery = null;
        discoveryController = null;
      });
      return discovery;
    },
    missions: () =>
      rows.flatMap((row) =>
        Array.from({ length: row.courses }, (_, index) => ({
          row,
          index,
          level: row.levels?.[index],
        })),
      ),
    async prepareMission(row, { signal }) {
      if (closed || !rows.some((offered) => offered.id === row.id && offered.sha256 === row.sha256))
        throw new Error('This download is no longer offered. Refresh the level selector.');
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      const timer = setTimeout(
        () => controller.abort(new DOMException('World download timed out', 'TimeoutError')),
        120000,
      );
      try {
        const generation = await begin();
        controller.signal.throwIfAborted();
        const bytes = await read(row.url, row.bytes, controller.signal, () => {}, row.sha256);
        check(bytes.length === row.bytes && (await worldSHA256(bytes)) === row.sha256);
        controller.signal.throwIfAborted();
        await install(bytes, row, {
          generation,
          signal: controller.signal,
          commit() {
            clearTimeout(timer);
          },
          saved() {},
        });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    },
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
      discoveryController?.abort();
      metadataRequested = false;
      epoch++;
      operation?.abort();
      home.remove();
      root.remove();
    },
  };
}

// Route labels from the exact published pack hashes; never used as flight authority.
export const WORLD_LIBRARY_CATALOGUE = Object.freeze([
  {
    "id": "mountain-reservoir",
    "title": [
      "Mountain Reservoir",
      "Гірське водосховище"
    ],
    "revision": "r16",
    "commit": "ea57d2e321896ab873c2ca6ca06791a88362a674",
    "path": "authoring/fpv-worlds/mountain-reservoir/distribution/r16/mountain-reservoir.r16.rlpack",
    "sha256": "50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554",
    "bytes": 1379988,
    "courses": 8,
    "levels": [
      {
        "id": "mountain-reservoir-01",
        "title": [
          "Shoreline check-in",
          "Перевірка берегового маршруту"
        ]
      },
      {
        "id": "mountain-reservoir-02",
        "title": [
          "Western dam crest",
          "Західний гребінь греблі"
        ]
      },
      {
        "id": "mountain-reservoir-03",
        "title": [
          "Intake controls",
          "Пульт водозабору"
        ]
      },
      {
        "id": "mountain-reservoir-04",
        "title": [
          "Dry spillway descent",
          "Спуск сухим водоскидом"
        ]
      },
      {
        "id": "mountain-reservoir-05",
        "title": [
          "Exterior service passage",
          "Зовнішній службовий прохід"
        ]
      },
      {
        "id": "mountain-reservoir-06",
        "title": [
          "Rock terrace climb",
          "Підйом кам’яними терасами"
        ]
      },
      {
        "id": "mountain-reservoir-07",
        "title": [
          "Shoreline circuit",
          "Берегове коло"
        ]
      },
      {
        "id": "mountain-reservoir-08",
        "title": [
          "Maintenance roof landing",
          "Посадка на дах службової будівлі"
        ]
      }
    ]
  },
  {
    "id": "festival-grounds",
    "title": [
      "Festival Grounds",
      "Фестивальний майданчик"
    ],
    "revision": "r5",
    "commit": "62d0e72f2963a61cc65ef829a320d9a1c2593b0c",
    "path": "authoring/fpv-worlds/festival-grounds/distribution/r5/festival-grounds.r5.rlpack",
    "sha256": "87baca276e174f31ba19c02f4f2359c97affa07eefd4a5f4912b4d8664450f51",
    "bytes": 1256875,
    "courses": 8,
    "levels": [
      {
        "id": "festival-grounds-01",
        "title": [
          "Entry check-in",
          "Огляд від входу"
        ]
      },
      {
        "id": "festival-grounds-02",
        "title": [
          "Main lawn loop",
          "Коло центральною галявиною"
        ]
      },
      {
        "id": "festival-grounds-03",
        "title": [
          "Market slalom",
          "Слалом між крамничками"
        ]
      },
      {
        "id": "festival-grounds-04",
        "title": [
          "Stage-side sprint",
          "Спринт навколо сцени"
        ]
      },
      {
        "id": "festival-grounds-05",
        "title": [
          "Sound-desk landing",
          "Посадка на звуковий пульт"
        ]
      },
      {
        "id": "festival-grounds-06",
        "title": [
          "Service cart escort",
          "Супровід службового візка"
        ]
      },
      {
        "id": "festival-grounds-07",
        "title": [
          "Festival guide",
          "Спостереження за гідом"
        ]
      },
      {
        "id": "festival-grounds-08",
        "title": [
          "Grounds circuit",
          "Коло фестивальним майданчиком"
        ]
      }
    ]
  },
  {
    "id": "harbor-docks",
    "title": [
      "Harbor Docks",
      "Портові доки"
    ],
    "revision": "r4",
    "commit": "8af1b67220be4f26e9b68d821e2b574b63a23904",
    "path": "authoring/fpv-worlds/harbor-docks/distribution/r4/harbor-docks.r4.rlpack",
    "sha256": "d5bf4b9bb6829c04dbe1bb398893e5243cefc1f9acf018bf153a2012c8cf49b6",
    "bytes": 879213,
    "courses": 8,
    "levels": [
      {
        "id": "harbor-docks-01",
        "title": [
          "Quay check-in",
          "Огляд причалу"
        ]
      },
      {
        "id": "harbor-docks-02",
        "title": [
          "Container perimeter",
          "Периметр контейнерів"
        ]
      },
      {
        "id": "harbor-docks-03",
        "title": [
          "Gantry height line",
          "Висотна траєкторія порталу"
        ]
      },
      {
        "id": "harbor-docks-04",
        "title": [
          "Service-deck landing",
          "Посадка на службовий майданчик"
        ]
      },
      {
        "id": "harbor-docks-05",
        "title": [
          "Terminal cart escort",
          "Супровід портового візка"
        ]
      },
      {
        "id": "harbor-docks-06",
        "title": [
          "Deck inspection",
          "Огляд службового майданчика"
        ]
      },
      {
        "id": "harbor-docks-07",
        "title": [
          "Training-drone bay",
          "Майданчик навчального дрона"
        ]
      },
      {
        "id": "harbor-docks-08",
        "title": [
          "Harbor circuit",
          "Коло портом"
        ]
      }
    ]
  },
  {
    "id": "cc0-castle-court",
    "title": [
      "Castle Courtyard",
      "Замкове подвір’я"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-castle-court/cc0-castle-court.r1.rlpack",
    "sha256": "ee6d8ee8ea5d981f49cdeaa52282a33d36de3f98321883b0cb7cbcc630356ed0",
    "bytes": 160544,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-castle-court-route",
        "title": [
          "Castle Courtyard · discovery",
          "Замкове подвір’я · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-city-plaza",
    "title": [
      "City Plaza",
      "Міська площа"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-city-plaza/cc0-city-plaza.r1.rlpack",
    "sha256": "08dd572b3812ffeac3ba1e87ef1890afa7e3d3f127493c189197d1739f1e78ce",
    "bytes": 1289830,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-city-plaza-route",
        "title": [
          "City Plaza · discovery",
          "Міська площа · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-construction-site",
    "title": [
      "House Construction Site",
      "Будівельний майданчик"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-construction-site/cc0-construction-site.r1.rlpack",
    "sha256": "8d6f217d626c570815722fc23d04cd5297093ab0ff6a1f6886897a5d96ffe062",
    "bytes": 2368301,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-construction-site-route",
        "title": [
          "House Construction Site · discovery",
          "Будівельний майданчик · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-frontier-camp",
    "title": [
      "Frontier Camp",
      "Табір на узліссі"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-frontier-camp/cc0-frontier-camp.r1.rlpack",
    "sha256": "4c9b122ccfb6b28b46dd2b198b8d15477fde456d91a2f416498bf40948a5e92b",
    "bytes": 172377,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-frontier-camp-route",
        "title": [
          "Frontier Camp · discovery",
          "Табір на узліссі · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-industrial-yard",
    "title": [
      "Industrial Service Yard",
      "Промисловий двір"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-industrial-yard/cc0-industrial-yard.r1.rlpack",
    "sha256": "74fc5afb38af089a0bf58740640b070532d36cdd181011b9ef2fb8742d496273",
    "bytes": 1054654,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-industrial-yard-route",
        "title": [
          "Industrial Service Yard · discovery",
          "Промисловий двір · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-orbital-workshop",
    "title": [
      "Orbital Workshop",
      "Орбітальна майстерня"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-orbital-workshop/cc0-orbital-workshop.r1.rlpack",
    "sha256": "916d8da5a1b2b29ddc20ef7bf090fbc38038ea926d7bdd1a0e560ce513c5e71c",
    "bytes": 155913,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-orbital-workshop-route",
        "title": [
          "Orbital Workshop · discovery",
          "Орбітальна майстерня · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-pine-clearing",
    "title": [
      "Pine Clearing",
      "Соснова галявина"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-pine-clearing/cc0-pine-clearing.r1.rlpack",
    "sha256": "59c448a1226ad03a3881322ff7d9d766cc7ca35ef888267665fe66399cfe8b3f",
    "bytes": 131266,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-pine-clearing-route",
        "title": [
          "Pine Clearing · discovery",
          "Соснова галявина · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-platform-garden",
    "title": [
      "Platform Garden",
      "Сад платформ"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-platform-garden/cc0-platform-garden.r1.rlpack",
    "sha256": "019d00195bcb03dd9f202e12cd948d369cdda271517bf4d493e68440b8e406b0",
    "bytes": 159176,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-platform-garden-route",
        "title": [
          "Platform Garden · discovery",
          "Сад платформ · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-race-paddock",
    "title": [
      "Race Paddock",
      "Гоночний паддок"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-race-paddock/cc0-race-paddock.r1.rlpack",
    "sha256": "33443ec2cb18a9d4c8874f564e3644fd0cd36c03680d1b37cfd01bab1f9a949e",
    "bytes": 394615,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-race-paddock-route",
        "title": [
          "Race Paddock · discovery",
          "Гоночний паддок · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-road-lab",
    "title": [
      "Roadworks Practice Park",
      "Дорожній тренувальний парк"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-road-lab/cc0-road-lab.r1.rlpack",
    "sha256": "97fe29db831659500a8850ed0e0a0252c37b6a6c893b37536e1967404683c355",
    "bytes": 63754,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-road-lab-route",
        "title": [
          "Roadworks Practice Park · discovery",
          "Дорожній тренувальний парк · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-rock-grotto",
    "title": [
      "Rock Grotto",
      "Скелястий грот"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-rock-grotto/cc0-rock-grotto.r1.rlpack",
    "sha256": "8f4809f5f07d625046ec58f810fca9d52d14ad177b5564f16f0ee73da187a2f5",
    "bytes": 1433783,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-rock-grotto-route",
        "title": [
          "Rock Grotto · discovery",
          "Скелястий грот · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-ruined-halls",
    "title": [
      "Ruined Halls",
      "Зруйновані зали"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-ruined-halls/cc0-ruined-halls.r1.rlpack",
    "sha256": "01eb7bd2874bb07ff7617f792fa765ca1d8d3e6cad72445013a4c72e8c21324a",
    "bytes": 1750695,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-ruined-halls-route",
        "title": [
          "Ruined Halls · discovery",
          "Зруйновані зали · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-shipyard",
    "title": [
      "Dry-dock Shipyard",
      "Верф сухого доку"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-shipyard/cc0-shipyard.r1.rlpack",
    "sha256": "5b3f2251ff0fcbdfbd645a7f6394b2f13d23f544adc57fe2b8a8ccdcdce14e98",
    "bytes": 608177,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-shipyard-route",
        "title": [
          "Dry-dock Shipyard · discovery",
          "Верф сухого доку · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-skate-plaza",
    "title": [
      "Skate Plaza",
      "Скейт-площа"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-skate-plaza/cc0-skate-plaza.r1.rlpack",
    "sha256": "388c68e57c43b4d3d450c57890b112408c0316e4e5e2d0e9eae00d9cb151e03b",
    "bytes": 214473,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-skate-plaza-route",
        "title": [
          "Skate Plaza · discovery",
          "Скейт-площа · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-village-green",
    "title": [
      "Village Green",
      "Сільський парк"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-village-green/cc0-village-green.r1.rlpack",
    "sha256": "3ca6c466023b6b764c47c70c15013b64d0af7ca4577104ff777707527d4192af",
    "bytes": 620228,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-village-green-route",
        "title": [
          "Village Green · discovery",
          "Сільський парк · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-woodland-camp",
    "title": [
      "Woodland Camp",
      "Лісовий табір"
    ],
    "revision": "r1",
    "commit": "0c05c638bad38a3ae62c4c0a911919bc54f1eb11",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-woodland-camp/cc0-woodland-camp.r1.rlpack",
    "sha256": "a7b0f6d52411131f6e03d25f5db1ef25209be2875422e0aad8fd0f155735b93c",
    "bytes": 310434,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-woodland-camp-route",
        "title": [
          "Woodland Camp · discovery",
          "Лісовий табір · знайомство"
        ]
      }
    ]
  },
  {
    "id": "cc0-coaster-park",
    "title": [
      "Coaster Practice Park",
      "Тренувальний парк атракціонів"
    ],
    "revision": "r1",
    "commit": "f1b6373996a53c84bca77b485e73630ffe6b00c7",
    "path": "authoring/fpv-worlds/free-worlds/distribution/r1/cc0-coaster-park/cc0-coaster-park.r1.rlpack",
    "sha256": "a0483ee22fabdc190fc65858c458ed4730297a0179f8ede793383775a7568025",
    "bytes": 1201279,
    "courses": 1,
    "levels": [
      {
        "id": "cc0-coaster-park-route",
        "title": [
          "Coaster Practice Park · discovery",
          "Тренувальний парк атракціонів · знайомство"
        ]
      }
    ]
  }
]);
