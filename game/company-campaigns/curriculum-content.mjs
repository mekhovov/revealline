import { createStarterProject } from '../content-design/starter.mjs';
import {
  TRAIL_IMPACT_JOURNEY_POLICY,
  CURRENT_PRESSURE_ACTOR_CATALOG,
  PRESSURE_DIFFICULTY_CATALOG,
} from '../content-design/catalogs.mjs';
import { DISCOVERY_PACING_BEATS } from '../content-design/discovery-schema.mjs';
import { required } from '../data-json.mjs';
import { selectCurrentCompanyArtwork } from './artwork.mjs';
import { CURRICULUM_CAMPAIGNS, CURRICULUM_MISSIONS } from './curriculum.mjs';
import { COMMUNITY_LAYOUTS } from './curriculum-community-layouts.mjs';
import { authorCompanyProgression } from './progression.mjs';

// Authored geometry, not image tracing. Each tuple is walls, safe foundations,
// slow terrain, top-edge opening. No six-map template is reused across brands.
const layouts = {
  ...COMMUNITY_LAYOUTS,
  'social-drone-people-workshop': [
    [[], [[25, 13, 17, 5]], [], 31],
    [
      [[37, 9, 2, 14]],
      [
        [15, 10, 10, 4],
        [43, 23, 13, 4],
      ],
      [],
      20,
    ],
    [
      [
        [18, 8, 15, 2],
        [44, 22, 14, 2],
      ],
      [
        [12, 22, 9, 4],
        [33, 15, 11, 4],
      ],
      [],
      37,
    ],
    [
      [[49, 11, 2, 14]],
      [
        [22, 15, 21, 5],
        [54, 7, 8, 4],
      ],
      [],
      32,
    ],
    [
      [
        [16, 9, 2, 10],
        [48, 21, 3, 8],
      ],
      [
        [27, 9, 10, 4],
        [32, 24, 11, 4],
        [8, 23, 7, 4],
      ],
      [[25, 17, 21, 3]],
      31,
    ],
    [
      [
        [18, 14, 10, 2],
        [47, 20, 12, 2],
      ],
      [
        [31, 12, 10, 9],
        [11, 25, 10, 4],
        [50, 6, 9, 4],
      ],
      [],
      35,
    ],
  ],
  'victory-drones-knowledge-connects': [
    [
      [],
      [
        [25, 9, 6, 5],
        [24, 19, 11, 5],
      ],
      [],
      28,
    ],
    [
      [
        [33, 8, 3, 8],
        [33, 24, 3, 5],
      ],
      [
        [13, 16, 11, 4],
        [45, 13, 12, 4],
      ],
      [],
      18,
    ],
    [
      [[26, 11, 2, 13]],
      [
        [12, 10, 8, 5],
        [37, 20, 9, 4],
        [53, 9, 8, 4],
      ],
      [],
      16,
    ],
    [
      [
        [14, 9, 12, 2],
        [48, 26, 12, 2],
      ],
      [[27, 14, 20, 7]],
      [],
      36,
    ],
    [
      [
        [20, 12, 2, 10],
        [49, 10, 2, 10],
      ],
      [
        [30, 8, 11, 4],
        [14, 26, 12, 3],
        [43, 24, 13, 4],
      ],
      [[28, 16, 16, 3]],
      35,
    ],
    [
      [
        [15, 14, 12, 2],
        [48, 14, 10, 2],
      ],
      [
        [31, 9, 10, 5],
        [32, 22, 10, 5],
        [10, 24, 9, 4],
      ],
      [],
      35,
    ],
  ],
  'ukraine-threads': [
    [[], [[28, 11, 13, 7]], [], 34],
    [
      [
        [15, 10, 15, 2],
        [43, 23, 16, 2],
      ],
      [
        [31, 15, 9, 4],
        [11, 23, 9, 4],
        [48, 10, 8, 4],
      ],
      [],
      35,
    ],
    [
      [
        [21, 10, 2, 16],
        [47, 10, 2, 16],
      ],
      [
        [28, 8, 12, 4],
        [31, 17, 7, 4],
        [28, 26, 12, 3],
      ],
      [],
      34,
    ],
    [
      [[33, 8, 3, 8]],
      [
        [12, 18, 15, 6],
        [44, 17, 15, 6],
        [30, 25, 11, 4],
      ],
      [],
      19,
    ],
    [
      [
        [24, 8, 2, 11],
        [46, 18, 2, 11],
      ],
      [
        [32, 7, 8, 8],
        [32, 22, 8, 8],
        [12, 22, 7, 4],
      ],
      [[28, 17, 16, 3]],
      35,
    ],
    [
      [
        [17, 8, 11, 2],
        [45, 26, 12, 2],
      ],
      [
        [29, 13, 13, 8],
        [10, 24, 9, 3],
        [49, 8, 9, 4],
        [53, 19, 7, 3],
      ],
      [],
      35,
    ],
  ],
  'fpv-meet-aircraft': [
    [[], [[26, 12, 16, 6]], [], 33],
    [
      [[34, 15, 3, 5]],
      [
        [14, 9, 10, 4],
        [46, 9, 10, 4],
        [14, 23, 10, 4],
        [46, 23, 10, 4],
      ],
      [],
      18,
    ],
    [
      [
        [19, 9, 14, 2],
        [41, 24, 14, 2],
      ],
      [
        [12, 21, 10, 4],
        [45, 12, 11, 4],
      ],
      [],
      16,
    ],
    [
      [
        [20, 12, 2, 13],
        [50, 12, 2, 13],
      ],
      [
        [27, 9, 17, 4],
        [31, 20, 9, 5],
      ],
      [],
      35,
    ],
    [
      [
        [34, 8, 3, 7],
        [34, 24, 3, 5],
      ],
      [
        [14, 14, 12, 5],
        [46, 14, 12, 5],
        [31, 18, 9, 3],
      ],
      [[28, 10, 3, 5]],
      19,
    ],
    [
      [
        [16, 13, 9, 2],
        [48, 22, 11, 2],
      ],
      [
        [29, 11, 13, 10],
        [9, 24, 10, 4],
        [50, 7, 9, 4],
      ],
      [],
      35,
    ],
  ],
};
const rectangle = ([x, y, w, h]) => ({ x, y, w, h });
const inside = (x, y, rectangles) =>
  rectangles.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
