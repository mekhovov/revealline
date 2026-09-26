import { dataIdentity, required, stableId } from '../data-json.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { prepareCreatorBundle } from './bundle.mjs';
import { creatorMediaBundleInputByHash } from './media-bundle.mjs';
import { generateCreatorProject } from './templates.mjs';

const hashValid = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const uint32 = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const title = (name) => (name.replace(/\.[^.]+$/u, '').trim() || 'Creator media').slice(0, 160);
const generationSeed = (rootSeed, kind, sha256, index) =>
  Number(BigInt(`0x${dataIdentity({ rootSeed, kind, sha256, index })}`) & 0xffffffffn);

function validateSettings(settings) {
  required(
    settings && Object.getPrototypeOf(settings) === Object.prototype,
    'Review campaign settings.',
  );
  const keys = Object.keys(settings).sort();
  required(
    JSON.stringify(keys) ===
      JSON.stringify(['collectionName', 'credits', 'draftId', 'seed', 'themes']),
    'Media campaign settings contain unsupported fields.',
  );
  required(
    stableId(settings.draftId) && text(settings.collectionName, 160) && uint32(settings.seed),
    'Choose a media campaign identity, name and unsigned generation seed.',
  );
  required(Array.isArray(settings.themes), 'Provide the selected presentation themes.');
  required(
    settings.credits &&
      Object.getPrototypeOf(settings.credits) === Object.prototype &&
      ['creator', 'picture', 'license'].every((key) => text(settings.credits[key], 512)) &&
      Object.keys(settings.credits).length === 3,
    'Review creator, picture credit and sharing permission.',
  );
  return settings;
}

function mediaUnits(intake) {
  required(
    intake?.format === 'revealline-creator-media-intake.v1' &&
      Array.isArray(intake.items) &&
      Array.isArray(intake.assets) &&
      intake.items.length > 0 &&
      intake.items.length <= 100 &&
      intake.items.every((item) => Array.isArray(item.errors) && item.errors.length === 0),
    'Inspect and resolve every selected media item before generating its campaign.',
  );
  const storyByVideo = new Map(
    (intake.dependencies?.stories ?? []).map((story) => [story.video.sha256, story]),
  );
  const imageBySourceHash = new Map(
    intake.items
      .filter((item) => item.kind === 'image' && hashValid(item.assetSha256))
      .map((item) => [item.assetSha256, item]),
  );
  const pairedImages = new Set(
    [...storyByVideo.values()]
      .filter((story) => story.poster.origin.kind === 'supplied-image')
      .map((story) => story.poster.origin.sourceImageSha256),
  );
  for (const story of storyByVideo.values()) {
    if (story.poster.origin.kind !== 'supplied-image') continue;
    const image = imageBySourceHash.get(story.poster.origin.sourceImageSha256);
    required(
      image?.poster?.sha256 === story.poster.sha256,
      'A paired video poster differs from its exact reviewed image.',
    );
  }
  const units = [];
  for (const item of intake.items) {
    required(hashValid(item.assetSha256), 'A reviewed media item is missing its exact identity.');
    if (item.kind === 'image') {
      if (pairedImages.has(item.assetSha256)) continue;
      required(
        item.poster?.sha256 &&
          hashValid(item.poster.sha256) &&
          item.poster.origin?.kind === 'supplied-image' &&
          item.poster.origin.sourceImageSha256 === item.assetSha256,
        'A standalone image is missing its prepared poster descriptor.',
      );
      units.push({ kind: 'image', item, poster: item.poster, story: null });
    } else {
      const story = storyByVideo.get(item.assetSha256);
      required(story, 'A reviewed video is missing its exact story dependency.');
      units.push({ kind: 'video', item, poster: story.poster, story });
    }
  }
  required(units.length >= 1 && units.length <= 50, 'A campaign needs 1 to 50 generated missions.');
  return units;
}

/** Private editing state for a reviewed mixed-media campaign. This record is
 * deliberately separate from the portable content manifest: it retains the
 * selected source identities and names needed to explain/reopen pairing,
 * poster and playback choices without exposing those originals in .rlpack. */
export function creatorMediaSourceEditing(intake) {
  const units = mediaUnits(intake),
    included = new Set(units.map(({ item }) => item.assetSha256));
  for (const unit of units) {
    if (unit.story?.poster.origin.kind === 'supplied-image')
      included.add(unit.story.poster.origin.sourceImageSha256);
  }
  const assets = new Map(intake.assets.map((asset) => [asset.sha256, asset]));
  const items = intake.items
    .filter((item) => included.has(item.assetSha256))
    .map((item) => {
      const selected = assets.get(item.assetSha256);
      required(selected?.blob instanceof Blob, 'Private media source bytes are missing.');
      if (item.kind === 'image') {
        required(item.poster?.sha256, 'Private picture editing state is missing its poster.');
        return {
          name: item.name,
          kind: 'image',
          source: {
            sha256: item.assetSha256,
            bytes: selected.blob.size,
            mime: selected.blob.type,
          },
          posterSha256: item.poster.sha256,
        };
      }
      const detail = item.video;
      required(detail?.video?.sha256 === item.assetSha256, 'Private video editing state changed.');
      const candidate = detail.posterCandidates.find(
        (entry) => entry.sha256 === detail.selectedPosterSha256,
      );
      return {
        name: item.name,
        kind: 'video',
        source: {
          sha256: detail.video.sha256,
          bytes: detail.video.bytes,
          mime: detail.video.mime,
        },
        posterSha256: detail.selectedPosterSha256,
        pairedImageSha256: detail.selectedPairingAssetSha256,
        posterRequestedTime: candidate?.capture.requestedTime ?? null,
        playbackRange: detail.playbackRange,
      };
    });
  return Object.freeze({
    format: 'revealline-creator-media-editing.v1',
    items: Object.freeze(items.map((item) => Object.freeze(item))),
  });
}

