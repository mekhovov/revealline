import { createPressureCorridorTriptychCandidates } from './pressure-corridor-triptych-candidates.mjs';

export const COOLING_LOOP_EROSION_REVISION = 'cooling-loop-erosion-1';

/** Copy-on-write successor to v37. Only one existing eroder's authored route
 * and its mission's design explanation change; maps and movement policy do not. */
export function createCoolingLoopErosionCandidates({ artwork = false } = {}) {
  const project = createPressureCorridorTriptychCandidates({ artwork });
  project.id = artwork
    ? 'whole-cooling-loop-erosion-original-review'
    : 'whole-cooling-loop-erosion-greybox-review';
  project.name = 'Whole Journey · Cooling loop earned-return pressure';
  project.revision = COOLING_LOOP_EROSION_REVISION;

  const mission = project.missions.find((item) => item.id === 'cooling-loop');
  mission.revision = COOLING_LOOP_EROSION_REVISION;
  mission.actors = mission.actors.map((actor) =>
    actor.id === 'eroder' ? { ...actor, x: 14.5, y: 24.5, heading: [1, 1] } : actor,
  );
  mission.design = {
    ...mission.design,
    routeDecision:
      'Connect the protected northern and side landings first, or neutralize a lethal bank and use its earned approach while the eroder contests the lower return?',
    lesson:
      'The established Polissia separated-band wall geometry is unchanged. Foundations survive erosion; earned links between them do not. The eroder moves straight between physical impacts and warns before removing territory.',
    counterplay:
      'Keep a permanent landing within reach before extending an earned return. When erosion marks a useful link, choose whether to repair it after the warning or depart from a different foundation; do not repair every isolated cell.',
    captureConsequence:
      'The landing-first route connects protected staging points through erodible links. Bank-first neutralizes lethal terrain and creates an earned approach that must be treated as expendable, not permanent safety.',
    memorableMoment:
      'A warned cell opens in the lower earned return while the craft can still choose a protected landing for its next departure.',
    mastery:
      'Neutralize both banks, connect every foundation and finish after an erosion event without losing a life.',
  };

  const campaigns = new Set();
  for (const campaign of project.campaigns)
    if (campaign.missionIds.includes(mission.id)) {
      campaign.revision = COOLING_LOOP_EROSION_REVISION;
      campaigns.add(campaign.id);
    }
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => campaigns.has(id)))
      pack.revision = COOLING_LOOP_EROSION_REVISION;
  return project;
}
