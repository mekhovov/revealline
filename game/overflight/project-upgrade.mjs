import { validateOverflightProject } from './project.mjs';
import { validateOverflightHuntProject } from './raid-project.mjs';
import { createOverflightCombatProfile } from './combat-profile.mjs';

/** Explicit author action: make a distinct versioned copy without rewriting the imported
 * project, its authored positions, or the original installed package. */
export function upgradeOverflightProjectCopy(
  source,
  { hunt = false, difficulty = 'standard', rulesVersion = 2 } = {},
) {
  const validate = hunt ? validateOverflightHuntProject : validateOverflightProject;
  const original = validate(source);
  const project = structuredClone(original);
  project.format = `${hunt ? 'OverflightHuntProject' : 'OverflightProject'}V${rulesVersion >= 4 ? 4 : rulesVersion >= 3 ? 3 : 2}`;
  if (rulesVersion >= 3)
    project.balanceRevision = rulesVersion >= 4 ? 'overflight-balance.v4' : 'overflight-balance.v3';
  if (hunt && rulesVersion >= 3)
    project.medalBudgets ??= {
      gold: 90,
      silver: 150,
      bronze: 240,
      provisional: true,
    };
  project.difficulty = difficulty;
  project.combat =
    rulesVersion >= 3
      ? createOverflightCombatProfile(difficulty, 3)
      : (original.combat ?? createOverflightCombatProfile(difficulty));
  project.id = `${original.id.slice(0, 60)}-v${rulesVersion >= 4 ? 4 : rulesVersion >= 3 ? 3 : 2}`;
  project.title = {
    en: `${original.title.en.slice(0, 108)} · Revised`,
    uk: `${original.title.uk.slice(0, 105)} · Оновлено`,
  };
  if (!project.upgrades.modules.includes('plating')) project.upgrades.modules.push('plating');
  return structuredClone(validate(project));
}