/** Build the exact project and dependency closure reviewed by the mixed-media
 * surface. Every mission is generated by the shared verified template registry. */
export function creatorMediaCampaignInput(intake, sourceSettings) {
  const settings = validateSettings(sourceSettings),
    units = mediaUnits(intake),
    projects = [],
    provenances = [],
    bindings = [],
    wantedAssets = new Set();
  for (const [index, unit] of units.entries()) {
    const seed = generationSeed(settings.seed, unit.kind, unit.item.assetSha256, index);
    const missionId = `media-${index + 1}-${unit.item.assetSha256.slice(0, 12)}`;
    const generated = generateCreatorProject({
      id: missionId,
      name: settings.collectionName,
      seed,
    });
    const project = structuredClone(generated.project),
      mapId = `${missionId}-map`,
      assetId = `${missionId}-poster`;
    project.maps[0].id = mapId;
    project.missions[0].id = missionId;
    project.missions[0].name = title(unit.item.name);
    project.missions[0].map.id = mapId;
    project.campaigns[0].missionIds = [missionId];
    project.assets = [
      {
        format: 'AssetRevisionV1',
        id: assetId,
        revision: '1',
        kind: 'reveal-background',
        path: `content-design/assets/creator/${unit.poster.sha256}.png`,
        sha256: unit.poster.sha256,
        bytes: unit.poster.bytes,
        width: unit.poster.width,
        height: unit.poster.height,
        alt: `${title(unit.item.name)} reveal poster`,
        review: 'candidate',
      },
    ];
    project.missions[0].presentation.backgroundAssetId = assetId;
    projects.push(project);
    provenances.push({ ...generated.provenance, missionId });
    wantedAssets.add(unit.poster.sha256);
    if (unit.story) bindings.push({ videoSha256: unit.story.video.sha256, missionId });
  }

  const project = structuredClone(projects[0]);
  project.id = settings.draftId;
  project.name = settings.collectionName;
  project.maps = projects.flatMap((entry) => structuredClone(entry.maps));
  project.missions = projects.flatMap((entry) => structuredClone(entry.missions));
  project.assets = projects.flatMap((entry) => structuredClone(entry.assets));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'pictures',
      revision: '1',
      name: settings.collectionName,
      band: 1,
      missionIds: project.missions.map((mission) => mission.id),
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
  const storyInput = bindings.length
    ? creatorMediaBundleInputByHash(intake, bindings, {
        descriptionFor: ({ missionId }) =>
          `${project.missions.find((mission) => mission.id === missionId)?.name ?? 'Creator level'} victory celebration.`,
      })
    : null;
  for (const asset of storyInput?.assets ?? []) wantedAssets.add(asset.sha256);
  const byHash = new Map(intake.assets.map((asset) => [asset.sha256, asset]));
  const assets = [...wantedAssets].sort().map((sha256) => {
    const asset = byHash.get(sha256);
    required(asset?.blob instanceof Blob, 'Reviewed campaign media is missing its exact bytes.');
    return Object.freeze({ sha256, blob: asset.blob });
  });
  const content = {
    project: compileContentProject(project).source,
    packId: 'collection',
    themes: settings.themes,
    provenance: provenances.length === 1 ? provenances[0] : provenances,
    credits: settings.credits,
    ...(storyInput ? { media: storyInput.media } : {}),
  };
  return Object.freeze({
    content: Object.freeze(content),
    assets: Object.freeze(assets),
    bindings: Object.freeze(bindings.map((binding) => Object.freeze(binding))),
  });
}

export async function prepareCreatorMediaCampaign(intake, settings, options = {}) {
  const input = creatorMediaCampaignInput(intake, settings);
  const prepared = await prepareCreatorBundle(input.content, input.assets, options);
  const sourceEditing = creatorMediaSourceEditing(intake),
    sourceHashes = new Set([
      ...input.assets.map((asset) => asset.sha256),
      ...sourceEditing.items.map((item) => item.source.sha256),
    ]),
    sourceAssets = intake.assets
      .filter((asset) => sourceHashes.has(asset.sha256))
      .map((asset) =>
        Object.freeze({
          sha256: asset.sha256,
          blob: asset.blob,
          role: asset.role,
        }),
      );
  required(
    new Set(sourceAssets.map((asset) => asset.sha256)).size === sourceHashes.size,
    'Private media source closure is incomplete.',
  );
  return Object.freeze({
    ...input,
    prepared,
    sourceAssets: Object.freeze(sourceAssets),
    sourceEditing,
  });
}
