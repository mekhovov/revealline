import { createApexSpatialCandidates } from './apex-spatial-candidates.mjs';
import { compileContentProject } from './project.mjs';

/** Explicit ordinary-capture finale alternative, not a new Sentinel fill rule. */
export function createApexFieldCandidates({ artwork = false } = {}) {
  const source = createApexSpatialCandidates({ artwork });
  source.id = artwork ? 'apex-field-original-review' : 'apex-field-greybox-review';
  source.name = 'Apex Aurora · Home Signal field finale';
  source.revision = 'home-field-2';
  const mission = source.missions.find((item) => item.id === 'home-signal');
  mission.revision = source.revision;
  mission.encounter = null;
  mission.actors = [
    {
      id: 'north-keeper',
      role: 'field-keeper',
      tier: 'measured',
      x: 22.5,
      y: 6.5,
      heading: [1, 1],
    },
    {
      id: 'south-keeper',
      role: 'field-keeper',
      tier: 'measured',
      x: 57.5,
      y: 21.5,
      heading: [-1, -1],
    },
    ...mission.actors.filter((actor) => actor.id !== 'sentinel'),
  ];
  const ids = {
    'west-shield': 'dock-relay',
    'east-shield': 'east-relay',
    'south-shield': 'south-relay',
    core: 'north-relay',
  };
  for (const item of mission.objectives) item.id = ids[item.id];
  Object.assign(
    mission.objectives.find((item) => item.id === 'north-relay'),
    { x: 20.5, y: 4.5 },
  );
  for (const item of mission.relayLinks) item.objectiveId = ids[item.objectiveId];
  Object.assign(mission.design, {
    routeDecision:
      'Capture the near relay to open the home dock, or establish a far-wing return while the two field keepers occupy different approaches?',
    lesson:
      'The finale combines the familiar enemy-retained capture rule with relay returns and reclaimed-ground pressure. There is no boss shield or release window: enclose the four visible signal objectives and reach the coverage target.',
    counterplay:
      'Watch both keeper positions before departing; an enemy on each side can leave a line-only capture. Keep an upper or dock return ready before enclosing the ground roamer. The freeze pickup is optional.',
    captureConsequence:
      'The near relay opens a permanent non-scoring home dock. Other captures neutralize field only where no keeper remains, and can wake the roamer on reclaimed ground. Captured objectives persist through ordinary recovery.',
    memorableMoment:
      'An opened dock can offer a homeward return after a wide reveal wakes the roamer; choose a return rather than wait for a boss opening.',
    mastery:
      'Connect and visit a western wing and either far-eastern platform before clearing without a life loss.',
    combines: ['field-keeper', 'reclaimed-roamer', 'frontier-patrol', 'permanent-relay-connectors'],
  });
  for (const item of [...source.packs, ...source.campaigns]) item.revision = source.revision;
  return structuredClone(compileContentProject(source).source);
}
