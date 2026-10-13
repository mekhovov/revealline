import { OVERFLIGHT_RIY_FIELDS, OVERFLIGHT_RIY_ESCORT_FIELDS } from '../overflight/riy-project.mjs';

/** Escort authoring is an additional section of the existing Survivor editor. */
export function overflightRiyEditor({ document, project, locale, onChange }) {
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
  controls(root, project.riy, OVERFLIGHT_RIY_FIELDS);
  for (const escort of project.riy.escorts) {
    const section = document.createElement('fieldset');
    const title = document.createElement('legend');
    title.textContent =
      escort.role === 'sweeper'
        ? words('Sweeper · group impact', 'Зачисник · удар по групі')
        : words('Breaker · focused impact', 'Пробійник · зосереджений удар');
    section.append(title);
    controls(section, escort, OVERFLIGHT_RIY_ESCORT_FIELDS);
    root.append(section);
  }
  return root;
}
