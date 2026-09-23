import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBundledChapter } from '../chapter-download.mjs';

const chapter = Object.freeze({ name: 'First Light', path: 'fpv-arcade.json' });

test('a failed chapter request gives a deliberate online retry and preserves its diagnostic cause', async () => {
  const cause = new TypeError('Failed to fetch');
  let requests = 0;
  await assert.rejects(
    fetchBundledChapter(chapter, {
      fetch: async (url) => {
        requests++;
        assert.equal(url, 'content/packs/fpv-arcade.json');
        throw cause;
      },
    }),
    (error) => {
      assert.equal(error.code, 'chapter-download');
      assert.equal(error.cause, cause);
      assert.match(error.message, /First Light/);
      assert.match(error.message, /Connect to the internet/);
      assert.match(error.message, /choose this chapter again/);
      assert.match(error.message, /Already-installed chapters.*offline/);
      assert.match(error.message, /current flight and installed chapters are kept/);
      assert.doesNotMatch(error.message, /Failed to fetch/);
      return true;
    },
  );
  assert.equal(requests, 1, 'An error never starts an automatic retry loop');
});

test('an unavailable HTTP chapter is not parsed and reports its status without installing anything', async () => {
  let parsed = false;
  await assert.rejects(
    fetchBundledChapter(chapter, {
      fetch: async () => ({
        ok: false,
        status: 404,
        json() {
          parsed = true;
        },
      }),
    }),
    (error) => {
      assert.equal(error.code, 'chapter-download');
      assert.match(error.message, /First Light \(HTTP 404\)/);
      assert.match(error.message, /While online, choose this chapter again to retry/);
      return true;
    },
  );
  assert.equal(parsed, false);
});

test('unreadable downloaded JSON stays separate from later pack validation', async () => {
  const cause = new SyntaxError('Unexpected token');
  await assert.rejects(
    fetchBundledChapter(chapter, {
      fetch: async () => ({
        ok: true,
        json: async () => {
          throw cause;
        },
      }),
    }),
    (error) => {
      assert.equal(error.cause, cause);
      assert.match(error.message, /First Light could not be read/);
      assert.match(error.message, /While online, choose this chapter again to retry/);
      return true;
    },
  );
  const unvalidated = { format: 'unsupported-pack-format' };
  assert.equal(
    await fetchBundledChapter(chapter, {
      fetch: async () => ({ ok: true, json: async () => unvalidated }),
    }),
    unvalidated,
    'Only the host’s ordinary preparePack grants installation authority',
  );
});

test('request and body cancellation retain the original abort rather than suggesting a retry', async () => {
  const abort = new DOMException('Cancelled by a newer action', 'AbortError');
  for (const fetch of [
    async () => {
      throw abort;
    },
    async () => ({
      ok: true,
      json: async () => {
        throw abort;
      },
    }),
  ])
    await assert.rejects(fetchBundledChapter(chapter, { fetch }), (error) => error === abort);
});
