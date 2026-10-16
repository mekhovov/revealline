import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants, createReadStream } from 'node:fs';
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { postgresDatabaseName } from './postgres-command-environment.mjs';

export const RECOVERY_FORMAT = 'revealline-community-recovery.v1';

const DATABASE_FILE = 'database.dump';
const MANIFEST_FILE = 'manifest.json';
const BLOB_DIRECTORY = 'blobs';
const RESTORE_JOURNAL_FORMAT = 'revealline-community-restore-journal.v1';
const CLEAR_TRANSIENT_UPLOADS_SQL = 'DELETE FROM public.community_tus_uploads;';
const PACKAGE_KEY = /^packages\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.rlpack$/u;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const canonicalManifestCore = ({ database, blobs }) => ({
  format: RECOVERY_FORMAT,
  database,
  blobs,
});

const snapshotIdFor = (core) => `snapshot_${sha256(Buffer.from(JSON.stringify(core), 'utf8'))}`;

const mustBeDirectory = async (target, label) => {
  const metadata = await lstat(target);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error(`${label} must be a real directory.`);
};

const assertAbsent = async (target, label) => {
  try {
    await access(target, fsConstants.F_OK);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`${label} already exists: ${target}`);
};

const readOptionalJson = async (file) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

const writeJournal = async (file, journal) => {
  const temporary = `${file}.${randomUUID()}.partial`;
  await writeFile(temporary, `${JSON.stringify(journal, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(temporary, file);
};

const digestFile = async (file) => {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error(`Recovery input must be a regular file: ${file}`);
  const digest = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    size += chunk.length;
    digest.update(chunk);
  }
  return { size, sha256: digest.digest('hex') };
};

const walkFiles = async (root, prefix = '') => {
  let entries;
  try {
    entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT' && !prefix) return [];
    throw error;
  }
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${relative}`);
    if (entry.isDirectory()) files.push(...(await walkFiles(root, relative)));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unsupported filesystem entry: ${relative}`);
  }
  return files;
};

const validateBlobKey = (key) => {
  const match = PACKAGE_KEY.exec(key);
  if (!match || match[1] !== match[2].slice(0, 2))
    throw new Error(`Unexpected community blob key: ${key}`);
  return match[2];
};

const inventoryBlobs = async (root) => {
  const keys = await walkFiles(root);
  const blobs = [];
  for (const key of keys) {
    const expectedSha256 = validateBlobKey(key);
    const identity = await digestFile(path.join(root, key));
    if (identity.sha256 !== expectedSha256)
      throw new Error(`Blob bytes do not match their content-addressed key: ${key}`);
    blobs.push({ key, ...identity });
  }
  return blobs;
};

const validateManifest = (manifest) => {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
    throw new Error('Recovery manifest must be an object.');
  if (manifest.format !== RECOVERY_FORMAT)
    throw new Error(`Unsupported recovery format: ${manifest.format ?? 'missing'}`);
  if (
    manifest.database?.file !== DATABASE_FILE ||
    !Number.isSafeInteger(manifest.database?.size) ||
    manifest.database.size < 1 ||
    !/^[a-f0-9]{64}$/u.test(manifest.database?.sha256 ?? '')
  )
    throw new Error('Recovery manifest database identity is invalid.');
  if (!Array.isArray(manifest.blobs))
    throw new Error('Recovery manifest blob inventory is invalid.');
  let previous = '';
  for (const blob of manifest.blobs) {
    const expectedSha256 = validateBlobKey(blob?.key);
    if (
      blob.key <= previous ||
      !Number.isSafeInteger(blob.size) ||
      blob.size < 1 ||
      blob.sha256 !== expectedSha256
    )
      throw new Error('Recovery manifest blob inventory is invalid or unsorted.');
    previous = blob.key;
  }
  const core = canonicalManifestCore(manifest);
  if (manifest.snapshotId !== snapshotIdFor(core))
    throw new Error('Recovery manifest snapshot identity is invalid.');
  return { ...core, snapshotId: manifest.snapshotId };
};

const copyBlobInventory = async ({ blobs, sourceRoot, targetRoot }) => {
  for (const blob of blobs) {
    const source = path.join(sourceRoot, blob.key);
    const target = path.join(targetRoot, blob.key);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target, fsConstants.COPYFILE_EXCL);
    await chmod(target, 0o600);
    const copied = await digestFile(target);
    if (copied.size !== blob.size || copied.sha256 !== blob.sha256)
      throw new Error(`Copied blob failed identity verification: ${blob.key}`);
  }
};

const inventoryBlobStore = async (blobStore) => {
  if (!blobStore?.list || !blobStore?.open)
    throw new Error('Recovery blob store must support list and open.');
  const blobs = [];
  const seenCursors = new Set();
  let cursor = null;
  let previous = '';
  do {
    const page = await blobStore.list({ prefix: 'packages/sha256/', cursor, limit: 1_000 });
    if (!Array.isArray(page?.items)) throw new Error('Blob store listing is invalid.');
    for (const item of page.items) {
      const expectedSha256 = validateBlobKey(item?.key);
      if (item.key <= previous) throw new Error('Blob store listing is unsorted or duplicated.');
      if (!Number.isSafeInteger(item.size) || item.size < 1)
        throw new Error(`Blob store listing size is invalid: ${item.key}`);
      blobs.push({ key: item.key, size: item.size, sha256: expectedSha256 });
      previous = item.key;
    }
    cursor = page.cursor ?? null;
    if (cursor && seenCursors.has(cursor)) throw new Error('Blob store listing cursor repeated.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return blobs;
};

const closeBlobBody = async (body) => {
  if (typeof body?.destroy !== 'function') return;
  if (!body.destroyed) body.destroy();
  if (typeof body.once === 'function') await finished(body).catch(() => {});
};

const copyBlobStoreInventory = async ({ blobStore, blobs, targetRoot, openTarget = open }) => {
  for (const blob of blobs) {
    const opened = await blobStore.open(blob.key);
    const target = path.join(targetRoot, blob.key);
    let handle;
    let failure = null;
    const digest = createHash('sha256');
    let size = 0;
    try {
      if (!opened || opened.size !== blob.size)
        throw new Error(`Blob disappeared or changed during recovery backup: ${blob.key}`);
      await mkdir(path.dirname(target), { recursive: true });
      handle = await openTarget(target, 'wx', 0o600);
      for await (const chunk of opened.body) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        digest.update(bytes);
        let offset = 0;
        while (offset < bytes.length) {
          const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset);
          if (bytesWritten < 1) throw new Error('Recovery snapshot write made no progress.');
          offset += bytesWritten;
        }
      }
      await handle.sync();
      if (size !== blob.size || digest.digest('hex') !== blob.sha256)
        throw new Error(`Blob bytes changed during recovery backup: ${blob.key}`);
    } catch (error) {
      failure = error;
    } finally {
      try {
        await handle?.close();
      } catch (error) {
        failure ??= error;
      }
      await closeBlobBody(opened?.body);
    }
    if (failure) {
      await rm(target, { force: true });
      throw failure;
    }
  }
};

const assertEmptyPackageStore = async (blobStore) => {
  const page = await blobStore.list({ prefix: 'packages/sha256/', cursor: null, limit: 1 });
  if (!Array.isArray(page?.items)) throw new Error('Blob store listing is invalid.');
  if (page.items.length)
    throw new Error('Restore package prefix must be empty in a fresh dedicated recovery store.');
};

const verifyPackageStore = async (blobStore, expected) => {
  const actual = await inventoryBlobStore(blobStore);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error('Restored package store inventory does not match the recovery manifest.');
  for (const blob of expected) {
    const opened = await blobStore.open(blob.key);
    try {
      if (!opened || opened.size !== blob.size)
        throw new Error(`Restored package is missing: ${blob.key}`);
      const digest = createHash('sha256');
      let size = 0;
      for await (const chunk of opened.body) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        digest.update(bytes);
      }
      if (size !== blob.size || digest.digest('hex') !== blob.sha256)
        throw new Error(`Restored package failed identity verification: ${blob.key}`);
    } finally {
      await closeBlobBody(opened?.body);
    }
  }
};

const verifyStagedBlobs = async (root, expected) => {
  await mustBeDirectory(root, 'Staged blob root');
  const actual = await inventoryBlobs(root);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error('Staged restore blob inventory does not match the recovery manifest.');
};

const prepareEmptyTarget = async (target) => {
  try {
    const entries = await readdir(target);
    if (entries.length) throw new Error(`Restore blob root must be empty: ${target}`);
    await rm(target, { recursive: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
};

const restoreRecoveryDatabase = async ({ databaseUrl, dump, runCommand }) => {
  await runCommand(
    'pg_restore',
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      '--dbname',
      postgresDatabaseName(databaseUrl),
      dump,
    ],
    { databaseUrl },
  );
  await runCommand(
    'psql',
    ['--no-psqlrc', '--set=ON_ERROR_STOP=1', '--command', CLEAR_TRANSIENT_UPLOADS_SQL],
    { databaseUrl },
  );
};

export async function createRecoverySnapshot({
  databaseUrl,
  blobRoot,
  blobStore,
  destination,
  runCommand,
  openBlobTarget = open,
}) {
  if (!databaseUrl || (!blobRoot && !blobStore) || !destination || typeof runCommand !== 'function')
    throw new Error('databaseUrl, blob storage, destination, and runCommand are required.');
  const target = path.resolve(destination);
  const sourceBlobs = blobRoot ? path.resolve(blobRoot) : null;
  if (sourceBlobs) await mustBeDirectory(sourceBlobs, 'Blob root');
  await assertAbsent(target, 'Recovery destination');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.partial-${randomUUID()}`;
  try {
    await mkdir(path.join(temporary, BLOB_DIRECTORY), { recursive: true, mode: 0o700 });
    const dump = path.join(temporary, DATABASE_FILE);
    await runCommand('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', dump], {
      databaseUrl,
    });
    const database = { file: DATABASE_FILE, ...(await digestFile(dump)) };
    if (database.size < 1) throw new Error('pg_dump produced an empty recovery database file.');
    const blobs = blobStore
      ? await inventoryBlobStore(blobStore)
      : await inventoryBlobs(sourceBlobs);
    if (blobStore)
      await copyBlobStoreInventory({
        blobStore,
        blobs,
        targetRoot: path.join(temporary, BLOB_DIRECTORY),
        openTarget: openBlobTarget,
      });
    else
      await copyBlobInventory({
        blobs,
        sourceRoot: sourceBlobs,
        targetRoot: path.join(temporary, BLOB_DIRECTORY),
      });
    const core = canonicalManifestCore({ database, blobs });
    const manifest = { ...core, snapshotId: snapshotIdFor(core) };
    await writeFile(path.join(temporary, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporary, target);
    return manifest;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyRecoverySnapshot({ source }) {
  if (!source) throw new Error('Recovery source is required.');
  const root = path.resolve(source);
  await mustBeDirectory(root, 'Recovery source');
  const manifest = validateManifest(
    JSON.parse(await readFile(path.join(root, MANIFEST_FILE), 'utf8')),
  );
  const database = await digestFile(path.join(root, DATABASE_FILE));
  if (database.size !== manifest.database.size || database.sha256 !== manifest.database.sha256)
    throw new Error('Recovery database dump failed identity verification.');
  const blobs = await inventoryBlobs(path.join(root, BLOB_DIRECTORY));
  if (JSON.stringify(blobs) !== JSON.stringify(manifest.blobs))
    throw new Error('Recovery blob inventory does not match the manifest.');
  const allowed = new Set([
    MANIFEST_FILE,
    DATABASE_FILE,
    ...manifest.blobs.map((blob) => path.posix.join(BLOB_DIRECTORY, blob.key)),
  ]);
  const actual = await walkFiles(root);
  const unexpected = actual.filter((file) => !allowed.has(file));
  if (unexpected.length)
    throw new Error(`Recovery snapshot contains unexpected files: ${unexpected[0]}`);
  return manifest;
}

export async function restoreRecoverySnapshot({ databaseUrl, blobRoot, source, runCommand }) {
  if (!databaseUrl || !blobRoot || !source || typeof runCommand !== 'function')
    throw new Error('databaseUrl, blobRoot, source, and runCommand are required.');
  const manifest = await verifyRecoverySnapshot({ source });
  const target = path.resolve(blobRoot);
  const databaseTargetHash = sha256(Buffer.from(databaseUrl, 'utf8'));
  const journalFile = `${target}.restore-journal.json`;
  let journal = await readOptionalJson(journalFile);
  if (journal) {
    const expectedPrefix = `${path.basename(target)}.restore-`;
    if (
      journal.format !== RESTORE_JOURNAL_FORMAT ||
      journal.snapshotId !== manifest.snapshotId ||
      journal.blobRoot !== target ||
      journal.databaseTargetHash !== databaseTargetHash ||
      typeof journal.stagedRoot !== 'string' ||
      path.dirname(journal.stagedRoot) !== path.dirname(target) ||
      !path.basename(journal.stagedRoot).startsWith(expectedPrefix) ||
      !['staging', 'blobs-staged', 'database-restored'].includes(journal.state)
    )
      throw new Error(`Restore journal does not match this snapshot and target: ${journalFile}`);
    if (journal.state !== 'staging') await verifyStagedBlobs(journal.stagedRoot, manifest.blobs);
    if (journal.state === 'database-restored') {
      await prepareEmptyTarget(target);
      await rename(journal.stagedRoot, target);
      await rm(journalFile, { force: true });
      return manifest;
    }
  } else {
    await prepareEmptyTarget(target);
    await mkdir(path.dirname(target), { recursive: true });
    const stagedRoot = `${target}.restore-${randomUUID()}`;
    journal = {
      format: RESTORE_JOURNAL_FORMAT,
      snapshotId: manifest.snapshotId,
      blobRoot: target,
      databaseTargetHash,
      stagedRoot,
      state: 'staging',
    };
    await writeJournal(journalFile, journal);
  }
  await prepareEmptyTarget(target);
  if (journal.state === 'staging') {
    await rm(journal.stagedRoot, { recursive: true, force: true });
    await mkdir(journal.stagedRoot, { recursive: true, mode: 0o700 });
    await copyBlobInventory({
      blobs: manifest.blobs,
      sourceRoot: path.join(path.resolve(source), BLOB_DIRECTORY),
      targetRoot: journal.stagedRoot,
    });
    journal = { ...journal, state: 'blobs-staged' };
    await writeJournal(journalFile, journal);
  }
  await restoreRecoveryDatabase({
    databaseUrl,
    dump: path.join(path.resolve(source), DATABASE_FILE),
    runCommand,
  });
  journal = { ...journal, state: 'database-restored' };
  await writeJournal(journalFile, journal);
  await prepareEmptyTarget(target);
  await rename(journal.stagedRoot, target);
  await rm(journalFile, { force: true });
  return manifest;
}

export const recoveryStorageIdentity = (storage) => {
  if (storage?.driver === 'disk' && typeof storage.root === 'string')
    return `disk_${sha256(Buffer.from(path.resolve(storage.root), 'utf8'))}`;
  if (storage?.driver === 's3' && storage.bucket && storage.region)
    return `s3_${sha256(
      Buffer.from(
        JSON.stringify({
          bucket: storage.bucket,
          region: storage.region,
          endpoint: storage.endpoint ?? null,
          forcePathStyle: Boolean(storage.forcePathStyle),
        }),
        'utf8',
      ),
    )}`;
  throw new Error('Recovery storage configuration is invalid.');
};

export async function restoreRecoverySnapshotToStore({
  databaseUrl,
  blobStore,
  storageIdentity,
  journalFile,
  source,
  runCommand,
}) {
  if (
    !databaseUrl ||
    !blobStore?.putVerified ||
    !blobStore?.list ||
    !blobStore?.open ||
    !storageIdentity ||
    !journalFile ||
    !source ||
    typeof runCommand !== 'function'
  )
    throw new Error(
      'databaseUrl, blobStore, storageIdentity, journalFile, source, and runCommand are required.',
    );
  const manifest = await verifyRecoverySnapshot({ source });
  const databaseTargetHash = sha256(Buffer.from(databaseUrl, 'utf8'));
  const storageTargetHash = sha256(Buffer.from(storageIdentity, 'utf8'));
  const targetJournal = path.resolve(journalFile);
  let journal = await readOptionalJson(targetJournal);
  if (journal) {
    if (
      journal.format !== RESTORE_JOURNAL_FORMAT ||
      journal.snapshotId !== manifest.snapshotId ||
      journal.databaseTargetHash !== databaseTargetHash ||
      journal.storageTargetHash !== storageTargetHash ||
      !['prepared', 'database-restored', 'packages-restored'].includes(journal.state)
    )
      throw new Error(`Restore journal does not match this snapshot and target: ${targetJournal}`);
  } else {
    await assertEmptyPackageStore(blobStore);
    await mkdir(path.dirname(targetJournal), { recursive: true });
    journal = {
      format: RESTORE_JOURNAL_FORMAT,
      snapshotId: manifest.snapshotId,
      databaseTargetHash,
      storageTargetHash,
      state: 'prepared',
    };
    await writeJournal(targetJournal, journal);
  }
  if (journal.state === 'prepared') {
    await assertEmptyPackageStore(blobStore);
    await restoreRecoveryDatabase({
      databaseUrl,
      dump: path.join(path.resolve(source), DATABASE_FILE),
      runCommand,
    });
    journal = { ...journal, state: 'database-restored' };
    await writeJournal(targetJournal, journal);
  }
  if (journal.state === 'database-restored') {
    for (const blob of manifest.blobs)
      await blobStore.putVerified({
        key: blob.key,
        body: createReadStream(path.join(path.resolve(source), BLOB_DIRECTORY, blob.key)),
        expectedSha256: blob.sha256,
        expectedSize: blob.size,
        maxBytes: blob.size,
      });
    journal = { ...journal, state: 'packages-restored' };
    await writeJournal(targetJournal, journal);
  }
  await verifyPackageStore(blobStore, manifest.blobs);
  await rm(targetJournal, { force: true });
  return manifest;
}
