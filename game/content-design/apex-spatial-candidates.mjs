import { createApexCandidates } from './apex-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });

/** Explicit finale approach study; historical Apex/whole-Journey editions stay
 * unchanged. Walls never close cuts, and the Sentinel remains the sole seed. */
export function createApexSpatialCandidates({ artwork = false } = {}) {
  const source = withPressureDifficulty(createApexCandidates({ artwork }));
  source.id = artwork ? 'apex-spatial-original-review' : 'apex-spatial-greybox-review';
  source.name = 'Apex Aurora · Home Signal approach study';
  source.revision = 'home-approach-1';
  const mission = source.missions.find((item) => item.id === 'home-signal');
  const map = source.maps.find((item) => item.id === mission.map.id);
  map.revision = mission.revision = mission.map.revision = source.revision;
  map.foundations = [
    rect(10, 14, 10, 8),
    rect(8, 5, 8, 4),
    rect(18, 9, 8, 4),
    rect(8, 27, 8, 4),
    rect(18, 23, 8, 4),
    rect(32, 19, 5, 5),
    rect(59, 4, 7, 4),
    rect(32, 28, 8, 3),
    rect(61, 28, 6, 4),
  ];
  map.spawns = [{ id: 'home', x: 15.5, y: 17.5 }];
  map.gates = [{ id: 'home-dock', ...rect(20, 20, 12, 2) }];
  map.walls = [
    rect(28, 9, 3, 11),
    rect(28, 22, 3, 5),
    rect(37, 7, 14, 2),
    rect(64, 11, 2, 13),
    rect(44, 26, 12, 2),
  ];
  for (const [id, x, y] of [
    ['west-shield', 33.5, 12.5],
    ['east-shield', 62.5, 17.5],
    ['south-shield', 50.5, 29.5],
  ])
    Object.assign(
      mission.objectives.find((item) => item.id === id),
      { x, y },
    );
  mission.actors.find((item) => item.id === 'frontier').edge = { x: 9, y: 18, side: 'east' };
  Object.assign(
    mission.actors.find((item) => item.id === 'roamer'),
    { x: 42.5, y: 22.5 },
  );
  Object.assign(mission.design, {
    routeDecision:
      'Establish the northern approach to the near shield and open a transfer dock, or take the southern route around the baffles toward the far receivers?',
    lesson:
      'Invest in return ground around three open approaches. Shield captures keep the established sole-anchor rule; walls block movement but never secure a trail.',
    counterplay:
      'Leave turning room at each baffle end. Enclosing the lower return wakes its ground roamer after the normal warning; use the upper approach or the opened home dock instead of waiting on that return.',
    captureConsequence:
      'The near shield opens a permanent non-scoring transfer route. The other receivers remain subject to the same enemy-seeded enclosure rule, followed by the unchanged exposed-core opening.',
    memorableMoment:
      'A formerly blocked transfer dock becomes a homeward route between the two long receiver approaches.',
  });
  for (const item of [...source.packs, ...source.campaigns]) item.revision = source.revision;
  return structuredClone(compileContentProject(source).source);
}
