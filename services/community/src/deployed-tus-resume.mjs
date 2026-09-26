import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCommunityClient } from '../../../game/community/client.mjs';
import { createCommunityPublisher } from '../../../game/community/publisher.mjs';
import { createTusBrowserUpload } from '../../../game/community/tus-upload.mjs';
import { creatorSHA256 } from '../../../game/creator/bytes.mjs';
import {
  approveCreatorBundle,
  exportCreatorBundle,
  prepareCreatorBundle,
} from '../../../game/creator/bundle.mjs';
import { generateCreatorProject } from '../../../game/creator/templates.mjs';
import { startTusFaultProxy } from '../scripts/tus-fault-proxy.mjs';
import {
  ACCEPTANCE_PNG_HEIGHT,
  ACCEPTANCE_PNG_WIDTH,
  createAcceptancePng,
  inspectAcceptanceImage,
} from './acceptance-fixture.mjs';

export const DEPLOYED_TUS_ACCEPTANCE_FORMAT = 'revealline-community-deployed-tus-acceptance.v1';
export const DEPLOYED_TUS_DESTRUCTIVE_OPT_IN =
  'I_UNDERSTAND_THIS_PUBLISHES_AND_UNLISTS_TEST_CONTENT';

const NAMESPACE = /^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])$/u;
const RELEASE_VERSION = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const SOURCE_REVISION = /^[a-f0-9]{40}$/u;
const VALIDATOR_VERSION = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,127})$/u;
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

export function validateDeployedTusResumeConfig(input = {}) {
  required(
    input.optIn === DEPLOYED_TUS_DESTRUCTIVE_OPT_IN,
    'Explicit destructive acceptance opt-in is required.',
  );
  required(
    typeof input.namespace === 'string' && NAMESPACE.test(input.namespace),
    'A unique 8-40 character lowercase namespace is required.',
  );
  const baseURL = new URL(input.baseURL);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(baseURL.hostname);
  required(
    baseURL.protocol === 'https:' || (baseURL.protocol === 'http:' && loopback),
    'Deployed community service URL must use HTTPS outside loopback.',
  );
  required(
    !baseURL.username && !baseURL.password && !baseURL.search && !baseURL.hash,
    'Community service URL must not contain credentials, a query, or a fragment.',
  );
  baseURL.pathname = baseURL.pathname.endsWith('/') ? baseURL.pathname : `${baseURL.pathname}/`;
  required(
    RELEASE_VERSION.test(input.expectedRelease?.version ?? '') &&
      SOURCE_REVISION.test(input.expectedRelease?.sourceRevision ?? '') &&
      VALIDATOR_VERSION.test(input.expectedRelease?.validatorVersion ?? ''),
    'Exact expected release, source and validator versions are required.',
  );
  return Object.freeze({
    baseURL: baseURL.href,
    namespace: input.namespace,
    expectedRelease: Object.freeze({
      version: input.expectedRelease.version,
      sourceRevision: input.expectedRelease.sourceRevision,
      validatorVersion: input.expectedRelease.validatorVersion,
    }),
    auth: Object.freeze({
      creator: exactAuth(input.auth?.creator, 'Creator authentication'),
      admin: exactAuth(input.auth?.admin, 'Administrator authentication'),
    }),
    dropAfterBytes: boundedInteger(
      input.dropAfterBytes ?? 17,
      'Dropped PATCH byte count',
      1,
      64 * 1024,
    ),
    chunkBytes: boundedInteger(
      input.chunkBytes ?? 1024 * 1024,
      'Upload chunk size',
      1024,
      8 * 1024 * 1024,
    ),
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
    size: () => values.size,
  });
};

const authProvider = (headers) => async () => headers;

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

