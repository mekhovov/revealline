const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1_024;
const MAX_HEADER_VALUE_LENGTH = 8_192;
const MAX_RESPONSE_BYTES = 64 * 1_024;

const required = (condition, message) => {
  if (!condition) throw new Error(message);
};

const credentialText = (value, { name, minimum, maximum }) => {
  required(
    typeof value === 'string' &&
      value.length >= minimum &&
      value.length <= maximum &&
      !/[\u0000\r\n]/u.test(value),
    `${name} is invalid.`,
  );
  return value;
};

export function validateDeployedAcceptanceAccount(value, name) {
  required(value && typeof value === 'object' && !Array.isArray(value), `${name} is required.`);
  const entries = Object.entries(value);
  const headerNames = new Set(entries.map(([key]) => key.toLowerCase()));
  required(
    !(headerNames.has('authorization') && headerNames.has('cookie')),
    `${name} must use exactly one credential form.`,
  );
  const usesPassword = entries.some(([key]) => key === 'email' || key === 'password');
  if (usesPassword) {
    required(
      entries.length === 2 && Object.hasOwn(value, 'email') && Object.hasOwn(value, 'password'),
      `${name} must use exactly one credential form.`,
    );
    const email = credentialText(value.email, {
      name: `${name} email`,
      minimum: 3,
      maximum: MAX_EMAIL_LENGTH,
    });
    required(email.includes('@'), `${name} email is invalid.`);
    return Object.freeze({
      email,
      password: credentialText(value.password, {
        name: `${name} password`,
        minimum: 8,
        maximum: MAX_PASSWORD_LENGTH,
      }),
    });
  }

  required(entries.length > 0 && entries.length <= 8, `${name} is invalid.`);
  for (const [key, header] of entries)
    required(
      /^[a-z0-9-]{1,64}$/iu.test(key) &&
        typeof header === 'string' &&
        header.length <= MAX_HEADER_VALUE_LENGTH &&
        !/[\u0000-\u001f\u007f]/u.test(header),
      `${name} is invalid.`,
    );
  return Object.freeze(Object.fromEntries(entries));
}

const sessionCookie = (headers) => {
  const sources =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')].filter(Boolean);
  for (const source of sources) {
    if (source.length > MAX_HEADER_VALUE_LENGTH || !/;\s*HttpOnly(?:;|$)/iu.test(source)) continue;
    const pair = source.slice(0, source.indexOf(';') < 0 ? source.length : source.indexOf(';'));
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (
      /^[-!#$%&'*+.^_`|~0-9A-Za-z]+$/u.test(name) &&
      /session/iu.test(name) &&
      value.length > 0 &&
      value.length <= MAX_HEADER_VALUE_LENGTH &&
      !/[\u0000-\u0020\u007f;,]/u.test(value)
    )
      return pair;
  }
  throw new Error('Account sign-in did not return a bounded session cookie.');
};

const cancelBody = (body) => {
  try {
    const cancellation = body?.cancel();
    cancellation?.catch(() => {});
  } catch {
    // Cancellation is best effort; the caller still receives the bounded error.
  }
};

const consumeBoundedBody = async (response, deadline) => {
  if (!response.body) return;
  const reader = response.body.getReader();
  deadline.setReader(reader);
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline.promise]);
      if (done) return;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        cancelBody(reader);
        throw new Error('Account sign-in returned too much data.');
      }
    }
  } finally {
    deadline.clearReader(reader);
    reader.releaseLock();
  }
};

export async function resolveDeployedAcceptanceAccount(
  account,
  { baseURL, fetchImpl, timeoutMs = 15_000 },
) {
  if (!Object.hasOwn(account, 'email')) return account;
  required(typeof fetchImpl === 'function', 'Account sign-in fetch adapter is required.');
  required(
    Number.isSafeInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 60_000,
    'Account sign-in timeout is invalid.',
  );
  const controller = new AbortController();
  let activeReader = null;
  let rejectTimeout;
  const timeoutError = new Error('Account sign-in timed out.');
  const timeout = new Promise((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    rejectTimeout(timeoutError);
    controller.abort(timeoutError);
    void cancelBody(activeReader);
  }, timeoutMs);
  const deadline = {
    promise: timeout,
    setReader: (reader) => {
      activeReader = reader;
    },
    clearReader: (reader) => {
      if (activeReader === reader) activeReader = null;
    },
  };
  let response;
  try {
    response = await Promise.race([
      fetchImpl(new URL('api/auth/sign-in/email', baseURL), {
        method: 'POST',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email: account.email, password: account.password }),
      }),
      timeout,
    ]);
    if (!response.ok) {
      cancelBody(response.body);
      throw new Error(`Account sign-in failed (${response.status}).`);
    }
    await consumeBoundedBody(response, deadline);
    return Object.freeze({ cookie: sessionCookie(response.headers) });
  } catch (error) {
    if (error?.message === 'Account sign-in returned too much data.') throw error;
    if (error?.message === 'Account sign-in timed out.') throw error;
    if (/^Account sign-in failed \(\d+\)\.$/u.test(error?.message ?? '')) throw error;
    if (error?.message === 'Account sign-in did not return a bounded session cookie.') throw error;
    throw new Error('Account sign-in failed.');
  } finally {
    clearTimeout(timer);
    if (response && activeReader) cancelBody(activeReader);
  }
}
