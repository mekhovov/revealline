import { freezeDesign } from './catalogs.mjs';
import { JOURNEY_ROVER_SPATIAL_PAIR_REVISIONS } from './journey-rover-spatial-pair.mjs';
import { createNeonCulturalCompletionCandidates } from './neon-cultural-completion-candidates.mjs';

export const ROVER_CULTURAL_COMPLETION_REVISION = 'rover-cultural-routes-2';

export const ROVER_CULTURAL_COMPLETION_SOURCES = freezeDesign({
  museumGerdan: {
    title: 'Gerdan, 1930s',
    institution: 'Museum Fund of Ukraine',
    url: 'https://museum.mincult.gov.ua/collections/39754',
    observedVocabulary: [
      'diagonal lattice',
      'alternating rhombi',
      'X-shaped elements',
      'central symmetry',
    ],
    adaptationBoundary:
      'The route uses original stepped wall bands and return islands. No beadwork, object outline, colour, meaning, collection layout or source coordinates are copied.',
  },
  slobozhanshchynaEmbroidery: {
    title: 'Slobozhanshchyna embroidery survey',
    institution: 'Kharkiv Historical Museum',
    url: 'https://museum.kh.ua/academic/sumtsov-conference/1996/article.html?n=799',
    observedVocabulary: ['rhombi', 'squares', 'crosses', 'rosettes', 'zigzags'],
    adaptationBoundary:
      'The route uses original broken bands and an offset stepped centre. No textile, regional pattern, ritual interpretation, palette or source coordinates are copied.',
  },
});

export const ROVER_CULTURAL_COMPLETION_SELECTIONS = freezeDesign([
  {
    id: 'split-berths',
    disposition: 'fpv-workbench-berths',
    sourceIds: ['museumGerdan'],
    approaches: ['workbench-first', 'battery-berth-first'],
    pressurePoints: ['central-pad', 'west-bracket', 'east-bracket', 'cable-tray'],
  },
  {
    id: 'stepped-return',
    disposition: 'gerdan-lattice-return',
    sourceIds: ['museumGerdan', 'slobozhanshchynaEmbroidery'],
    approaches: ['diamond-first', 'lattice-opening-first'],
    pressurePoints: ['upper-point', 'central-diamond', 'west-opening', 'east-opening'],
  },
]);

/** Copy-on-write successor to v29. It adopts the already-reviewed Rover spatial
 * blueprints while preserving the current pressure actors, objectives, art and rules. */
export function createRoverCulturalCompletionCandidates({ artwork = false } = {}) {
  const before = createNeonCulturalCompletionCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-rover-cultural-completion-original-review'
    : 'whole-rover-cultural-completion-greybox-review';
  project.name = 'Whole Journey · Rover Ukrainian and FPV spatial completion';
  project.revision = ROVER_CULTURAL_COMPLETION_REVISION;

  for (const selection of ROVER_CULTURAL_COMPLETION_SELECTIONS) {
    const blueprint = JOURNEY_ROVER_SPATIAL_PAIR_REVISIONS[selection.id];
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: ROVER_CULTURAL_COMPLETION_REVISION,
      walls: structuredClone(blueprint.walls),
      foundations: structuredClone(blueprint.foundations),
      terrain: structuredClone(blueprint.terrain),
      spawns: [structuredClone(blueprint.spawn)],
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: ROVER_CULTURAL_COMPLETION_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...structuredClone(blueprint.design),
        introduces: mission.design.introduces,
        practices: [...new Set([...mission.design.practices, 'walls', 'slow-field'])],
        combines: [...new Set([...mission.design.combines, 'walls', 'slow-field'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) =>
        campaign.missionIds.some((id) => JOURNEY_ROVER_SPATIAL_PAIR_REVISIONS[id]),
      )
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = ROVER_CULTURAL_COMPLETION_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = ROVER_CULTURAL_COMPLETION_REVISION;
  return structuredClone(project);
}
