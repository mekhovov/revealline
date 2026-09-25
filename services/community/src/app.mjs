import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import { createAdmissionController } from './admission.mjs';
import {
  CommunityError,
  PACKAGE_MEDIA_TYPE,
  packageBlobKey,
  parseCatalogQuery,
  parseReportQuery,
  toAdminReport,
  toOwnerSubmission,
  toPublicEdition,
  validateCreateSubmission,
  validateReport,
  validateReportId,
  validateReportResolution,
} from './domain.mjs';
import { DirectUploadTransport } from './upload-transport.mjs';
import { mountCommunityTus } from './tus-server.mjs';
import { readCreatorPreview } from './validator.mjs';

const notFound = () =>
  new CommunityError(404, 'not_found', 'The requested resource was not found.');

export function buildCommunityApp({
  repository,
  blobStore,
  authenticator,
  maxPackageBytes = 256 * 1024 * 1024,
  validatorVersion = 'creator-bundle-v1',
  uploadTransport = new DirectUploadTransport(),
  tus = null,
  admission = null,
  admissionPolicies,
  trustProxy = false,
  logger = false,
}) {
  if (!repository || !blobStore || !authenticator)
    throw new Error('repository, blobStore, and authenticator are required.');
  const app = Fastify({ logger, bodyLimit: maxPackageBytes, trustProxy });
  const admissionBoundary =
    admission ?? createAdmissionController({ repository, policies: admissionPolicies });
  const parsePackage = (_request, body, done) => done(null, body);
  const parserOptions = { parseAs: 'buffer', bodyLimit: maxPackageBytes };
  app.addContentTypeParser(PACKAGE_MEDIA_TYPE, parserOptions, parsePackage);
  app.addContentTypeParser('application/octet-stream', parserOptions, parsePackage);
  app.addHook('onRequest', async (request) => {
    if (request.method === 'POST' && request.url.startsWith('/api/auth/'))
      await admissionBoundary.admit({
        action: 'auth',
        subject: `network/${request.ip}`,
      });
  });
  if (tus) mountCommunityTus(app, tus);

  const identity = async (request) => {
    const identity = await authenticator.authenticate(request);
    if (!identity?.subject) throw new Error('Authentication adapter returned no subject.');
    return identity;
  };
  const owner = async (request) => (await identity(request)).subject;
  const administrator = async (request) => {
    const actor = await identity(request);
    if (!actor.roles?.includes('admin'))
      throw new CommunityError(403, 'admin_required', 'Administrator access is required.');
    return actor;
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof CommunityError) {
      if (error.retryAfterSeconds) reply.header('retry-after', String(error.retryAfterSeconds));
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        },
      });
    }
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
    if (!blob || blob.size !== row.actualSize || blob.sha256 !== row.packageSha256) {
      if (blob?.body?.destroy) {
        const closed = blob.body.closed
          ? Promise.resolve()
          : new Promise((resolve) => blob.body.once('close', resolve));
        blob.body.destroy();
        await closed;
      }
      throw new CommunityError(503, 'package_unavailable', 'The immutable package is unavailable.');
    }
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

  app.get('/v1/catalog/:editionId/preview', async (request, reply) => {
    const row = await repository.getPublishedEdition(request.params.editionId);
    if (!row) throw notFound();
    const preview = await readCreatorPreview(blobStore, row);
    if (!preview)
      throw new CommunityError(503, 'preview_unavailable', 'The verified preview is unavailable.');
    return reply
      .header('content-type', preview.mime)
      .header('content-length', preview.size)
      .header('etag', `"sha256-${preview.sha256}"`)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(preview.body);
  });

  app.post('/v1/catalog/:editionId/reports', async (request, reply) => {
    const reporterSubject = `anonymous/${createHash('sha256')
      .update(request.ip)
      .update('\0')
      .update(request.headers['user-agent'] ?? '')
      .digest('hex')}`;
    await admissionBoundary.admit({
      action: 'report',
      subject: `network/${request.ip}`,
      idempotencyKey: `${request.params.editionId}\0${reporterSubject}`,
    });
    const report = validateReport(request.body);
    const created = await repository.createReport({
      editionId: request.params.editionId,
      reporterSubject,
      ...report,
    });
    if (!created) throw notFound();
    return reply
      .code(created.reused ? 200 : 201)
      .header('cache-control', 'no-store')
      .send({
        report: { id: created.report.id, status: created.report.status },
        reused: created.reused,
      });
  });

  app.post('/v1/admin/catalog/:editionId/unlist', async (request, reply) => {
    const actor = await administrator(request);
    const reason = validateReport({ reason: 'other', details: request.body?.reason ?? '' }).details;
    if (!reason)
      throw new CommunityError(400, 'invalid_request', 'An unlisting reason is required.');
    const result = await repository.unlistPublishedEdition({
      editionId: request.params.editionId,
      actorSubject: actor.subject,
      administrator: true,
      reason,
    });
    if (!result) throw notFound();
    return reply.header('cache-control', 'no-store').send({
      editionId: request.params.editionId,
      status: result.status,
    });
  });

  app.get('/v1/admin/reports', async (request, reply) => {
    await administrator(request);
    const query = parseReportQuery(request.query);
    const page = await repository.listReports(query);
    return reply.header('cache-control', 'no-store').send({
      reports: page.rows.map(toAdminReport),
      nextCursor: page.nextCursor,
    });
  });

  app.post('/v1/admin/reports/:id/resolve', async (request, reply) => {
    const actor = await administrator(request);
    const resolution = validateReportResolution(request.body);
    const result = await repository.resolveReport({
      id: validateReportId(request.params.id),
      actorSubject: actor.subject,
      resolution,
    });
    if (!result) throw notFound();
    return reply.header('cache-control', 'no-store').send({
      report: toAdminReport(result.report),
      reused: result.reused,
    });
  });

  app.post('/v1/publications/:editionId/unlist', async (request, reply) => {
    const actor = await identity(request);
    const row = await repository.unlistPublishedEdition({
      editionId: request.params.editionId,
      actorSubject: actor.subject,
      administrator: actor.roles?.includes('admin') ?? false,
      reason: actor.roles?.includes('admin')
        ? 'Administrator removed publication.'
        : 'Creator removed publication.',
    });
    if (!row) throw notFound();
    return reply.header('cache-control', 'no-store').send({ submission: toOwnerSubmission(row) });
  });

  app.post('/v1/submissions', async (request, reply) => {
    const ownerSubject = await owner(request);
    const candidate = validateCreateSubmission(request.body, { ownerSubject, maxPackageBytes });
    await admissionBoundary.admit({
      action: 'submission',
      subject: ownerSubject,
      idempotencyKey: candidate.editionId,
    });
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
    await admissionBoundary.admit({
      action: 'uploadBytes',
      subject: ownerSubject,
      cost: row.declaredSize,
      idempotencyKey: row.editionId,
    });
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
