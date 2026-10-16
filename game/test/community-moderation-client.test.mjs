import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommunityClient, validateCommunityReport } from '../community/client.mjs';

const reportId = '11111111-1111-4111-8111-111111111111';
const editionId = `ed_${'a'.repeat(64)}`;
const createdAt = '2026-09-26T09:00:00.000Z';
const resolvedAt = '2026-09-26T10:00:00.000Z';
const cursor = `${createdAt}|${reportId}`;

const openReport = (overrides = {}) => ({
  id: reportId,
  editionId,
  reason: 'copyright',
  details: 'Please review the included artwork.',
  status: 'open',
  createdAt,
  resolvedAt: null,
  resolution: null,
  ...overrides,
});

const resolvedReport = (overrides = {}) => ({
  ...openReport(),
  status: 'resolved',
  resolvedAt,
  resolution: 'Evidence reviewed; no removal required.',
  ...overrides,
});

test('moderation report validation returns a bounded immutable public shape', () => {
  const open = validateCommunityReport(openReport());
  assert.equal(Object.isFrozen(open), true);
  assert.deepEqual(open, openReport());

  const resolved = validateCommunityReport(resolvedReport());
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.resolution, 'Evidence reviewed; no removal required.');

  for (const source of [
    openReport({ id: 'not-a-report' }),
    openReport({ editionId: `ed_${'A'.repeat(64)}` }),
    openReport({ reason: 'spam' }),
    openReport({ details: 'x'.repeat(2_001) }),
    openReport({ status: 'closed' }),
    openReport({ createdAt: 'yesterday' }),
    openReport({ resolvedAt, resolution: 'already handled' }),
    resolvedReport({ resolvedAt: null }),
    resolvedReport({ resolution: '' }),
    resolvedReport({ resolution: 'x'.repeat(1_001) }),
    { ...openReport(), reporterSubject: 'anonymous/private-fingerprint' },
  ]) {
    assert.throws(() => validateCommunityReport(source));
  }
});

test('administrator report listing is authenticated, bounded, paged, and fail closed', async () => {
  const calls = [];
  const client = createCommunityClient({
    baseURL: 'https://community.example/',
    authHeaders: async () => ({ authorization: 'Bearer administrator' }),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: new URL(url), init });
      return Response.json({ reports: [openReport()], nextCursor: cursor });
    },
  });

  const page = await client.listAdminReports({ status: 'open', limit: 1, cursor });
  assert.equal(Object.isFrozen(page), true);
  assert.equal(Object.isFrozen(page.reports), true);
  assert.equal(page.reports[0].id, reportId);
  assert.equal(page.nextCursor, cursor);
  assert.equal(calls[0].url.pathname, '/v1/admin/reports');
  assert.equal(calls[0].url.searchParams.get('status'), 'open');
  assert.equal(calls[0].url.searchParams.get('limit'), '1');
  assert.equal(calls[0].url.searchParams.get('cursor'), cursor);
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.authorization, 'Bearer administrator');

  for (const options of [
    { status: 'pending' },
    { limit: 0 },
    { limit: 51 },
    { limit: 1.5 },
    { cursor: 'not-a-cursor' },
  ])
    await assert.rejects(client.listAdminReports(options));
  assert.equal(calls.length, 1, 'invalid requests must stop before fetch');

  const malformedBodies = [
    { reports: {}, nextCursor: null },
    { reports: [openReport(), openReport()], nextCursor: null },
    { reports: [openReport({ reason: 'unknown' })], nextCursor: null },
    {
      reports: [{ ...openReport(), reporterSubject: 'anonymous/private-fingerprint' }],
      nextCursor: null,
    },
    { reports: [openReport()], nextCursor: 'invalid' },
    { reports: [openReport()], nextCursor: null, unexpected: true },
  ];
  for (const body of malformedBodies) {
    const malformed = createCommunityClient({
      baseURL: 'https://community.example/',
      authHeaders: async () => ({}),
      fetchImpl: async () => Response.json(body),
    });
    await assert.rejects(malformed.listAdminReports({ limit: 1 }));
  }
});

