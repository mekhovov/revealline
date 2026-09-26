// Offline feasibility probe. A successful machine route is not a human playtest.
import { probePressureRoute } from './lib/pressure-route-probe.mjs';
import { createCompanyProject } from '../game/company-campaigns/content.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { COMPANY_MISSIONS } from '../game/company-campaigns/catalog.mjs';
import { createContentExecutionCatalog } from '../game/content-design/execution.mjs';

const mission = COMPANY_MISSIONS.find((entry) => entry.id === process.argv[2]);
if (!mission) throw new Error('Choose a company mission ID.');
probePressureRoute(
  { [mission.id]: 'down' },
  () => {
    const source = createCompanyProject({
      brandId: mission.brandId,
      campaignId: mission.campaignId,
    });
    createContentExecutionCatalog(source);
    return source;
  },
  {
    bentCuts: process.argv.includes('--bent'),
    prepareManifest(manifest, difficulty) {
      if (mission.brandId === 'droneaid') return manifest;
      const gameplayTuning = resolveGameplayTuning(difficulty);
      return {
        ...manifest,
        level: applyGameplayTuning(manifest.level, gameplayTuning),
        gameplayTuning,
      };
    },
  },
);
