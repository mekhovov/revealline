import { betterAuth } from 'better-auth';
import { createAccountMailCallbacks } from './account-mail.mjs';

export function createCommunityBetterAuth({
  database,
  baseURL,
  secret,
  trustedOrigins = [],
  mailDelivery,
  emailVerificationExpiresIn = 3_600,
  passwordResetExpiresIn = 1_800,
}) {
  if (!database || !baseURL || !secret)
    throw new Error('Better Auth needs database, baseURL, and secret.');
  const accountMail = createAccountMailCallbacks({
    delivery: mailDelivery,
    actionBaseURL: baseURL,
    emailVerificationExpiresIn,
    passwordResetExpiresIn,
  });
  return betterAuth({
    database,
    baseURL,
    secret,
    trustedOrigins,
    emailVerification: {
      sendVerificationEmail: accountMail.sendVerificationEmail,
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: emailVerificationExpiresIn,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: accountMail.sendResetPassword,
      resetPasswordTokenExpiresIn: passwordResetExpiresIn,
      revokeSessionsOnPasswordReset: true,
    },
    advanced: { database: { joins: true } },
  });
}

export function mountCommunityBetterAuth(app, auth) {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
        else if (value !== undefined) headers.set(key, String(value));
      }
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        }),
      );
      response.headers.forEach((value, key) => reply.header(key, value));
      const body = Buffer.from(await response.arrayBuffer());
      return reply.code(response.status).send(body);
    },
  });
}
