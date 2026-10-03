import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { makeClassicSnakeV3, createClassicSnake } from '../snake/classic-core.mjs';
import { drawClassicTarget } from '../snake/classic-target-art.mjs';
import { actorFieldGuide, ACTOR_CASTS } from '../hunt/actor-catalog.mjs';
import { renderEnemyFieldGuide } from '../ui/enemy-field-guide.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { boundedJSON, required } from '../data-json.mjs';
import { contentStudioLinks } from '../ui/content-studio-navigation.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  validateClassicSnakePackage,
  classicSnakePackageIdentity,
  createClassicSnakeCommunityLibrary,
  importClassicSnakePackage,
  exportClassicSnakePackage,
} from '../snake/classic-community.mjs';

const language = new URL(location.href).searchParams.get('lang') === 'uk' ? 'uk' : 'en';
document.documentElement.lang = language;
const words = (en, uk) => (language === 'uk' ? uk : en);
const root = document.querySelector('#snake-studio');
root.replaceChildren();
const el = (tag, text, attrs = {}) => {
  const node = document.createElement(tag);
  if (text !== null && text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const nav = el('nav');
const links = contentStudioLinks(location.href);
const snakePlay = new URL('snake/play.html', links.game);
snakePlay.searchParams.set('lang', language);
nav.append(
  el('a', words('Main game', 'Головна гра'), { href: links.game }),
  el('a', words('Content Studio', 'Майстерня контенту'), { href: links.studio }),
  el('a', 'Snake', { href: snakePlay.href }),
);
root.append(
  nav,
  el('h1', words('Snake Studio', 'Майстерня Snake')),
  el(
    'p',
    words(
      'Shape routes, choose readable prey and play the exact accepted mission in Solo, Versus or Team.',
      'Створюйте маршрути, обирайте зрозумілу здобич і грайте точну прийняту місію соло, у змаганні чи команді.',
    ),
  ),
);
const status = el('p', '', { id: 'studio-status', role: 'status' });
const formatNotice = el('p', '', { role: 'status' });
formatNotice.hidden = true;
root.append(status, formatNotice);
const report = (text, error = false) => {
  status.textContent = text;
  status.dataset.error = String(error);
};
const guard = (fn) => async () => {
  try {
    await fn();
  } catch (error) {
    report(error.message, true);
  }
};
const button = (text, fn) => {
  const node = el('button', text, { type: 'button' });
  node.addEventListener('click', guard(fn));
  return node;
};
const field = (parent, title, input) => {
  const label = el('label', title);
  label.append(input);
  parent.append(label);
  return input;
};
const select = (values) => {
  const node = el('select');
  for (const [value, label] of values) node.append(el('option', label, { value }));
  return node;
};
let sequence = 1;
const initial = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === 'classic-living-refuge-bays');
let draft = {
  format: CLASSIC_PACKAGE_FORMAT,
  title: { en: 'My Snake campaign', uk: 'Моя кампанія Snake' },
  entries: [
    {
      title: structuredClone(initial.title),
      description: structuredClone(initial.description),
      level: structuredClone(initial.level),
    },
  ],
};
let active = 0,
  cursor = { x: 0, y: 0 },
  strokes = new Set();
const library = createClassicSnakeCommunityLibrary();
const drafts = createProfileRecordBackend({
  key: 'classic-snake-studio-draft.v1',
  empty: () => ({ draft: null }),
  validate: (source) => {
    const value = boundedJSON(source, {
      maxBytes: 1536 * 1024,
      maxNodes: 160000,
      maxArray: 1536,
      maxDepth: 14,
    });
    required(
      Object.keys(value).length === 1 && Object.hasOwn(value, 'draft'),
      'Invalid Snake Studio draft.',
    );
    if (value.draft !== null) validateClassicSnakePackage(value.draft);
    return value;
  },
  operationTimeoutMs: 5000,
});
const top = el('div', null, { class: 'fields' });
root.append(top);
const packageName = field(
  top,
  words('Campaign name', 'Назва кампанії'),
  el('input', null, { maxlength: '120' }),
);
const missionSelect = field(top, words('Mission', 'Місія'), select([]));
const template = field(
  top,
  words('Layout to copy', 'Макет для копії'),
  select(CLASSIC_SNAKE_LEVELS.map((entry) => [entry.id, entry.title[language]])),
);
template.value = initial.id;
const actions = el('div', null, { class: 'actions' });
root.append(actions);
const layout = el('div', null, { class: 'layout' }),
  boardSection = el('section'),
  editor = el('section');
layout.append(boardSection, editor);
root.append(layout);
const tools = el('div', null, { class: 'fields' });
boardSection.append(tools);
const tool = field(
  tools,
  words('Board tool', 'Інструмент поля'),
  select([
    ['wall', words('Wall', 'Стіна')],
    ['erase', words('Erase', 'Стерти')],
    ['goal', words('Goal waypoint', 'Ціль маршруту')],
    ['path', words('Patrol route', 'Маршрут патруля')],
    ['shutter1', words('Shutter 1', 'Заслінка 1')],
    ['shutter2', words('Shutter 2', 'Заслінка 2')],
    ['pulse', words('Pulse pad', 'Місце імпульсу')],
    ['reel', words('Reel pad', 'Місце котушки')],
    ['p1', words('Player 1 start', 'Старт гравця 1')],
    ['p2', words('Player 2 start', 'Старт гравця 2')],
  ]),
);
const board = el('canvas', null, {
  width: '960',
  height: '720',
  tabindex: '0',
  role: 'img',
  'aria-label': words(
    'Editable Snake board. Arrow keys move the cursor, Space applies the tool.',
    'Редаговане поле Snake. Стрілки рухають курсор, пробіл застосовує інструмент.',
  ),
});
boardSection.append(
  board,
  el(
    'p',
    words(
      'Click or drag to paint. Arrow keys move the cursor; Space paints. Routes need adjacent cells and a closed loop. Both complete four-cell starting bodies must stay clear.',
      'Натискайте чи тягніть для малювання. Стрілки рухають курсор, пробіл малює. Маршрути мають іти сусідніми клітинками замкненим колом. Обидва стартові хвости з чотирьох клітинок мають бути вільними.',
    ),
  ),
);
const fields = el('div', null, { class: 'fields' });
editor.append(fields);
const titleEn = field(fields, 'Name · EN', el('input', null, { maxlength: '120' }));
const titleUk = field(fields, 'Назва · UK', el('input', null, { maxlength: '120' }));
const briefEn = field(fields, 'Brief · EN', el('textarea', null, { maxlength: '1200' }));
const briefUk = field(fields, 'Опис · UK', el('textarea', null, { maxlength: '1200' }));
const kinds = [
  'still',
  'runner',
  'patroller',
  'sprinter',
  'refuge',
  'switchback',
  'pair',
  'shield',
  'brace',
];
const kind = field(
  fields,
  words('Prey policy', 'Поведінка здобичі'),
  select(kinds.map((value) => [value, actorFieldGuide(value, language)?.name ?? value])),
);
const population = field(
  fields,
  words('Active prey', 'Активні цілі'),
  select([
    ['1', '1'],
    ['2', '2'],
  ]),
);
const quota = field(
  fields,
  words('Required catches', 'Потрібні дотики'),
  el('input', null, { type: 'number', min: '1', max: '128' }),
);
const edge = field(
  fields,
  words('Edges', 'Краї'),
  select([
    ['solid', words('Solid', 'Суцільні')],
    ['wrap', words('Wrap', 'Перехід')],
  ]),
);
const cast = field(
  fields,
  words('Preview cast', 'Стиль перегляду'),
  select(ACTOR_CASTS.map((entry) => [entry.id, entry.name[language]])),
);
const phase = field(
  fields,
  words('Preview phase', 'Фаза перегляду'),
  select(['rest', 'warning', 'burst', 'turning'].map((value) => [value, value])),
);
const specimen = el('canvas', null, {
  width: '240',
  height: '140',
  class: 'preview',
  'aria-label': words('Shared humanoid artwork preview', 'Спільний перегляд гуманоїда'),
});
editor.append(specimen);
const guide = el('section', null, {
  class: 'enemy-field-guide',
  'aria-label': words('Prey goal, tell and counter', 'Мета, ознака та протидія здобичі'),
});
editor.append(guide);
const modes = el('div', null, { class: 'actions' });
editor.append(modes);
const sourceDetails = el('details'),
  sourceArea = el('textarea', null, {
    id: 'package-source',
    spellcheck: 'false',
    'aria-label': words('Advanced package JSON', 'Розширений JSON пакунка'),
  });
sourceDetails.append(
  el(
    'summary',
    words(
      'Advanced recipe: goals, routes, shutters and supplies',
      'Розширений рецепт: цілі, маршрути, заслінки й припаси',
    ),
  ),
  sourceArea,
  button(words('Apply validated JSON', 'Застосувати перевірений JSON'), () => {
    draft = structuredClone(validateClassicSnakePackage(sourceArea.value));
    active = 0;
    refresh();
  }),
);
root.append(sourceDetails);
const current = () => draft.entries[active];
const upgradedEntries = new WeakMap();
function editableLevel() {
  const entry = current();
  if (entry.level.version !== 'classic-snake-level.v3') {
    const previous = entry.level.version;
    entry.level = structuredClone(makeClassicSnakeV3(entry.level));
    upgradedEntries.set(entry, previous);
  }
  return entry.level;
}
function changed() {
  current().level.revision = `studio-${sequence++}`;
  paint();
}
function validate() {
  const pack = validateClassicSnakePackage(draft);
  report(
    words(
      `Ready: ${pack.entries.length} mission(s). Structural validation is not play qualification.`,
      `Готово: місій ${pack.entries.length}. Структурна перевірка не замінює перевірку грою.`,
    ),
  );
  return pack;
}
function refresh() {
  const entry = current(),
    level = entry.level;
  missionSelect.replaceChildren(
    ...draft.entries.map((entry, i) =>
      el('option', `${i + 1}. ${entry.title[language]}`, { value: String(i) }),
    ),
  );
  missionSelect.value = String(active);
  packageName.value = draft.title[language];
  titleEn.value = entry.title.en;
  titleUk.value = entry.title.uk;
  briefEn.value = entry.description.en;
  briefUk.value = entry.description.uk;
  kind.value =
    level.targets?.required[0]?.kind ?? (level.targetMovement === 'flee' ? 'runner' : 'still');
  population.value = String(level.targets?.maxActive ?? 1);
  quota.value = level.goal;
  edge.value = level.wrap ? 'wrap' : 'solid';
  sourceArea.value = JSON.stringify(draft, null, 2);
  paint();
}
function paint() {
  const level = current().level,
    context = board.getContext('2d'),
    cell = board.width / level.width;
  const previous = upgradedEntries.get(current());
  formatNotice.hidden = !previous;
  formatNotice.textContent = previous
    ? words(
        `This draft mission was upgraded from ${previous} to Snake v3 for your gameplay edits.`,
        `Цю чернетку місії оновлено з ${previous} до Snake v3 для редагування ігрових правил.`,
      )
    : '';
  board.height = Math.round(cell * level.height);
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#1a2b2a';
  context.fillRect(0, 0, board.width, board.height);
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      context.fillStyle = (x + y) % 2 ? '#203331' : '#243a36';
      context.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }
  const square = (point, color, inset = 3) => {
    context.fillStyle = color;
    context.fillRect(
      point.x * cell + inset,
      point.y * cell + inset,
      cell - inset * 2,
      cell - inset * 2,
    );
  };
  level.walls.forEach((point) => square(point, '#71816e'));
  level.shutters?.forEach((gate, i) =>
    gate.cells.forEach((point) => square(point, i ? '#b393e4' : '#e5b759')),
  );
  level.targets?.required.forEach((policy) => {
    policy.goals?.forEach((point) => square(point, '#c5e18b', cell * 0.3));
    policy.path?.forEach((point) => square(point, '#6fc7da', cell * 0.4));
  });
  level.pickups?.forEach((pickup) =>
    pickup.pads.forEach((point) =>
      square(point, pickup.kind === 'pulse' ? '#dceff8' : '#f5ac6d', cell * 0.28),
    ),
  );
  level.spawns.forEach((spawn, i) => {
    square(spawn, i ? '#d9a5df' : '#7ee0ee');
    context.fillStyle = '#101d21';
    context.font = `bold ${cell * 0.5}px monospace`;
    context.fillText(String(i + 1), spawn.x * cell + cell * 0.3, spawn.y * cell + cell * 0.7);
  });
  context.strokeStyle = '#fff4c7';
  context.lineWidth = 3;
  context.strokeRect(cursor.x * cell + 2, cursor.y * cell + 2, cell - 4, cell - 4);
  const ctx = specimen.getContext('2d');
  ctx.clearRect(0, 0, 240, 140);
  drawClassicTarget(ctx, 12, 15, 110, 1, {
    kind: kind.value,
    cast: cast.value,
    phase: phase.value,
    heading: 'right',
    token: true,
  });
  drawClassicTarget(ctx, 154, 45, 36, 0, {
    kind: kind.value,
    cast: cast.value,
    phase: phase.value,
    heading: 'right',
    detail: 'compact',
    token: true,
  });
  renderEnemyFieldGuide(guide, [kind.value], { locale: language, cast: cast.value });
  try {
    createClassicSnake(level, { mode: 'team' });
    validate();
  } catch (error) {
    report(error.message, true);
  }
}
function paintCell(point) {
  const identity = `${point.x},${point.y}`;
  if (strokes.has(identity)) return;
  strokes.add(identity);
  const level = editableLevel(),
    same = (cell) => cell.x === point.x && cell.y === point.y;
  const append = (cells) => {
    if (!cells.some(same)) cells.push({ ...point });
  };
  if (tool.value === 'erase') {
    level.walls = level.walls.filter((cell) => !same(cell));
    level.shutters.forEach((gate) => {
      gate.cells = gate.cells.filter((cell) => !same(cell));
    });
    level.shutters = level.shutters.filter((gate) => gate.cells.length);
    level.pickups.forEach((pickup) => {
      pickup.pads = pickup.pads.filter((cell) => !same(cell));
    });
    level.pickups = level.pickups.filter((pickup) => pickup.pads.length);
    level.targets.required.forEach((policy) => {
      if (policy.goals) policy.goals = policy.goals.filter((cell) => !same(cell));
      if (policy.path) policy.path = policy.path.filter((cell) => !same(cell));
    });
  } else if (tool.value === 'wall') append(level.walls);
  else if (tool.value === 'goal') {
    for (const policy of level.targets.required)
      if (['refuge', 'switchback', 'pair'].includes(policy.kind)) append(policy.goals);
  } else if (tool.value === 'path') {
    for (const policy of level.targets.required)
      if (['patroller', 'courier'].includes(policy.kind)) append(policy.path);
  } else if (tool.value.startsWith('shutter')) {
    const id = tool.value;
    let gate = level.shutters.find((entry) => entry.id === id);
    if (!gate) {
      gate = { id, cells: [], phase: id === 'shutter2' ? 24 : 0 };
      level.shutters.push(gate);
    }
    append(gate.cells);
  } else if (['pulse', 'reel'].includes(tool.value)) {
    let pickup = level.pickups.find((entry) => entry.kind === tool.value);
    if (!pickup) {
      pickup = { at: level.pickups.length ? 6 : 2, kind: tool.value, pads: [] };
      level.pickups.push(pickup);
    }
    append(pickup.pads);
  } else if (['p1', 'p2'].includes(tool.value))
    Object.assign(level.spawns[tool.value === 'p1' ? 0 : 1], point);
  changed();
}
board.addEventListener('pointerdown', (event) => {
  strokes = new Set();
  board.setPointerCapture(event.pointerId);
  locate(event);
});
board.addEventListener('pointermove', (event) => {
  if (event.buttons === 1) locate(event);
});
function locate(event) {
  const bounds = board.getBoundingClientRect(),
    level = current().level;
  cursor = {
    x: Math.max(
      0,
      Math.min(
        level.width - 1,
        Math.floor(((event.clientX - bounds.left) / bounds.width) * level.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        level.height - 1,
        Math.floor(((event.clientY - bounds.top) / bounds.height) * level.height),
      ),
    ),
  };
  paintCell(cursor);
}
board.addEventListener('keydown', (event) => {
  const direction = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
    event.key
  ];
  if (direction) {
    event.preventDefault();
    cursor.x = Math.max(0, Math.min(current().level.width - 1, cursor.x + direction[0]));
    cursor.y = Math.max(0, Math.min(current().level.height - 1, cursor.y + direction[1]));
    paint();
  } else if (event.key === ' ') {
    event.preventDefault();
    strokes = new Set();
    paintCell(cursor);
  }
});
packageName.addEventListener('change', () => {
  draft.title[language] = packageName.value;
  changed();
});
missionSelect.addEventListener('change', () => {
  active = Number(missionSelect.value);
  cursor = { x: 0, y: 0 };
  refresh();
});
for (const [input, map, key] of [
  [titleEn, 'title', 'en'],
  [titleUk, 'title', 'uk'],
  [briefEn, 'description', 'en'],
  [briefUk, 'description', 'uk'],
])
  input.addEventListener('change', () => {
    current()[map][key] = input.value;
    if (map === 'title' && key === 'en') current().level.name = input.value;
    changed();
  });
