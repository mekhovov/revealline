import {
  OVERFLIGHT_WORLDS,
  OVERFLIGHT_LANDMARK_KINDS,
  createOverflightWorldPresentation,
  applyOverflightWorld,
  validateOverflightWorldPresentation,
} from '../overflight/worlds.mjs';
import { paintOverflightWorld } from '../presentation/overflight-world-art.mjs';

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
    canvas.hidden = !project.presentation;
    const ctx = canvas.getContext?.('2d');
    if (!ctx || !project.presentation) return;
    ctx.clearRect(0, 0, 720, 270);
    ctx.save();
    ctx.scale(720 / project.arena.width, 270 / project.arena.height);
    paintOverflightWorld(ctx, project.presentation, project.arena);
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
  return root;
}
