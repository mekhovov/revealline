import { journeyPreset } from '../content-design/catalogs.mjs';
import { localizedText, t } from '../i18n/index.mjs';

const difficultyKeys = {
  gentle: 'interface:missionLibrary.difficulty.gentle',
  standard: 'interface:missionLibrary.difficulty.standard',
  expert: 'interface:missionLibrary.difficulty.expert',
};

/** Describe the applied catalogue, never the unapplied JSON or a global default.
 * Updating labels must not select a new preset, write history or edit a mission. */
export function syncStudioDifficulty(select, catalogId, { team = false } = {}) {
  const updates = Array.from(select.options, (option) => {
    const preset = journeyPreset(option.value, catalogId);
    const nameKey = difficultyKeys[option.value];
    return [
      option,
      () =>
        t(team ? 'tools:studio.difficulty.shared' : 'tools:studio.difficulty.solo', {
          name: t(nameKey),
          count: preset.lives,
          speed: preset.enemySpeedFactor,
        }),
    ];
  });
  for (const [option, label] of updates) localizedText(option, label);
}
