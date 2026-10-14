import {
  OVERFLIGHT_WORLDS,
  OVERFLIGHT_LANDMARK_KINDS,
  createOverflightWorldPresentation,
  applyOverflightWorld,
  validateOverflightWorldPresentation,
  createExperimentalOverflightWorldProject,
} from '../overflight/worlds.mjs';
import { paintOverflightWorld } from '../presentation/overflight-world-art.mjs';
import { validateOverflightTerrain, overflightTerrainClear } from '../overflight/terrain.mjs';
import { validateOverflightSupplyTerrain } from '../overflight/tactics.mjs';

const MATERIALS = ['earth', 'concrete', 'damaged', 'timber', 'masonry', 'metal'];
const TITLES = {
  earth: ['Earth', 'Ґрунт'],
  concrete: ['Concrete', 'Бетон'],
  damaged: ['Damaged paving', 'Пошкоджене покриття'],
  timber: ['Timber', 'Деревина'],
  masonry: ['Masonry', 'Камінь'],
  metal: ['Metal', 'Метал'],
  road: ['Road', 'Дорога'],
  tracks: ['Wheel tracks', 'Колії'],
  rail: ['Railway', 'Залізниця'],
  foundation: ['Low foundation', 'Низький фундамент'],
  crater: ['Crater', 'Вирва'],
  tree: ['Perimeter tree', 'Дерево на краю'],
  container: ['Perimeter container', 'Контейнер на краю'],
  antenna: ['Perimeter antenna', 'Антена на краю'],
  rubble: ['Low rubble', 'Низькі уламки'],
};
const tall = (entry) => ['tree', 'container', 'antenna'].includes(entry.kind);

