import Fastify from 'fastify';
import {
  CommunityError,
  PACKAGE_MEDIA_TYPE,
  packageBlobKey,
  parseCatalogQuery,
  toOwnerSubmission,
  toPublicEdition,
  validateCreateSubmission,
} from './domain.mjs';
import { DirectUploadTransport } from './upload-transport.mjs';

const notFound = () =>
  new CommunityError(404, 'not_found', 'The requested resource was not found.');

export function buildCommunityApp({
  repository,
  blobStore,
  authenticator,
  maxPackageBytes = 256 * 1024 * 1024,
  validatorVersion = 'creator-bundle-v1',
  uploadTransport = new DirectUploadTransport(),
  logger = false,
}) {
  if (!repository || !blobStore || !authenticator)
    throw new Error('repository, blobStore, and authenticator are required.');
  const app = Fastify({ logger, bodyLimit: maxPackageBytes });
  const parsePackage = (_request, body, done) => done(null, body);
  const parserOptions = { parseAs: 'buffer', bodyLimit: maxPackageBytes };
  app.addContentTypeParser(PACKAGE_MEDIA_TYPE, parserOptions, parsePackage);
  app.addContentTypeParser('application/octet-stream', parserOptions, parsePackage);

  const owner = async (request) => {
    const identity = await authenticator.authenticate(request);
    if (!identity?.subject) throw new Error('Authentication adapter returned no subject.');
    return identity.subject;
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof CommunityError)
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    if (error?.statusCode && error.statusCode < 500)
      return reply
        .code(error.statusCode)
        .send({ error: { code: 'invalid_request', message: error.message } });
    request.log.error(error);
    return reply
      .code(500)
      .send({ error: { code: 'internal_error', message: 'The request could not be completed.' } });
  });

  app.get('/health', async (_request, reply) => {
    await repository.health();
    return reply.header('cache-control', 'no-store').send({ status: 'ok' });
  });

  app.get('/v1/catalog', async (request, reply) => {
    const query = parseCatalogQuery(request.query);
    const page = await repository.listPublished(query);
    return reply.header('cache-control', 'public, max-age=60').send({
      editions: page.rows.map(toPublicEdition),
      nextCursor: page.nextCursor,
    });
  });

  app.get('/v1/catalog/:editionId', async (request, reply) => {
    const row = await repository.getPublishedEdition(request.params.editionId);
    if (!row) throw notFound();
    return reply
      .header('cache-control', 'public, max-age=60')
      .send({ edition: toPublicEdition(row) });
  });

  app.get('/v1/catalog/:editionId/download', async (request, reply) => {
    const row = await repository.getPublishedEdition(request.params.editionId);
    if (!row) throw notFound();
    const blob = await blobStore.open(row.blobKey);
    if (!blob || blob.size !== row.actualSize)
      throw new CommunityError(503, 'package_unavailable', 'The immutable package is unavailable.');
    return reply
      .header('content-type', PACKAGE_MEDIA_TYPE)
      .header('content-length', blob.size)
      .header('etag', `"sha256-${row.packageSha256}"`)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header(
        'content-disposition',
        `attachment; filename="${row.slug}-${row.editionVersion}.rlpack"`,
      )
      .send(blob.body);
  });

  app.post('/v1/submissions', async (request, reply) => {
    const ownerSubject = await owner(request);
    const candidate = validateCreateSubmission(request.body, { ownerSubject, maxPackageBytes });
    const row = await repository.createSubmission(candidate);
    return reply
      .code(201)
      .header('cache-control', 'no-store')
      .send({
        submission: toOwnerSubmission(row),
        upload: uploadTransport.describe(row),
      });
  });

  app.get('/v1/submissions/:id', async (request, reply) => {
    const ownerSubject = await owner(request);
    const row = await repository.getOwnerSubmission(request.params.id, ownerSubject);
    if (!row) throw notFound();
    return reply.header('cache-control', 'no-store').send({ submission: toOwnerSubmission(row) });
  });

  app.put('/v1/submissions/:id/package', async (request, reply) => {
    const ownerSubject = await owner(request);
    const row = await repository.getOwnerSubmission(request.params.id, ownerSubject);
    if (!row) throw notFound();
    if (row.status !== 'draft' && row.status !== 'uploaded')
      throw new CommunityError(
        409,
        'invalid_transition',
        'This submission can no longer be uploaded.',
      );
    if (!Buffer.isBuffer(request.body))
      throw new CommunityError(
        415,
        'unsupported_media_type',
        `Use ${PACKAGE_MEDIA_TYPE} or application/octet-stream.`,
      );
    const blobKey = packageBlobKey(row.packageSha256);
    const stored = await blobStore.putVerified({
      key: blobKey,
      body: request.body,
      expectedSha256: row.packageSha256,
      expectedSize: row.declaredSize,
      maxBytes: maxPackageBytes,
    });
    const updated = await repository.markUploaded({
      id: row.id,
      ownerSubject,
      packageSha256: stored.sha256,
      actualSize: stored.size,
      blobKey: stored.key,
    });
    if (!updated) throw notFound();
    return reply
      .header('cache-control', 'no-store')
      .send({ submission: toOwnerSubmission(updated) });
  });

  app.post('/v1/submissions/:id/submit', async (request, reply) => {
    const ownerSubject = await owner(request);
    const queued = await repository.enqueueValidation({
      id: request.params.id,
      ownerSubject,
      validatorVersion,
    });
    if (!queued) throw notFound();
    return reply
      .code(queued.reused ? 200 : 202)
      .header('cache-control', 'no-store')
      .send({
        submission: toOwnerSubmission(queued.submission),
        validation: {
          jobId: queued.job.id,
          status: queued.job.status,
          validatorVersion: queued.job.validatorVersion,
          reused: queued.reused,
        },
      });
  });

  return app;
}
