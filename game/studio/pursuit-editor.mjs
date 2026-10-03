import { compileContentProject } from '../content-design/project.mjs';
import { dataIdentity } from '../data-json.mjs';
import { actorFieldGuide, ACTOR_CASTS } from '../hunt/actor-catalog.mjs';
import { drawHuntActor } from '../hunt/actor-art.mjs';
import { missionEditContext } from './edit-context.mjs';
import { getLocale, onLocaleChange } from '../i18n/index.mjs';

const copy = {
  title: ['Pursuit routes and personalities', 'Маршрути та характери переслідування'],
  help: [
    'Author up to six targets. Ordinary prey allows one-contact catches; Shield and Brace are explicit hazardous challenges. Use cell centres (for example 12.5, 8.5). Routes need two to eight reachable points; Runner and Sprinter may omit them. Paired actors must name one another and share the same ordered meeting points. New editions use committed goals, announced switchbacks and timed sprints. Inspection uses the same compiler as play and export.',
    'Створіть до шести цілей. Звичайну здобич ловлять дотиком; Щит та Броньований ривок — окремі небезпечні випробування. Вказуйте центри клітинок (наприклад 12.5, 8.5). Маршрути потребують від двох до восьми досяжних точок; Бігун і Спринтер можуть їх не мати. Напарники мають указувати одне одного й однаковий порядок точок зустрічі. Нові версії використовують сталі цілі, оголошені зміни напрямку та ривки з попередженням. Перевірка використовує той самий компілятор, що й гра та експорт.',
  ],
  add: ['Add target', 'Додати ціль'],
  remove: ['Remove target', 'Видалити ціль'],
  inspect: ['Inspect pursuit routes', 'Перевірити маршрути'],
  apply: ['Apply pursuit to mission', 'Застосувати переслідування'],
  id: ['Target ID', 'ID цілі'],
  behavior: ['Behavior', 'Поведінка'],
  partner: ['Partner ID (pairs only)', 'ID напарника (лише для пари)'],
  waypoints: ['Waypoints: one x, y pair per line', 'Точки: одна пара x, y на рядок'],
  cast: ['Preview cast (cosmetic)', 'Вигляд для перегляду'],
  pose: ['Preview state', 'Стан для перегляду'],
  direction: ['Preview direction', 'Напрямок для перегляду'],
  frame: ['Next animation frame', 'Наступний кадр анімації'],
  walk: ['Running', 'Біг'],
  up: ['Up', 'Угору'],
  right: ['Right', 'Праворуч'],
  down: ['Down', 'Униз'],
  left: ['Left', 'Ліворуч'],
  rest: ['Recovery / exposed armor', 'Відновлення / відкрита броня'],
  warning: ['Warning / closed armor', 'Попередження / закрита броня'],
  burst: ['Committed action', 'Виконання дії'],
  turning: ['Shield turn warning', 'Попередження повороту щита'],
  applied: [
    'Pursuit saved to this mission edition. Export and Undo use the normal Studio source.',
    'Переслідування збережено у версії місії. Експорт і скасування використовують звичайне джерело Студії.',
  ],
  changed: [
    'The mission or draft changed. Inspect again before applying.',
    'Місія або чернетка змінилася. Повторіть перевірку перед застосуванням.',
  ],
  accepted: [
    'Accepted by the native compiler. Human play qualification is still required.',
    'Прийнято рідним компілятором. Перевірка людиною в грі ще потрібна.',
  ],
  select: ['Choose an active mission first.', 'Спочатку виберіть активну місію.'],
  pointsError: [
    'Each waypoint must contain two finite numbers separated by a comma.',
    'Кожна точка має містити два скінченні числа, розділені комою.',
  ],
  preview: ['Authored target starts and waypoint routes', 'Початкові позиції цілей та маршрути'],
  ordinary: [
    'Shield front contact is hazardous; approach the exposed sides or rear. Brace armor is closed during warning and burst, and open during recovery. Enclosure defeats either. These specialists appear only when explicitly authored here, never through the ordinary Varied setting.',
    'Дотик спереду до Щита небезпечний: підходьте збоку чи ззаду. Броня Ривка закрита під час попередження й ривка, відкрита під час відновлення. Оточення долає обох. Спеціалісти з’являються лише за явного вибору автора, ніколи через звичайний різноманітний склад.',
  ],
  authored: [
    'Authored Hunt keeps its existing population, positions and quota. Edit only the movement of its runner targets.',
    'Авторське полювання зберігає групу цілей, позиції та квоту. Змінюйте лише рух наявних бігунів.',
  ],
  snake: [
    'Capture Snake pursuit keeps every original target, the clear-all quota, tail growth and ordered bonuses. Applying new routes creates an explicit successor edition; old saves retain their original rules.',
    'Переслідування у Змійці-захопленні зберігає всі початкові цілі, квоту впіймати всіх, ріст хвоста та бонуси за порядок. Нові маршрути створюють окрему наступну версію; старі збереження зберігають початкові правила.',
  ],
};
const words = (key) => copy[key][getLocale() === 'uk' ? 1 : 0];
const behaviors = [
  'runner',
  'sprinter',
  'patroller',
  'courier',
  'refuge',
  'switchback',
  'pair',
  'shield',
  'brace',
];