function fieldPoint(map, desired) {
  for (let distance = 0; distance < 72; distance++)
    for (let y = 1; y < 35; y++)
      for (let x = 1; x < 71; x++)
        if (
          Math.abs(x - desired[0]) + Math.abs(y - desired[1]) === distance &&
          !inside(x, y, map.walls) &&
          !inside(x, y, map.foundations)
        )
          return { x: x + 0.5, y: y + 0.5 };
  throw new Error('Curriculum map has no field placement.');
}

/** Same pressure policy, actors, difficulty and tuning as the canonical engine.
 * With artwork=false this is a geometry-only authoring/route-proof projection.
 * Publishing admits only exact supplied picture records; one clearly labelled
 * home scene may support several missions until distinct compositions arrive. */
export function createCurriculumProject({ campaignId, brandId, artwork = false } = {}) {
  const definition = CURRICULUM_CAMPAIGNS.find(
    (entry) => entry.id === campaignId && (!brandId || brandId === entry.brandId),
  );
  required(definition, 'Choose a declared curriculum campaign.');
  required(
    artwork === false || Array.isArray(artwork),
    'Supply explicit curriculum artwork revisions.',
  );
  const project = createStarterProject(campaignId);
  Object.assign(project, {
    revision: definition.revision,
    name: definition.name,
    policyId: TRAIL_IMPACT_JOURNEY_POLICY.id,
    actorCatalogId: CURRENT_PRESSURE_ACTOR_CATALOG.id,
    difficultyCatalogId: PRESSURE_DIFFICULTY_CATALOG.id,
    maps: [],
    assets: [],
  });
  const available = artwork === false ? [] : selectCurrentCompanyArtwork(artwork);
  project.missions = CURRICULUM_MISSIONS.filter((entry) => entry.campaignId === campaignId).map(
    (entry) => {
      const [walls, foundations, terrain, spawn] = layouts[campaignId][entry.ordinal - 1];
      const map = {
        format: 'MapDesignV1',
        id: `${entry.id}-map`,
        revision: '1',
        name: entry.name,
        width: 72,
        height: 36,
        walls: walls.map(rectangle),
        foundations: foundations.map(rectangle),
        terrain: terrain.map((value, index) => ({
          id: `slow-${index + 1}`,
          kind: 'slow',
          ...rectangle(value),
        })),
        spawns: [{ id: 'home', x: spawn + 0.5, y: 0.5 }],
      };
      project.maps.push(map);
      const picture =
        available.find((asset) => asset.id === `${entry.id}-picture`) ??
        available.find((asset) => asset.id === `${entry.brandId}-home-picture`);
      if (artwork !== false) required(picture, `Missing admitted curriculum artwork: ${entry.id}.`);
      if (picture && !project.assets.some((asset) => asset.id === picture.id))
        project.assets.push(structuredClone(picture));
      const late = entry.ordinal >= 4;
      const actors = [
        {
          id: 'field-gap',
          role: 'field-keeper',
          tier: 'measured',
          ...fieldPoint(map, [61, 28]),
          heading: [-1, -1],
        },
      ];
      if ([3, 6].includes(entry.ordinal))
        actors.push({
          id: 'second-gap',
          role: 'field-keeper',
          tier: 'measured',
          ...fieldPoint(map, [12, 27]),
          heading: [1, -1],
        });
      if (late)
        actors.push({
          id: 'outer-interference',
          role: 'perimeter-patrol',
          tier: 'measured',
          x: 71.5,
          y: 18.5,
          clockwise: true,
        });
      const template = createStarterProject().missions[0];
      const mission = {
        ...template,
        id: entry.id,
        revision: '1',
        name: entry.name,
        map: { id: map.id, revision: map.revision },
        modes: ['solo'],
        actors,
        objectives: [
          {
            id: 'discovery',
            ...fieldPoint(map, [13 + entry.ordinal, 8]),
            required: true,
            hidden: false,
          },
        ],
        coverage: [0.48, 0.53, 0.56, 0.5, 0.6, 0.64][entry.ordinal - 1],
        bonuses: late
          ? [
              {
                id: 'steady-return',
                kind: 'extra-life',
                x: map.foundations[0].x + 0.5,
                y: map.foundations[0].y + 0.5,
              },
            ]
          : [],
        presentation: { themeId: `${campaignId}-theme`, backgroundAssetId: picture?.id ?? null },
        design: {
          ...template.design,
          routeDecision: entry.routeDecision,
          lesson: entry.brief,
          counterplay: late
            ? 'Watch both the field drifter and perimeter patrol; use interior returns to shorten an exposed cut.'
            : 'Read the field drifter before leaving safety and return to an interior island when a broad cut becomes risky.',
          captureConsequence:
            'A completed cut reveals the picture and connects the discovery point. It never certifies real skills or changes real equipment.',
          introduces:
            entry.ordinal === 1 ? ['foundations'] : entry.ordinal === 4 ? ['perimeter-patrol'] : [],
          practices: ['closure', 'enemy-seeded-closure'],
          combines: late ? ['foundations', 'perimeter-patrol'] : [],
          memorableMoment: entry.scene,
          mastery:
            'Connect the discovery and finish without losing a life; the untimed explanation remains separate from arcade score.',
          durationSeconds: entry.ordinal <= 4 ? [60, 180] : [180, 360],
          difficulty: {
            band: late ? 2 : 1,
            planning: late ? 2 : 1,
            execution: late ? 2 : 1,
            threatDensity: actors.length,
            timePressure: 0,
            mechanicLoad: late ? 2 : 1,
            coordination: 0,
          },
          pacingBeat: DISCOVERY_PACING_BEATS[entry.ordinal - 1],
          rewardRef: { id: `${entry.id}-discovery`, revision: '1' },
        },
      };
      return definition.progression
        ? authorCompanyProgression(mission, map, definition.progression, entry.ordinal)
        : mission;
    },
  );
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: campaignId,
      revision: definition.revision,
      name: definition.name,
      band: definition.progression?.band ?? 1,
      missionIds: [...definition.missionIds],
      discovery: {
        exhibitLayout: definition.exhibitLayout,
        finaleRewardRef: { id: `${campaignId}-finale`, revision: '1' },
      },
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: `${campaignId}-pack`,
      revision: definition.revision,
      name: definition.name,
      campaignIds: [campaignId],
    },
  ];
  return project;
}
