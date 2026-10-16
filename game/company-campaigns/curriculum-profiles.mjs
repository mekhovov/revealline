import { COMMUNITY_LEARNING_PROFILES } from './profiles/community.mjs';
import { CULTURE_LEARNING_PROFILES } from './profiles/culture.mjs';
import { FPV_LEARNING_PROFILES } from './profiles/fpv.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
export const CURRICULUM_LEARNING_PROFILES = freezeDesign({
  ...COMMUNITY_LEARNING_PROFILES,
  ...CULTURE_LEARNING_PROFILES,
  ...FPV_LEARNING_PROFILES,
});
