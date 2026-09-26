import { createHash } from 'node:crypto';

const MAX_EMAIL_LENGTH = 320;
const MAX_TOKEN_LENGTH = 4_096;
const MAX_ACTION_URL_LENGTH = 4_096;
const MAX_WEBHOOK_TOKEN_LENGTH = 4_096;

const boundedText = (value, { name, maxLength, minimum = 1 }) => {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new Error(`${name} is invalid.`);
  return value;
};

const secureURL = (value, { name, allowPath = true }) => {
  const source = boundedText(value, { name, maxLength: MAX_ACTION_URL_LENGTH });
  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    (!allowPath && (parsed.pathname !== '/' || parsed.search))
  )
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  return parsed;
};

const accountAction = ({ kind, to, actionURL, token, actionOrigin, expiresInSeconds, now }) => {
  if (kind !== 'verify-email' && kind !== 'reset-password')
    throw new Error('Account mail kind is invalid.');
  const recipient = boundedText(to, {
    name: 'Account mail recipient',
    maxLength: MAX_EMAIL_LENGTH,
  });
  if (!recipient.includes('@')) throw new Error('Account mail recipient is invalid.');
  const boundedToken = boundedText(token, {
    name: 'Account mail token',
    maxLength: MAX_TOKEN_LENGTH,
  });
  const url = secureURL(actionURL, { name: 'Account action URL' });
  if (url.origin !== actionOrigin) throw new Error('Account action URL has an unexpected origin.');
  const containsToken =
    kind === 'verify-email'
      ? url.searchParams.get('token') === boundedToken
      : decodeURIComponent(url.pathname).endsWith(`/reset-password/${boundedToken}`);
  if (!containsToken) throw new Error('Account action URL does not contain the expected token.');
  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + expiresInSeconds * 1_000);
  const id = createHash('sha256')
    .update(`${kind}\0${recipient.toLowerCase()}\0${url.href}`)
    .digest('hex');
  return Object.freeze({
    id,
    kind,
    to: recipient,
    actionURL: url.href,
    expiresAt: expiresAt.toISOString(),
  });
};

export function createAccountMailCallbacks({
  delivery,
  actionBaseURL,
  emailVerificationExpiresIn,
  passwordResetExpiresIn,
  now = () => new Date(),
}) {
  if (!delivery || typeof delivery.deliver !== 'function')
    throw new Error('Account mail delivery adapter is required.');
  if (
    !Number.isSafeInteger(emailVerificationExpiresIn) ||
    emailVerificationExpiresIn < 300 ||
    emailVerificationExpiresIn > 86_400
  )
    throw new Error('Email verification expiry must be between 300 and 86400 seconds.');
  if (
    !Number.isSafeInteger(passwordResetExpiresIn) ||
    passwordResetExpiresIn < 300 ||
    passwordResetExpiresIn > 3_600
  )
    throw new Error('Password reset expiry must be between 300 and 3600 seconds.');
  const actionOrigin = secureURL(actionBaseURL, {
    name: 'Better Auth action base URL',
    allowPath: false,
  }).origin;
  return Object.freeze({
    async sendVerificationEmail({ user, url, token }) {
      await delivery.deliver(
        accountAction({
          kind: 'verify-email',
          to: user?.email,
          actionURL: url,
          token,
          actionOrigin,
          expiresInSeconds: emailVerificationExpiresIn,
          now,
        }),
      );
    },
    async sendResetPassword({ user, url, token }) {
      await delivery.deliver(
        accountAction({
          kind: 'reset-password',
          to: user?.email,
          actionURL: url,
          token,
          actionOrigin,
          expiresInSeconds: passwordResetExpiresIn,
          now,
        }),
      );
    },
  });
}

export class MemoryAccountMailDelivery {
  #messages = [];

  async deliver(message) {
    this.#messages.push(structuredClone(message));
  }

  messages() {
    return this.#messages.map((message) => Object.freeze(structuredClone(message)));
  }
}

export function createWebhookAccountMailDelivery({
  endpoint,
  authorizationToken,
  timeoutMs,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') throw new Error('Account mail fetch adapter is required.');
  const webhook = secureURL(endpoint, { name: 'Account mail webhook URL' });
  const credential = boundedText(authorizationToken, {
    name: 'Account mail webhook token',
    maxLength: MAX_WEBHOOK_TOKEN_LENGTH,
    minimum: 32,
  });
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000)
    throw new Error('Account mail webhook timeout must be between 100 and 30000 milliseconds.');
  return Object.freeze({
    async deliver(message) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(webhook, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${credential}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(message),
        });
      } catch {
        throw new Error('Account mail delivery failed.');
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error('Account mail delivery failed.');
    },
  });
}