const boundedFetch =
  (fetchImpl, timeoutMs) =>
  async (input, init = {}) => {
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

const stageError = (stage, error, receipt) => {
  const wrapped = new Error(`Deployed tus acceptance failed during ${stage}.`, { cause: error });
  wrapped.name = 'DeployedTusAcceptanceError';
  wrapped.stage = stage;
  wrapped.code = 'deployed_tus_acceptance_failed';
  wrapped.receipt = Object.freeze({
    ...receipt,
    status: 'failed',
    failedStage: stage,
    errorCode: wrapped.code,
  });
  return wrapped;
};

async function acceptancePackage({ namespace, runId }) {
  const generated = generateCreatorProject({
    id: `tus-acceptance-${runId}`,
    name: `Tus acceptance ${namespace} ${runId}`,
    seed: Number.parseInt(runId.slice(0, 6), 36),
  });
  const project = structuredClone(generated.project);
  const picture = new Blob([createAcceptancePng()], { type: 'image/png' });
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
      width: ACCEPTANCE_PNG_WIDTH,
      height: ACCEPTANCE_PNG_HEIGHT,
      alt: 'Deployed tus acceptance fixture',
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
        creator: 'RevealLine deployed tus acceptance runner',
        picture: 'Embedded generated test fixture',
        license: 'Acceptance testing only',
      },
    },
    [{ sha256, blob: picture }],
    { decodeImage: inspectAcceptanceImage },
  );
  return exportCreatorBundle(prepared, approveCreatorBundle(prepared));
}

