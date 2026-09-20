/** Authoring and runtime use the same explicit Team role boundary. An additive
 * project catalog never upgrades an earlier mission's qualified behavior. */
export const TEAM_MISSION_FORMATS = Object.freeze([
  'TeamMissionV1',
  'TeamMissionV2',
  'TeamMissionV3',
]);
export const teamRoleQualified = (format, role) =>
  TEAM_MISSION_FORMATS.includes(format) &&
  (role === 'field-keeper' || (format === 'TeamMissionV3' && role === 'reclaimed-roamer'));
