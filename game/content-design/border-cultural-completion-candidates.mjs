import {
  BORDER_CULTURAL_NEXT_BATCH_SOURCES,
  BORDER_CULTURAL_NEXT_BATCH_SELECTIONS,
} from './border-cultural-next-batch-candidates.mjs';
import { freezeDesign } from './catalogs.mjs';
import { createRoverCulturalCompletionCandidates } from './rover-cultural-completion-candidates.mjs';

export const BORDER_CULTURAL_COMPLETION_REVISION = 'border-cultural-routes-2';
export const BORDER_CULTURAL_COMPLETION_SOURCES = BORDER_CULTURAL_NEXT_BATCH_SOURCES;

export const BORDER_CULTURAL_COMPLETION_SELECTIONS = freezeDesign(
  BORDER_CULTURAL_NEXT_BATCH_SELECTIONS.map((selection) => ({
    ...selection,
    disposition: `${selection.disposition}-wall-field`,
  })),
);

const rect = (x, y, w, h) => ({ x, y, w, h });
const revisions = Object.freeze({
  'second-landing': {
    walls: [
      rect(5, 7, 7, 2),
      rect(21, 7, 8, 2),
      rect(42, 7, 8, 2),
      rect(59, 11, 8, 2),
      rect(10, 17, 6, 2),
      rect(32, 17, 8, 2),
      rect(44, 21, 2, 7),
      rect(59, 21, 2, 7),
    ],
    design: {
      lesson:
        'Known walls turn the Reshetylivka-informed openings into readable approach windows; the foundations remain the only valid returns.',
      counterplay:
        'Use the broad gap above the near aperture to wait out the patrol. The far wrap enters between two vertical bars only while the east keeper is moving away.',
      captureConsequence:
        'The near-aperture closure creates a compact return behind the upper bands; the far-window closure establishes a departure beyond the lower wall gate.',
      memorableMoment:
        'Alternating cutwork-like openings make the visually nearer landing and the mechanically safer landing disagree.',
      difficulty: {
        band: 2,
        planning: 3,
        execution: 3,
        threatDensity: 2,
        timePressure: 0,
        mechanicLoad: 3,
        coordination: 0,
      },
    },
  },
  'long-rail': {
    walls: [
      rect(11, 7, 8, 2),
      rect(17, 10, 2, 5),
      rect(53, 7, 10, 2),
      rect(53, 9, 2, 6),
      rect(7, 24, 11, 2),
      rect(17, 20, 2, 4),
      rect(54, 25, 11, 2),
      rect(53, 21, 2, 4),
    ],
    design: {
      lesson:
        'Petrykivka-informed separated branches become blocking wall masses around the permanent stem; optional bonuses remain detours, never gates.',
      counterplay:
        'The central stem remains the direct return. Commit to an outer branch only after reading both its keeper and the perimeter patrol through the open end.',
      captureConsequence:
        'A central closure preserves two large fields; an outer closure creates a farther return behind a branch wall and shortens the next exposed crossing.',
      memorableMoment:
        'The unbroken central stem is calm, while the separated branch ends turn an optional bonus route into a deliberate pressure window.',
      difficulty: {
        band: 2,
        planning: 3,
        execution: 3,
        threatDensity: 2,
        timePressure: 0,
        mechanicLoad: 3,
        coordination: 0,
      },
    },
  },
  'new-frontier': {
    walls: [
      rect(10, 7, 10, 2),
      rect(10, 9, 2, 7),
      rect(48, 7, 10, 2),
      rect(56, 9, 2, 7),
      rect(12, 27, 10, 2),
      rect(20, 23, 2, 4),
      rect(50, 27, 10, 2),
      rect(50, 23, 2, 4),
    ],
    design: {
      lesson:
        'Bilateral Kosiv-ceramic-informed wall frames make the known frontier change easier to read without changing how its patrol is assigned.',
      counterplay:
        'Use the open centre to compare both keeper headings. The wall shoulders make an outside route longer, so commit only after the frontier passes the intended return.',
      captureConsequence:
        'The near closure keeps a compact contour between the inner frames; the far closure shifts the surviving route behind the opposite shoulder.',
      memorableMoment:
        'A closure makes the frontier visibly leave one framed side and take the other, while both approaches remain physically open.',
      difficulty: {
        band: 2,
        planning: 3,
        execution: 3,
        threatDensity: 2,
        timePressure: 0,
        mechanicLoad: 3,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v30. Only wall geometry and mission design notes
 * change; foundations, actors, objectives, bonuses, art and rules remain exact. */
export function createBorderCulturalCompletionCandidates({ artwork = false } = {}) {
  const before = createRoverCulturalCompletionCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-border-cultural-completion-original-review'
    : 'whole-border-cultural-completion-greybox-review';
  project.name = 'Whole Journey · Border Ukrainian cultural completion';
  project.revision = BORDER_CULTURAL_COMPLETION_REVISION;

  for (const selection of BORDER_CULTURAL_COMPLETION_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: BORDER_CULTURAL_COMPLETION_REVISION,
      walls: structuredClone(revision.walls),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: BORDER_CULTURAL_COMPLETION_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        introduces: mission.design.introduces,
        practices: [...new Set([...mission.design.practices, 'walls'])],
        combines: [...new Set([...mission.design.combines, 'walls'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = BORDER_CULTURAL_COMPLETION_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = BORDER_CULTURAL_COMPLETION_REVISION;
  return structuredClone(project);
}