quota.addEventListener('change', () => {
  editableLevel().goal = Number(quota.value);
  changed();
});
edge.addEventListener('change', () => {
  editableLevel().wrap = edge.value === 'wrap';
  changed();
});
population.addEventListener('change', () => {
  editableLevel().targets.maxActive = Number(population.value);
  changed();
});
kind.addEventListener('change', () => {
  const level = editableLevel(),
    selected = kind.value;
  const policy = { kind: selected, every: selected === 'patroller' ? 4 : 3 };
  if (['refuge', 'switchback', 'pair'].includes(selected))
    policy.goals = [
      { x: 3, y: 3 },
      { x: level.width - 4, y: level.height - 4 },
    ];
  if (selected === 'patroller') policy.path = [];
  level.targets.required = [policy];
  level.targets.bonus = null;
  if (selected === 'pair') level.targets.maxActive = 2;
  population.value = String(level.targets.maxActive);
  changed();
});
cast.addEventListener('change', paint);
phase.addEventListener('change', paint);
actions.append(
  button(words('Add copied mission', 'Додати копію місії'), () => {
    required(draft.entries.length < 12, 'A package supports at most twelve missions.');
    const source = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === template.value),
      level = structuredClone(makeClassicSnakeV3(source.level));
    level.id = `studio-mission-${Date.now()}-${draft.entries.length + 1}`;
    draft.entries.push({
      title: structuredClone(source.title),
      description: structuredClone(source.description),
      level,
    });
    active = draft.entries.length - 1;
    refresh();
  }),
  button(words('Remove mission', 'Прибрати місію'), () => {
    required(draft.entries.length > 1, 'Keep at least one mission.');
    draft.entries.splice(active, 1);
    active = Math.min(active, draft.entries.length - 1);
    refresh();
  }),
  button(words('Save valid draft', 'Зберегти правильну чернетку'), async () => {
    const pack = validate();
    await drafts.update(() => ({ draft: pack }));
    report(
      words(
        'Draft saved in the shared profile database.',
        'Чернетку збережено у спільній базі профілю.',
      ),
    );
  }),
  button(words('Restore saved draft', 'Відновити чернетку'), async () => {
    const saved = await drafts.read();
    required(saved.draft, 'No saved draft.');
    draft = structuredClone(saved.draft);
    active = 0;
    refresh();
  }),
  button(words('Validate', 'Перевірити'), validate),
  button(words('Export package', 'Експорт пакунка'), () => {
    const pack = validate(),
      url = URL.createObjectURL(exportClassicSnakePackage(pack));
    const link = el('a', '', {
      href: url,
      download: `snake-${classicSnakePackageIdentity(pack)}.rlsnake.json`,
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }),
);
const file = el('input', null, {
  type: 'file',
  accept: '.json,.rlsnake,.rlpack',
  class: 'file-label',
});
field(actions, words('Import package', 'Імпорт пакунка'), file);
file.addEventListener(
  'change',
  guard(async () => {
    if (!file.files[0]) return;
    draft = structuredClone(await importClassicSnakePackage(file.files[0]));
    active = 0;
    refresh();
    file.value = '';
  }),
);
for (const mode of ['solo', 'versus', 'team'])
  modes.append(
    button(words(`Play ${mode}`, `Грати: ${mode}`), async () => {
      const installed = await library.install(validate(), { owner: 'studio' }),
        url = new URL('../snake/play.html', location.href);
      url.search = new URLSearchParams({
        mode,
        community: installed.identity,
        level: installed.entries[active].id,
        lang: language,
        studio: 'snake',
      }).toString();
      location.assign(url.href);
    }),
  );
sourceDetails.addEventListener('toggle', () => {
  if (sourceDetails.open) sourceArea.value = JSON.stringify(draft, null, 2);
});
window.addEventListener('pagehide', () => {
  drafts.close();
  library.close();
});
refresh();
