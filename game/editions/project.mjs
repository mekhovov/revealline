import { required } from '../data-json.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { validateCompanyLessons } from '../company-campaigns/learning.mjs';

/** Exact player campaign projection: invisible missions, archived maps and
 * unreferenced media are source material, not runtime dependencies. */
export function validateEditionCampaignProject(source, descriptor) {
  const project = compileContentProject(source),
    value = project.source;
  required(
    value.campaigns.length === 1 &&
      value.campaigns[0].id === descriptor.id &&
      value.campaigns[0].revision === descriptor.revision,
    'Campaign source differs from its selected identity.',
  );
  const missionIds = new Set(value.campaigns[0].missionIds);
  required(
    value.missions.length === missionIds.size &&
      value.missions.every((mission) => missionIds.has(mission.id)),
    'Campaign source contains omitted missions.',
  );
  const mapIds = new Set(
    value.missions.map((mission) => `${mission.map.id}@${mission.map.revision}`),
  );
  required(
    value.maps.length === mapIds.size &&
      value.maps.every((map) => mapIds.has(`${map.id}@${map.revision}`)),
    'Campaign source contains unused map history.',
  );
  const assetIds = new Set(
    value.missions.map((mission) => mission.presentation.backgroundAssetId).filter(Boolean),
  );
  required(
    (value.assets ?? []).length === assetIds.size &&
      (value.assets ?? []).every((asset) => assetIds.has(asset.id)),
    'Campaign source contains unused artwork.',
  );
  required(
    value.packs.length > 0 &&
      value.packs.every(
        (pack) => pack.campaignIds.length === 1 && pack.campaignIds[0] === descriptor.id,
      ),
    'Campaign source contains omitted pack content.',
  );
  return project;
}

export function validateEditionLessonBundle(lessons, project) {
  lessons = validateCompanyLessons(lessons);
  const missionIds = new Set(project.missions.map((mission) => mission.id));
  required(
    Array.isArray(lessons) &&
      lessons.length <= 512 &&
      lessons.every(
        (lesson) =>
          lesson &&
          typeof lesson === 'object' &&
          missionIds.has(lesson.missionId) &&
          project.campaigns.some((campaign) => campaign.id === lesson.campaignId),
      ),
    'Lesson bundle contains omitted missions.',
  );
  required(
    new Set(lessons.map((lesson) => lesson.id)).size === lessons.length,
    'Lesson bundle contains conflicting identities.',
  );
  return lessons;
}