export function parsePursuitWaypoints(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error(words('pointsError'));
  if (!value.trim()) return [];
  return value
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const parts = line.split(',').map((entry) => entry.trim());
      if (parts.length !== 2 || parts.some((part) => !part || !Number.isFinite(Number(part))))
        throw new Error(words('pointsError'));
      return { x: Number(parts[0]), y: Number(parts[1]) };
    });
}

/** Recompile before adopting, and propagate revisions only through ancestors
 * that actually own this mission. No other mission/population is rewritten. */
export function selectedMissionPursuitSource(source, missionId, population) {
  const project = structuredClone(compileContentProject(source).source);
  const mission = project.missions.find((entry) => entry.id === missionId && !entry.archived);
  if (!mission) throw new Error(words('select'));
  mission.format = 'MissionDesignV6';
  mission.pursuit = { version: 'mission-pursuit.v2', actors: structuredClone(population) };
  mission.revision = `pursuit-${dataIdentity(mission)}`;
  const changed = new Set();
  for (const campaign of project.campaigns) {
    if (!campaign.missionIds.includes(mission.id)) continue;
    campaign.revision = `pursuit-${dataIdentity({ campaign, mission: mission.revision })}`;
    changed.add(campaign.id);
  }
  for (const pack of project.packs) {
    if (!pack.campaignIds.some((id) => changed.has(id))) continue;
    pack.revision = `pursuit-${dataIdentity({ pack, campaigns: project.campaigns.filter((campaign) => changed.has(campaign.id)) })}`;
  }
  project.revision = `pursuit-${dataIdentity(project)}`;
  return compileContentProject(project).source;
}

