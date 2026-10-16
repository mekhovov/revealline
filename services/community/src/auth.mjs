import { timingSafeEqual } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { CommunityError, normalizeOwnerSubject } from './domain.mjs';

const equalToken = (left, right) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function createTokenAuthenticator(tokenSubjects) {
  const entries = Object.entries(tokenSubjects ?? {}).map(([token, value]) => {
    const identity = typeof value === 'string' ? { subject: value, roles: [] } : value;
    return [
      token,
      {
        subject: normalizeOwnerSubject(identity?.subject),
        roles: Array.isArray(identity?.roles)
          ? [...new Set(identity.roles.filter((role) => role === 'admin'))]
          : [],
      },
    ];
  });
  if (entries.length === 0) throw new Error('At least one development token is required.');
  return {
    async authenticate(request) {
      const header = request.headers.authorization;
      if (typeof header !== 'string' || !header.startsWith('Bearer '))
        throw new CommunityError(401, 'authentication_required', 'A bearer token is required.');
      const supplied = header.slice('Bearer '.length);
      const entry = entries.find(([token]) => equalToken(token, supplied));
      if (!entry)
        throw new CommunityError(401, 'authentication_required', 'The bearer token is invalid.');
      return entry[1];
    },
  };
}

/** Better Auth boundary. Pass `auth.api.getSession` without coupling the service
 * to a particular account schema. The session user id is the immutable owner
 * subject; admin authority must come from trusted server-side session data. */
export function createSessionAuthenticator({ getSession, getRoles = () => [] }) {
  if (typeof getSession !== 'function') throw new Error('getSession is required.');
  return {
    async authenticate(request) {
      const session = await getSession({ headers: fromNodeHeaders(request.headers) });
      const subject = session?.user?.id;
      if (!subject)
        throw new CommunityError(
          401,
          'authentication_required',
          'A signed-in account is required.',
        );
      const roles = await getRoles(session);
      return {
        subject: normalizeOwnerSubject(subject),
        roles: Array.isArray(roles) ? [...new Set(roles.filter((role) => role === 'admin'))] : [],
      };
    },
  };
}
