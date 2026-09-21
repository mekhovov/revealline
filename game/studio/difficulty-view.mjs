import { journeyPreset } from '../content-design/catalogs.mjs';

/** Describe the applied catalogue, never the unapplied JSON or a global default.
 * Updating labels must not select a new preset, write history or edit a mission. */
export function syncStudioDifficulty(select, catalogId, { team = false } = {}) {
  const updates = Array.from(select.options, (option) => {
    const preset = journeyPreset(option.value, catalogId);
    const name = option.value[0].toUpperCase() + option.value.slice(1);
    return [
      option,
      `${name} · ${preset.lives} ${team ? 'shared lives' : 'lives'} · enemy speed ×${preset.enemySpeedFactor}`,
    ];
  });
  for (const [option, label] of updates) option.textContent = label;
}
