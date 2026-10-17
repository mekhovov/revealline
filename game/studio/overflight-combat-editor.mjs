import {
  OVERFLIGHT_COMBAT_FIELDS,
  OVERFLIGHT_COMBAT_V3_FIELDS,
} from '../overflight/combat-profile.mjs';

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
  const modern = /V[34]$/.test(project.survivorFormat ?? project.format);
  const difficulty = document.createElement('select');
  for (const [id, en, uk] of [
    ...(modern ? [['relaxed', 'Relaxed', 'Спокійна']] : []),
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
  const hunt = project.format.startsWith('OverflightHuntProject');
  if (!hunt && /V4$/.test(project.survivorFormat ?? project.format)) {
    const separation = document.createElement('select');
    separation.setAttribute('data-crowd-separation', '');
    for (const [value, en, uk] of [
      ['legacy', 'Original crowd movement', 'Початковий рух натовпу'],
      ['local-v1', 'Local spacing · experimental', 'Локальні відстані · експеримент'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = words(en, uk);
      separation.append(option);
    }
    separation.value = project.combat.crowdSeparation ?? 'legacy';
    separation.addEventListener('change', () => {
      if (separation.value === 'local-v1') project.combat.crowdSeparation = 'local-v1';
      else delete project.combat.crowdSeparation;
      onChange();
    });
    field(words('Crowd movement', 'Рух натовпу'), separation);
  }
  if (modern && !hunt) {
    const overdrive = document.createElement('input');
    overdrive.type = 'checkbox';
    overdrive.checked = project.combat.supplies.overdrive;
    overdrive.addEventListener('change', () => {
      project.combat.supplies.overdrive = overdrive.checked;
      onChange();
    });
    field(words('Stored Overdrive supply reward', 'Нагорода запасеним форсажем'), overdrive);
    if (!hunt) {
      const bonus = document.createElement('select');
      for (const [value, en, uk] of [
        [1, 'Standard damage', 'Звичайна шкода'],
        [1.15, '+15% friendly damage', '+15% шкоди гравця'],
      ]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = words(en, uk);
        bonus.append(option);
      }
      bonus.value = project.combat.friendlyDamageMultiplier;
      bonus.addEventListener('change', () => {
        project.combat.friendlyDamageMultiplier = Number(bonus.value);
        onChange();
      });
      field(words('Friendly damage', 'Шкода гравця'), bonus);
    }
  }
  for (const [section, key, min, max, step, en, uk] of [
    ...OVERFLIGHT_COMBAT_FIELDS,
    ...(modern ? OVERFLIGHT_COMBAT_V3_FIELDS : []),
  ]) {
    // Raid uses contact states and authored finite packs. Numeric absorption,
    // hull partitioning and timed spawn relief belong to Survivor only.
    if (
      hunt &&
      ((section === 'guard' && key !== 'commitSeconds') ||
        (section === 'machinery' && key !== 'exposureSeconds') ||
        section === 'pacing' ||
        section === 'threats')
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
  const guidance = document.createElement('p');
  guidance.textContent = words(
    'Difficulty labels this custom encounter. The values above set its balance; changing the label preserves your tuning.',
    'Складність позначає цей власний сценарій. Значення вище визначають баланс; зміна позначки зберігає ваші налаштування.',
  );
  root.append(fields, guidance);
  return root;
}
