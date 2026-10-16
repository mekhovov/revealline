import { required } from '../data-json.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { openVideoPosterSource } from '../video-poster.mjs';
import { ownRewardVideoFile, validateDiscoveryVideoInfo } from '../rewards/video-original.mjs';
import {
  inspectRewardMediaBytes,
  REWARD_MEDIA_LIMITS,
  validateRewardMediaAsset,
} from '../rewards/media-format.mjs';
import { editDiscoveryPayload } from './discovery.mjs';

const roles = Object.freeze({
  video: 'video',
  poster: 'poster',
  en: 'transcript',
  uk: 'transcript',
  enCaptions: 'captions',
  ukCaptions: 'captions',
});
const limit = (role) =>
  role === 'video'
    ? REWARD_MEDIA_LIMITS.sourceBytes
    : role === 'poster'
      ? REWARD_MEDIA_LIMITS.imageBytes
      : REWARD_MEDIA_LIMITS.textBytes;

/** Local file transfer does not approve rights. Only selected campaign originals
 * already admitted by the Company source inventory can become reward pins. */
export async function inspectDiscoveryVideoHandoff(
  context,
  files,
  { signal, openSource = openVideoPosterSource } = {},
) {
  signal?.throwIfAborted();
  const owned = Object.fromEntries(
    Object.entries(roles).map(([key, role]) => [
      key,
      ownRewardVideoFile(files[key], limit(role), role),
    ]),
  );
  required(
    Object.values(owned).reduce((sum, file) => sum + file.size, 0) <=
      REWARD_MEDIA_LIMITS.sourceBytes,
    'The six discovery originals exceed the 32 MiB edition asset limit.',
  );
  const result = { identity: context.identity, campaignId: context.campaign.id };
  for (const [key, role] of Object.entries(roles)) {
    const bytes = new Uint8Array(await owned[key].arrayBuffer()),
      sha256 = await hashPresentationBytes(bytes);
    signal?.throwIfAborted();
    const matches = context.assets.filter((asset) => {
      if (
        !context.campaign.assetIds.includes(asset.id) ||
        asset.sha256 !== sha256 ||
        asset.bytes !== bytes.length
      )
        return false;
      try {
        validateRewardMediaAsset(asset, role);
        return true;
      } catch {
        return false;
      }
    });
    required(
      matches.length,
      `The ${key} original is not admitted for this campaign. Complete source and rights review first.`,
    );
    let facts;
    for (const asset of matches) {
      context.admitted(asset);
      facts = inspectRewardMediaBytes(asset, role, bytes);
    }
    result[key] = { bytes, matches, facts };
  }
  let decoded;
  try {
    decoded = await openSource(owned.video, { signal });
    signal?.throwIfAborted();
    validateDiscoveryVideoInfo(decoded.info);
    required(
      decoded.info.sha256 === result.video.matches[0].sha256 &&
        decoded.info.bytes === result.video.bytes.length &&
        decoded.info.mime === result.video.facts.mime,
      'The decoded clip differs from its exact original.',
    );
    for (const key of ['enCaptions', 'ukCaptions'])
      required(
        result[key].facts.endSeconds <= decoded.info.durationSeconds + 0.05,
        'Captions extend beyond the actual clip duration.',
      );
  } finally {
    decoded?.dispose();
  }
  signal?.throwIfAborted();
  return result;
}

export function editDiscoveryVideoHandoff(
  source,
  rewards,
  rewardId,
  context,
  inspected,
  selection,
) {
  required(
    inspected.identity === context.identity && inspected.campaignId === context.campaign.id,
    'The edition source changed. Inspect these originals again.',
  );
  const reward = rewards.find((item) => item.id === rewardId);
  required(
    reward?.campaignId === context.campaign.id && reward.brandId === context.selection.brand.id,
    'Choose a reward owned by this selected campaign.',
  );
  const reference = (role) => {
    const asset = inspected[role].matches.find((item) => item.id === selection[role]);
    required(
      asset &&
        context.campaign.assetIds.includes(asset.id) &&
        context.assets.some((item) => item.id === asset.id && item.sha256 === asset.sha256),
      'Explicitly select the verified original for every clip role.',
    );
    context.admitted(asset);
    return { assetId: asset.id, sha256: asset.sha256 };
  };
  return editDiscoveryPayload(
    source,
    rewards,
    rewardId,
    {
      id: selection.payloadId,
      type: 'video',
      locales: selection.locales,
      asset: reference('video'),
      poster: reference('poster'),
      transcript: { en: reference('en'), uk: reference('uk') },
      captions: { en: reference('enCaptions'), uk: reference('ukCaptions') },
    },
    'clip',
  );
}
