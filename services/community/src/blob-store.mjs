import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { CommunityError } from './domain.mjs';

const validatedKey = (key) => {
  if (typeof key !== 'string' || !/^[a-z0-9][a-z0-9./_-]*$/u.test(key) || key.includes('..'))
    throw new Error('Blob key is invalid.');
  return key;
};

const chunks = async function* (body) {
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    yield Buffer.from(body);
    return;
  }
  for await (const chunk of body) yield Buffer.from(chunk);
};

export class DiskBlobStore {
  constructor({ root }) {
    this.root = path.resolve(root);
  }

  #path(key) {
    return path.join(this.root, validatedKey(key));
  }

  async putVerified({ key, body, expectedSha256, expectedSize, maxBytes }) {
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
          await handle.write(chunk);
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
    try {
      const existing = await stat(target);
      if (existing.size !== size) throw new Error('Existing immutable blob has a different size.');
      await rm(temporary, { force: true });
    } catch (error) {
      if (error?.code === 'ENOENT') await rename(temporary, target);
      else {
        await rm(temporary, { force: true });
        if (error.message === 'Existing immutable blob has a different size.') throw error;
      }
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
    const metadata = await this.stat(key);
    if (!metadata) return null;
    return { ...metadata, body: createReadStream(this.#path(key)) };
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
    return bytes ? { key, size: bytes.length, body: Readable.from(bytes) } : null;
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
}

// The production package intentionally does not choose an S3 SDK. This boundary accepts any
// client that implements the documented command factory, including AWS S3 and compatible hosts.
export class S3CompatibleBlobStore {
  constructor({ client, bucket, commands }) {
    if (!client?.send || !bucket || !commands?.put || !commands?.head || !commands?.get)
      throw new Error('S3 adapter requires a client, bucket, and put/head/get command factories.');
    this.client = client;
    this.bucket = bucket;
    this.commands = commands;
  }

  async putVerified({ key, body, expectedSha256, expectedSize, maxBytes }) {
    if (!Buffer.isBuffer(body))
      throw new Error('S3 adapter requires staged verified bytes before immutable upload.');
    if (body.length > maxBytes || body.length !== expectedSize)
      throw new CommunityError(413, 'package_too_large', 'Package size is invalid.');
    const actualSha256 = createHash('sha256').update(body).digest('hex');
    if (actualSha256 !== expectedSha256)
      throw new CommunityError(422, 'package_identity_mismatch', 'Package SHA-256 is invalid.');
    await this.client.send(
      this.commands.put({
        Bucket: this.bucket,
        Key: validatedKey(key),
        Body: body,
        ContentLength: body.length,
        ContentType: 'application/vnd.revealline.rlpack',
        Metadata: { sha256: actualSha256 },
      }),
    );
    return { key, sha256: actualSha256, size: body.length };
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
      return { key, size: Number(result.ContentLength), body: result.Body };
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
}
