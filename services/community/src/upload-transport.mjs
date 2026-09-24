import { CommunityError, PACKAGE_MEDIA_TYPE, packageBlobKey } from './domain.mjs';

// Upload transport boundary. A tus integration can replace this object without changing
// submission identity, ownership, validation jobs, or publication state.
export class DirectUploadTransport {
  describe(submission) {
    return {
      method: 'PUT',
      href: `/v1/submissions/${submission.id}/package`,
      mediaType: PACKAGE_MEDIA_TYPE,
      packageSha256: submission.packageSha256,
      packageSize: submission.declaredSize,
      resumable: false,
    };
  }
}

export class TusUploadTransportBoundary {
  constructor({ endpoint }) {
    if (!endpoint || typeof endpoint !== 'string') throw new Error('tus endpoint is required.');
    this.endpoint = endpoint.replace(/\/$/u, '');
  }

  describe(submission) {
    return {
      method: 'POST',
      href: this.endpoint,
      protocol: 'tus-1.0',
      mediaType: PACKAGE_MEDIA_TYPE,
      packageSha256: submission.packageSha256,
      packageSize: submission.declaredSize,
      resumable: true,
      metadata: {
        submissionId: submission.id,
        editionId: submission.editionId,
        packageSha256: submission.packageSha256,
        packageSize: String(submission.declaredSize),
      },
    };
  }
}

/** Completion hook for a maintained tus server and either its disk or S3 store.
 * The tus implementation owns chunking and offsets; this hook admits only the
 * completed stream whose authenticated owner and immutable metadata still match
 * the submission created before upload began. */
export async function completeTusUpload({
  metadata,
  body,
  ownerSubject,
  repository,
  blobStore,
  maxPackageBytes,
}) {
  const row = await repository.getOwnerSubmission(metadata?.submissionId, ownerSubject);
  if (!row) throw new CommunityError(404, 'not_found', 'The submission was not found.');
  if (row.status !== 'draft' && row.status !== 'uploaded')
    throw new CommunityError(
      409,
      'invalid_transition',
      'This submission can no longer be uploaded.',
    );
  if (
    metadata.editionId !== row.editionId ||
    metadata.packageSha256 !== row.packageSha256 ||
    metadata.packageSize !== String(row.declaredSize)
  )
    throw new CommunityError(
      422,
      'package_identity_mismatch',
      'Completed tus metadata differs from the immutable submission.',
    );
  const stored = await blobStore.putVerified({
    key: packageBlobKey(row.packageSha256),
    body,
    expectedSha256: row.packageSha256,
    expectedSize: row.declaredSize,
    maxBytes: maxPackageBytes,
  });
  return repository.markUploaded({
    id: row.id,
    ownerSubject,
    packageSha256: stored.sha256,
    actualSize: stored.size,
    blobKey: stored.key,
  });
}
