import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, opendir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { CommunityError } from './domain.mjs';

const S3_PUT_ATTEMPTS = 3;

const validatedKey = (key) => {
  if (typeof key !== 'string' || !/^[a-z0-9][a-z0-9./_-]*$/u.test(key) || key.includes('..'))
    throw new Error('Blob key is invalid.');
  return key;
};

const validatedListInput = ({ prefix, cursor = null, limit = 1_000 }) => {
  const checkedPrefix = validatedKey(prefix);
  if (cursor !== null && (typeof cursor !== 'string' || cursor.length < 1 || cursor.length > 4_096))
    throw new Error('Blob listing cursor is invalid.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000)
    throw new Error('Blob listing limit must be between 1 and 1000.');
  return { prefix: checkedPrefix, cursor, limit };
};

const readBoundedDirectory = async (directory, maximum, label) => {
  let handle;
  try {
    handle = await opendir(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const entries = [];
  for await (const entry of handle) {
    entries.push(entry);
    if (entries.length > maximum)
      throw new Error(`${label} exceeds the bounded disk inventory limit of ${maximum}.`);
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name));
};

const validateContentAddress = (key, expectedSha256) => {
  const match = /^packages\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.rlpack$/u.exec(key);
  if (match && (match[1] !== match[2].slice(0, 2) || match[2] !== expectedSha256))
    throw new Error('Content-addressed blob key differs from the expected SHA-256.');
};

const chunks = async function* (body) {
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    yield Buffer.from(body);
    return;
  }
  for await (const chunk of body) yield Buffer.from(chunk);
};

const writeChunk = async (handle, chunk) => {
  let offset = 0;
  while (offset < chunk.length) {
    const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
    if (bytesWritten < 1) throw new Error('Package staging write made no progress.');
    offset += bytesWritten;
  }
};

const verifiedInput = ({ key, expectedSha256, expectedSize, maxBytes }) => {
  const checkedKey = validatedKey(key);
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256 ?? ''))
    throw new CommunityError(422, 'package_identity_mismatch', 'Package SHA-256 is invalid.');
  validateContentAddress(checkedKey, expectedSha256);
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 0)
    throw new CommunityError(422, 'package_identity_mismatch', 'Package size is invalid.');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new Error('Maximum package bytes must be a positive integer.');
  if (expectedSize > maxBytes)
    throw new CommunityError(413, 'package_too_large', 'Package exceeds the configured limit.');
  return checkedKey;
};

