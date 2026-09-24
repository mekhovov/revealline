import { timingSafeEqual } from 'node:crypto';
import { CommunityError, normalizeOwnerSubject } from './domain.mjs';

const equalToken = (left, right) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function createTokenAuthenticator(tokenSubjects) {
  const entries = Object.entries(tokenSubjects ?? {}).map(([token, subject]) => [
    token,
    normalizeOwnerSubject(subject),
  ]);
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
      return { subject: entry[1] };
    },
  };
}
