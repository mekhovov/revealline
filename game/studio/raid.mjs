import {
  createOverflightHuntProject,
  validateOverflightHuntProject,
  compileOverflightHuntProject,
  OVERFLIGHT_HUNT_UPGRADES,
  OVERFLIGHT_HUNT_BEHAVIORS,
  OVERFLIGHT_HUNT_ENCOUNTER_SETS,
} from '../overflight/raid-project.mjs';
import { OVERFLIGHT_SOLDIERS, OVERFLIGHT_MACHINERY } from '../overflight/project.mjs';
import {
  createOverflightHuntPackage,
  createOverflightHuntLibrary,
  importOverflightHuntPackage,
  exportOverflightHuntPackage,
} from '../overflight/raid-community.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { boundedJSON, exactKeys } from '../data-json.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { nativeArtReviewURL } from '../fpv-entry.mjs';

const params = new URL(location.href).searchParams;
if (['en', 'uk'].includes(params.get('lang'))) setLocale(params.get('lang'), { persist: false });
const locale = getLocale() === 'uk' ? 'uk' : 'en';
document.documentElement.lang = locale;
const words = (en, uk) => (locale === 'uk' ? uk : en);
const element = (tag, text = '', attributes = {}) => {
  const node = document.createElement(tag);
  node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};
const root = document.querySelector('#raid-studio');
const status = element('p', '', { id: 'raid-status', role: 'status' });
const previewStatus = element('p', '', { id: 'raid-preview-status', role: 'status' });
const reportPreview = (text, error = false) => {
  previewStatus.textContent = text;
  previewStatus.dataset.error = String(error);
};
const report = (text, error = false) => {
  status.textContent = text;
  status.dataset.error = String(error);
};
const guarded = (fn) => async () => {
  try {
    await fn();
  } catch (error) {
    report(error.message, true);
  }
};
const button = (label, fn) => {
  const node = element('button', label, { type: 'button' });
  node.addEventListener('click', guarded(fn));
  return node;
};
const field = (parent, label, input) => {
  const node = element('label', label);
  node.append(input);
  parent.append(node);
  return input;
};
const scopedURL = (path) => {
  const url = new URL(path, location.href);
  url.searchParams.set('lang', locale);
  return nativeArtReviewURL(url.href, location.href);
};
const nav = element('nav', '', {
  'aria-label': words('Creator navigation', 'Навігація майстерні'),
});
for (const [path, en, uk] of [
  ['../', 'Main game', 'Головна гра'],
  ['./', 'Content Studio', 'Майстерня контенту'],
  ['../overflight/raid.html', 'Play Raid', 'Грати в Наліт'],
  ['../community/store.html', 'Community', 'Спільнота'],
  ['../../authoring/asset-studio/', 'Asset Studio', 'Майстерня ресурсів'],
  ['../../authoring/motion-lab/#overflight-motion-study', 'Motion Lab', 'Лабораторія руху'],
])
  nav.append(element('a', words(en, uk), { href: scopedURL(path) }));
let draft = createOverflightHuntProject(),
  sector = 0,
  selected = { kind: 'objectives', index: 0 },
  revision = 0,
  disposed = false,
  ready = false,
  requestId = 0,
  previewIdentity = null;
const library = createOverflightHuntLibrary();
const drafts = createProfileRecordBackend({
  key: 'overflight-hunt-studio-draft.v1',
  empty: () => ({ project: null }),
  validate(source) {
    const value = boundedJSON(source, {
      maxBytes: 140 * 1024,
      maxNodes: 18000,
      maxDepth: 14,
      maxArray: 128,
    });
    exactKeys(value, ['project'], 'Raid draft');
    if (value.project !== null) value.project = validateOverflightHuntProject(value.project);
    return value;
  },
});
const editor = element('div'),
  installed = element('div', '', { class: 'raid-installed' });
