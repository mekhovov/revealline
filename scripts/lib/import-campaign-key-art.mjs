import { createHash } from 'node:crypto';
import { boundedJSON, canonicalJSON, required } from '../../game/data-json.mjs';
import { compileAssetRevision, assetRevisionMime } from '../../game/content-design/assets.mjs';
import { inspectImageDataUrl } from '../../game/content.mjs';

/** Admit reviewed campaign scenes through the existing asset inventories. No
 * campaign or player progress is edited; callers explicitly bind the new pins. */
export async function importCampaignKeyArt({
  receipts,
  campaigns,
  missions = [],
  assets,
  artwork,
  sources,
  read,
}) {
  const result = {
    assets: structuredClone(assets),
    artwork: structuredClone(artwork),
    sources: structuredClone(sources),
    imported: [],
  };
  const seen = new Set();
  for (const input of receipts) {
    const receipt = boundedJSON(input, { maxBytes: 1024 * 1024, maxNodes: 50000 });
    const missionArt = receipt.schema === 'revealline-generated-mission-art-review.v1';
    required(
      (missionArt || receipt.schema === 'revealline-generated-campaign-art-review.v1') &&
        Array.isArray(receipt.assets),
      'Expected a reviewed campaign-art receipt.',
    );
    for (const record of receipt.assets) {
      const campaign = missionArt
        ? missions.find(({ id }) => id === record.missionId)
        : campaigns.find(({ id }) => id === record.campaignId);
      required(campaign && !seen.has(campaign.id), 'Unknown or repeated campaign artwork.');
      seen.add(campaign.id);
      required(
        Number.isSafeInteger(record.revision) && record.revision > 0,
        'Invalid campaign artwork revision.',
      );
      required(
        record.tool === 'built-in image_gen.imagegen' &&
          record.rightsClassification === 'generated-original' &&
          record.role === (missionArt ? 'mission-reveal' : 'campaign-key') &&
          record.transparentBackground === false,
        'Campaign scenes require declared original opaque generation.',
      );
      required(
        typeof record.prompt === 'string' &&
          record.prompt.length >= 40 &&
          record.humanReview === 'deferred' &&
          record.visualReview?.masterViewed &&
          record.visualReview?.derivativeDimensionsVerified,
        'Campaign art requires its full prompt and explicit review state.',
      );
      required(
        ['en', 'uk'].every(
          (locale) =>
            typeof record.alt?.[locale] === 'string' &&
            record.alt[locale].trim() &&
            typeof record.publicationContext?.[locale] === 'string' &&
            record.publicationContext[locale].trim(),
        ),
        'Campaign art needs localized descriptions and context.',
      );
      required(
        Array.isArray(record.sourceInspiration) &&
          record.sourceInspiration.every(
            ({ url, role }) => typeof role === 'string' && role.trim() && /^https:\/\//.test(url),
          ),
        'Source inspiration must retain explicit HTTPS references.',
      );
      const original = record.master;
      required(
        original &&
          /^[a-f0-9]{64}$/.test(original.sha256) &&
          Number.isSafeInteger(original.bytes) &&
          original.bytes > 0 &&
          typeof original.path === 'string' &&
          original.path.includes('/generated_images/'),
        'Campaign art needs an exact generation-master reference.',
      );
      const selected = record.derivative;
      required(
        selected?.path?.startsWith('game/editions/assets/') &&
          typeof selected.transformation === 'string' &&
          selected.transformation.trim() &&
          selected.bytes <= 1024 * 1024,
        'Selected campaign art must stay within the 1 MiB production target.',
      );
      const picture = compileAssetRevision({
        format: 'AssetRevisionV1',
        id: `${campaign.id}${missionArt ? '' : '-key'}-picture`,
        revision: String(record.revision),
        kind: 'reveal-background',
        path: selected.path.slice(5),
        sha256: selected.sha256,
        bytes: selected.bytes,
        width: selected.width,
        height: selected.height,
        alt: record.alt.en,
        review: 'candidate',
      });
      const previous = result.artwork.filter(({ id }) => id === picture.id);
      required(
        previous.some(({ revision }) => revision === picture.revision) ||
          record.revision === Math.max(0, ...previous.map(({ revision }) => Number(revision))) + 1,
        'Campaign artwork revisions cannot skip or replace history.',
      );
      const bytes = await read(selected.path);
      const info = inspectImageDataUrl(
        `data:${assetRevisionMime(picture)};base64,${Buffer.from(bytes).toString('base64')}`,
      );
      required(
        bytes.length === selected.bytes &&
          createHash('sha256').update(bytes).digest('hex') === selected.sha256 &&
          info.valid &&
          info.width === selected.width &&
          info.height === selected.height,
        'Selected campaign image differs from its reviewed exact bytes.',
      );
      const id = `${campaign.id}-${missionArt ? 'reveal' : 'key'}-v${record.revision}`;
      const asset = {
        id,
        path: selected.path,
        sha256: selected.sha256,
        bytes: selected.bytes,
        publication: 'public',
        approved: true,
        dependencies: [],
      };
      const source = {
        ...asset,
        revision: record.revision,
        title: record.title,
        rights: 'generated-original',
        source: 'image_gen.imagegen',
        prompt: record.prompt,
        original: {
          path: '$CODEX_HOME/generated_images/' + original.path.split('/generated_images/')[1],
          sha256: original.sha256,
          bytes: original.bytes,
          width: original.width,
          height: original.height,
        },
        derivation: selected.transformation,
        locales: {
          en: { alt: record.alt.en, context: record.publicationContext.en },
          uk: { alt: record.alt.uk, context: record.publicationContext.uk },
        },
        sourceInspiration: record.sourceInspiration,
        review:
          'candidate-public-bytes; generated master and selected derivative inspected; human artwork review deferred',
      };
      // Retain text describing corrective generations without leaking local paths.
      if (record.edit) {
        const edit = record.edit;
        required(
          typeof edit.prompt === 'string' &&
            edit.prompt.length >= 40 &&
            typeof edit.inputPath === 'string' &&
            edit.inputPath.includes('/generated_images/') &&
            /^[a-f0-9]{64}$/.test(edit.inputSha256) &&
            Number.isSafeInteger(edit.inputBytes) &&
            edit.inputBytes > 0 &&
            typeof edit.reason === 'string',
          'A corrective generation requires its exact prompt and source master.',
        );
        source.correctiveGeneration = {
          prompt: edit.prompt,
          reason: edit.reason,
          input: {
            path: '$CODEX_HOME/generated_images/' + edit.inputPath.split('/generated_images/')[1],
            sha256: edit.inputSha256,
            bytes: edit.inputBytes,
          },
        };
      }
      for (const [list, value] of [
        [result.assets, asset],
        [result.artwork, picture],
        [result.sources.assets, source],
      ]) {
        const same = (entry) =>
          entry.id === value.id && (list !== result.artwork || entry.revision === value.revision);
        const existing = list.find(same);
        required(
          !existing || canonicalJSON(existing) === canonicalJSON(value),
          'Campaign art would replace an immutable revision.',
        );
        required(
          !list.some((entry) => !same(entry) && entry.path === value.path),
          'Campaign artwork path already belongs to another identity.',
        );
        if (!existing) list.push(value);
      }
      result.imported.push({
        [missionArt ? 'missionId' : 'campaignId']: campaign.id,
        assetId: id,
        bytes: selected.bytes,
      });
    }
  }
  return result;
}
