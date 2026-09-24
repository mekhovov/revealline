import { required } from '../data-json.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { importCreatorBundle } from '../creator/bundle.mjs';

const slug = (value) =>
  value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 64);

/** Publication starts from a portable pack that passes the same local import
 * validator. Authentication and resumable transport remain injected service
 * capabilities; this controller never invents credentials or upload success. */
export function createCommunityPublisher({ client, decodeImage } = {}) {
  required(client, 'Community publication client is required.');
  let selection = null;
  return Object.freeze({
    async select(blob) {
      const pack = await importCreatorBundle(blob, { decodeImage });
      const packageSha256 = await creatorSHA256(await blob.arrayBuffer());
      selection = Object.freeze({
        blob: blob.slice(),
        packageSha256,
        packageSize: blob.size,
        creatorEditionId: pack.editionId,
        suggestedTitle: pack.review.name,
        suggestedSlug: slug(pack.review.name) || `campaign-${pack.editionId.slice(0, 10)}`,
      });
      return selection;
    },
    current: () => selection,
    async publish({
      title,
      description = '',
      version = '1.0.0',
      slug: requestedSlug,
      onProgress,
    } = {}) {
      required(selection, 'Choose an approved .rlpack file first.');
      const created = await client.createSubmission({
        slug: requestedSlug || selection.suggestedSlug,
        title: title || selection.suggestedTitle,
        description,
        version,
        packageSha256: selection.packageSha256,
        packageSize: selection.packageSize,
      });
      await client.uploadSubmission(created, selection.blob, { onProgress });
      const queued = await client.submit(created.submission.id);
      return Object.freeze({
        id: created.submission.id,
        editionId: created.submission.editionId,
        status: queued.submission.status,
        resumable: !!created.upload.resumable,
      });
    },
    async status(submissionId) {
      const value = await client.submission(submissionId);
      return Object.freeze(value.submission);
    },
  });
}
