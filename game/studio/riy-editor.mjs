import {
  OVERFLIGHT_RIY_FIELDS,
  OVERFLIGHT_RIY_ESCORT_FIELDS,
  OVERFLIGHT_RIY_FIELDS_V2,
  OVERFLIGHT_RIY_ESCORT_FIELDS_V2,
} from '../overflight/riy-project.mjs';

/** Escort authoring is an additional section of the existing Survivor editor. */
export function overflightRiyEditor({ document, project, locale, onChange }) {
  const v2 = ['OverflightRiyProjectV2', 'OverflightRiyProjectV3'].includes(project.format);
  const words = (en, uk) => (locale === 'uk' ? uk : en);
  const root = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = words('Riy formation and escort attacks', 'Стрій і атаки супроводу Рою');
  root.append(legend);
  const hint = document.createElement('p');
  hint.textContent = words(
    'Offsets rotate with the flight heading. Sweeper clears groups; breaker concentrates damage. Preview uses these exact settings.',
    'Відступи повертаються разом із курсом польоту. Зачисник очищує групи, пробійник зосереджує шкоду. Перегляд використовує саме ці налаштування.',
  );
  root.append(hint);
  const controls = (parent, owner, fields) => {
    const grid = document.createElement('div');
    grid.className = 'of-fields';
    for (const [key, min, max, step, en, uk] of fields) {
      const label = document.createElement('label');
      label.textContent = words(en, uk);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = owner[key];
      input.addEventListener('input', () => {
        owner[key] = Number(input.value);
        onChange();
      });
      label.append(input);
      grid.append(label);
    }
    parent.append(grid);
  };
  controls(root, project.riy, v2 ? OVERFLIGHT_RIY_FIELDS_V2 : OVERFLIGHT_RIY_FIELDS);
  if (v2) {
    for (const pack of project.riy.intro) {
      const section = document.createElement('fieldset');
      const title = document.createElement('legend');
      title.textContent =
        pack.facing === 'rear'
          ? words('Introduction · rear formation', 'Вступ · задній стрій')
          : words('Introduction · front formation', 'Вступ · передній стрій');
      section.append(title);
      controls(section, pack, [
        ['start', 0, 25, 1, 'Arrival begins (seconds)', 'Початок прибуття (с)'],
        ['end', 5, 30, 1, 'Arrival ends (seconds)', 'Кінець прибуття (с)'],
        ['count', 4, 48, 1, 'Infantry in this pack', 'Піхотинців у строю'],
      ]);
      root.append(section);
    }
  }
  for (const escort of project.riy.escorts) {
    const section = document.createElement('fieldset');
    const title = document.createElement('legend');
    title.textContent =
      escort.role === 'sweeper'
        ? words('Sweeper · group impact', 'Зачисник · удар по групі')
        : words('Breaker · focused impact', 'Пробійник · зосереджений удар');
    section.append(title);
    controls(section, escort, v2 ? OVERFLIGHT_RIY_ESCORT_FIELDS_V2 : OVERFLIGHT_RIY_ESCORT_FIELDS);
    root.append(section);
  }
  return root;
}
