import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, realpath, rm, statfs } from 'node:fs/promises';
import path from 'node:path';

const MiB = 1024 ** 2;

export function offlineStoragePolicy(installedBodyBytes) {
  assert(Number.isSafeInteger(installedBodyBytes) && installedBodyBytes > 0);
  const installedBodyCapBytes = Math.ceil((installedBodyBytes + 64 * MiB) / (16 * MiB)) * 16 * MiB;
  assert(
    installedBodyCapBytes <= 1024 * MiB,
    'Complete installation exceeds the 1 GiB body ceiling.',
  );
  // Capacity reservation includes Cache Storage, SQLite journals and metadata;
  // it is not a claim that total filesystem allocation has a hard size cap.
  const profileReservationBytes = 3 * installedBodyCapBytes + 256 * MiB;
  return {
    installedBodyBytes,
    installedBodyCapBytes,
    profileReservationBytes,
    minimumFreeBeforeBytes: profileReservationBytes + 512 * MiB,
    minimumFreeDuringBytes: 512 * MiB,
    minimumEvidenceFreeBytes: 200 * MiB,
    formula:
      'body cap = ceil((complete audited core+selected bytes +64MiB)/16MiB)*16MiB; maximum1GiB; reserve3x cap+256MiB plus512MiB free',
  };
}

export function directoryIdentity(stat) {
  const identity = { dev: stat.dev, ino: stat.ino, uid: stat.uid };
  assert(Object.values(identity).every(Number.isSafeInteger), 'Inexact directory identity.');
  return identity;
}

export function assertDirectoryIdentity(actual, expected, uid) {
  assert(actual.isDirectory && !actual.isSymbolicLink, 'Expected an ordinary owned directory.');
  assert.equal(actual.uid, uid, 'Directory owner changed.');
  assert.deepEqual(directoryIdentity(actual), expected, 'Directory identity changed.');
}

export async function availableBytes(directory) {
  const stat = await statfs(directory);
  return Number(stat.bavail) * Number(stat.bsize);
}

/** A fresh private session, never an existing user profile or arbitrary cleanup target. */
export async function createLocalOfflineSession(parent) {
  assert(path.isAbsolute(parent), 'An absolute runner temporary directory is required.');
  const canonicalParent = await realpath(parent);
  const parentStat = await lstat(canonicalParent);
  assert(parentStat.isDirectory() && !parentStat.isSymbolicLink());
  const session = await mkdtemp(path.join(canonicalParent, 'demo-full-core-offline-'));
  const tmp = path.join(session, 'tmp');
  const downloads = path.join(session, 'downloads');
  const uid = process.getuid();
  const identities = [{ path: canonicalParent, ...directoryIdentity(parentStat) }];
  try {
    await mkdir(tmp, { mode: 0o700 });
    await mkdir(downloads, { mode: 0o700 });
    for (const name of [session, tmp, downloads]) {
      const stat = await lstat(name);
      assert(stat.isDirectory() && !stat.isSymbolicLink());
      assert.equal(stat.uid, uid);
      assert.equal(stat.mode & 0o077, 0, 'Owned browser session must be private.');
      identities.push({ path: name, ...directoryIdentity(stat) });
    }
  } catch (error) {
    // No browser has started and this exact directory was created above.
    await rm(session, { recursive: true });
    throw error;
  }
  const verify = async () => {
    for (const identity of identities) {
      const stat = await lstat(identity.path);
      assertDirectoryIdentity(
        {
          ...directoryIdentity(stat),
          isDirectory: stat.isDirectory(),
          isSymbolicLink: stat.isSymbolicLink(),
        },
        { dev: identity.dev, ino: identity.ino, uid: identity.uid },
        identity.uid,
      );
      assert.equal(await realpath(identity.path), identity.path);
    }
    return true;
  };
  return {
    session,
    tmp,
    downloads,
    identities,
    verify,
    async remove() {
      await verify();
      await rm(session, { recursive: true });
    },
  };
}
