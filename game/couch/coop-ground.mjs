import { isJourneyTeamLevel } from '../coop/foundations.mjs';

/** Presentation vocabulary only. Historical Team editions keep their wording;
 * all Journey editions name the surface consistently, not by present enemies. */
export const coopGroundName = (level) =>
  level && isJourneyTeamLevel(level) ? 'reclaimed ground' : 'safe ground';