export function createPursuitEditor({ container, getSource, getMission, apply }) {
  const doc = container.ownerDocument;
  const node = (tag, text = '') => {
    const result = doc.createElement(tag);
    result.textContent = text;
    return result;
  };
  const root = node('fieldset'),
    legend = node('legend'),
    help = node('p'),
    note = node('p'),
    list = node('div'),
    add = node('button'),
    inspect = node('button'),
    commit = node('button'),
    status = node('p'),
    castLabel = node('label'),
    castCaption = node('span'),
    cast = node('select'),
    poseLabel = node('label'),
    poseCaption = node('span'),
    pose = node('select'),
    directionLabel = node('label'),
    directionCaption = node('span'),
    direction = node('select'),
    frame = node('button'),
    preview = node('canvas');
  let animationFrame = 0;
  root.dataset.pursuitEditor = 'true';
  status.setAttribute('role', 'status');
  preview.width = 720;
  preview.height = 360;
  preview.style.cssText =
    'display:block;max-width:100%;height:auto;margin:.75rem 0;background:#182326;image-rendering:pixelated;';
  preview.setAttribute('role', 'img');
  castLabel.style.cssText = 'display:grid;gap:.4rem;margin:.75rem 0;';
  for (const entry of ACTOR_CASTS) {
    const option = node('option');
    option.value = entry.id;
    cast.append(option);
  }
  cast.value = 'rivals';
  castLabel.append(castCaption, cast);
  poseLabel.style.cssText = castLabel.style.cssText;
  for (const value of ['walk', 'rest', 'warning', 'burst', 'turning']) {
    const option = node('option');
    option.value = value;
    pose.append(option);
  }
  pose.value = 'rest';
  poseLabel.append(poseCaption, pose);
  pose.onchange = () => draw();
  directionLabel.style.cssText = castLabel.style.cssText;
  for (const value of ['up', 'right', 'down', 'left']) {
    const option = node('option');
    option.value = value;
    direction.append(option);
  }
  direction.value = 'right';
  directionLabel.append(directionCaption, direction);
  direction.onchange = () => draw();
  frame.type = 'button';
  frame.onclick = () => {
    animationFrame = (animationFrame + 1) % 12;
    draw();
  };
  for (const button of [add, inspect, commit]) {
    button.type = 'button';
    button.style.margin = '.25rem';
  }
  commit.dataset.pursuitApply = 'true';
  inspect.dataset.pursuitInspect = 'true';
  add.dataset.pursuitAdd = 'true';
  root.append(
    legend,
    help,
    note,
    castLabel,
    poseLabel,
    directionLabel,
    frame,
    preview,
    list,
    add,
    inspect,
    commit,
    status,
  );
  container.append(root);
  let identity = null,
    activeMission = null,
    rows = [],
    prepared = null,
    pendingKey = null,
    disposed = false;
  const context = () => missionEditContext(getSource(), getMission());
  const map = () =>
    getSource().maps.find(
      (entry) => entry.id === getMission()?.map.id && entry.revision === getMission()?.map.revision,
    );
  const authoredRunners = () => {
    const mission = getMission();
    return (mission?.hunt?.targets ?? [])
      .filter((target) => target.kind === 'runner')
      .map((target) => mission.actors.find((actor) => actor.id === target.id))
      .filter(Boolean);
  };
  const refreshAdd = () => {
    add.disabled =
      rows.length >= 6 ||
      (!!getMission()?.hunt &&
        !authoredRunners().some(
          (actor) => !rows.some(({ fields }) => fields.id.value === actor.id),
        ));
  };
  const invalidate = () => {
    prepared = null;
    pendingKey = null;
    commit.disabled = true;
  };
  const population = () =>
    rows.map(({ fields }) => ({
      id: fields.id.value.trim(),
      x: Number(fields.x.value),
      y: Number(fields.y.value),
      behavior: fields.behavior.value,
      waypoints: parsePursuitWaypoints(fields.waypoints.value),
      ...(fields.behavior.value === 'pair' ? { partnerId: fields.partner.value.trim() } : {}),
    }));
  const draftKey = () =>
    JSON.stringify(
      rows.map(({ fields }) =>
        Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])),
      ),
    );

  function draw() {
    // Locale can change while the Studio is still loading its first draft.
    if (!activeMission) return;
    const ctx = preview.getContext?.('2d'),
      board = map();
    if (!ctx || !board) return;
    ctx.clearRect(0, 0, preview.width, preview.height);
    const sx = preview.width / board.width,
      sy = preview.height / board.height;
    ctx.fillStyle = '#182326';
    ctx.fillRect(0, 0, preview.width, preview.height);
    for (const [entries, color] of [
      [board.foundations ?? [], '#687663'],
      [board.walls ?? [], '#8b8a85'],
    ]) {
      ctx.fillStyle = color;
      for (const rect of entries) ctx.fillRect(rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy);
    }
    let entries;
    try {
      entries = population();
    } catch {
      return;
    }
    for (const actor of entries) {
      if (![actor.x, actor.y].every(Number.isFinite)) continue;
      ctx.beginPath();
      ctx.moveTo(actor.x * sx, actor.y * sy);
      for (const point of actor.waypoints) ctx.lineTo(point.x * sx, point.y * sy);
      ctx.strokeStyle = '#e8c36b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff0c3';
      for (const point of actor.waypoints) ctx.fillRect(point.x * sx - 2, point.y * sy - 2, 4, 4);
      drawHuntActor(ctx, actor.x * sx - 12, actor.y * sy - 12, 24, 0, {
        kind: actor.behavior,
        partnerId: actor.partnerId,
        cast: cast.value,
        state: pose.value === 'walk' ? 'walk' : pose.value === 'rest' ? 'recover' : 'warning',
        timeMs: animationFrame * 130,
        heading: direction.value,
        nextHeading:
          pose.value === 'turning'
            ? ['up', 'right', 'down', 'left'][
                (['up', 'right', 'down', 'left'].indexOf(direction.value) + 1) % 4
              ]
            : null,
        phase: pose.value,
      });
      const row = rows.find((entry) => entry.fields.id.value === actor.id);
      const portrait = row?.portrait.getContext?.('2d');
      if (portrait) {
        portrait.clearRect(0, 0, 56, 56);
        drawHuntActor(portrait, 0, 0, 56, 0, {
          kind: actor.behavior,
          partnerId: actor.partnerId,
          cast: cast.value,
          state: pose.value === 'walk' ? 'walk' : pose.value === 'rest' ? 'recover' : 'warning',
          timeMs: animationFrame * 130,
          heading: direction.value,
          nextHeading:
            pose.value === 'turning'
              ? ['up', 'right', 'down', 'left'][
                  (['up', 'right', 'down', 'left'].indexOf(direction.value) + 1) % 4
                ]
              : null,
          phase: pose.value,
        });
      }
    }
  }

  function localize() {
    legend.textContent = words('title');
    help.textContent = words('help');
    note.textContent = activeMission?.snake
      ? words('snake')
      : activeMission?.hunt
        ? words('authored')
        : words('ordinary');
    add.textContent = words('add');
    inspect.textContent = words('inspect');
    commit.textContent = words('apply');
    castCaption.textContent = words('cast');
    poseCaption.textContent = words('pose');
    directionCaption.textContent = words('direction');
    frame.textContent = words('frame');
    for (const option of direction.options) option.textContent = words(option.value);
    for (const option of pose.options) option.textContent = words(option.value);
    preview.setAttribute('aria-label', words('preview'));
    for (const option of cast.options)
      option.textContent = ACTOR_CASTS.find((entry) => entry.id === option.value).name[
        getLocale() === 'uk' ? 'uk' : 'en'
      ];
    for (const row of rows) {
      for (const [key, caption] of Object.entries(row.labels))
        caption.textContent = key === 'x' || key === 'y' ? key.toUpperCase() : words(key);
      for (const option of row.fields.behavior.options)
        option.textContent = actorFieldGuide(option.value, getLocale()).name;
      const guide = actorFieldGuide(row.fields.behavior.value, getLocale());
      row.heading.textContent = `${row.fields.id.value || '—'} · ${guide.name}`;
      row.guide.textContent = `${guide.goal} ${guide.tell} ${guide.counter}`;
      row.partnerLabel.hidden = row.fields.behavior.value !== 'pair';
      row.remove.textContent = words('remove');
    }
  }

  function appendActor(actor) {
    const details = node('details'),
      heading = node('summary'),
      guide = node('p'),
      portrait = node('canvas'),
      remove = node('button');
    details.open = true;
    details.style.cssText =
      'padding:.75rem;margin:.75rem 0;border:1px solid var(--panel-border,#71818b);';
    portrait.width = portrait.height = 56;
    portrait.style.cssText = 'image-rendering:pixelated;width:56px;height:56px;';
    portrait.setAttribute('aria-hidden', 'true');
    details.append(heading, portrait, guide);
    const fields = {},
      labels = {};
    let partnerLabel;
    for (const key of ['id', 'behavior', 'x', 'y', 'waypoints', 'partner']) {
      const label = node('label'),
        caption = node('span'),
        field = node(key === 'behavior' ? 'select' : key === 'waypoints' ? 'textarea' : 'input');
      label.style.cssText = 'display:grid;gap:.3rem;margin:.5rem 0;';
      field.style.maxWidth = '100%';
      field.dataset.pursuitField = key;
      if (key === 'behavior')
        for (const behavior of behaviors) {
          const option = node('option');
          option.value = behavior;
          field.append(option);
        }
      if (['x', 'y'].includes(key)) {
        field.type = 'number';
        field.step = '1';
        field.min = '0.5';
      }
      if (key === 'waypoints') field.rows = 4;
      field.value =
        key === 'waypoints'
          ? actor.waypoints.map((point) => `${point.x}, ${point.y}`).join('\n')
          : key === 'partner'
            ? (actor.partnerId ?? '')
            : String(actor[key] ?? '');
      if (getMission()?.hunt && ['id', 'x', 'y'].includes(key)) field.readOnly = true;
      field.oninput = field.onchange = () => {
        invalidate();
        localize();
        draw();
      };
      labels[key] = caption;
      fields[key] = field;
      label.append(caption, field);
      details.append(label);
      if (key === 'partner') partnerLabel = label;
    }
    const row = { details, fields, labels, heading, guide, portrait, partnerLabel, remove };
    remove.type = 'button';
    remove.onclick = () => {
      rows = rows.filter((entry) => entry !== row);
      details.remove();
      invalidate();
      refreshAdd();
      draw();
    };
    details.append(remove);
    list.append(details);
    rows.push(row);
    refreshAdd();
    localize();
  }

  add.onclick = () => {
    if (rows.length >= 6) return;
    if (getMission()?.hunt) {
      const actor = authoredRunners().find(
        (candidate) => !rows.some(({ fields }) => fields.id.value === candidate.id),
      );
      if (actor)
        appendActor({ id: actor.id, x: actor.x, y: actor.y, behavior: 'runner', waypoints: [] });
      invalidate();
      draw();
      refreshAdd();
      return;
    }
    const board = map();
    if (!board) return;
    const occupied = [...(board.walls ?? []), ...(board.foundations ?? [])];
    let start = { x: 2.5, y: 2.5 };
    outer: for (let y = 3; y < board.height - 3; y += 4)
      for (let x = 3; x < board.width - 3; x += 4) {
        if (
          occupied.some(
            (rect) =>
              x >= rect.x - 1 &&
              x <= rect.x + rect.w + 1 &&
              y >= rect.y - 1 &&
              y <= rect.y + rect.h + 1,
          )
        )
          continue;
        if (
          rows.some(
            ({ fields }) =>
              Number(fields.x.value) === x + 0.5 && Number(fields.y.value) === y + 0.5,
          )
        )
          continue;
        start = { x: x + 0.5, y: y + 0.5 };
        break outer;
      }
    let suffix = 1;
    const ids = new Set([
      ...rows.map(({ fields }) => fields.id.value),
      ...(getMission().actors ?? []).map((actor) => actor.id),
    ]);
    while (ids.has(`prey-${suffix}`)) suffix++;
    appendActor({ id: `prey-${suffix}`, behavior: 'runner', ...start, waypoints: [] });
    invalidate();
    draw();
  };
  inspect.onclick = () => {
    try {
      if (identity !== context()) throw new Error(words('changed'));
      prepared = selectedMissionPursuitSource(getSource(), getMission()?.id, population());
      pendingKey = `${context()}|${draftKey()}`;
      commit.disabled = false;
      status.textContent = words('accepted');
    } catch (error) {
      invalidate();
      status.textContent = error.message;
    }
  };
  const accept = () => {
    try {
      if (!prepared || pendingKey !== `${context()}|${draftKey()}`)
        throw new Error(words('changed'));
      if (apply(prepared, accept) === false) return;
      identity = null;
      sync();
      status.textContent = words('applied');
    } catch (error) {
      status.textContent = error.message;
    }
  };
  commit.onclick = accept;
  cast.onchange = draw;
  function sync() {
    if (disposed) return;
    const mission = getMission();
    activeMission = mission;
    root.disabled = !mission || !!mission.archived;
    const next = context();
    if (next !== identity) {
      identity = next;
      invalidate();
      rows = [];
      list.replaceChildren();
      const population =
        mission?.pursuit?.actors ??
        authoredRunners()
          .slice(0, 6)
          .map((actor) => ({
            id: actor.id,
            x: actor.x,
            y: actor.y,
            behavior: 'runner',
            waypoints: [],
          }));
      for (const actor of population) appendActor(actor);
      status.textContent = mission ? '' : words('select');
      refreshAdd();
    }
    localize();
    draw();
  }
  const unlocale = onLocaleChange(() => {
    localize();
    draw();
  });
  localize();
  invalidate();
  return Object.freeze({
    sync,
    dispose() {
      disposed = true;
      unlocale();
      root.remove();
      rows = [];
      prepared = null;
    },
  });
}
