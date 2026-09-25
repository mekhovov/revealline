import { required } from '../data-json.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { importCreatorBundle } from '../creator/bundle.mjs';
import { validateCommunitySubmission } from './client.mjs';

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
  let selection = null,
    publication = null,
    pending = null;
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
      pending = null;
      publication = null;
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
      const metadata = {
        slug: requestedSlug || selection.suggestedSlug,
        title: title || selection.suggestedTitle,
        description,
        version,
        packageSha256: selection.packageSha256,
        packageSize: selection.packageSize,
      };
      const signature = JSON.stringify(metadata);
      const created =
        pending?.signature === signature
          ? pending.created
          : await client.createSubmission(metadata);
      pending = Object.freeze({ signature, created });
      await client.uploadSubmission(created, selection.blob, { onProgress });
      const queued = await client.submit(created.submission.id);
      pending = null;
      const submitted = validateCommunitySubmission({
        ...queued.submission,
        id: queued.submission?.id ?? created.submission.id,
        editionId: queued.submission?.editionId ?? created.submission.editionId,
      });
      publication = Object.freeze({
        ...submitted,
        resumable: !!created.upload.resumable,
      });
      return publication;
    },
    async status(submissionId) {
      const value = await client.submission(submissionId);
      publication = value.submission;
      return publication;
    },
    publication: () => publication,
    async unlist() {
      required(publication?.status === 'published', 'Only a published edition can be unlisted.');
      publication = await client.unlistEdition(publication.editionId);
      return publication;
    },
  });
}
