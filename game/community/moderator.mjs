import { required } from '../data-json.mjs';

const REPORT_STATUSES = new Set(['open', 'resolved']);

const resolutionText = (value) => {
  required(typeof value === 'string', 'A moderation resolution is required.');
  const resolution = value.trim();
  required(
    resolution.length >= 1 && resolution.length <= 1_000,
    'A moderation resolution must contain 1 to 1000 characters.',
  );
  return resolution;
};

const reportIdentity = (value) => {
  required(typeof value === 'string' && value.length > 0, 'Choose a valid community report.');
  return value;
};

/** Keeps report pagination and the two-step removal decision outside the DOM.
 * The service remains the authority for administrator access. */
export function createCommunityModerator({ client, pageSize = 20 } = {}) {
  required(
    client &&
      typeof client.listAdminReports === 'function' &&
      typeof client.resolveAdminReport === 'function' &&
      typeof client.adminUnlistEdition === 'function' &&
      typeof client.edition === 'function' &&
      typeof client.preview === 'function',
    'A complete community moderation client is required.',
  );
  required(
    Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 50,
    'Moderation page size is invalid.',
  );

  let status = 'open';
  let reports = [];
  let nextCursor = null;

  const snapshot = () =>
    Object.freeze({
      status,
      reports: Object.freeze([...reports]),
      nextCursor,
    });

  const find = (reportId) => {
    const id = reportIdentity(reportId);
    const report = reports.find((candidate) => candidate.id === id);
    required(report, 'This report is no longer in the current moderation queue.');
    return report;
  };

  const load = async ({ selectedStatus = status, reset = true } = {}) => {
    required(REPORT_STATUSES.has(selectedStatus), 'Moderation status is invalid.');
    const cursor = reset || selectedStatus !== status ? null : nextCursor;
    const page = await client.listAdminReports({
      status: selectedStatus,
      limit: pageSize,
      cursor,
    });
    status = selectedStatus;
    reports =
      reset || cursor === null
        ? [...page.reports]
        : [
            ...reports,
            ...page.reports.filter(
              (candidate) => !reports.some((report) => report.id === candidate.id),
            ),
          ];
    nextCursor = page.nextCursor;
    return snapshot();
  };

  const resolve = async (reportId, value) => {
    const report = find(reportId);
    const result = await client.resolveAdminReport(report.id, resolutionText(value));
    reports =
      status === 'open'
        ? reports.filter((candidate) => candidate.id !== report.id)
        : reports.map((candidate) => (candidate.id === report.id ? result.report : candidate));
    return Object.freeze({ ...result, snapshot: snapshot() });
  };

  return Object.freeze({
    snapshot,
    load,
    resolve,
    async unlistAndResolve(reportId, value) {
      const report = find(reportId);
      const resolution = resolutionText(value);
      const unlisted = await client.adminUnlistEdition(report.editionId, resolution);
      try {
        const resolved = await resolve(report.id, resolution);
        return Object.freeze({ unlisted, resolved, snapshot: snapshot() });
      } catch (error) {
        const failure = new Error(
          `The edition was unlisted, but the report remains open: ${error.message}`,
          { cause: error },
        );
        failure.editionUnlisted = true;
        throw failure;
      }
    },
    async preview(reportId) {
      const report = find(reportId);
      const edition = await client.edition(report.editionId);
      return client.preview(edition);
    },
  });
}
