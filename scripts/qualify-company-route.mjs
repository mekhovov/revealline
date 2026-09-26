// Offline feasibility probe. A successful machine route is not a human playtest.
import { probePressureRoute } from './lib/pressure-route-probe.mjs';
import { createCompanyProject } from '../game/company-campaigns/content.mjs';
import { COMPANY_MISSIONS } from '../game/company-campaigns/catalog.mjs';

const mission = COMPANY_MISSIONS.find((entry) => entry.id === process.argv[2]);
if (!mission) throw new Error('Choose a company mission ID.');
probePressureRoute({ [mission.id]: 'down' }, () =>
  createCompanyProject({ brandId: mission.brandId, campaignId: mission.campaignId }),
);
