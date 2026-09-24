import { FileStore } from '@tus/file-store';
import { Server } from '@tus/server';
import { completeTusUpload } from './upload-transport.mjs';

const fail = (status_code, body) => {
  throw { status_code, body };
};

const requestHeaders = (request) => {
  if (request.headers instanceof Headers) return Object.fromEntries(request.headers);
  return request.headers ?? {};
};

export function createCommunityTusServer({
  directory,
  endpoint = '/v1/uploads',
  authenticator,
  repository,
  blobStore,
  maxPackageBytes,
}) {
  const datastore = new FileStore({ directory });
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
  return { server, datastore, endpoint };
}

export function mountCommunityTus(app, tus) {
  app.addContentTypeParser('application/offset+octet-stream', (_request, _payload, done) =>
    done(null),
  );
  const handle = async (request, reply) => {
    reply.hijack();
    await tus.server.handle(request.raw, reply.raw);
  };
  app.all(tus.endpoint, handle);
  app.all(`${tus.endpoint}/*`, handle);
}