export async function runDeployedTusResumeAcceptance(input, adapters = {}) {
  const config = validateDeployedTusResumeConfig(input);
  const now = adapters.now ?? (() => Date.now());
  const sleep =
    adapters.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const runId = (adapters.randomUUID ?? randomUUID)().replaceAll('-', '').slice(0, 10);
  required(/^[a-f0-9]{10}$/u.test(runId), 'Acceptance run identity is invalid.');
  const startedAtMs = now();
  const receipt = {
    format: DEPLOYED_TUS_ACCEPTANCE_FORMAT,
    status: 'running',
    namespace: config.namespace,
    runId,
    serviceOrigin: new URL(config.baseURL).origin,
    startedAt: new Date(startedAtMs).toISOString(),
  };
  let stage = 'identity';
  let editionId = null;
  let proxy = null;
  let fetchImpl;
  const cleanup = async () => {
    if (!editionId || !fetchImpl) return 'not-required';
    try {
      const admin = createCommunityClient({
        baseURL: proxy.origin,
        fetchImpl,
        authHeaders: authProvider(config.auth.admin),
      });
      await admin.adminUnlistEdition(
        editionId,
        `Deployed tus acceptance cleanup ${config.namespace}/${runId}.`,
      );
      return 'unlisted';
    } catch {
      return 'failed';
    }
  };

  try {
    fetchImpl = boundedFetch(adapters.fetchImpl ?? globalThis.fetch, config.requestTimeoutMs);
    const identity = await json(
      await fetchImpl(new URL('version', config.baseURL), { cache: 'no-store' }),
      'Release identity',
    );
    required(
      identity?.format === 'revealline-community-release.v1' &&
        identity.version === config.expectedRelease.version &&
        identity.sourceRevision === config.expectedRelease.sourceRevision &&
        identity.validatorVersion === config.expectedRelease.validatorVersion,
      'Deployed release identity differs from the expected immutable source and validator.',
    );
    receipt.release = {
      version: identity.version,
      sourceRevision: identity.sourceRevision,
      validatorVersion: identity.validatorVersion,
    };

    stage = 'health';
    const health = await json(
      await fetchImpl(new URL('health', config.baseURL), { cache: 'no-store' }),
      'Health check',
    );
    required(health?.status === 'ok', 'Health check is not ready.');

    stage = 'readiness';
    const readiness = await json(
      await fetchImpl(new URL('ready', config.baseURL), { cache: 'no-store' }),
      'Readiness check',
    );
    required(readiness?.status === 'ready', 'Deployment readiness check did not pass.');
    receipt.readiness = { status: 'ready' };

    stage = 'proxy';
    proxy = await (adapters.startProxy ?? startTusFaultProxy)({
      upstreamURL: config.baseURL,
      allowRemoteUpstream: true,
      dropAfterBytes: config.dropAfterBytes,
      maximumRequestBytes: 32 * 1024 * 1024,
      requestTimeoutMs: config.requestTimeoutMs,
    });

    stage = 'package';
    const blob = await (adapters.createPackage ?? acceptancePackage)({
      namespace: config.namespace,
      runId,
    });
    required(blob instanceof Blob, 'Acceptance package builder returned invalid bytes.');
    required(blob.size > config.dropAfterBytes, 'Acceptance package is too small for the fault.');
    const packageSha256 = await creatorSHA256(await blob.arrayBuffer());
    const storage = memoryStorage();
    const resumableUpload = createTusBrowserUpload({
      baseURL: proxy.origin,
      fetchImpl,
      storage,
      chunkBytes: Math.min(config.chunkBytes, blob.size),
    });
    const creator = createCommunityClient({
      baseURL: proxy.origin,
      fetchImpl,
      authHeaders: authProvider(config.auth.creator),
      resumableUpload,
    });
    const trackedCreator = Object.freeze({
      ...creator,
      async createSubmission(metadata) {
        const created = await creator.createSubmission(metadata);
        receipt.submissionId = created?.submission?.id ?? null;
        editionId = created?.submission?.editionId ?? null;
        receipt.editionId = editionId;
        return created;
      },
    });
    const publisher = createCommunityPublisher({
      client: trackedCreator,
      decodeImage: inspectAcceptanceImage,
    });
    await publisher.select(blob);
    const metadata = {
      title: `Tus acceptance ${config.namespace} ${runId}`,
      slug: `tus-${config.namespace}-${runId}`,
      version: `0.0.0-tus-${runId}`,
      description: `Disposable deployed tus recovery acceptance ${config.namespace}/${runId}.`,
    };

    stage = 'interruption';
    let interrupted = false;
    try {
      await publisher.publish(metadata);
    } catch {
      interrupted = true;
    }
    const interruptedNetwork = proxy.snapshot();
    required(
      interrupted && interruptedNetwork.faultInjected,
      'The first PATCH was not interrupted.',
    );
    required(storage.size() === 1, 'Interrupted upload URL was not retained for recovery.');

    stage = 'resume';
    const queued = await publisher.publish(metadata);
    required(queued.editionId && queued.id, 'Resumed upload did not queue its submission.');
    editionId = queued.editionId;
    receipt.submissionId = queued.id;
    receipt.editionId = editionId;
    required(storage.size() === 0, 'Completed upload retained a stale resume URL.');
    const network = proxy.snapshot();
    required(network.submissionCreates === 1, 'Recovery created another submission.');
    required(network.uploadCreates === 1, 'Recovery created another tus resource.');
    required(
      network.committedBeforeDrop === config.dropAfterBytes &&
        network.headOffsets[0] === config.dropAfterBytes,
      'Recovery did not resume from the authoritative server offset.',
    );

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

    stage = 'exact-download';
    const catalog = await creator.catalog({ query: runId, limit: 50 });
    const edition = catalog.editions.find((candidate) => candidate.editionId === editionId);
    required(edition, 'Published tus acceptance edition was not discoverable.');
    const downloaded = await creator.download(edition);
    const downloadedSha256 = await creatorSHA256(await downloaded.arrayBuffer());
    required(
      downloaded.size === blob.size && downloadedSha256 === packageSha256,
      'Downloaded bytes differ from the resumed upload.',
    );

    stage = 'cleanup';
    const cleanupStatus = await cleanup();
    required(cleanupStatus === 'unlisted', 'Administrator cleanup did not unlist the edition.');
    receipt.package = { sha256: packageSha256, bytes: blob.size };
    receipt.resume = {
      interruptedAtBytes: config.dropAfterBytes,
      authoritativeHeadOffset: network.headOffsets[0],
      submissionCreates: network.submissionCreates,
      uploadCreates: network.uploadCreates,
      patchOffsets: [...network.patchOffsets],
    };
    receipt.validation = { status: 'published', polls };
    receipt.download = { exactBytes: true, sha256: downloadedSha256, bytes: downloaded.size };
    receipt.cleanup = cleanupStatus;
    receipt.status = 'passed';
    receipt.completedAt = new Date(now()).toISOString();
    receipt.durationMs = Math.max(0, now() - startedAtMs);
    return Object.freeze(structuredClone(receipt));
  } catch (error) {
    receipt.cleanup = await cleanup();
    receipt.completedAt = new Date(now()).toISOString();
    receipt.durationMs = Math.max(0, now() - startedAtMs);
    throw stageError(stage, error, receipt);
  } finally {
    await proxy?.close();
  }
}
