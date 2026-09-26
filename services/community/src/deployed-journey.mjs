import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCommunityClient } from '../../../game/community/client.mjs';
import { createMemoryCommunityDownloadStore } from '../../../game/community/download-store.mjs';
import { createCommunityLibrary } from '../../../game/community/library.mjs';
import { createCommunityPublisher } from '../../../game/community/publisher.mjs';
import { createMemoryCommunityStateStore } from '../../../game/community/state.mjs';
import { createTusBrowserUpload } from '../../../game/community/tus-upload.mjs';
import { creatorSHA256 } from '../../../game/creator/bytes.mjs';
import {
  approveCreatorBundle,
  exportCreatorBundle,
  prepareCreatorBundle,
} from '../../../game/creator/bundle.mjs';
import { loadInstalledCreatorBundle } from '../../../game/creator/installed.mjs';
import { createCreatorRuntime, creatorProfileKey } from '../../../game/creator/runtime.mjs';
import { generateCreatorProject } from '../../../game/creator/templates.mjs';
import { emptyGenericMediaLibrary } from '../../../game/media-storage-record.mjs';
import {
  applyJourneyEvent,
  createJourneyProfileStore,
  emptyJourneyProfile,
} from '../../../game/journey/profile.mjs';

export const DEPLOYED_ACCEPTANCE_FORMAT = 'revealline-community-deployed-acceptance.v1';
export const DESTRUCTIVE_OPT_IN = 'I_UNDERSTAND_THIS_PUBLISHES_AND_UNLISTS_TEST_CONTENT';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
  'base64',
);
const NAMESPACE = /^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])$/u;
const REPORT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const inspectAcceptanceImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const decodeAcceptanceImage = async () => ({
  width: 1,
  height: 1,
  naturalWidth: 1,
  naturalHeight: 1,
  close() {},
});

const themesPromise = readFile(
  new URL('../../../game/content-design/themes.json', import.meta.url),
  'utf8',
).then((source) => JSON.parse(source).themes);

const required = (condition, message) => {
  if (!condition) throw new Error(message);
};

const exactAuth = (value, name) => {
  required(value && typeof value === 'object' && !Array.isArray(value), `${name} is required.`);
  const entries = Object.entries(value);
  required(entries.length > 0 && entries.length <= 8, `${name} is invalid.`);
  for (const [key, header] of entries)
    required(
      /^[a-z0-9-]{1,64}$/iu.test(key) &&
        typeof header === 'string' &&
        header.length <= 8192 &&
        !/[\u0000-\u001f\u007f]/u.test(header),
      `${name} is invalid.`,
    );
  return Object.freeze(Object.fromEntries(entries));
};