export function paintOverflightTerrainLayout(ctx, terrain) {
  if (!terrain) return;
  ctx.save();
  ctx.lineWidth = 5;
  for (const obstacle of terrain.obstacles) {
    const { x, y, width, height, breakable } = obstacle;
    ctx.fillStyle = breakable ? '#75552e' : '#34454a';
    ctx.strokeStyle = breakable ? '#f4c765' : '#d2dad6';
    ctx.fillRect(x, y, width, height);
    ctx.setLineDash(breakable ? [12, 8] : []);
    ctx.strokeRect(x, y, width, height);
    if (breakable) {
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 8);
      ctx.lineTo(x + width - 8, y + height - 8);
      ctx.moveTo(x + width - 8, y + 8);
      ctx.lineTo(x + 8, y + height - 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function validateTerrainDraft(project) {
  validateOverflightTerrain(project.terrain, project.arena);
  validateOverflightSupplyTerrain(project);
  if (project.format.startsWith('OverflightHunt'))
    for (const encounter of project.encounters)
      for (const point of [
        encounter.entry,
        ...encounter.objectives,
        ...encounter.packs,
        ...[...encounter.objectives, ...encounter.packs].flatMap((actor) => actor.route),
      ])
        if (!overflightTerrainClear(project.terrain, point.x, point.y, point.x, point.y, 28))
          throw new TypeError('Keep objectives, packs and route points clear of cover.');
}

/** Keep placement controls in the admitted footprint. Tall scenery is decoration
 * at the edge, never a deceptive obstacle in the open-arena flight corridor. */
export function fitOverflightWorldPlacement(entry, arena) {
  const next = { ...entry };
  for (const [size, position, limit] of [
    ['width', 'x', arena.width],
    ['height', 'y', arena.height],
  ]) {
    next[size] = Math.max(1, Math.min(limit, Math.round(next[size]) || 1));
    next[position] = Math.max(0, Math.min(limit - next[size], Math.round(next[position]) || 0));
  }
  if (tall(next)) {
    const perimeter = (150 * arena.height) / 1080;
    next.height = Math.min(next.height, Math.floor(perimeter));
    next.y =
      next.y < arena.height / 2
        ? Math.min(next.y, Math.floor(perimeter - next.height))
        : Math.max(next.y, Math.ceil(arena.height - perimeter));
    next.y = Math.min(next.y, arena.height - next.height);
  }
  return next;
}

/** One editor serves Single Drone, Riy and Raid. Selecting a world changes only
 * presentation; the separately labelled encounter action is the only combat edit. */
export function overflightWorldEditor({
  document,
  project,
  locale = 'en',
  onChange,
  onApply = () => {},
  fieldsClass = 'of-fields',
  allowTerrain = true,
}) {
  const words = (en, uk) => (locale === 'uk' ? uk : en);
  const element = (tag, text = '', attributes = {}) => {
    const node = document.createElement(tag);
    node.textContent = text;
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const root = element('fieldset', '', { 'data-world-editor': '' });
  root.append(
    element('legend', words('Battlefield world and decoration', 'Світ і декорації поля бою')),
  );
  if (!(project.survivorFormat ?? project.format).endsWith('V3')) {
    root.append(
      element(
        'p',
        words(
          'Upgrade a copy to current rules to edit its world. This original keeps its artwork and rules.',
          'Оновіть копію до чинних правил, щоб редагувати світ. Оригінал збереже оформлення та правила.',
        ),
      ),
    );
    return root;
  }
  const label = element('label', words('World appearance', 'Оформлення світу')),
    select = element('select', '', { 'data-world-select': '' }),
    status = element('p', '', { role: 'status', 'data-world-status': '' }),
    layout = element('div'),
    canvas = element('canvas', '', {
      width: 720,
      height: 270,
      'aria-label': words(
        'Native battlefield artwork preview',
        'Перегляд ігрового оформлення поля бою',
      ),
    });
  canvas.style.width = '100%';
  canvas.style.imageRendering = 'pixelated';
  select.append(element('option', words('Original ground', 'Початковий ґрунт'), { value: '' }));
  for (const world of OVERFLIGHT_WORLDS)
    select.append(element('option', world.title[locale] ?? world.title.en, { value: world.id }));
  select.value = project.presentation?.world ?? '';
  label.append(select);
  root.append(
    label,
    element(
      'p',
      words(
        'World selection replaces decoration only. Applying its encounter patterns below changes combat. Tall decoration stays at the perimeter; all interior props are fly-over scenery.',
        'Вибір світу замінює лише декорації. Окрема дія нижче змінює бойові хвилі. Високі декорації залишаються на краях; над внутрішніми можна вільно літати.',
      ),
    ),
    canvas,
    status,
    layout,
  );
  const apply = element('button', words('Apply world encounters', 'Застосувати бої цього світу'), {
    type: 'button',
    'data-world-encounters': '',
  });
  root.append(apply);
  const report = (message, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
  };
  const paint = () => {
    canvas.hidden = !project.presentation && !project.terrain;
    const ctx = canvas.getContext?.('2d');
    if (!ctx || canvas.hidden) return;
    ctx.clearRect(0, 0, 720, 270);
    ctx.save();
    ctx.scale(720 / project.arena.width, 270 / project.arena.height);
    ctx.fillStyle = '#11251f';
    ctx.fillRect(0, 0, project.arena.width, project.arena.height);
    if (project.presentation) paintOverflightWorld(ctx, project.presentation, project.arena);
    paintOverflightTerrainLayout(ctx, project.terrain);
    ctx.restore();
  };
  const changed = () => {
    validateOverflightWorldPresentation(project.presentation, project.arena);
    onChange();
    paint();
  };
  const button = (parent, text, key, callback) => {
    const node = element('button', text, { type: 'button', [key]: '' });
    node.addEventListener('click', callback);
    parent.append(node);
    return node;
  };
  const terrainPanel = element('fieldset', '', { 'data-terrain-editor': '' });
  root.append(terrainPanel);
  function renderTerrain() {
    terrainPanel.replaceChildren();
    terrainPanel.append(
      element('legend', words('Experimental cover', 'Експериментальні перешкоди')),
      element(
        'p',
        words(
          allowTerrain
            ? 'Single Drone, Riy and Single Raid only. Six solid obstacles and two breakable barriers; keep the central passage and gaps at least 240 units wide. Solid outlines are permanent; crossed, dashed outlines break in two hits. These change gameplay records.'
            : 'Experimental cover is unavailable in Time Attack and Contract Marathon. Switch to Single Raid to edit it, or remove cover to use this operation.',
          allowTerrain
            ? 'Лише для одного дрона, Рою та одного Нальоту. Шість перешкод і дві руйнівні перепони; центральний прохід і проміжки — щонайменше 240 одиниць. Суцільні контури постійні; пунктирні з хрестом руйнуються за два удари. Зміни впливають на ігрові рекорди.'
            : 'Експериментальні перешкоди недоступні в режимах «На час» і «Марафон контрактів». Перейдіть до одного Нальоту для редагування або вилучіть перешкоди.',
        ),
      ),
    );
    if (!project.terrain) {
      const add = button(
        terrainPanel,
        words('Add Experimental depot cover', 'Додати експериментальні перешкоди депо'),
        'data-terrain-add',
        () => {
          if (!allowTerrain) return;
          try {
            const next = createExperimentalOverflightWorldProject(() => structuredClone(project));
            validateTerrainDraft(next);
            project.terrain = next.terrain;
            project.encounters = next.encounters;
            onChange();
            report(
              words(
                'Experimental cover added. Raid targets and routes were adjusted for clearance; other authored settings are preserved.',
                'Експериментальні перешкоди додано. Цілі й маршрути Нальоту зміщено для вільного проходу; інші авторські налаштування збережено.',
              ),
            );
            paint();
            renderTerrain();
            onApply();
          } catch (error) {
            report(error.message, true);
          }
        },
      );
      add.disabled = !allowTerrain || project.arena.width < 2880 || project.arena.height < 1080;
      terrainPanel.append(
        element(
          'p',
          words(
            'Adding cover requires at least 2880 × 1080. Raid targets and routes move only as needed for clearance.',
            'Для перешкод потрібна арена від 2880 × 1080. Цілі й маршрути Нальоту зміщуються лише для вільного проходу.',
          ),
        ),
      );
      return;
    }
    for (const [index, obstacle] of project.terrain.obstacles.entries()) {
      const row = element('div', '', { class: fieldsClass, 'data-terrain-obstacle': obstacle.id });
      row.append(
        element(
          'strong',
          `${obstacle.id} · ${obstacle.breakable ? words('Breakable · 2 hits', 'Руйнується · 2 удари') : words('Permanent', 'Постійна')}`,
        ),
      );
      for (const [key, en, uk] of [
        ['x', 'X', 'X'],
        ['y', 'Y', 'Y'],
        ['width', 'Width', 'Ширина'],
        ['height', 'Height', 'Висота'],
      ]) {
        const label = element('label', words(en, uk)),
          input = element('input', '', {
            type: 'number',
            min: ['x', 'y'].includes(key) ? 90 : 32,
            max: (['x', 'width'].includes(key) ? project.arena.width : project.arena.height) - 90,
            step: 1,
            'data-terrain-coordinate': key,
          });
        input.value = obstacle[key];
        input.disabled = !allowTerrain;
        input.addEventListener('change', () => {
          if (!allowTerrain) return;
          const candidate = structuredClone(project.terrain);
          candidate.obstacles[index][key] = Number(input.value);
          try {
            if (!input.value.trim() || !Number.isFinite(Number(input.value)))
              throw new TypeError(
                words('Enter a finite coordinate.', 'Введіть скінченну координату.'),
              );
            validateTerrainDraft({ ...project, terrain: candidate });
            project.terrain = candidate;
            onChange();
            report(
              words(
                'Cover updated. Passage, objective and reward clearance remain valid.',
                'Перешкоди оновлено. Проходи, цілі й винагороди залишаються доступними.',
              ),
            );
            paint();
          } catch (error) {
            input.value = project.terrain.obstacles[index][key];
            report(error.message, true);
          }
        });
        label.append(input);
        row.append(label);
      }
      terrainPanel.append(row);
    }
    button(
      terrainPanel,
      words('Remove Experimental cover', 'Вилучити експериментальні перешкоди'),
      'data-terrain-remove',
      () => {
        delete project.terrain;
        onChange();
        paint();
        renderTerrain();
        onApply();
      },
    );
  }
  function render() {
    const opened = new Set(
      [...layout.querySelectorAll('[data-world-group]')]
        .filter((section) => section.open)
        .map((section) => section.dataset.worldGroup),
    );
    layout.replaceChildren();
    apply.disabled = !project.presentation;
    paint();
    if (!project.presentation) return;
    for (const [group, property, kinds, title] of [
      ['regions', 'material', MATERIALS, words('Ground material regions', 'Ділянки покриття')],
      ['landmarks', 'kind', OVERFLIGHT_LANDMARK_KINDS, words('Landmarks', 'Орієнтири')],
    ]) {
      const section = element('details', '', { 'data-world-group': group }),
        summary = element('summary', `${title} · ${project.presentation[group].length}/64`);
      section.open = opened.has(group);
      section.append(summary);
      for (const [index, entry] of project.presentation[group].entries()) {
        const row = element('div', '', {
          class: fieldsClass,
          'data-world-placement': `${group}:${entry.id}`,
        });
        row.append(element('span', entry.id));
        const kind = element('select', '', {
          'aria-label': `${entry.id} · ${title}`,
          'data-world-kind': '',
        });
        for (const id of kinds) kind.append(element('option', words(...TITLES[id]), { value: id }));
        kind.value = entry[property];
        kind.addEventListener('change', () => {
          entry[property] = kind.value;
          Object.assign(entry, fitOverflightWorldPlacement(entry, project.arena));
          changed();
          for (const control of row.querySelectorAll('[data-world-coordinate]'))
            control.value = entry[control.dataset.worldCoordinate];
        });
        row.append(kind);
        for (const [key, en, uk] of [
          ['x', 'X', 'X'],
          ['y', 'Y', 'Y'],
          ['width', 'Width', 'Ширина'],
          ['height', 'Height', 'Висота'],
        ]) {
          const label = element('label', words(en, uk)),
            input = element('input', '', {
              type: 'number',
              min: ['x', 'y'].includes(key) ? 0 : 1,
              max: ['width', 'x'].includes(key) ? project.arena.width : project.arena.height,
              step: 1,
              'data-world-coordinate': key,
            });
          input.value = entry[key];
          input.addEventListener('change', () => {
            if (!Number.isFinite(Number(input.value))) {
              input.value = entry[key];
              return;
            }
            entry[key] = Number(input.value);
            Object.assign(entry, fitOverflightWorldPlacement(entry, project.arena));
            changed();
            for (const control of row.querySelectorAll('[data-world-coordinate]'))
              control.value = entry[control.dataset.worldCoordinate];
          });
          label.append(input);
          row.append(label);
        }
        button(row, words('Remove', 'Вилучити'), 'data-world-remove', () => {
          project.presentation[group].splice(index, 1);
          changed();
          render();
        });
        section.append(row);
      }
      const add = button(
        section,
        words('Add placement', 'Додати елемент'),
        `data-world-add-${group}`,
        () => {
          if (project.presentation[group].length >= 64) return;
          let serial = 1;
          while (
            project.presentation[group].some((entry) => entry.id === `custom-${group}-${serial}`)
          )
            serial++;
          project.presentation[group].push(
            fitOverflightWorldPlacement(
              {
                id: `custom-${group}-${serial}`,
                [property]: kinds[0],
                x: project.arena.width / 2,
                y: project.arena.height / 2,
                width: 120,
                height: 64,
              },
              project.arena,
            ),
          );
          changed();
          render();
        },
      );
      add.disabled = project.presentation[group].length >= 64;
      layout.append(section);
    }
  }
  select.addEventListener('change', () => {
    if (select.value)
      project.presentation = createOverflightWorldPresentation(select.value, project.arena);
    else delete project.presentation;
    onChange();
    report(
      words(
        'Appearance updated. Encounters and gameplay records are unchanged.',
        'Оформлення оновлено. Бої та ігрові рекорди не змінилися.',
      ),
    );
    render();
  });
  apply.addEventListener('click', () => {
    try {
      const next = applyOverflightWorld(project, project.presentation.world);
      if (next.terrain) validateTerrainDraft(next);
      // Keep the author's title, ID, settings, resources and placement edits.
      project.encounters = next.encounters;
      project.encounterProfile = next.encounterProfile;
      onChange();
      report(
        words(
          'World encounters applied. Review the encounter schedule and preview before exporting.',
          'Бої світу застосовано. Перевірте розклад і перегляд перед експортом.',
        ),
      );
      onApply();
    } catch (error) {
      report(error.message, true);
    }
  });
  render();
  renderTerrain();
  return root;
}
