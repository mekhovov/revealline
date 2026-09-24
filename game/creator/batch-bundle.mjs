import { exactKeys, required } from '../data-json.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { assembleCreatorBatchPackage, assembleCreatorBatchProject } from './batch.mjs';
import { isPreparedCreatorBundle, prepareCreatorBundle } from './bundle.mjs';

/** Adapter seam for Studio review results. It selects only prepared runtime
 * derivatives referenced by the assembled project; retained source originals,
 * thumbnails and unrelated media never enter the portable bundle input. */
export function creatorBatchBundleInput(batch, settings) {
  required(settings && typeof settings === 'object', 'Review batch sharing information.');
  exactKeys(settings, ['themes', 'credits', 'plan', 'part'], 'batch bundle settings');
  const planned = settings.plan !== undefined || settings.part !== undefined;
  required(
    !planned || (settings.plan && Number.isInteger(settings.part)),
    'Choose both the reviewed split plan and one of its parts.',
  );
  const assembled = planned
    ? assembleCreatorBatchPackage(batch, settings.plan, settings.part)
    : assembleCreatorBatchProject(batch);
  const wanted = new Set(assembled.project.assets.map((asset) => asset.sha256));
  const found = new Map();
  for (const item of batch.items) {
    const runtime = item.image?.runtime;
    if (runtime && wanted.has(runtime.sha256) && !found.has(runtime.sha256))
      found.set(runtime.sha256, Object.freeze({ sha256: runtime.sha256, blob: runtime.blob }));
  }
  required(
    found.size === wanted.size && [...wanted].every((sha256) => found.has(sha256)),
    'Regenerate a missing runtime picture before preparing this package.',
  );
  return Object.freeze({
    content: Object.freeze({
      project: assembled.project,
      packId: assembled.packId,
      themes: settings.themes,
      provenance: assembled.provenance,
      credits: settings.credits,
    }),
    assets: Object.freeze([...wanted].sort().map((sha256) => found.get(sha256))),
    part: planned ? assembled.part : 1,
    parts: planned ? assembled.parts : 1,
  });
}

export async function prepareCreatorBatchBundle(batch, settings, options = {}) {
  const input = creatorBatchBundleInput(batch, settings);
  const prepared = await prepareCreatorBundle(input.content, input.assets, options);
  return Object.freeze({ ...input, prepared });
}

/** Assemble the exact one-mission preparations displayed by the batch review
 * controller. Revalidation happens on the combined graph, while the source
 * result retains only selected runtime derivatives and their private originals. */
export async function prepareReviewedCreatorBundle(reviewed, settings, options = {}) {
  required(
    Array.isArray(reviewed) && reviewed.length >= 1 && reviewed.length <= 50,
    'Review 1 to 50 prepared pictures.',
  );
  required(settings && typeof settings === 'object', 'Review batch settings.');
  exactKeys(
    settings,
    ['draftId', 'collectionName', 'creatorCredit', 'pictureCredit', 'license'],
    'reviewed batch settings',
  );
  const projects = [];
  const provenances = [];
  const themes = new Map();
  const payloads = new Map();
  const sourceAssets = new Map();
  const originalSha256 = [];
  for (const entry of reviewed) {
    const pack = entry?.result?.prepared;
    const image = entry?.result?.image;
    required(
      isPreparedCreatorBundle(pack) && image?.runtime?.sha256,
      'Regenerate every included picture before approving the campaign.',
    );
    const packContent = pack.manifest.content;
    required(
      packContent.project.missions.length === 1 && !Array.isArray(packContent.provenance),
      'Each review card must own one prepared mission.',
    );
    projects.push(packContent.project);
    provenances.push(packContent.provenance);
    for (const theme of packContent.themes) themes.set(theme.id, theme);
    for (const asset of pack.assets) {
      payloads.set(asset.sha256, asset);
      sourceAssets.set(asset.sha256, asset);
    }
    if (image.original) {
      originalSha256.push(image.original.sha256);
      sourceAssets.set(image.original.sha256, image.original);
    }
  }
  const project = structuredClone(projects[0]);
  project.id = settings.draftId;
  project.name = settings.collectionName;
  project.maps = projects.flatMap((source) => structuredClone(source.maps));
  project.missions = projects.flatMap((source) => structuredClone(source.missions));
  project.assets = projects.flatMap((source) => structuredClone(source.assets));
  required(
    new Set(project.maps.map(({ id }) => id)).size === project.maps.length &&
      new Set(project.missions.map(({ id }) => id)).size === project.missions.length &&
      new Set(project.assets.map(({ id }) => id)).size === project.assets.length,
    'Regenerate the campaign because two review cards share an identity.',
  );
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'pictures',
      revision: '1',
      name: settings.collectionName,
      band: 1,
      missionIds: project.missions.map(({ id }) => id),
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'collection',
      revision: '1',
      name: settings.collectionName,
      campaignIds: ['pictures'],
    },
  ];
  const content = {
    project: compileContentProject(project).source,
    packId: 'collection',
    themes: [...themes.values()],
    provenance: provenances.length === 1 ? provenances[0] : provenances,
    credits: {
      creator: settings.creatorCredit,
      picture: settings.pictureCredit,
      license: settings.license,
    },
  };
  const prepared = await prepareCreatorBundle(content, [...payloads.values()], options);
  return Object.freeze({
    prepared,
    content,
    sourceAssets: Object.freeze([...sourceAssets.values()]),
    originalSha256: Object.freeze(originalSha256),
  });
}
