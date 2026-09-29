import { required } from '../data-json.mjs';
import { inspectMP3, throwIfSoundtrackAborted } from '../mp3.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { inspectRewardMediaBytes, REWARD_MEDIA_LIMITS } from '../rewards/media-format.mjs';
import { editDiscoveryPayload } from './discovery.mjs';

async function inspectOriginal(context, file, role, signal) {
  const limit = role === 'audio' ? REWARD_MEDIA_LIMITS.sourceBytes : REWARD_MEDIA_LIMITS.textBytes;
  required(
    file instanceof Blob && file.size > 0 && file.size <= limit,
    `Choose a bounded exact ${role} original.`,
  );
  throwIfSoundtrackAborted(signal);
  const bytes = new Uint8Array(await file.arrayBuffer()),
    sha256 = await hashPresentationBytes(bytes);
  throwIfSoundtrackAborted(signal);
  const matches = context.assets.filter(
    (asset) =>
      context.campaign.assetIds.includes(asset.id) &&
      asset.sha256 === sha256 &&
      asset.bytes === bytes.length &&
      (role !== 'audio' || /\.mp3$/i.test(asset.path)),
  );
  required(
    matches.length,
    'This original is not admitted for the selected campaign. Complete source and rights review before handoff.',
  );
  for (const asset of matches) {
    context.admitted(asset);
    inspectRewardMediaBytes(asset, role, bytes);
  }
  if (role === 'audio') {
    const facts = await inspectMP3(file, { signal });
    required(
      facts.durationSeconds <= REWARD_MEDIA_LIMITS.durationSeconds,
      'Discovery audio must be at most 120 seconds.',
    );
  }
  return { bytes, matches };
}

/** EN/UK transcript pins are selected independently; source declarations and
 * filenames never approve a recording or replace selected inventory rights. */
export async function inspectDiscoveryAudioHandoff(context, files, { signal } = {}) {
  required(
    ['audio', 'en', 'uk'].every((key) => files[key] instanceof Blob),
    'Choose the recording and both EN/UK transcript originals.',
  );
  required(
    Object.values(files).reduce((sum, file) => sum + file.size, 0) <=
      REWARD_MEDIA_LIMITS.sourceBytes,
    'The discovery originals exceed the 32 MiB edition asset limit.',
  );
  const audio = await inspectOriginal(context, files.audio, 'audio', signal);
  const en = await inspectOriginal(context, files.en, 'transcript', signal);
  const uk = await inspectOriginal(context, files.uk, 'transcript', signal);
  throwIfSoundtrackAborted(signal);
  return { identity: context.identity, campaignId: context.campaign.id, audio, en, uk };
}

export function editDiscoveryAudioHandoff(
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
      'Explicitly select the verified original for every recording role.',
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
      type: 'audio',
      asset: reference('audio'),
      transcript: { en: reference('en'), uk: reference('uk') },
      locales: selection.locales,
    },
    'recording',
  );
}