test('administrator resolves a report with normalized bounded text and exact response identity', async () => {
  const calls = [];
  const client = createCommunityClient({
    baseURL: 'https://community.example/',
    authHeaders: async () => ({ authorization: 'Bearer administrator' }),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: new URL(url), init });
      return Response.json({ report: resolvedReport(), reused: false });
    },
  });

  const result = await client.resolveAdminReport(
    reportId,
    '  Evidence reviewed; no removal required.  ',
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.report.status, 'resolved');
  assert.equal(result.reused, false);
  assert.equal(calls[0].url.pathname, `/v1/admin/reports/${reportId}/resolve`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.authorization, 'Bearer administrator');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    resolution: 'Evidence reviewed; no removal required.',
  });

  for (const [id, resolution] of [
    ['invalid', 'Reviewed.'],
    [reportId, ''],
    [reportId, '\u0000'],
    [reportId, 'x'.repeat(1_001)],
  ])
    await assert.rejects(client.resolveAdminReport(id, resolution));
  assert.equal(calls.length, 1, 'invalid resolution requests must stop before fetch');

  for (const body of [
    { report: resolvedReport(), reused: 'false' },
    { report: openReport(), reused: false },
    {
      report: resolvedReport({ id: '22222222-2222-4222-8222-222222222222' }),
      reused: false,
    },
    { report: resolvedReport(), reused: false, unexpected: true },
  ]) {
    const malformed = createCommunityClient({
      baseURL: 'https://community.example/',
      authHeaders: async () => ({}),
      fetchImpl: async () => Response.json(body),
    });
    await assert.rejects(malformed.resolveAdminReport(reportId, 'Reviewed.'));
  }
});

test('administrator unlisting sends an exact reason and rejects changed response identity', async () => {
  const calls = [];
  const client = createCommunityClient({
    baseURL: 'https://community.example/',
    authHeaders: async () => ({ authorization: 'Bearer administrator' }),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: new URL(url), init });
      return Response.json({ editionId, status: 'unlisted' });
    },
  });

  const result = await client.adminUnlistEdition(editionId, '  Confirmed policy violation.  ');
  assert.deepEqual(result, { editionId, status: 'unlisted' });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(calls[0].url.pathname, `/v1/admin/catalog/${editionId}/unlist`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.authorization, 'Bearer administrator');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { reason: 'Confirmed policy violation.' });

  for (const [id, reason] of [
    ['invalid', 'Confirmed.'],
    [editionId, ''],
    [editionId, '\u0007'],
    [editionId, 'x'.repeat(2_001)],
  ])
    await assert.rejects(client.adminUnlistEdition(id, reason));
  assert.equal(calls.length, 1, 'invalid unlisting requests must stop before fetch');

  for (const body of [
    { editionId: `ed_${'b'.repeat(64)}`, status: 'unlisted' },
    { editionId, status: 'published' },
    { editionId, status: 'unlisted', unexpected: true },
  ]) {
    const malformed = createCommunityClient({
      baseURL: 'https://community.example/',
      authHeaders: async () => ({}),
      fetchImpl: async () => Response.json(body),
    });
    await assert.rejects(malformed.adminUnlistEdition(editionId, 'Confirmed.'));
  }
});

test('moderation methods require configured authentication and surface bounded service errors', async () => {
  let calls = 0;
  const unauthenticated = createCommunityClient({
    baseURL: 'https://community.example/',
    fetchImpl: async () => {
      calls += 1;
      return Response.json({});
    },
  });
  await assert.rejects(unauthenticated.listAdminReports(), /configured creator account/u);
  await assert.rejects(
    unauthenticated.resolveAdminReport(reportId, 'Reviewed.'),
    /configured creator account/u,
  );
  await assert.rejects(
    unauthenticated.adminUnlistEdition(editionId, 'Confirmed.'),
    /configured creator account/u,
  );
  assert.equal(calls, 0);

  const forbidden = createCommunityClient({
    baseURL: 'https://community.example/',
    authHeaders: async () => ({}),
    fetchImpl: async () =>
      Response.json(
        { error: { code: 'admin_required', message: 'Administrator access is required.' } },
        { status: 403 },
      ),
  });
  await assert.rejects(forbidden.listAdminReports(), /Administrator access is required/u);
});
