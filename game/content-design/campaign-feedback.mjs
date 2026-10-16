import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import {
  validateCampaignFeedback,
  CAMPAIGN_FEEDBACK_FORMAT,
} from '../journey/campaign-feedback.mjs';

/** Presentation-only source edit. Existing reward promises and all simulation
 * data retain their original values. Null deliberately restores the fallback. */
export function editCampaignFeedback(source, campaignId, input) {
  const project = structuredClone(compileContentProject(source).source),
    campaign = project.campaigns.find((item) => item.id === campaignId);
  required(campaign, 'Choose an authored campaign.');
  if (input === null) {
    if (campaign.discovery) delete campaign.discovery.feedback;
  } else {
    const content = boundedJSON(input, {
      maxBytes: 8192,
      maxNodes: 32,
      maxArray: 4,
      maxString: 240,
    });
    exactKeys(content, ['lines', 'victoryMotif'], 'Campaign feedback edit');
    const feedback = validateCampaignFeedback({
      ...content,
      format: CAMPAIGN_FEEDBACK_FORMAT,
      revision: `feedback-${dataIdentity(content)}`,
    });
    campaign.discovery = { exhibitLayout: 'route', ...campaign.discovery, feedback };
  }
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
