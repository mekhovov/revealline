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

export async function resolveDeployedAcceptanceAccount(account, { baseURL, fetchImpl }) {
  if (!Object.hasOwn(account, 'email')) return account;
  required(typeof fetchImpl === 'function', 'Account sign-in fetch adapter is required.');
  let response;
  try {
    response = await fetchImpl(new URL('api/auth/sign-in/email', baseURL), {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: account.email, password: account.password }),
    });
    const body = await response.text();
    required(body.length <= MAX_RESPONSE_BYTES, 'Account sign-in returned too much data.');
    required(response.ok, `Account sign-in failed (${response.status}).`);
    return Object.freeze({ cookie: sessionCookie(response.headers) });
  } catch (error) {
    if (error?.message === 'Account sign-in returned too much data.') throw error;
    if (/^Account sign-in failed \(\d+\)\.$/u.test(error?.message ?? '')) throw error;
    if (error?.message === 'Account sign-in did not return a bounded session cookie.') throw error;
    throw new Error('Account sign-in failed.');
  }
}
