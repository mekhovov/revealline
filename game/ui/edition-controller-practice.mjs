import { required } from '../data-json.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { entryScenario } from '../playground/model.mjs';

const projects = new WeakMap();
function selectedProject(provider) {
  required(provider?.kind === 'edition', 'Controller practice needs a selected edition.');
  if (!projects.has(provider)) projects.set(provider, compileContentProject(provider.route.source));
  return projects.get(provider);
}

/** Only the admitted audience's missions are exposed. A resolved scenario is
 * reconstructed in the child, never transferred through the shared Playground. */
export function editionPracticeChoices(provider, { difficulty = 'standard' } = {}) {
  resolveGameplayTuning(difficulty);
  const project = selectedProject(provider);
  return project.campaigns.flatMap((campaign) =>
    campaign.missionIds.map((missionId) => {
      const manifest = resolveMission(project, missionId, { difficulty });
      const theme = provider.themes.find((item) => item.id === manifest.presentation.themeId);
      required(theme, 'Practice mission theme is outside the selected edition.');
      return {
        missionId,
        levelId: missionId,
        label: `${campaign.name} / ${manifest.level.name}`,
        entry: {
          campaign: {
            version: 'xonix-campaign.v1',
            id: campaign.id,
            revision: campaign.revision,
            title: campaign.name,
            levels: [manifest.level],
          },
          themes: [theme],
          classRecipes: provider.boot[3],
        },
      };
    }),
  );
}

export function createEditionPracticeScenario(
  provider,
  { missionId, classId = 'scout', turnPolicy = 'immediate', difficulty = 'standard' } = {},
) {
  const choice = editionPracticeChoices(provider, { difficulty }).find(
    (item) => item.missionId === missionId,
  );
  required(choice, 'Practice mission is outside the selected edition.');
  required(
    choice.entry.classRecipes.some((recipe) => recipe.id === classId),
    'Practice class is outside the selected edition.',
  );
  required(['immediate', 'grid-center'].includes(turnPolicy), 'Unsupported practice steering.');
  const scenario = entryScenario(choice.entry, missionId, { classId, turnPolicy, seed: 1 });
  // The normal host deliberately does not retune imported practice scenarios.
  scenario.level = applyGameplayTuning(scenario.level, resolveGameplayTuning(difficulty));
  return scenario;
}

export function editionPracticePreviewURL(
  provider,
  {
    missionId,
    classId = 'scout',
    turnPolicy = 'immediate',
    difficulty = 'standard',
    controllerSession,
    revision = 1,
  } = {},
) {
  createEditionPracticeScenario(provider, { missionId, classId, turnPolicy, difficulty });
  required(/^[a-f0-9]{32}$/.test(controllerSession), 'Invalid controller practice session.');
  required(Number.isSafeInteger(revision) && revision > 0, 'Invalid practice revision.');
  return provider.href({
    practice: '1',
    'edition-mission': missionId,
    class: classId,
    'turn-policy': turnPolicy,
    difficulty,
    'controller-preview': '1',
    'controller-session': controllerSession,
    revision: String(revision),
  });
}
