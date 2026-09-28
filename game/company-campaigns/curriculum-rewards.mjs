import {
  createCurriculumListeningContent,
  CURRICULUM_LISTENING_ASSET_IDS,
} from './curriculum-listening.mjs';
import { createCurriculumMissionExplorations } from './curriculum-mission-explorations.mjs';
import {
  createCurriculumMotionMakersContent,
  CURRICULUM_MOTION_MAKERS_ASSET_IDS,
} from './curriculum-motion-makers.mjs';
import {
  createCurriculumTextileLighting,
  CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS,
} from './curriculum-textile-lighting.mjs';
import { createCurriculumApplicationRewards } from './curriculum-application-rewards.mjs';
import { CURRICULUM_LEARNING_PROFILES } from './curriculum-profiles.mjs';
import {
  CURRICULUM_REFERENCE_ASSETS,
  curriculumReferencePayloads,
} from './curriculum-reference-assets.mjs';
import { required } from '../data-json.mjs';
import { CURRICULUM_MISSIONS, CURRICULUM_SOURCES } from './curriculum.mjs';
import { curriculumPresentationRevision } from './curriculum-presentation-revisions.mjs';
import { createCurriculumAtlasPayloads } from './curriculum-atlases.mjs';
import { selectExactCompanyArtworkDescriptions } from './artwork.mjs';
const localized = (locales, select) =>
  Object.fromEntries(['en', 'uk'].map((locale) => [locale, select(locales[locale], locale)]));

/** Same reward and receipt authority as the rest of the game. */
export function createCurriculumRewards({
  definition,
  source,
  assets,
  assetSources = [],
  missionBindings,
  lessons = [],
}) {
  const presentationRevision = curriculumPresentationRevision(definition.id);
  const rows = definition.missionIds.map((id) =>
    CURRICULUM_MISSIONS.find((entry) => entry.id === id),
  );
  required(
    rows.length === 6 && rows.every(Boolean),
    'A curriculum finale requires six authored missions.',
  );
  const requirements = rows.map((row) => {
    const binding = missionBindings.find(
      (entry) => entry.levelId === row.id && entry.campaignId === definition.id,
    );
    required(binding, 'Missing exact discovery binding: ' + row.id);
    return { missionId: row.id, bindings: structuredClone(binding.bindings) };
  });
  const imageFor = (row) => {
    const mission = source.missions.find((entry) => entry.id === row.id);
    const picture = source.assets.find(
      (entry) => entry.id === mission?.presentation.backgroundAssetId,
    );
    const descriptor =
      picture &&
      assets.find(
        (entry) =>
          entry.path === 'game/' + picture.path &&
          entry.sha256 === picture.sha256 &&
          entry.bytes === picture.bytes,
      );
    required(descriptor, 'Discovery picture has no exact public inventory entry: ' + row.id);
    const descriptions = selectExactCompanyArtworkDescriptions(descriptor, assetSources);
    return {
      id: row.id + '-image',
      type: 'image',
      asset: { assetId: descriptor.id, sha256: descriptor.sha256 },
      locales: localized(row.locales, ({ title, alt }, locale) => ({
        title,
        alt:
          descriptions?.[locale] ??
          (picture.id === `${row.id}-picture`
            ? alt
            : locale === 'uk'
              ? `Оригінальна уявна сцена кампанії «${definition.locales.uk.title}», а не документальне зображення.`
              : `An original imaginary scene for ${definition.locales.en.title}, not a documentary image.`),
      })),
    };
  };
  const knowledge = (id, locales, refs) => ({
    id,
    type: 'knowledge',
    ...(CURRICULUM_LEARNING_PROFILES[id.replace(/-knowledge$/, '')]
      ? { profiles: CURRICULUM_LEARNING_PROFILES[id.replace(/-knowledge$/, '')] }
      : {}),
    locales: localized(locales, ({ title, paragraphs }) => ({
      title,
      paragraphs: [...paragraphs],
      sources: refs.map((ref) => ({ ...CURRICULUM_SOURCES[ref] })),
    })),
  });
  const keyAsset = assets.find((entry) => entry.id === `${definition.id}-key-v1`);
  required(keyAsset, 'Missing separate campaign preview: ' + definition.id);
  const previewDescriptions = selectExactCompanyArtworkDescriptions(keyAsset, assetSources);
  const teaserImage = {
    asset: { assetId: keyAsset.id, sha256: keyAsset.sha256 },
    locales: Object.fromEntries(
      ['en', 'uk'].map((locale) => [
        locale,
        {
          alt:
            previewDescriptions?.[locale] ??
            (locale === 'uk'
              ? `Ілюстрований анонс кампанії «${definition.locales.uk.title}».`
              : `Illustrated preview of ${definition.locales.en.title}.`),
        },
      ]),
    ),
  };
  const base = (id, scope, locales, missions, payloads) => ({
    format: 'revealline-completion-reward.v1',
    id,
    revision:
      scope.kind === 'mission'
        ? (presentationRevision.missionRewards[scope.id] ?? '1')
        : presentationRevision.finale,
    teaserImage,
    brandId: definition.brandId,
    campaignId: definition.id,
    scope,
    locales: localized(locales, ({ title, teaser }) => ({ title, teaser })),
    requirements: { missions, learning: [], mastery: [] },
    payloads,
  });
  const rewards = rows.map((row, index) =>
    base(
      row.id + '-discovery',
      { kind: 'mission', id: row.id },
      row.locales,
      [requirements[index]],
      [
        imageFor(row),
        knowledge(row.id + '-knowledge', row.locales, row.refs),
        ...curriculumReferencePayloads(row.id, assets),
        ...createCurriculumMissionExplorations(row.id, assets),
        ...createCurriculumTextileLighting(row.id, assets),
        ...createCurriculumMotionMakersContent(row.id, assets),
      ],
    ),
  );
  const listening = createCurriculumListeningContent(definition.id, assets);
  const finalePayloads = [
    knowledge(definition.id + '-guide', definition.locales, [definition.link]),
    ...createCurriculumAtlasPayloads(definition.id),
    ...rows.map(imageFor),
    {
      id: definition.id + '-official-source',
      type: 'url',
      url: CURRICULUM_SOURCES[definition.link].url,
      qr: true,
      locales: {
        en: { title: 'Explore the official source' },
        uk: { title: 'Відкрити офіційне джерело' },
      },
    },
  ];
  finalePayloads.push(...listening.payloads);
  for (const assetId of definition.rewardAssetIds) {
    const asset = assets.find((entry) => entry.id === assetId);
    required(asset?.sha256, 'Missing declared curriculum reward asset: ' + assetId);
    if (CURRICULUM_LISTENING_ASSET_IDS.includes(assetId)) continue;
    if (CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS.includes(assetId)) continue;
    if (CURRICULUM_MOTION_MAKERS_ASSET_IDS.includes(assetId)) continue;
    if (assetId === 'met-degas-ukrainian-dress-436157')
      finalePayloads.push(...museumComparison(definition.id, asset));
    else
      required(
        CURRICULUM_REFERENCE_ASSETS.some(
          (item) => item.id === assetId && definition.missionIds.includes(item.missionId),
        ),
        'Undeclared source comparison.',
      );
  }
  rewards.push(
    base(
      definition.id + '-finale',
      { kind: 'campaign', id: definition.id },
      definition.locales,
      requirements,
      finalePayloads,
    ),
  );
  if (listening.audioGroups.length) rewards[rewards.length - 1].audioGroups = listening.audioGroups;
  rewards.push(
    ...createCurriculumApplicationRewards({ definition, requirements, lessons, assets }),
  );
  return rewards;
}

