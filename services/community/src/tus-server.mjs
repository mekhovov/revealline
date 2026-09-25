import { FileStore } from '@tus/file-store';
import { Server } from '@tus/server';
import { createAdmissionController } from './admission.mjs';
import { CommunityError } from './domain.mjs';
import { completeTusUpload } from './upload-transport.mjs';

const fail = (status_code, body) => {
  throw { status_code, body };
};

const requestHeaders = (request) => {
  if (request.headers instanceof Headers) return Object.fromEntries(request.headers);
  return request.headers ?? {};
};

const decodeCanonicalBase64 = (value) => {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value))
    throw new Error('non-canonical base64');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('non-canonical base64');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

const parseMetadataHeader = (header) => {
  if (typeof header !== 'string' || Buffer.byteLength(header) > 8 * 1024)
    throw new CommunityError(
      400,
      'invalid_request',
      'Tus upload metadata is missing or too large.',
    );
  const metadata = {};
  for (const item of header.split(',')) {
    const [key, encoded, extra] = item.trim().split(' ');
    if (extra !== undefined || !/^[A-Za-z0-9_-]{1,64}$/u.test(key) || !encoded)
      throw new CommunityError(400, 'invalid_request', 'Tus upload metadata is invalid.');
    if (Object.hasOwn(metadata, key))
      throw new CommunityError(400, 'invalid_request', 'Tus upload metadata is invalid.');
    try {
      metadata[key] = decodeCanonicalBase64(encoded);
    } catch {
      throw new CommunityError(400, 'invalid_request', 'Tus upload metadata is invalid.');
    }
  }
  return metadata;
};

export function createCommunityTusServer({
  directory,
  endpoint = '/v1/uploads',
  authenticator,
  repository,
  blobStore,
  maxPackageBytes,
  admission = null,
  admissionPolicies,
}) {
  const datastore = new FileStore({ directory });
  const admissionBoundary =
    admission ?? createAdmissionController({ repository, policies: admissionPolicies });
  const authenticate = async (request) => {
    try {
      const identity = await authenticator.authenticate({ headers: requestHeaders(request) });
      if (!identity?.subject) throw new Error('missing subject');
      return identity;
    } catch {
      fail(401, 'Authentication required.');
    }
  };
  const server = new Server({
    path: endpoint,
    datastore,
    maxSize: maxPackageBytes,
    relativeLocation: true,
    disableTerminationForFinishedUploads: true,
    async onUploadCreate(request, upload) {
      const identity = await authenticate(request);
      const metadata = upload.metadata ?? {};
      const submission = await repository.getOwnerSubmission(
        metadata.submissionId,
        identity.subject,
      );
      if (!submission) fail(404, 'Submission not found.');
      if (
        submission.status !== 'draft' ||
        metadata.editionId !== submission.editionId ||
        metadata.packageSha256 !== submission.packageSha256 ||
        metadata.packageSize !== String(submission.declaredSize) ||
        upload.size !== submission.declaredSize
      )
        fail(422, 'Upload metadata differs from the immutable submission.');
      return { metadata: { ...metadata, ownerSubject: identity.subject } };
    },
    async onIncomingRequest(request, uploadId) {
      const identity = await authenticate(request);
      if (!uploadId || request.method === 'POST' || request.method === 'OPTIONS') return;
      let upload;
      try {
        upload = await datastore.getUpload(uploadId);
      } catch {
        fail(404, 'Upload not found.');
      }
      if (upload.metadata?.ownerSubject !== identity.subject) fail(404, 'Upload not found.');
    },
    async onUploadFinish(request, upload) {
      const identity = await authenticate(request);
      try {
        await completeTusUpload({
          metadata: upload.metadata,
          body: datastore.read(upload.id),
          ownerSubject: identity.subject,
          repository,
          blobStore,
          maxPackageBytes,
        });
        await datastore.remove(upload.id);
      } catch (error) {
        fail(error?.statusCode ?? 500, error?.message ?? 'Completed upload admission failed.');
      }
      return {};
    },
  });
  const admitCreate = async (request) => {
    const identity = await authenticator.authenticate(request);
    if (!identity?.subject)
      throw new CommunityError(401, 'authentication_required', 'Authentication required.');
    const metadata = parseMetadataHeader(request.headers['upload-metadata']);
    const submission = await repository.getOwnerSubmission(metadata.submissionId, identity.subject);
    if (!submission) throw new CommunityError(404, 'not_found', 'Submission not found.');
    const uploadLength = Number(request.headers['upload-length']);
    if (
      submission.status !== 'draft' ||
      metadata.editionId !== submission.editionId ||
      metadata.packageSha256 !== submission.packageSha256 ||
      metadata.packageSize !== String(submission.declaredSize) ||
      uploadLength !== submission.declaredSize
    )
      throw new CommunityError(
        422,
        'upload_identity_changed',
        'Upload metadata differs from the immutable submission.',
      );
    await admissionBoundary.admit({
      action: 'uploadBytes',
      subject: identity.subject,
      cost: submission.declaredSize,
      idempotencyKey: submission.editionId,
    });
  };
  return { server, datastore, endpoint, admitCreate };
}

export function mountCommunityTus(app, tus) {
  app.addContentTypeParser('application/offset+octet-stream', (_request, _payload, done) =>
    done(null),
  );
  const handle = async (request, reply) => {
    if (request.method === 'POST') await tus.admitCreate(request);
    reply.hijack();
    await tus.server.handle(request.raw, reply.raw);
  };
  app.all(tus.endpoint, handle);
  app.all(`${tus.endpoint}/*`, handle);
}
