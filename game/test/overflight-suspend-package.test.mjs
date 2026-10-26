import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'acorn';
import {
  SURVIVAL_SUSPEND_RUNTIME_FILES,
  readSurvivalSuspendPackage,
} from '../overflight/suspend-package.mjs';

const root = new URL('../../', import.meta.url),
  url = new URL('https://game.example/release/');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const marker = {
    format: 'revealline-offline.v1',
    version: 'test-package',
    buildId: '7'.repeat(64),
  };
  const info = {
    formatVersion: 1,
    version: marker.version,
    sourceRevision: '8'.repeat(40),
    entry: 'game/overflight/play.html',
  };
  const contents = new Map(
    await Promise.all(
      [...SURVIVAL_SUSPEND_RUNTIME_FILES, 'game/overflight/app.mjs'].map(async (name) => [
        name,
        await readFile(new URL(name, root)),
      ]),
    ),
  );
  contents.set('game/build-info.json', Buffer.from(JSON.stringify(info)));
  contents.set(
    info.entry,
    Buffer.from(
      `<html><head><meta name="revealline-offline" content='${JSON.stringify(marker)}'></head></html>`,
    ),
  );
  const manifest = {
    ...info,
    totalBytes: [...contents.values()].reduce((sum, value) => sum + value.byteLength, 0),
    files: [...contents].map(([name, bytes]) => ({
      path: name,
      bytes: bytes.byteLength,
      sha256: hash(bytes),
    })),
  };
  const refresh = () => contents.set('manifest.json', Buffer.from(JSON.stringify(manifest)));
  refresh();
  const calls = [];
  const options = {
    rootURL: url,
    documentRef: { querySelector: () => ({ content: JSON.stringify(marker) }) },
    cryptoImpl: webcrypto,
    fetchImpl: async (requested, { signal }) => {
      signal.throwIfAborted();
      assert.equal(new URL(requested).origin, url.origin);
      const name = new URL(requested).pathname.slice(url.pathname.length);
      calls.push(name);
      return new Response(contents.get(name) ?? '', { status: contents.has(name) ? 200 : 404 });
    },
  };
  return { marker, info, contents, manifest, refresh, options, calls };
}

test('admission hashes real fetched manifest and exact runtime member bytes, bound to the visible build', async () => {
  const f = await fixture();
  const identity = await readSurvivalSuspendPackage(f.options);
  assert.equal(identity.manifestSha256, hash(f.contents.get('manifest.json')));
  assert.equal(identity.sourceRevision, f.info.sourceRevision);
  assert.match(identity.runtimeSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(identity));
  assert.equal(new Set(f.calls).size, SURVIVAL_SUSPEND_RUNTIME_FILES.length + 4);
  assert.ok(f.calls.includes('game/overflight/app.mjs'));
  // This isolated byte fixture tests the production reader; it is not a built
  // release or a device qualification claim.
});

test('missing development identity and unavailable storage package remain honestly unavailable', async () => {
  const f = await fixture();
  await assert.rejects(
    readSurvivalSuspendPackage({ ...f.options, documentRef: null }),
    /development page/,
  );
  assert.equal(f.calls.length, 0);
  f.contents.delete('manifest.json');
  await assert.rejects(readSurvivalSuspendPackage(f.options), /unavailable/);
});

test('package mismatch, mixed host bytes, invalid manifest and oversized response all reject', async () => {
  for (const mutate of [
    (f) => {
      f.marker.buildId = '9'.repeat(64);
    },
    (f) => {
      f.contents.set('game/overflight/core.mjs', Buffer.from('changed'));
    },
    (f) => {
      f.contents.set('game/overflight/app.mjs', Buffer.from('old host'));
    },
    (f) => {
      f.manifest.files.push(f.manifest.files[0]);
      f.refresh();
    },
    (f) => {
      f.manifest.sourceRevision = null;
      f.refresh();
    },
    (f) => {
      f.manifest.totalBytes++;
      f.refresh();
    },
    (f) => {
      f.contents.set('game/build-info.json', Buffer.alloc(8192));
    },
    (f) => {
      f.manifest.files[0].path = '../outside.mjs';
      f.refresh();
    },
  ]) {
    const f = await fixture();
    mutate(f);
    await assert.rejects(readSurvivalSuspendPackage(f.options));
  }
});

test('caller cancellation including a final digest cannot return an admitted identity', async () => {
  const f = await fixture(),
    cancelled = new AbortController();
  cancelled.abort(new Error('cancelled'));
  await assert.rejects(
    readSurvivalSuspendPackage({ ...f.options, signal: cancelled.signal }),
    /cancelled/,
  );
  const late = new AbortController();
  let digests = 0;
  await assert.rejects(
    readSurvivalSuspendPackage({
      ...f.options,
      signal: late.signal,
      cryptoImpl: {
        subtle: {
          async digest(...args) {
            const result = await webcrypto.subtle.digest(...args);
            if (++digests === SURVIVAL_SUSPEND_RUNTIME_FILES.length + 5)
              late.abort(new Error('late cancellation'));
            return result;
          },
        },
      },
    }),
    /late cancellation/,
  );
});

test('the declared verified closure includes every static dependency of state and durable result owners', async () => {
  const seen = new Set();
  const visit = async (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const ast = parse(await readFile(new URL(file, root), 'utf8'), {
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
    for (const node of ast.body) {
      if (
        !['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(
          node.type,
        ) ||
        !node.source?.value?.startsWith('.')
      )
        continue;
      await visit(
        path.posix.normalize(path.posix.join(path.posix.dirname(file), node.source.value)),
      );
    }
  };
  for (const file of [
    'game/overflight/suspend.mjs',
    'game/overflight/records.mjs',
    'game/overflight/mastery.mjs',
    'game/overflight/suspend-package.mjs',
    'game/overflight/suspend-view.mjs',
    'game/profile-writer.mjs',
  ])
    await visit(file);
  assert.deepEqual([...seen].sort(), [...SURVIVAL_SUSPEND_RUNTIME_FILES]);
});
