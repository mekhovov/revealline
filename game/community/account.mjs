import { boundedJSON, required } from '../data-json.mjs';

const readJSON = async (response) => {
  const source = await response.text();
  let value = null;
  if (source)
    try {
      value = boundedJSON(source, { maxBytes: 64 * 1024, maxNodes: 2_000, maxDepth: 10 });
    } catch {
      throw new Error('The account service returned unreadable data.');
    }
  if (!response.ok)
    throw new Error(
      value?.message || value?.error?.message || `Account request failed (${response.status}).`,
    );
  return value;
};

const user = (source) => {
  if (!source) return null;
  required(source && typeof source === 'object', 'Account session is invalid.');
  required(
    typeof source.id === 'string' && source.id.length <= 256,
    'Account identity is invalid.',
  );
  required(
    typeof source.email === 'string' && source.email.length <= 320,
    'Account email is invalid.',
  );
  return Object.freeze({
    id: source.id,
    email: source.email,
    name: typeof source.name === 'string' && source.name.length <= 160 ? source.name : '',
  });
};

/** Same-origin Better Auth browser boundary. Cookies remain HttpOnly and are
 * sent by fetch; this client never copies a session token into local storage. */
export function createCommunityAccountClient({
  baseURL,
  fetchImpl = globalThis.fetch,
  origin = globalThis.location?.origin ?? 'https://local',
} = {}) {
  required(typeof fetchImpl === 'function', 'Account network adapter is required.');
  const base = new URL(baseURL ?? '/', `${origin}/`);
  required(
    base.origin === new URL(origin).origin,
    'Creator accounts require the same-origin service.',
  );
  const request = async (path, init = {}) =>
    readJSON(
      await fetchImpl(new URL(path, base), {
        credentials: 'same-origin',
        cache: 'no-store',
        ...init,
        headers: init.body
          ? { 'content-type': 'application/json', ...(init.headers ?? {}) }
          : init.headers,
      }),
    );
  const session = async () => {
    const value = await request('api/auth/get-session');
    return value?.user
      ? Object.freeze({ user: user(value.user), expiresAt: value.session?.expiresAt ?? null })
      : null;
  };
  return Object.freeze({
    session,
    headers: async () => ({}),
    async signUp({ name, email, password }) {
      required(
        typeof name === 'string' && name.trim().length >= 1 && name.length <= 160,
        'Name is required.',
      );
      required(typeof email === 'string' && email.length <= 320, 'Email is invalid.');
      required(
        typeof password === 'string' && password.length >= 8 && password.length <= 128,
        'Password must be 8–128 characters.',
      );
      await request('api/auth/sign-up/email', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      return session();
    },
    async signIn({ email, password }) {
      required(typeof email === 'string' && email.length <= 320, 'Email is invalid.');
      required(
        typeof password === 'string' && password.length >= 1 && password.length <= 128,
        'Password is required.',
      );
      await request('api/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      return session();
    },
    async signOut() {
      await request('api/auth/sign-out', { method: 'POST', body: '{}' });
      return null;
    },
  });
}
