import { compileContentProject } from './project.mjs';
import { createTeamImpactOriginalCandidates } from './team-impact-originals.mjs';

export const TEAM_SPECIALIST_PROFILE_KEY = 'team-specialist-originals-1';
export const TEAM_SPECIALIST_MISSIONS = Object.freeze([
  'twin-depots',
  'changing-courtyard',
  'last-rendezvous',
]);

/** A bounded successor for the end of the final Team learning arc. The first
 * nine missions retain hybrid Support. In the final three, seat one intercepts
 * travelling impacts and seat two disrupts moving enemies; rescue remains a
 * shared action for both. Historical impact editions and receipts stay intact. */
export function createTeamSpecialistOriginalCandidates() {
  const source = createTeamImpactOriginalCandidates();
  const changed = new Set(TEAM_SPECIALIST_MISSIONS);
  source.id = 'team-specialist-originals-review';
  source.revision = 'specialist-support-1';
  source.name = 'Team Journey · complementary specialists · balance review pending';
  for (const mission of source.missions) {
    if (!changed.has(mission.id)) continue;
    mission.revision = source.revision;
    mission.team = {
      ...mission.team,
      format: 'TeamMissionV6',
      supportRoles: ['interceptor', 'disruptor'],
    };
    const introduces = new Set(mission.design.introduces);
    const practices = new Set(mission.design.practices);
    if (mission.id === TEAM_SPECIALIST_MISSIONS[0]) introduces.add('complementary-support-roles');
    else practices.add('complementary-support-roles');
    mission.design = {
      ...mission.design,
      lesson:
        mission.id === TEAM_SPECIALIST_MISSIONS[0]
          ? 'Interceptor Support removes nearby travelling impacts while Disruptor Support slows nearby enemies. Rescue remains available to both players.'
          : mission.design.lesson,
      counterplay: `${mission.design.counterplay} Coordinate the Interceptor around exposed lines and the Disruptor around moving threats; neither pulse substitutes for the other.`,
      introduces: [...introduces],
      practices: [...practices],
      combines: [...new Set([...mission.design.combines, 'complementary-support-roles'])],
    };
  }
  const campaigns = new Set();
  for (const campaign of source.campaigns)
    if (campaign.missionIds.some((id) => changed.has(id))) {
      campaign.revision = source.revision;
      campaigns.add(campaign.id);
    }
  for (const pack of source.packs)
    if (pack.campaignIds.some((id) => campaigns.has(id))) pack.revision = source.revision;
  return structuredClone(compileContentProject(source).source);
}