const source = element('textarea', '', {
  id: 'raid-source',
  spellcheck: 'false',
  'aria-label': words('Raid project JSON', 'JSON проєкту Нальоту'),
});
const preview = element('iframe', '', {
  id: 'raid-preview',
  title: words('Native Raid preview', 'Ігровий перегляд Нальоту'),
  allow: 'gamepad; fullscreen',
  src: scopedURL(`../overflight/raid.html?studio=overflight-hunt`),
});
const touch = () => {
  revision++;
  source.value = JSON.stringify(draft, null, 2);
};
source.addEventListener('input', () => revision++);
function replaceProject(project) {
  draft = structuredClone(validateOverflightHuntProject(project));
  sector = 0;
  selected = { kind: 'objectives', index: 0 };
  touch();
  render();
}
function check() {
  const compiled = compileOverflightHuntProject(draft);
  report(
    words(
      `Validated · ${compiled.projectIdentity} · seven objectives`,
      `Перевірено · ${compiled.projectIdentity} · сім цілей`,
    ),
  );
  return compiled;
}
function sendPreview() {
  const compiled = compileOverflightHuntProject(draft);
  if (!ready) {
    reportPreview(
      words(
        'The native preview is preparing artwork. Preview when it is ready.',
        'Ігровий перегляд готує оформлення. Запустіть перегляд, коли він буде готовий.',
      ),
    );
    return;
  }
  previewIdentity = compiled.projectIdentity;
  preview.contentWindow.postMessage(
    {
      type: 'overflight-hunt:preview',
      version: 1,
      requestId: ++requestId,
      project: structuredClone(draft),
      seed: draft.seed,
    },
    location.origin,
  );
}
const onMessage = (event) => {
  if (
    disposed ||
    event.source !== preview.contentWindow ||
    event.origin !== location.origin ||
    event.data?.version !== 1
  )
    return;
  if (event.data.type === 'overflight-hunt:ready') {
    ready = true;
    try {
      sendPreview();
    } catch (error) {
      reportPreview(error.message, true);
    }
  }
  if (
    event.data.type === 'overflight-hunt:accepted' &&
    event.data.requestId === requestId &&
    event.data.projectIdentity === previewIdentity
  )
    reportPreview(
      words(
        'Native preview ready. Press Start below.',
        'Ігровий перегляд готовий. Натисніть «Почати» внизу.',
      ),
    );
  if (event.data.type === 'overflight-hunt:error' && event.data.requestId === requestId)
    reportPreview(String(event.data.message ?? 'Preview failed'), true);
};
window.addEventListener('message', onMessage);
const svgElement = (tag, attributes = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};
function numeric(parent, label, owner, key, min, max, step = 1, onChange = () => {}) {
  const input = field(parent, label, element('input', '', { type: 'number', min, max, step }));
  input.value = owner[key];
  input.addEventListener('input', () => {
    owner[key] = Number(input.value);
    touch();
    onChange();
  });
  return input;
}
function selectField(parent, label, value, options, onChange) {
  const input = field(parent, label, element('select'));
  for (const option of options)
    input.append(
      element('option', typeof option === 'string' ? option : option.label, {
        value: typeof option === 'string' ? option : option.value,
      }),
    );
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  return input;
}
function currentActor() {
  return draft.encounters[sector][selected.kind][selected.index];
}
function render() {
  editor.replaceChildren();
  const general = element('fieldset'),
    generalFields = element('div', '', { class: 'raid-fields' });
  general.append(element('legend', words('Sortie', 'Виліт')), generalFields);
  for (const language of ['en', 'uk']) {
    const input = field(
      generalFields,
      language === 'en' ? 'Title · EN' : 'Назва · UK',
      element('input', '', { maxlength: 120 }),
    );
    input.value = draft.title[language];
    input.addEventListener('input', () => {
      draft.title[language] = input.value;
      touch();
    });
  }
  numeric(generalFields, words('Seed', 'Зерно'), draft, 'seed', 1, 4294967295);
  numeric(generalFields, words('World width', 'Ширина світу'), draft.arena, 'width', 2880, 5760);
  numeric(generalFields, words('World height', 'Висота світу'), draft.arena, 'height', 1080, 2160);
  const heading = element('div', '', { class: 'raid-toolbar' });
  selectField(
    heading,
    words('Encounter sector', 'Сектор бою'),
    String(sector),
    draft.encounters.map((item, index) => ({
      value: String(index),
      label: `${index + 1} · ${item.title[locale]}`,
    })),
    (value) => {
      sector = Number(value);
      selected = { kind: 'objectives', index: 0 };
      render();
    },
  );
  const encounter = draft.encounters[sector];
  selectField(
    heading,
    words('Edit actor or pack', 'Редагувати ціль чи групу'),
    `${selected.kind}:${selected.index}`,
    ['objectives', 'packs'].flatMap((kind) =>
      encounter[kind].map((item, index) => ({
        value: `${kind}:${index}`,
        label: `${kind === 'objectives' ? '◆' : '●'} ${item.id} · ${item.family}`,
      })),
    ),
    (value) => {
      const [kind, index] = value.split(':');
      selected = { kind, index: Number(index) };
      render();
    },
  );
  const workspace = element('div', '', { class: 'raid-workspace' }),
    mapPanel = element('section'),
    inspector = element('section');
  const svg = svgElement('svg', {
    id: 'raid-map',
    viewBox: `0 0 ${draft.arena.width} ${draft.arena.height}`,
    role: 'group',
    'aria-label': words(
      'Arena layout. Select and drag targets or route points.',
      'Схема арени. Оберіть і перетягніть цілі або точки маршруту.',
    ),
  });
  const map = () => {
    svg.replaceChildren();
    draft.encounters.forEach((part) => {
      const tint = part.sector === sector ? '#f0c364' : '#586b60';
      svg.append(
        svgElement('line', {
          x1: part.sector * 960,
          x2: part.sector * 960,
          y1: 0,
          y2: draft.arena.height,
          stroke: '#53675a',
          'stroke-width': 4,
        }),
      );
      const text = svgElement('text', {
        x: part.sector * 960 + 40,
        y: 70,
        class: 'raid-sector-label',
      });
      text.textContent = `${part.sector + 1} · ${part.title[locale]}`;
      svg.append(text);
      for (const kind of ['packs', 'objectives'])
        part[kind].forEach((actor, index) => {
          const active =
            part.sector === sector && selected.kind === kind && selected.index === index;
          const circle = svgElement('circle', {
            cx: actor.x,
            cy: actor.y,
            r: kind === 'objectives' ? 27 : 17,
            fill: active ? '#fff1c8' : tint,
            stroke: kind === 'objectives' ? '#f39774' : '#183229',
            'stroke-width': kind === 'objectives' ? 9 : 4,
            'data-actor': `${part.sector}:${kind}:${index}`,
            tabindex: 0,
            role: 'button',
            'aria-label': `${actor.id}: ${actor.family}`,
          });
          svg.append(circle);
          if (active) {
            const line = svgElement('polyline', {
              points: [[actor.x, actor.y], ...actor.route.map((p) => [p.x, p.y])]
                .map((p) => p.join(','))
                .join(' '),
              fill: 'none',
              stroke: '#9de4d0',
              'stroke-width': 6,
              'stroke-dasharray': '14 10',
            });
            svg.append(line);
            actor.route.forEach((p, index) => {
              const handle = svgElement('circle', {
                cx: p.x,
                cy: p.y,
                r: 17,
                fill: '#172a22',
                stroke: '#9de4d0',
                'stroke-width': 5,
                'data-route': index,
                tabindex: 0,
                role: 'button',
                'aria-label': words(`Route point ${index + 1}`, `Точка маршруту ${index + 1}`),
              });
              svg.append(handle);
            });
          }
        });
    });
    draft.props.forEach((prop) =>
      svg.append(
        svgElement('rect', {
          x: prop.x - 14,
          y: prop.y - 14,
          width: 28,
          height: 28,
          fill: '#ba9660',
        }),
      ),
    );
  };
  map();
  let dragging = null;
  const position = (event) => {
    const bounds = svg.getBoundingClientRect();
    return {
      x: Math.round(
        Math.max(
          40,
          Math.min(
            draft.arena.width - 40,
            ((event.clientX - bounds.left) / bounds.width) * draft.arena.width,
          ),
        ),
      ),
      y: Math.round(
        Math.max(
          40,
          Math.min(
            draft.arena.height - 40,
            ((event.clientY - bounds.top) / bounds.height) * draft.arena.height,
          ),
        ),
      ),
    };
  };
  svg.addEventListener('pointerdown', (event) => {
    const actorKey = event.target.getAttribute('data-actor');
    if (actorKey) {
      const [part, kind, index] = actorKey.split(':');
      if (Number(part) !== sector || kind !== selected.kind || Number(index) !== selected.index) {
        sector = Number(part);
        selected = { kind, index: Number(index) };
        render();
        return;
      }
      dragging = currentActor();
    } else if (event.target.hasAttribute('data-route'))
      dragging = currentActor().route[Number(event.target.getAttribute('data-route'))];
    else return;
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  svg.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    Object.assign(dragging, position(event));
    touch();
    map();
  });
  const finish = () => {
    if (dragging) {
      dragging = null;
      render();
    }
  };
  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);
  svg.addEventListener('keydown', (event) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    const selectOnly = ['Enter', ' '].includes(event.key);
    if (!delta && !selectOnly) return;
    const key = event.target.getAttribute('data-actor'),
      routeKey = event.target.getAttribute('data-route');
    let target;
    if (key) {
      const [part, kind, index] = key.split(':');
      sector = Number(part);
      selected = { kind, index: Number(index) };
      target = currentActor();
    } else if (routeKey !== null) target = currentActor().route[Number(routeKey)];
    if (!target) return;
    event.preventDefault();
    if (delta) {
      const step = event.shiftKey ? 40 : 10;
      target.x = Math.max(40, Math.min(draft.arena.width - 40, target.x + delta[0] * step));
      target.y = Math.max(40, Math.min(draft.arena.height - 40, target.y + delta[1] * step));
      touch();
    }
    render();
    editor.querySelector(key ? `[data-actor="${key}"]` : `[data-route="${routeKey}"]`)?.focus();
  });
  mapPanel.append(
    svg,
    element(
      'p',
      words(
        'Gold dots are finite packs; outlined targets advance the encounter. Select a marker, then drag it or its route points. Arrow keys move focused markers; Shift moves farther. Routes commit instead of tracking the drone continuously.',
        'Золоті точки — скінченні групи; обведені цілі просувають бій. Оберіть маркер, потім перетягніть його чи точки маршруту. Стрілки рухають вибрані маркери; Shift збільшує крок. Вороги дотримуються маршруту, а не безупинно стежать за дроном.',
      ),
      { class: 'raid-hint' },
    ),
  );
  const actor = currentActor();
  inspector.append(element('h2', actor.id));
  const actorFields = element('div', '', { class: 'raid-fields' });
  inspector.append(actorFields);
  selectField(
    actorFields,
    words('Shared appearance', 'Спільний вигляд'),
    actor.family,
    actor.behavior === 'vehicle' ? OVERFLIGHT_MACHINERY : OVERFLIGHT_SOLDIERS,
    (value) => {
      actor.family = value;
      touch();
      render();
    },
  );
  selectField(
    actorFields,
    words('Contact behavior', 'Поведінка контакту'),
    actor.behavior,
    actor.behavior === 'vehicle'
      ? ['vehicle']
      : OVERFLIGHT_HUNT_BEHAVIORS.filter(
          (value) => value !== 'vehicle' && (selected.kind !== 'objectives' || value !== 'courier'),
        ),
    (value) => {
      actor.behavior = value;
      touch();
      render();
    },
  );
  numeric(actorFields, 'X', actor, 'x', 40, draft.arena.width - 40, 1, map);
  numeric(actorFields, 'Y', actor, 'y', 40, draft.arena.height - 40, 1, map);
  if (selected.kind === 'packs') {
    numeric(actorFields, words('Finite population', 'Скінченна кількість'), actor, 'count', 6, 20);
    numeric(actorFields, words('Spacing', 'Відстань'), actor, 'spacing', 16, 40);
    numeric(actorFields, words('Speed', 'Швидкість'), actor, 'speed', 30, 140);
  } else
    inspector.append(
      element(
        'p',
        words(
          `Objective · ${actor.armorSegments ? `${actor.armorSegments} armor segment(s)` : 'exposed body or guard facing'} · ${sector < 2 ? 'guaranteed upgrade' : 'wins the Raid'}`,
          `Ціль · ${actor.armorSegments ? `${actor.armorSegments} сегм. броні` : 'відкрите тіло або напрямок захисту'} · ${sector < 2 ? 'гарантоване покращення' : 'перемога в Нальоті'}`,
        ),
        { class: 'raid-hint' },
      ),
    );
  inspector.append(element('h2', words('Committed route', 'Маршрут руху')));
  actor.route.forEach((p, index) => {
    const row = element('div', '', { class: 'raid-route-row' });
    numeric(row, `X${index + 1}`, p, 'x', 40, draft.arena.width - 40, 1, map);
    numeric(row, `Y${index + 1}`, p, 'y', 40, draft.arena.height - 40, 1, map);
    const remove = button(words('Remove', 'Прибрати'), () => {
      actor.route.splice(index, 1);
      touch();
      render();
    });
    remove.disabled = actor.route.length <= 2;
    row.append(remove);
    inspector.append(row);
  });
  const add = button(words('Add route point', 'Додати точку маршруту'), () => {
    const last = actor.route.at(-1);
    actor.route.push({ x: Math.min(draft.arena.width - 40, last.x + 60), y: last.y });
    touch();
    render();
  });
  add.disabled = actor.route.length >= 8;
  inspector.append(add);
  workspace.append(mapPanel, inspector);
  const upgrades = element('fieldset'),
    upgradeFields = element('div', '', { class: 'raid-fields' });
  upgrades.append(
    element('legend', words('Upgrade opportunities', 'Можливості покращення')),
    element(
      'p',
      words(
        'Six objective milestones plus two optional pack-hunting rewards. Enable at least six families so every draft has three legal choices.',
        'Шість покращень за цілі та два додаткових за полювання на групи. Увімкніть принаймні шість типів, щоб кожен вибір мав три доступні картки.',
      ),
      { class: 'raid-hint' },
    ),
    upgradeFields,
  );
  numeric(upgradeFields, words('Rerolls', 'Перевибори'), draft.upgrades, 'rerolls', 0, 2);
  numeric(
    upgradeFields,
    words('First kill milestone', 'Перша межа знищень'),
    draft.upgrades.thresholds,
    0,
    1,
    100,
  );
  numeric(
    upgradeFields,
    words('Second kill milestone', 'Друга межа знищень'),
    draft.upgrades.thresholds,
    1,
    2,
    300,
  );
  const names = [
    ['Strike width', 'Ширина удару'],
    ['Slow wake', 'Слід уповільнення'],
    ['Rush charge', 'Заряд ривка'],
    ['Boost cooldown', 'Відновлення прискорення'],
    ['Boost duration', 'Тривалість прискорення'],
    ['Chain window', 'Час серії'],
    ['Heavy exposure', 'Вразливість техніки'],
    ['Guard interrupt', 'Зрив атаки охорони'],
    ['Recovery shield', 'Захисний щит'],
  ];
  OVERFLIGHT_HUNT_UPGRADES.forEach((id, index) => {
    const input = element('input', '', { type: 'checkbox' });
    input.checked = draft.upgrades.modules.includes(id);
    field(upgradeFields, words(...names[index]), input);
    input.addEventListener('change', () => {
      draft.upgrades.modules = input.checked
        ? [...draft.upgrades.modules, id]
        : draft.upgrades.modules.filter((value) => value !== id);
      touch();
    });
  });
  const props = element('fieldset'),
    propFields = element('div', '', { class: 'raid-fields' });
  props.append(
    element('legend', words('Shared supply-case props', 'Спільні ящики постачання')),
    propFields,
  );
  draft.props.forEach((prop) => {
    numeric(propFields, `${prop.id} · X`, prop, 'x', 40, draft.arena.width - 40, 1, map);
    numeric(propFields, `${prop.id} · Y`, prop, 'y', 40, draft.arena.height - 40, 1, map);
  });
  editor.append(general, heading, workspace, upgrades, props);
}
async function refreshInstalled() {
  const rows = await library.list();
  if (disposed) return;
  installed.replaceChildren();
  for (const row of rows)
    installed.append(
      element('a', row.title[locale], {
        href: scopedURL(`../overflight/raid.html?community=${row.identity}`),
      }),
    );
  if (!rows.length)
    installed.append(
      element(
        'p',
        words(
          'No Raid packages installed in this profile.',
          'У цьому профілі ще немає пакетів Нальоту.',
        ),
      ),
    );
}
const toolbar = element('div', '', { class: 'raid-toolbar' });
let preset = 'patrol',
  exportURL = null;