const boundedInteger = (value, name, minimum, maximum) => {
  required(
    Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${name} is invalid.`,
  );
  return value;
};

export function validateDeployedJourneyConfig(input = {}) {
  required(
    input.optIn === DESTRUCTIVE_OPT_IN,
    'Explicit destructive acceptance opt-in is required.',
  );
  required(
    typeof input.namespace === 'string' && NAMESPACE.test(input.namespace),
    'A unique 8-40 character lowercase namespace is required.',
  );
  const baseURL = new URL(input.baseURL);
  required(['http:', 'https:'].includes(baseURL.protocol), 'Community service URL is invalid.');
  required(
    !baseURL.username && !baseURL.password,
    'Community service URL must not contain credentials.',
  );
  baseURL.pathname = baseURL.pathname.endsWith('/') ? baseURL.pathname : `${baseURL.pathname}/`;
  baseURL.search = '';
  baseURL.hash = '';
  return Object.freeze({
    baseURL: baseURL.href,
    namespace: input.namespace,
    auth: Object.freeze({
      creatorA: exactAuth(input.auth?.creatorA, 'Creator A authentication'),
      creatorB: exactAuth(input.auth?.creatorB, 'Creator B authentication'),
      admin: exactAuth(input.auth?.admin, 'Administrator authentication'),
    }),
    requestTimeoutMs: boundedInteger(
      input.requestTimeoutMs ?? 15_000,
      'Request timeout',
      100,
      60_000,
    ),
    pollIntervalMs: boundedInteger(input.pollIntervalMs ?? 1_000, 'Poll interval', 50, 10_000),
    validationTimeoutMs: boundedInteger(
      input.validationTimeoutMs ?? 120_000,
      'Validation timeout',
      100,
      600_000,
    ),
  });
}

const memoryStorage = () => {
  const values = new Map();
  return Object.freeze({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  });
};

/** Finite in-memory implementation of the installed-content storage boundary.
 * The HTTP acceptance runner must not modify an operator's browser profile. */
export function createMemoryCreatorAcceptanceStore({ limitBytes = 32 * 1024 * 1024 } = {}) {
  boundedInteger(limitBytes, 'Creator storage limit', 1024 * 1024, 512 * 1024 * 1024);
  let generation = 0;
  let library = emptyGenericMediaLibrary();
  let assets = new Map();
  const snapshot = (includeAssets) =>
    Object.freeze({
      generation,
      library: structuredClone(library),
      ...(includeAssets
        ? {
            assets: Object.freeze(
              [...assets].map(([sha256, blob]) => Object.freeze({ sha256, blob: blob.slice() })),
            ),
          }
        : {}),
    });
  return Object.freeze({
    readDomain: async (domain) => {
      required(domain === 'media', 'Acceptance store supports installed creator media only.');
      return snapshot(true);
    },
    readDomainMetadata: async (domain) => {
      required(domain === 'media', 'Acceptance store supports installed creator media only.');
      return snapshot(false);
    },
    readSelectedBlob: async (sha256, { maxBytes } = {}) => {
      const blob = assets.get(sha256);
      required(
        !blob || maxBytes === undefined || blob.size <= maxBytes,
        'Installed acceptance asset exceeds its read bound.',
      );
      return blob?.slice() ?? null;
    },
    usage: async () => ({
      usedBytes: [...assets.values()].reduce((total, blob) => total + blob.size, 0),
      reservedBytes: 0,
      limitBytes,
    }),
    commitDomain: async (domain, prepared, { expectedGeneration } = {}) => {
      required(domain === 'media', 'Acceptance store supports installed creator media only.');
      required(expectedGeneration === generation, 'Acceptance store generation changed.');
      required(
        prepared?.library && Array.isArray(prepared.assets),
        'Installed creator commit is invalid.',
      );
      library = structuredClone(prepared.library);
      assets = new Map(prepared.assets.map((asset) => [asset.sha256, asset.blob.slice()]));
      generation += 1;
      return generation;
    },
  });
}

export function createMemoryJourneyAcceptanceBackend(profileKey) {
  let profile = emptyJourneyProfile();
  return Object.freeze({
    profileKey,
    read: async () => structuredClone(profile),
    commit: async (events) => {
      for (const event of events) profile = applyJourneyEvent(profile, event);
      return structuredClone(profile);
    },
  });
}

const replayCommands = (replay) =>
  replay.segments.flatMap((segment) => Array.from({ length: segment.ticks }, () => segment.input));

export function createBoundedFetch(fetchImpl, timeoutMs) {
  required(typeof fetchImpl === 'function', 'Fetch implementation is required.');
  boundedInteger(timeoutMs, 'Request timeout', 100, 60_000);
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error('Community request timed out.')),
      timeoutMs,
    );
    const external = init.signal;
    const abort = () => controller.abort(external?.reason);
    external?.addEventListener('abort', abort, { once: true });
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', abort);
    }
  };
}

const json = async (response, action) => {
  const source = await response.text();
  required(source.length <= 256 * 1024, `${action} returned too much data.`);
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`${action} returned unreadable data.`);
  }
  required(response.ok, `${action} failed (${response.status}).`);
  return value;
};

const authProvider = (headers) => async () => headers;
const stageError = (stage, error, partialReceipt) => {
  const wrapped = new Error(`Deployed community acceptance failed during ${stage}.`, {
    cause: error,
  });
  wrapped.name = 'DeployedCommunityAcceptanceError';
  wrapped.stage = stage;
  wrapped.code = 'acceptance_step_failed';
  wrapped.receipt = Object.freeze({
    ...partialReceipt,
    status: 'failed',
    failedStage: stage,
    errorCode: wrapped.code,
  });
  return wrapped;
};

async function acceptancePackage({ namespace, runId }) {
  const name = `Deployment acceptance ${namespace} ${runId}`;
  const generated = generateCreatorProject({
    id: `acceptance-${runId}`,
    name,
    seed: Number.parseInt(runId.slice(0, 6), 36),
  });
  const project = structuredClone(generated.project);
  const picture = new Blob([PNG_1X1], { type: 'image/png' });
  const sha256 = await creatorSHA256(await picture.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'acceptance-picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: picture.size,
      width: 1,
      height: 1,
      alt: 'Deployment acceptance fixture',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'acceptance-picture';
  const prepared = await prepareCreatorBundle(
    {
      project,
      packId: project.packs[0].id,
      themes: await themesPromise,
      provenance: generated.provenance,
      credits: {
        creator: 'RevealLine deployed acceptance runner',
        picture: 'Embedded generated test fixture',
        license: 'Acceptance testing only',
      },
    },
    [{ sha256, blob: picture }],
    { decodeImage: inspectAcceptanceImage },
  );
  return exportCreatorBundle(prepared, approveCreatorBundle(prepared));
}

async function findAdminReport({ fetchImpl, baseURL, auth, reportId }) {
  let cursor = null;
  for (let page = 0; page < 10; page += 1) {
    const url = new URL('v1/admin/reports', baseURL);
    url.searchParams.set('status', 'open');
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);
    const body = await json(
      await fetchImpl(url, { headers: auth, cache: 'no-store' }),
      'Report queue',
    );
    required(Array.isArray(body.reports) && body.reports.length <= 50, 'Report queue is invalid.');
    const match = body.reports.find((report) => report?.id === reportId);
    if (match) return match;
    if (body.nextCursor === null) break;
    required(
      typeof body.nextCursor === 'string' && body.nextCursor.length <= 256,
      'Report cursor is invalid.',
    );
    cursor = body.nextCursor;
  }
  throw new Error('The submitted report was not visible in the bounded administrator queue.');
}

async function adminPost({ fetchImpl, baseURL, auth, path, body, action }) {
  return json(
    await fetchImpl(new URL(path, baseURL), {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify(body),
    }),
    action,
  );
}

/** Runs a real deployed-service journey. It publishes uniquely named test content,
 * verifies another creator cannot operate the owner's draft, then unlists the
 * resulting edition through the administrator boundary. */
export async function runDeployedCommunityJourney(input, adapters = {}) {
  const config = validateDeployedJourneyConfig(input);
  const fetchImpl = createBoundedFetch(
    adapters.fetchImpl ?? globalThis.fetch,
    config.requestTimeoutMs,
  );
  const now = adapters.now ?? (() => Date.now());
  const sleep =
    adapters.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const runId = (adapters.randomUUID ?? randomUUID)().replaceAll('-', '').slice(0, 10);
  required(/^[a-f0-9]{10}$/u.test(runId), 'Acceptance run identity is invalid.');
  const startedAtMs = now();
  const receipt = {
    format: DEPLOYED_ACCEPTANCE_FORMAT,
    status: 'running',
    namespace: config.namespace,
    runId,
    serviceOrigin: new URL(config.baseURL).origin,
    startedAt: new Date(startedAtMs).toISOString(),
  };
  let stage = 'health';
  let editionId = null;
  const creatorStore = adapters.creatorStore ?? createMemoryCreatorAcceptanceStore();
  const stateStore = adapters.stateStore ?? createMemoryCommunityStateStore();
  const downloadStore = adapters.downloadStore ?? createMemoryCommunityDownloadStore();
  const adminCleanup = async () => {
    if (!editionId) return 'not-required';
    try {
      await adminPost({
        fetchImpl,
        baseURL: config.baseURL,
        auth: config.auth.admin,
        path: `v1/admin/catalog/${editionId}/unlist`,
        body: { reason: `Acceptance cleanup ${config.namespace}/${runId}.` },
        action: 'Acceptance cleanup',
      });
      return 'unlisted';
    } catch {
      return 'failed';
    }
  };

  try {
    const health = await json(
      await fetchImpl(new URL('health', config.baseURL), { cache: 'no-store' }),
      'Health check',
    );
    required(health?.status === 'ok', 'Health check is not ready.');

    stage = 'package';
    const blob = await acceptancePackage({ namespace: config.namespace, runId });
    const packageSha256 = await creatorSHA256(await blob.arrayBuffer());
    const title = `Acceptance ${config.namespace} ${runId}`;
    const slug = `acceptance-${config.namespace}-${runId}`;
    const version = `0.0.0-acceptance-${runId}`;

    stage = 'publish';
    const tusUpload = createTusBrowserUpload({
      baseURL: config.baseURL,
      fetchImpl,
      storage: memoryStorage(),
      chunkBytes: 1024 * 1024,
    });
    const creatorA = createCommunityClient({
      baseURL: config.baseURL,
      fetchImpl,
      authHeaders: authProvider(config.auth.creatorA),
      resumableUpload: tusUpload,
    });
    const creatorB = createCommunityClient({
      baseURL: config.baseURL,
      fetchImpl,
      authHeaders: authProvider(config.auth.creatorB),
      resumableUpload: tusUpload,
    });
    const publisher = createCommunityPublisher({
      client: creatorA,
      decodeImage: inspectAcceptanceImage,
    });
    await publisher.select(blob);
    const queued = await publisher.publish({
      title,
      slug,
      version,
      description: `Disposable deployed acceptance run ${config.namespace}/${runId}.`,
    });
    editionId = queued.editionId;
    required(editionId, 'Submission did not return an edition identity.');
    receipt.submissionId = queued.id;
    receipt.editionId = editionId;
    receipt.package = { sha256: packageSha256, bytes: blob.size };

    stage = 'ownership';
    let creatorBIsolation = false;
    try {
      await creatorB.submission(queued.id);
    } catch {
      creatorBIsolation = true;
    }
    required(creatorBIsolation, 'Creator B could read Creator A submission.');

    stage = 'validation';
    const deadline = now() + config.validationTimeoutMs;
    let polls = 0;
    let published;
    while (now() <= deadline) {
      polls += 1;
      const current = await publisher.status(queued.id);
      if (current.status === 'published') {
        published = current;
        break;
      }
      required(
        current.status !== 'rejected',
        `Validation rejected the package (${current.rejectionCode ?? 'unknown'}).`,
      );
      required(
        ['queued', 'validating'].includes(current.status),
        `Validation ended in unexpected state ${current.status}.`,
      );
      await sleep(config.pollIntervalMs);
    }
    required(published, 'Validation did not finish within the configured deadline.');
    receipt.validation = { status: 'published', polls };

    stage = 'discover-download';
    const page = await creatorB.catalog({ query: runId, limit: 50 });
    const discovered = page.editions.find((edition) => edition.editionId === editionId);
    required(discovered, 'Creator B could not discover the published edition.');
    const downloaded = await creatorB.download(discovered);
    const downloadedSha256 = await creatorSHA256(await downloaded.arrayBuffer());
    required(
      downloaded.size === blob.size && downloadedSha256 === packageSha256,
      'Downloaded bytes differ from the published package.',
    );
    receipt.discovery = {
      creatorBIsolation,
      exactDownload: true,
      sha256: downloadedSha256,
      bytes: downloaded.size,
    };

    stage = 'install-play';
    await downloadStore.put(editionId, downloaded);
    const library = createCommunityLibrary({
      client: creatorB,
      creatorStore,
      stateStore,
      downloadStore,
      decodeImage: inspectAcceptanceImage,
    });
    const installed = await library.install(discovered, { offline: true });
    const installedPack = await loadInstalledCreatorBundle(
      creatorStore,
      installed.creatorEditionId,
      {
        decodeImage: inspectAcceptanceImage,
      },
    );
    const route = installedPack.manifest.evidence.find(
      (entry) => entry.difficulty === 'standard' && entry.turnPolicy === 'immediate',
    );
    required(route, 'Installed package has no standard verified route.');
    const commands = replayCommands(route.replay);
    required(commands.length > 0, 'Installed verified route is empty.');
    const runtime = createCreatorRuntime(installedPack, {
      decodeImage: decodeAcceptanceImage,
    });
    const attempt = await runtime.start({
      missionId: route.missionId,
      difficulty: route.difficulty,
      turnPolicy: route.turnPolicy,
    });
    for (const command of commands) runtime.step(command);
    required(attempt.run.status === 'won', 'Installed verified route did not complete.');
    const completion = await runtime.completion();
    runtime.dispose();
    const profileKey = creatorProfileKey(installed.creatorEditionId);
    const profileBackend =
      adapters.profileBackend ?? createMemoryJourneyAcceptanceBackend(profileKey);
    const profile = createJourneyProfileStore({ backend: profileBackend, profileKey });
    await profile.load();
    profile.record(completion);
    required(await profile.flush(), 'Completion receipt did not persist.');
    const reloadedProfile = createJourneyProfileStore({ backend: profileBackend, profileKey });
    await reloadedProfile.load();
    const retainedCompletion = reloadedProfile.snapshot().clears.solo[completion.missionId];
    required(
      retainedCompletion?.runId === completion.runId &&
        retainedCompletion.gameplayId === completion.gameplayId &&
        retainedCompletion.difficulty === completion.difficulty,
      'Reloaded completion differs from the legal win.',
    );
    const mission = installedPack.manifest.content.project.missions.find(
      (candidate) => candidate.id === completion.missionId,
    );
    const picture = installedPack.manifest.content.project.assets.find(
      (asset) => asset.id === mission?.presentation?.backgroundAssetId,
    );
    required(
      picture && installedPack.assets.some((asset) => asset.sha256 === picture.sha256),
      'Completed mission did not retain its exact earned picture.',
    );
    receipt.play = {
      creatorEditionId: installed.creatorEditionId,
      missionId: completion.missionId,
      gameplayId: completion.gameplayId,
      completionReloaded: true,
      pictureSha256: picture.sha256,
    };

    stage = 'report';
    const reported = await creatorB.reportEdition(editionId, {
      reason: 'other',
      details: `Automated deployed acceptance report ${config.namespace}/${runId}.`,
    });
    const reportId = reported?.report?.id;
    required(
      REPORT_ID.test(reportId) && reported.report.status === 'open',
      'Report response is invalid.',
    );
    const queuedReport = await findAdminReport({
      fetchImpl,
      baseURL: config.baseURL,
      auth: config.auth.admin,
      reportId,
    });
    required(
      queuedReport.editionId === editionId && !('reporterSubject' in queuedReport),
      'Administrator report projection is invalid.',
    );

    stage = 'moderation';
    const reason = `Acceptance removal ${config.namespace}/${runId}.`;
    const unlisted = await adminPost({
      fetchImpl,
      baseURL: config.baseURL,
      auth: config.auth.admin,
      path: `v1/admin/catalog/${editionId}/unlist`,
      body: { reason },
      action: 'Administrator unlisting',
    });
    required(
      unlisted?.editionId === editionId && unlisted.status === 'unlisted',
      'Administrator unlisting response is invalid.',
    );
    const resolved = await adminPost({
      fetchImpl,
      baseURL: config.baseURL,
      auth: config.auth.admin,
      path: `v1/admin/reports/${reportId}/resolve`,
      body: { resolution: reason },
      action: 'Report resolution',
    });
    required(
      resolved?.report?.id === reportId && resolved.report.status === 'resolved',
      'Report resolution response is invalid.',
    );
    const hidden = await fetchImpl(new URL(`v1/catalog/${editionId}`, config.baseURL), {
      cache: 'no-store',
    });
    required(hidden.status === 404, 'Unlisted edition remains publicly available.');
    receipt.moderation = { reportId, reportStatus: 'resolved', editionStatus: 'unlisted' };

    stage = 'offline-replay';
    const offlinePack = await loadInstalledCreatorBundle(creatorStore, installed.creatorEditionId, {
      decodeImage: inspectAcceptanceImage,
    });
    const offlineRuntime = createCreatorRuntime(offlinePack, {
      decodeImage: decodeAcceptanceImage,
    });
    const replayed = await offlineRuntime.start({
      missionId: completion.missionId,
      difficulty: completion.difficulty,
      turnPolicy: route.turnPolicy,
    });
    offlineRuntime.step(commands[0]);
    required(replayed.run.tick === 1, 'Installed edition could not start without the service.');
    offlineRuntime.dispose();
    receipt.offline = { exactEditionReloaded: true, replayStarted: true };
    receipt.status = 'passed';
    receipt.completedAt = new Date(now()).toISOString();
    receipt.durationMs = Math.max(0, now() - startedAtMs);
    return Object.freeze(structuredClone(receipt));
  } catch (error) {
    receipt.cleanup = await adminCleanup();
    receipt.completedAt = new Date(now()).toISOString();
    receipt.durationMs = Math.max(0, now() - startedAtMs);
    throw stageError(stage, error, receipt);
  }
}