const stageVerifiedBody = async ({
  stagingRoot,
  key,
  body,
  expectedSha256,
  expectedSize,
  maxBytes,
}) => {
  const checkedKey = verifiedInput({ key, expectedSha256, expectedSize, maxBytes });
  const directory = path.resolve(stagingRoot);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `${expectedSha256}.${randomUUID()}.partial`);
  const handle = await open(temporary, 'wx', 0o600);
  const digest = createHash('sha256');
  let size = 0;
  try {
    try {
      for await (const chunk of chunks(body)) {
        size += chunk.length;
        if (size > maxBytes)
          throw new CommunityError(
            413,
            'package_too_large',
            'Package exceeds the configured limit.',
          );
        digest.update(chunk);
        await writeChunk(handle, chunk);
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    const sha256 = digest.digest('hex');
    if (size !== expectedSize || sha256 !== expectedSha256)
      throw new CommunityError(
        422,
        'package_identity_mismatch',
        'Uploaded bytes do not match the declared size and SHA-256.',
      );
    return { key: checkedKey, path: temporary, sha256, size };
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

const closeReadStream = async (stream) => {
  if (!stream.destroyed) stream.destroy();
  await finished(stream).catch(() => {});
};

const isS3Status = (error, name, status) =>
  error?.name === name ||
  error?.Code === name ||
  error?.code === name ||
  error?.$metadata?.httpStatusCode === status;

export class DiskBlobStore {
  constructor({ root }) {
    this.root = path.resolve(root);
  }

  #path(key) {
    return path.join(this.root, validatedKey(key));
  }

  async putVerified({ key, body, expectedSha256, expectedSize, maxBytes }) {
    verifiedInput({ key, expectedSha256, expectedSize, maxBytes });
    const target = this.#path(key);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.partial`;
    const handle = await open(temporary, 'wx', 0o600);
    const digest = createHash('sha256');
    let size = 0;
    try {
      try {
        for await (const chunk of chunks(body)) {
          size += chunk.length;
          if (size > maxBytes)
            throw new CommunityError(
              413,
              'package_too_large',
              'Package exceeds the configured limit.',
            );
          digest.update(chunk);
          await writeChunk(handle, chunk);
        }
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    const actualSha256 = digest.digest('hex');
    if (size !== expectedSize || actualSha256 !== expectedSha256) {
      await rm(temporary, { force: true });
      throw new CommunityError(
        422,
        'package_identity_mismatch',
        'Uploaded bytes do not match the declared size and SHA-256.',
      );
    }
    // Publishing by atomic rename repairs a corrupt pre-existing target. Every
    // concurrent writer reaching this boundary has already authenticated the
    // same expected digest, so replacing the path cannot expose partial bytes.
    try {
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    return { key, sha256: actualSha256, size };
  }

  async stat(key) {
    try {
      const result = await stat(this.#path(key));
      return { key, size: result.size };
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async open(key) {
    const checkedKey = validatedKey(key);
    let handle;
    try {
      handle = await open(this.#path(checkedKey), 'r');
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
    try {
      const digest = createHash('sha256');
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let position = 0;
      while (true) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
        if (bytesRead === 0) break;
        digest.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
      }
      return {
        key: checkedKey,
        size: position,
        sha256: digest.digest('hex'),
        body: handle.createReadStream({ autoClose: true, start: 0 }),
      };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async openRange(key, start, end) {
    const metadata = await this.stat(key);
    if (
      !metadata ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      end > metadata.size
    )
      return null;
    const handle = await open(this.#path(key), 'r');
    try {
      const bytes = Buffer.alloc(end - start);
      await handle.read({ buffer: bytes, position: start });
      return bytes;
    } finally {
      await handle.close();
    }
  }

  async list(input) {
    const { prefix, cursor, limit } = validatedListInput(input);
    if (prefix !== 'packages/sha256/')
      throw new Error('Disk blob listing supports only the content-addressed package prefix.');
    if (cursor && (validatedKey(cursor), !cursor.startsWith(prefix)))
      throw new Error('Blob listing cursor is outside the requested prefix.');
    const root = path.join(this.root, prefix);
    const shards = await readBoundedDirectory(root, 256, 'Package shard directory');
    const items = [];
    for (const shard of shards) {
      const shardKey = path.posix.join(prefix, shard.name);
      if (shard.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${shardKey}`);
      if (!shard.isDirectory()) throw new Error(`Unsupported blob storage entry: ${shardKey}`);
      const entries = await readBoundedDirectory(
        path.join(root, shard.name),
        4_096,
        `Package shard ${shard.name}`,
      );
      for (const entry of entries) {
        const key = path.posix.join(shardKey, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${key}`);
        if (!entry.isFile()) throw new Error(`Unsupported blob storage entry: ${key}`);
        if (cursor && key <= cursor) continue;
        const metadata = await stat(this.#path(key));
        items.push({ key, size: metadata.size });
        if (items.length > limit)
          return { items: items.slice(0, limit), cursor: items[limit - 1].key };
      }
    }
    return { items, cursor: null };
  }
}

export class MemoryBlobStore {
  #items = new Map();

  async putVerified({ key, body, expectedSha256, expectedSize, maxBytes }) {
    const collected = [];
    let size = 0;
    const digest = createHash('sha256');
    for await (const chunk of chunks(body)) {
      size += chunk.length;
      if (size > maxBytes)
        throw new CommunityError(413, 'package_too_large', 'Package exceeds the configured limit.');
      digest.update(chunk);
      collected.push(chunk);
    }
    const actualSha256 = digest.digest('hex');
    if (size !== expectedSize || actualSha256 !== expectedSha256)
      throw new CommunityError(
        422,
        'package_identity_mismatch',
        'Uploaded bytes do not match the declared size and SHA-256.',
      );
    const bytes = Buffer.concat(collected);
    const existing = this.#items.get(validatedKey(key));
    if (existing && !existing.equals(bytes)) throw new Error('Immutable blob collision.');
    this.#items.set(key, bytes);
    return { key, sha256: actualSha256, size };
  }

  async stat(key) {
    const bytes = this.#items.get(validatedKey(key));
    return bytes ? { key, size: bytes.length } : null;
  }

  async open(key) {
    const bytes = this.#items.get(validatedKey(key));
    return bytes
      ? {
          key,
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          body: Readable.from(bytes),
        }
      : null;
  }

  async openRange(key, start, end) {
    const bytes = this.#items.get(validatedKey(key));
    if (
      !bytes ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      end > bytes.length
    )
      return null;
    return bytes.subarray(start, end);
  }

  async list(input) {
    const { prefix, cursor, limit } = validatedListInput(input);
    if (cursor && (validatedKey(cursor), !cursor.startsWith(prefix)))
      throw new Error('Blob listing cursor is outside the requested prefix.');
    const keys = [...this.#items.keys()]
      .filter((key) => key.startsWith(prefix) && (!cursor || key > cursor))
      .sort((left, right) => left.localeCompare(right));
    const page = keys.slice(0, limit);
    return {
      items: page.map((key) => ({ key, size: this.#items.get(key).length })),
      cursor: keys.length > limit ? page.at(-1) : null,
    };
  }
}

// The executable factory supplies AWS SDK command constructors. Keeping commands injectable makes
// exact staging, conditional publication, and range behavior testable without a network service.
export class S3CompatibleBlobStore {
  constructor({ client, bucket, stagingRoot, commands }) {
    if (
      !client?.send ||
      !bucket ||
      !commands?.put ||
      !commands?.head ||
      !commands?.get ||
      !commands?.list
    )
      throw new Error(
        'S3 adapter requires a client, bucket, and put/head/get/list command factories.',
      );
    if (typeof stagingRoot !== 'string' || stagingRoot.length === 0)
      throw new Error('S3 adapter requires a local staging root.');
    this.client = client;
    this.bucket = bucket;
    this.stagingRoot = stagingRoot;
    this.commands = commands;
  }

  async putVerified({ key, body, expectedSha256, expectedSize, maxBytes }) {
    const staged = await stageVerifiedBody({
      stagingRoot: this.stagingRoot,
      key,
      body,
      expectedSha256,
      expectedSize,
      maxBytes,
    });
    try {
      let publicationError;
      for (let attempt = 1; attempt <= S3_PUT_ATTEMPTS; attempt += 1) {
        const uploadBody = createReadStream(staged.path);
        publicationError = undefined;
        try {
          await this.client.send(
            this.commands.put({
              Bucket: this.bucket,
              Key: staged.key,
              Body: uploadBody,
              ContentLength: staged.size,
              ContentType: 'application/vnd.revealline.rlpack',
              IfNoneMatch: '*',
              Metadata: { sha256: staged.sha256 },
            }),
          );
        } catch (error) {
          publicationError = error;
        } finally {
          await closeReadStream(uploadBody);
        }
        if (!publicationError) break;
        if (
          !isS3Status(publicationError, 'ConditionalRequestConflict', 409) ||
          attempt === S3_PUT_ATTEMPTS
        )
          break;
      }
      if (publicationError) {
        if (!isS3Status(publicationError, 'PreconditionFailed', 412)) throw publicationError;
        const existing = await this.client.send(
          this.commands.head({ Bucket: this.bucket, Key: staged.key }),
        );
        if (
          Number(existing.ContentLength) !== staged.size ||
          existing.Metadata?.sha256 !== staged.sha256
        )
          throw new Error('Immutable blob collision.');
      }
      return { key: staged.key, sha256: staged.sha256, size: staged.size };
    } finally {
      await rm(staged.path, { force: true });
    }
  }

  async stat(key) {
    try {
      const result = await this.client.send(
        this.commands.head({ Bucket: this.bucket, Key: validatedKey(key) }),
      );
      return { key, size: Number(result.ContentLength) };
    } catch (error) {
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  async open(key) {
    try {
      const result = await this.client.send(
        this.commands.get({ Bucket: this.bucket, Key: validatedKey(key) }),
      );
      return {
        key,
        size: Number(result.ContentLength),
        sha256: result.Metadata?.sha256 ?? null,
        body: result.Body,
      };
    } catch (error) {
      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  async openRange(key, start, end) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start)
      return null;
    try {
      const result = await this.client.send(
        this.commands.get({
          Bucket: this.bucket,
          Key: validatedKey(key),
          Range: `bytes=${start}-${end - 1}`,
        }),
      );
      const chunks = [];
      for await (const chunk of result.Body) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      return bytes.length === end - start ? bytes : null;
    } catch (error) {
      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  async list(input) {
    const { prefix, cursor, limit } = validatedListInput(input);
    const result = await this.client.send(
      this.commands.list({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: limit,
        ...(cursor ? { ContinuationToken: cursor } : {}),
      }),
    );
    const items = (result.Contents ?? []).map(({ Key, Size }) => {
      if (typeof Key !== 'string' || !Key.startsWith(prefix) || !Number.isSafeInteger(Number(Size)))
        throw new Error('S3 listing returned an invalid blob entry.');
      return { key: validatedKey(Key), size: Number(Size) };
    });
    if (result.IsTruncated && !result.NextContinuationToken)
      throw new Error('S3 listing omitted its continuation token.');
    return { items, cursor: result.IsTruncated ? result.NextContinuationToken : null };
  }
}
