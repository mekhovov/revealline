import { PACKAGE_MEDIA_TYPE } from './domain.mjs';

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
      },
    };
  }
}