const downloadLink = element('a', words('Download package', 'Завантажити пакет'), { hidden: '' });
selectField(
  toolbar,
  words('Encounter set', 'Набір боїв'),
  preset,
  OVERFLIGHT_HUNT_ENCOUNTER_SETS,
  (value) => {
    preset = value;
  },
);
toolbar.append(
  button(words('New from preset', 'Новий зі зразка'), () =>
    replaceProject(createOverflightHuntProject({ encounterSet: preset })),
  ),
  button(words('Validate', 'Перевірити'), check),
  button(words('Preview', 'Перегляд'), sendPreview),
  button(words('Save draft', 'Зберегти чернетку'), async () => {
    const project = validateOverflightHuntProject(draft);
    await drafts.update(() => ({ project }));
    report(words('Draft saved in this profile.', 'Чернетку збережено в цьому профілі.'));
  }),
  button(words('Load saved draft', 'Відкрити чернетку'), async () => {
    const before = revision,
      value = await drafts.read();
    if (disposed || before !== revision) return;
    if (value.project) replaceProject(value.project);
    else report(words('No saved draft yet.', 'Збереженої чернетки ще немає.'));
  }),
  button(words('Install in this profile', 'Встановити в профіль'), async () => {
    await library.install(createOverflightHuntPackage(draft));
    await refreshInstalled();
    report(
      words(
        'Installed. Open the sortie from the list below.',
        'Встановлено. Відкрийте виліт зі списку нижче.',
      ),
    );
  }),
  button(words('Export package', 'Експортувати пакет'), () => {
    const blob = exportOverflightHuntPackage(createOverflightHuntPackage(draft));
    if (exportURL) URL.revokeObjectURL(exportURL);
    exportURL = URL.createObjectURL(blob);
    downloadLink.href = exportURL;
    downloadLink.download = `${draft.id}.raid.json`;
    downloadLink.hidden = false;
    downloadLink.click();
    report(
      words(
        'Package prepared. If the download did not start, use Download package.',
        'Пакет підготовлено. Якщо завантаження не почалося, натисніть «Завантажити пакет».',
      ),
    );
  }),
);
const file = element('input', '', { type: 'file', accept: '.json,application/json', hidden: '' });
file.addEventListener(
  'change',
  guarded(async () => {
    const before = revision,
      selectedFile = file.files?.[0];
    if (!selectedFile) return;
    const pack = await importOverflightHuntPackage(selectedFile);
    if (disposed || before !== revision) {
      report(
        words(
          'The draft changed during import. Import again to replace it.',
          'Чернетка змінилася під час імпорту. Імпортуйте знову, щоб замінити її.',
        ),
      );
      return;
    }
    replaceProject(pack.project);
    report(
      words(
        'Package imported and its shared dependencies verified.',
        'Пакет імпортовано, спільні залежності перевірено.',
      ),
    );
    file.value = '';
  }),
);
toolbar.append(
  button(words('Import package', 'Імпортувати пакет'), () => file.click()),
  file,
  downloadLink,
);
const advanced = element('details');
advanced.append(
  element('summary', words('Advanced project source', 'Повне джерело проєкту')),
  source,
  button(words('Apply source', 'Застосувати джерело'), () => replaceProject(source.value)),
);
root.replaceChildren(
  nav,
  element('h1', words('Raid Studio', 'Майстерня Нальоту')),
  element(
    'p',
    words(
      'Author the same finite encounters played in native Raid. Shared appearances, sounds and motion stay in their existing Studios.',
      'Створюйте ті самі скінченні бої, що використовує Наліт. Спільні вигляди, звуки та анімації залишаються у своїх майстернях.',
    ),
  ),
  status,
  toolbar,
  editor,
  advanced,
  element('h2', words('Installed sorties', 'Встановлені вильоти')),
  installed,
  element('h2', words('Native preview', 'Ігровий перегляд')),
  previewStatus,
  preview,
);
touch();
render();
void guarded(refreshInstalled)();
window.addEventListener(
  'pagehide',
  (event) => {
    if (event.persisted) return;
    disposed = true;
    window.removeEventListener('message', onMessage);
    library.dispose();
    drafts.close();
    if (exportURL) URL.revokeObjectURL(exportURL);
  },
  { once: true },
);