function museumComparison(campaignId, asset) {
  const sources = [
    {
      title: 'The Metropolitan Museum of Art — object 436157',
      url: 'https://www.metmuseum.org/art/collection/search/436157',
    },
    { title: 'The Met — Open Access', url: 'https://www.metmuseum.org/hubs/open-access' },
  ];
  return [
    {
      id: campaignId + '-painting',
      type: 'image',
      asset: { assetId: asset.id, sha256: asset.sha256 },
      locales: {
        en: {
          title: 'Dancer in Ukrainian Dress — Edgar Degas',
          alt: 'An 1899 pastel of a dancer in Ukrainian dress by Edgar Degas, from The Metropolitan Museum of Art. An artist’s interpretation, not a garment catalogue photograph.',
        },
        uk: {
          title: 'Танцівниця в українському вбранні — Едгар Дега',
          alt: 'Пастель Едгара Дега 1899 року з танцівницею в українському вбранні, з Метрополітен-музею. Авторська інтерпретація, а не фото одягу для каталогу.',
        },
      },
    },
    {
      id: campaignId + '-compare-sources',
      type: 'knowledge',
      locales: {
        en: {
          title: 'An artwork and an object record',
          paragraphs: [
            'The Met identifies this pastel as Edgar Degas’s Dancer in Ukrainian Dress, dated 1899, accession 29.100.556. Its Open Access image is public domain.',
            'Compare the expressive movement with the specific garment records linked in your discoveries. A painting and a clothing record answer different questions. An artist’s interpretation is not a complete technical account of regional clothing.',
          ],
          sources,
        },
        uk: {
          title: 'Твір мистецтва й запис предмета',
          paragraphs: [
            'Метрополітен-музей визначає пастель як «Танцівниця в українському вбранні» Едгара Дега, 1899 року, обліковий номер 29.100.556. Зображення Open Access є суспільним надбанням.',
            'Порівняйте виразний рух із конкретними записами одягу у відкриттях. Картина й опис одягу відповідають на різні запитання. Авторська інтерпретація не є повним технічним описом регіонального вбрання.',
          ],
          sources,
        },
      },
    },
  ];
}
