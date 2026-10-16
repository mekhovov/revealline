import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createCommunityModerator } from '../community/moderator.mjs';

const report = (id, overrides = {}) =>
  Object.freeze({
    id,
    editionId: `ed_${id[0].repeat(64)}`,
    reason: 'unsafe',
    details: 'Review this report.',
    status: 'open',
    createdAt: '2026-09-26T10:00:00.000Z',
    resolvedAt: null,
    resolution: null,
    ...overrides,
  });

const one = report('11111111-1111-4111-8111-111111111111');
const two = report('22222222-2222-4222-8222-222222222222');

const client = (overrides = {}) => ({
  listAdminReports: async () => ({ reports: [], nextCursor: null }),
  resolveAdminReport: async (id, resolution) => ({
    report: report(id, {
      status: 'resolved',
      resolution,
      resolvedAt: '2026-09-26T11:00:00.000Z',
    }),
    reused: false,
  }),
  adminUnlistEdition: async (editionId) => ({ editionId, status: 'unlisted' }),
  edition: async (editionId) => ({ editionId, previewAvailable: true }),
  preview: async () => new Blob(['preview'], { type: 'image/png' }),
  ...overrides,
});

test('moderation queue pages without duplicates and resets when the status changes', async () => {
  const calls = [];
  const moderator = createCommunityModerator({
    pageSize: 2,
    client: client({
      listAdminReports: async (options) => {
        calls.push(options);
        if (options.status === 'resolved') return { reports: [], nextCursor: null };
        return options.cursor
          ? { reports: [one, two], nextCursor: null }
          : { reports: [one], nextCursor: 'next' };
      },
    }),
  });
  assert.deepEqual((await moderator.load()).reports, [one]);
  assert.deepEqual((await moderator.load({ reset: false })).reports, [one, two]);
  assert.deepEqual(await moderator.load({ selectedStatus: 'resolved', reset: false }), {
    status: 'resolved',
    reports: [],
    nextCursor: null,
  });
  assert.deepEqual(calls, [
    { status: 'open', limit: 2, cursor: null },
    { status: 'open', limit: 2, cursor: 'next' },
    { status: 'resolved', limit: 2, cursor: null },
  ]);
});

test('resolving an open report removes it from the open queue with bounded text', async () => {
  const resolutions = [];
  const moderator = createCommunityModerator({
    client: client({
      listAdminReports: async () => ({ reports: [one], nextCursor: null }),
      resolveAdminReport: async (id, resolution) => {
        resolutions.push({ id, resolution });
        return {
          report: report(id, {
            status: 'resolved',
            resolution,
            resolvedAt: '2026-09-26T11:00:00.000Z',
          }),
          reused: false,
        };
      },
    }),
  });
  await moderator.load();
  const result = await moderator.resolve(one.id, '  Reviewed and retained.  ');
  assert.deepEqual(resolutions, [{ id: one.id, resolution: 'Reviewed and retained.' }]);
  assert.deepEqual(result.snapshot.reports, []);
  await assert.rejects(moderator.resolve(one.id, 'Reviewed again.'), /no longer/u);
  await assert.rejects(moderator.resolve(two.id, ''), /no longer/u);
});

test('unlist and resolve keeps the safety ordering and reports a retryable partial result', async () => {
  const events = [];
  let failResolution = false;
  const moderator = createCommunityModerator({
    client: client({
      listAdminReports: async () => ({ reports: [one], nextCursor: null }),
      adminUnlistEdition: async (editionId, reason) => {
        events.push(['unlist', editionId, reason]);
        return { editionId, status: 'unlisted' };
      },
      resolveAdminReport: async (id, resolution) => {
        events.push(['resolve', id, resolution]);
        if (failResolution) throw new Error('temporary database outage');
        return {
          report: report(id, {
            status: 'resolved',
            resolution,
            resolvedAt: '2026-09-26T11:00:00.000Z',
          }),
          reused: false,
        };
      },
    }),
  });
  await moderator.load();
  await moderator.unlistAndResolve(one.id, 'Confirmed unsafe content.');
  assert.deepEqual(
    events.map(([event]) => event),
    ['unlist', 'resolve'],
  );

  events.length = 0;
  failResolution = true;
  await moderator.load();
  await assert.rejects(
    moderator.unlistAndResolve(one.id, 'Confirmed unsafe content.'),
    (error) => error.editionUnlisted === true && /report remains open/u.test(error.message),
  );
  assert.deepEqual(
    events.map(([event]) => event),
    ['unlist', 'resolve'],
  );

  const blocked = createCommunityModerator({
    client: client({
      listAdminReports: async () => ({ reports: [one], nextCursor: null }),
      adminUnlistEdition: async () => {
        events.push(['unlist-failed']);
        throw new Error('unlisting refused');
      },
      resolveAdminReport: async () => events.push(['must-not-resolve']),
    }),
  });
  await blocked.load();
  await assert.rejects(blocked.unlistAndResolve(one.id, 'Confirmed.'), /unlisting refused/u);
  assert.notEqual(events.at(-1)[0], 'must-not-resolve');
});

test('reported media is fetched only through the explicit preview action', async () => {
  const calls = [];
  const blob = new Blob(['preview'], { type: 'image/png' });
  const moderator = createCommunityModerator({
    client: client({
      listAdminReports: async () => ({ reports: [one], nextCursor: null }),
      edition: async (editionId) => {
        calls.push(['edition', editionId]);
        return { editionId, previewAvailable: true };
      },
      preview: async (edition) => {
        calls.push(['preview', edition.editionId]);
        return blob;
      },
    }),
  });
  await moderator.load();
  assert.deepEqual(calls, []);
  assert.equal(await moderator.preview(one.id), blob);
  assert.deepEqual(
    calls.map(([operation]) => operation),
    ['edition', 'preview'],
  );
});

test('moderation page keeps remote text out of HTML and makes previews opt in', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../community/moderation.html', import.meta.url), 'utf8'),
    readFile(new URL('../community/moderation-page.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="reports"/u);
  assert.match(html, /id="report-status"/u);
  assert.match(html, /moderation-page\.mjs/u);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|\.srcdoc/u);
  assert.match(script, /remoteText/u);
  assert.match(script, /moderator\.preview\(report\.id\)/u);
  assert.match(script, /unlistAndResolve/u);
});
