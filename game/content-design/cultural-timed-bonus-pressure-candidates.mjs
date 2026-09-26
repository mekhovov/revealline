import { freezeDesign } from './catalogs.mjs';
import { createBorderFrontierPocketCandidates } from './border-frontier-pocket-candidates.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../core/timed-bonuses.mjs';

export const CULTURAL_TIMED_BONUS_PRESSURE_REVISION = 'cultural-timed-bonus-pressure-1';

export const CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS = freezeDesign([
  'two-ways-home',
  'read-the-lock',
  'returning-light',
]);

const schedules = freezeDesign({
  'two-ways-home': {
    id: 'two-ways-home-slow-window',
    kind: 'enemy-slow',
    anchors: [
      { x: 12.5, y: 18.5 },
      { x: 35.5, y: 24.5 },
      { x: 59.5, y: 18.5 },
    ],
    initialDelayTicks: 600,
    announcementTicks: 120,
    availableTicks: 960,
    cooldownTicks: 900,
    maxAppearances: 3,
    maxCollections: 1,
  },
  'read-the-lock': {
    id: 'read-the-lock-freeze-window',
    kind: 'enemy-freeze',
    anchors: [
      { x: 8.5, y: 20.5 },
      { x: 35.5, y: 22.5 },
      { x: 64.5, y: 20.5 },
    ],
    initialDelayTicks: 720,
    announcementTicks: 120,
    availableTicks: 840,
    cooldownTicks: 960,
    maxAppearances: 3,
    maxCollections: 1,
  },
  'returning-light': {
    id: 'returning-light-slow-window',
    kind: 'enemy-slow',
    anchors: [
      { x: 18.5, y: 8.5 },
      { x: 30.5, y: 19.5 },
      { x: 49.5, y: 28.5 },
    ],
    initialDelayTicks: 600,
    announcementTicks: 120,
    availableTicks: 960,
    cooldownTicks: 900,
    maxAppearances: 3,
    maxCollections: 1,
  },
});

const designNotes = freezeDesign({
  'two-ways-home': {
    counterplay:
      'West-first remains the short safe close and east-first remains the screened feint. A warned slow window relocates between the outer approaches and the central crossing, offering a tempting detour without changing the finite pursuit commitment.',
    memorableMoment:
      'A slow window lights on the abandoned side of the braid just as the pursuer commits to the old heading.',
  },
  'read-the-lock': {
    counterplay:
      'Central-first remains the short close and the lower landing remains the stronger return. A warned freeze window relocates across the three open corridors, but waiting for it can cost the next row-lock cycle.',
    memorableMoment:
      'The optional freeze window and the next lane warning overlap on different corridors, making the safe close and the ambitious detour visibly disagree.',
  },
  'returning-light': {
    counterplay:
      'The centre remains efficient during emitter recovery and the upper step remains the quieter first close. The former fixed slow pickup now warns, expires and relocates among three field approaches, so collecting it requires a deliberate exposed detour.',
    memorableMoment:
      'A missed slow window disappears beside one stepping return and later signals from another while the awakened roamer changes which detour is attractive.',
  },
});

/** Copy-on-write successor to v32. It adds optional, finite opportunity windows
 * to three established route problems. Geometry, actors, objectives, pictures,
 * rules and ordering remain exact; the former fixed Returning light pickup is
 * replaced by its timed edition rather than granted twice. */
export function createCulturalTimedBonusPressureCandidates({ artwork = false } = {}) {
  const before = createBorderFrontierPocketCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-cultural-timed-bonus-pressure-original-review'
    : 'whole-cultural-timed-bonus-pressure-greybox-review';
  project.name = 'Whole Journey · Cultural timed opportunity pressure';
  project.revision = CULTURAL_TIMED_BONUS_PRESSURE_REVISION;

  for (const id of CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS) {
    const mission = project.missions.find((item) => item.id === id);
    mission.revision = CULTURAL_TIMED_BONUS_PRESSURE_REVISION;
    mission.timedBonuses = {
      version: TIMED_BONUS_TRAIL_VERSION,
      schedules: [structuredClone(schedules[id])],
    };
    if (id === 'returning-light') mission.bonuses = [];
    mission.design = {
      ...mission.design,
      ...designNotes[id],
      practices: [...new Set([...mission.design.practices, 'timed-bonus-window'])],
      combines: [...new Set([...mission.design.combines, 'timed-bonus-window'])],
    };
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) =>
        campaign.missionIds.some((id) => CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS.includes(id)),
      )
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id))
      campaign.revision = CULTURAL_TIMED_BONUS_PRESSURE_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = CULTURAL_TIMED_BONUS_PRESSURE_REVISION;
  return structuredClone(project);
}
