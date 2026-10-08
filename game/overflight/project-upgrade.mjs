import { validateOverflightProject } from './project.mjs';
import { validateOverflightHuntProject } from './raid-project.mjs';
import { createOverflightCombatProfile } from './combat-profile.mjs';

/** Explicit author action: make a distinct V2 copy without rewriting the imported
 * project, its authored positions, or the original installed package. */
export function upgradeOverflightProjectCopy(
  source,
  { hunt = false, difficulty = 'standard' } = {},
) {
  const validate = hunt ? validateOverflightHuntProject : validateOverflightProject;
  const original = validate(source);
  const project = structuredClone(original);
  project.format = hunt ? 'OverflightHuntProjectV2' : 'OverflightProjectV2';
  project.difficulty = difficulty;
  project.combat = original.combat ?? createOverflightCombatProfile(difficulty);
  project.id = `${original.id.slice(0, 60)}-v2`;
  project.title = {
    en: `${original.title.en.slice(0, 108)} · Revised`,
    uk: `${original.title.uk.slice(0, 105)} · Оновлено`,
  };
  if (!project.upgrades.modules.includes('plating')) project.upgrades.modules.push('plating');
  return structuredClone(validate(project));
}
