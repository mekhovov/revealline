import { OVERFLIGHT_COMBAT_FIELDS } from '../overflight/combat-profile.mjs';

/** Shared controls edit the exact profile compiled by native Survivor and Raid. */
export function overflightCombatEditor({
  document,
  project,
  locale,
  onChange,
  fieldsClass = 'of-fields',
}) {
  const words = (en, uk) => (locale === 'uk' ? uk : en);
  const root = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = words('Armor, attacks and supply encounters', 'Броня, атаки й постачання');
  root.append(legend);
  if (!project.combat) {
    const text = document.createElement('p');
    text.textContent = words(
      'This project retains its original rules. Make an updated copy to author armor and supply encounters.',
      'Цей проєкт зберігає початкові правила. Створіть оновлену копію, щоб редагувати броню й постачання.',
    );
    root.append(text);
    return root;
  }
  const fields = document.createElement('div');
  fields.className = fieldsClass;
  const field = (text, input) => {
    const label = document.createElement('label');
    label.textContent = text;
    label.append(input);
    fields.append(label);
  };
  const difficulty = document.createElement('select');
  for (const [id, en, uk] of [
    ['standard', 'Standard', 'Звичайна'],
    ['veteran', 'Veteran', 'Ветеран'],
  ]) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = words(en, uk);
    difficulty.append(option);
  }
  difficulty.value = project.difficulty;
  difficulty.addEventListener('change', () => {
    project.difficulty = difficulty.value;
    onChange();
  });
  field(words('Difficulty', 'Складність'), difficulty);
  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  enabled.checked = project.combat.supplies.enabled;
  enabled.addEventListener('change', () => {
    project.combat.supplies.enabled = enabled.checked;
    onChange();
  });
  field(words('Guarded supply cases', 'Ящики під охороною'), enabled);
  const hunt = project.format === 'OverflightHuntProjectV2';
  for (const [section, key, min, max, step, en, uk] of OVERFLIGHT_COMBAT_FIELDS) {
    // Raid uses contact states and authored finite packs. Numeric absorption,
    // hull partitioning and timed spawn relief belong to Survivor only.
    if (
      hunt &&
      ((section === 'guard' && key !== 'commitSeconds') ||
        (section === 'machinery' && key !== 'exposureSeconds') ||
        section === 'pacing')
    )
      continue;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = project.combat[section][key];
    input.addEventListener('input', () => {
      project.combat[section][key] = Number(input.value);
      onChange();
    });
    field(words(en, uk), input);
  }
  root.append(fields);
  return root;
}
