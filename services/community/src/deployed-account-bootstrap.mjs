import { randomUUID } from 'node:crypto';
import {
  resolveDeployedAcceptanceAccount,
  validateDeployedAcceptanceAccount,
} from './deployed-acceptance-auth.mjs';

export const DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT =
  'revealline-community-account-bootstrap-acceptance.v1';
export const ACCOUNT_BOOTSTRAP_OPT_IN = 'I_UNDERSTAND_THIS_CREATES_DISPOSABLE_TEST_ACCOUNTS';

const MAX_RESPONSE_BYTES = 64 * 1024;
const NAMESPACE = /^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])$/u;
const RELEASE_VERSION = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const SOURCE_REVISION = /^[a-f0-9]{40}$/u;
const MESSAGE_ID = /^[a-f0-9]{64}$/u;

const required = (condition, message) => {
  if (!condition) throw new Error(message);
};

const boundedInteger = (value, name, minimum, maximum) => {
  required(
    Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${name} is invalid.`,
  );
  return value;
};

const boundedText = (value, name, minimum, maximum) => {
  required(
    typeof value === 'string' &&
      value.length >= minimum &&
      value.length <= maximum &&
      !/[\u0000-\u001f\u007f]/u.test(value),
    `${name} is invalid.`,
  );
  return value;
};

const httpsURL = (value, name) => {
  const url = new URL(value);
  required(
    url.protocol === 'https:' && !url.username && !url.password && !url.hash,
    `${name} must be an absolute HTTPS URL without credentials or a fragment.`,
  );
  return url;
};

const creator = (value, name) => {
  required(value && typeof value === 'object' && !Array.isArray(value), `${name} is required.`);
  required(
    Object.keys(value).length === 3 &&
      Object.hasOwn(value, 'name') &&
      Object.hasOwn(value, 'email') &&
      Object.hasOwn(value, 'password'),
    `${name} must contain name, email, and password only.`,
  );
  const email = boundedText(value.email, `${name} email`, 3, 320);
  required(email.includes('@'), `${name} email is invalid.`);
  return Object.freeze({
    name: boundedText(value.name, `${name} name`, 1, 80),
    email,
    password: boundedText(value.password, `${name} password`, 8, 1_024),
  });
};

export function validateDeployedAccountBootstrapConfig(input = {}) {
  required(
    input.optIn === ACCOUNT_BOOTSTRAP_OPT_IN,
    'Explicit disposable-account acceptance opt-in is required.',
  );
  required(
    typeof input.namespace === 'string' && NAMESPACE.test(input.namespace),
    'A unique 8-40 character lowercase namespace is required.',
  );
  const baseURL = httpsURL(input.baseURL, 'Community service URL');
  required(!baseURL.search, 'Community service URL must not contain a query.');
  baseURL.pathname = baseURL.pathname.endsWith('/') ? baseURL.pathname : `${baseURL.pathname}/`;
  required(
    RELEASE_VERSION.test(input.expectedRelease?.version ?? '') &&
      SOURCE_REVISION.test(input.expectedRelease?.sourceRevision ?? ''),
    'Exact expected release version and source revision are required.',
  );
  const captureURL = httpsURL(input.mailCapture?.url, 'Mail capture URL');
  const captureToken = boundedText(
    input.mailCapture?.authorizationToken,
    'Mail capture authorization token',
    32,
    4_096,
  );
  return Object.freeze({
    baseURL: baseURL.href,
    namespace: input.namespace,
    expectedRelease: Object.freeze({ ...input.expectedRelease }),
    creators: Object.freeze({
      creatorA: creator(input.creators?.creatorA, 'Creator A'),
      creatorB: creator(input.creators?.creatorB, 'Creator B'),
    }),
    admin: validateDeployedAcceptanceAccount(input.admin, 'Administrator authentication'),
    mailCapture: Object.freeze({ url: captureURL.href, authorizationToken: captureToken }),
    requestTimeoutMs: boundedInteger(
      input.requestTimeoutMs ?? 15_000,
      'Request timeout',
      100,
      60_000,
    ),
    pollIntervalMs: boundedInteger(input.pollIntervalMs ?? 1_000, 'Poll interval', 50, 10_000),
    mailTimeoutMs: boundedInteger(input.mailTimeoutMs ?? 120_000, 'Mail timeout', 100, 600_000),
  });
}

const cancelBody = (body) => {
  try {
    body?.cancel()?.catch(() => {});
  } catch {
    // Best effort only. A remote stream cannot extend the configured deadline.
  }
};

const requestError = (message) => {
  const error = new Error(message);
  error.safeAccountBootstrapError = true;
  return error;
};

const requestJSON = async (
  fetchImpl,
  url,
  init,
  timeoutMs,
  action,
  { allowNotFound = false, acceptedStatuses = [] } = {},
) => {
  const controller = new AbortController();
  let reader;
  let rejectTimeout;
  const timeoutError = requestError(`${action} timed out.`);
  const deadline = new Promise((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    rejectTimeout(timeoutError);
    controller.abort(timeoutError);
    cancelBody(reader);
  }, timeoutMs);
  let response;
  try {
    response = await Promise.race([
      fetchImpl(url, { ...init, signal: controller.signal }),
      deadline,
    ]);
    if (allowNotFound && response.status === 404) {
      cancelBody(response.body);
      return null;
    }
    if (acceptedStatuses.includes(response.status)) {
      cancelBody(response.body);
      return { status: response.status };
    }
    if (!response.ok) {
      cancelBody(response.body);
      throw requestError(`${action} failed (${response.status}).`);
    }
    if (!response.body) return null;
    reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        cancelBody(reader);
        throw requestError(`${action} returned too much data.`);
      }
      chunks.push(value);
    }
    const source = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
    try {
      return source ? JSON.parse(source) : null;
    } catch {
      throw requestError(`${action} returned unreadable data.`);
    }
  } catch (error) {
    if (error?.safeAccountBootstrapError === true) throw error;
    throw requestError(`${action} failed.`);
  } finally {
    clearTimeout(timer);
    if (reader) {
      cancelBody(reader);
      try {
        reader.releaseLock();
      } catch {
        // A failed remote reader is already contained by the request error.
      }
    } else if (response?.body) cancelBody(response.body);
  }
};

const postJSON = (fetchImpl, url, body, timeoutMs, action, headers = {}) =>
  requestJSON(
    fetchImpl,
    url,
    {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
    action,
  );

const capturedVerification = async ({ config, account, fetchImpl, sleep, now, requestedAfter }) => {
  const deadline = now() + config.mailTimeoutMs;
  let polls = 0;
  while (now() <= deadline) {
    polls += 1;
    const body = await requestJSON(
      fetchImpl,
      new URL(config.mailCapture.url),
      {
        method: 'POST',
        cache: 'no-store',
        redirect: 'error',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.mailCapture.authorizationToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ kind: 'verify-email', to: account.email, after: requestedAfter }),
      },
      config.requestTimeoutMs,
      'Mail capture',
      { allowNotFound: true },
    );
    if (body) {
      const message = body.message;
      required(
        message &&
          MESSAGE_ID.test(message.id ?? '') &&
          message.kind === 'verify-email' &&
          message.to === account.email &&
          typeof message.expiresAt === 'string' &&
          Number.isFinite(Date.parse(message.expiresAt)) &&
          Date.parse(message.expiresAt) > now(),
        'Mail capture returned an invalid verification message.',
      );
      const actionURL = httpsURL(message.actionURL, 'Captured verification action URL');
      required(
        actionURL.origin === new URL(config.baseURL).origin &&
          actionURL.pathname.endsWith('/api/auth/verify-email') &&
          actionURL.searchParams.get('token'),
        'Captured verification action URL has an unexpected origin.',
      );
      return { actionURL, polls };
    }
    await sleep(config.pollIntervalMs);
  }
  throw new Error('Verification mail did not arrive within the configured deadline.');
};

const verifyAccount = async ({ config, account, fetchImpl, sleep, now }) => {
  const requestedAfter = new Date(now()).toISOString();
  const signUp = await postJSON(
    fetchImpl,
    new URL('api/auth/sign-up/email', config.baseURL),
    account,
    config.requestTimeoutMs,
    'Account sign-up',
    { origin: new URL(config.baseURL).origin },
  );
  required(
    signUp?.token === null &&
      signUp?.user?.email === account.email &&
      signUp.user.emailVerified === false,
    'Account sign-up did not create an unverified account.',
  );
  const captured = await capturedVerification({
    config,
    account,
    fetchImpl,
    sleep,
    now,
    requestedAfter,
  });
  const verification = await requestJSON(
    fetchImpl,
    captured.actionURL,
    { cache: 'no-store', redirect: 'manual' },
    config.requestTimeoutMs,
    'Account verification',
    { acceptedStatuses: [302, 303] },
  );
  required([302, 303].includes(verification.status), 'Account verification did not redirect.');
  const auth = await resolveDeployedAcceptanceAccount(account, {
    baseURL: config.baseURL,
    fetchImpl,
    timeoutMs: config.requestTimeoutMs,
  });
  const session = await requestJSON(
    fetchImpl,
    new URL('api/auth/get-session', config.baseURL),
    { cache: 'no-store', headers: auth },
    config.requestTimeoutMs,
    'Verified account session',
  );
  required(
    session?.user?.email === account.email && session.user.emailVerified === true,
    'Verified account session is invalid.',
  );
  return captured.polls;
};

const stageError = (stage, error, receipt) => {
  const wrapped = new Error(`Deployed account bootstrap failed during ${stage}.`, { cause: error });
  wrapped.name = 'DeployedAccountBootstrapError';
  wrapped.stage = stage;
  wrapped.code = 'deployed_account_bootstrap_failed';
  wrapped.receipt = Object.freeze({
    ...receipt,
    status: 'failed',
    failedStage: stage,
    errorCode: wrapped.code,
  });
  return wrapped;
};

export async function runDeployedAccountBootstrap(input, adapters = {}) {
  const config = validateDeployedAccountBootstrapConfig(input);
  const fetchImpl = adapters.fetchImpl ?? globalThis.fetch;
  required(typeof fetchImpl === 'function', 'Fetch implementation is required.');
  const sleep =
    adapters.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = adapters.now ?? (() => Date.now());
  const runId = (adapters.randomUUID ?? randomUUID)().replaceAll('-', '').slice(0, 10);
  required(/^[a-f0-9]{10}$/u.test(runId), 'Acceptance run identity is invalid.');
  const startedAtMs = now();
  const receipt = {
    format: DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT,
    status: 'running',
    namespace: config.namespace,
    runId,
    serviceOrigin: new URL(config.baseURL).origin,
    startedAt: new Date(startedAtMs).toISOString(),
  };
  let stage = 'identity';
  try {
    const identity = await requestJSON(
      fetchImpl,
      new URL('version', config.baseURL),
      { cache: 'no-store' },
      config.requestTimeoutMs,
      'Release identity',
    );
    required(
      identity?.format === 'revealline-community-release.v1' &&
        identity.version === config.expectedRelease.version &&
        identity.sourceRevision === config.expectedRelease.sourceRevision,
      'Deployed release identity differs from the expected immutable source.',
    );
    receipt.release = { ...config.expectedRelease };

    stage = 'readiness';
    const health = await requestJSON(
      fetchImpl,
      new URL('health', config.baseURL),
      { cache: 'no-store' },
      config.requestTimeoutMs,
      'Health check',
    );
    required(health?.status === 'ok', 'Health check is not ready.');
    const readiness = await requestJSON(
      fetchImpl,
      new URL('ready', config.baseURL),
      { cache: 'no-store' },
      config.requestTimeoutMs,
      'Readiness check',
    );
    required(readiness?.status === 'ready', 'Deployment readiness check did not pass.');
    receipt.readiness = { status: 'ready' };

    const mailPolls = {};
    for (const [key, account] of Object.entries(config.creators)) {
      stage = `${key}-verification`;
      mailPolls[key] = await verifyAccount({ config, account, fetchImpl, sleep, now });
    }
    receipt.accounts = { creatorsVerified: 2, mailPolls };

    stage = 'administrator-role';
    const admin = await resolveDeployedAcceptanceAccount(config.admin, {
      baseURL: config.baseURL,
      fetchImpl,
      timeoutMs: config.requestTimeoutMs,
    });
    const reportQueue = await requestJSON(
      fetchImpl,
      new URL('v1/admin/reports?limit=1', config.baseURL),
      { cache: 'no-store', headers: admin },
      config.requestTimeoutMs,
      'Administrator role check',
    );
    required(Array.isArray(reportQueue?.reports), 'Administrator report queue is invalid.');
    receipt.administrator = { roleBound: true };
    receipt.status = 'passed';
    receipt.completedAt = new Date(now()).toISOString();
    receipt.durationMs = Math.max(0, now() - startedAtMs);
    return Object.freeze(structuredClone(receipt));
  } catch (error) {
    receipt.completedAt = new Date(now()).toISOString();
    receipt.durationMs = Math.max(0, now() - startedAtMs);
    throw stageError(stage, error, receipt);
  }
}
