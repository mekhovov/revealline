// Source-only compiler/transport checks. No site build, browser or public network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalJSON } from '../data-json.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { EXTERNAL_CATALOG, prepareExternalDownload } from '../external-chapter-catalog.mjs';
import { buildSentinelTheme } from '../../authoring/library/sentinel-theme-chapters/build.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const themes = ['ukraine', 'retro'];
const entries = [];
for (const [index, theme] of themes.entries()) {
  const result = await buildSentinelTheme(theme);
  assert.deepEqual(result.descriptor, SOURCE_EXTERNAL_CHAPTERS[index + 4]);
  const item = EXTERNAL_CATALOG.chapters[index + 4];
  for (const kind of ['pack', 'media'])
    entries.push({
      name: item[kind].path,
      bytes: Buffer.from(await result.payloads[kind].arrayBuffer()),
    });
}
const bodies = new Map(entries.map((e) => [e.name, e.bytes]));
// Native compiler decodes every actual original; repeated transport checks model
// image dimensions from those same bytes and make no browser codec claim.
const decodeImage = async (blob) => {
  const b = Buffer.from(await blob.arrayBuffer());
  return { naturalWidth: b.readUInt32BE(16), naturalHeight: b.readUInt32BE(20) };
};
test('two Sentinel theme producers preserve the four retained earlier authorities', async () => {
  assert.equal(SOURCE_EXTERNAL_CHAPTERS.length, 12);
  assert.equal(
    sha(canonicalJSON(SOURCE_EXTERNAL_CHAPTERS.slice(0, 4))),
    '320d3c877f3d553b61a8ea7e41a8da05bb78e1c8c79c4556ddb4f7e6b4e1358c',
  );
  assert.equal(
    sha(canonicalJSON(EXTERNAL_CATALOG.chapters.slice(0, 4))),
    'ab3ea68fa4a66472b81a27891cedacb9f5e8335b560083642269f51a472204ac',
  );
  assert.equal(entries.length, 4);
  assert.equal(bodies.size, 4);
  // All earlier body bytes, cumulative totals and the twelve-owner capacity case
  // share the complete real-source audit in scripts/test-external-distribution.mjs.
  assert.equal(
    entries.reduce((n, e) => n + e.bytes.length, 0),
    15747554,
  );
  for (const item of EXTERNAL_CATALOG.chapters.slice(4, 6))
    for (const kind of ['pack', 'media']) {
      const actual = bodies.get(item[kind].path);
      assert.equal(actual.length, item[kind].bytes);
      assert.equal(sha(actual), item[kind].sha256);
    }
  for (const [i, theme] of themes.entries())
    assert.deepEqual(
      SOURCE_EXTERNAL_CHAPTERS[i + 4],
      JSON.parse(
        await readFile(
          new URL(
            `../../authoring/library/sentinel-theme-chapters/descriptors/${theme}.json`,
            import.meta.url,
          ),
        ),
      ),
    );
  const files = await collectBuildFiles(root);
  // Current shared scenery uses these exact reviewed metadata/original inputs.
  // Producer scripts and unselected authoring files remain outside the build.
  assert.deepEqual(
    files.filter((file) => file.startsWith('authoring/library/sentinel-theme-chapters/')).sort(),
    [
      'authoring/library/sentinel-theme-chapters/descriptors/retro.json',
      'authoring/library/sentinel-theme-chapters/descriptors/ukraine.json',
      'authoring/library/sentinel-theme-chapters/editions.json',
    ],
  );
});
for (const [i, theme] of themes.entries())
  test(`explicit ${theme} transport resolves only that exact owner and all three null-story originals`, async () => {
    const item = EXTERNAL_CATALOG.chapters[i + 4],
      requests = [];
    const baseURL = [
      'https://example.test/',
      'https://example.test/revealline/',
      'https://example.test/releases/v0.36.0/site/',
    ][i];
    const prepared = await prepareExternalDownload(item.id, {
      baseURL,
      decodeImage,
      fetch: async (url, options) => {
        requests.push({ url, options });
        const kind = url.endsWith('/pack.json') ? 'pack' : 'media';
        assert.equal(url, new URL(item[kind].path, baseURL).href);
        return new Response(bodies.get(item[kind].path));
      },
    });
    assert.deepEqual(prepared.descriptor, SOURCE_EXTERNAL_CHAPTERS[i + 4]);
    assert.equal(requests.length, 2);
    assert(
      requests.every(
        (r) => r.options.redirect === 'error' && r.options.credentials === 'same-origin',
      ),
    );
    const { library } = prepared.imported.document;
    assert.equal(library.presentations.length, 3);
    for (const p of library.presentations) {
      assert.equal(p.identity.baseCampaignKey, item.campaignKey);
      assert.equal(p.identity.themeId, theme);
      assert.equal(p.story, null);
    }
  });
test('cross-theme originals and interrupted second body cannot become an install capability', async () => {
  const item = EXTERNAL_CATALOG.chapters[4],
    other = EXTERNAL_CATALOG.chapters[5];
  await assert.rejects(
    prepareExternalDownload(item.id, {
      baseURL: 'https://example.test/',
      decodeImage,
      fetch: async (url) =>
        new Response(bodies.get(url.endsWith('/pack.json') ? item.pack.path : other.media.path)),
    }),
    /length|incomplete|budget|differ/i,
  );
  const controller = new AbortController();
  await assert.rejects(
    prepareExternalDownload(item.id, {
      baseURL: 'https://example.test/',
      decodeImage,
      signal: controller.signal,
      fetch: async (url) => {
        if (url.endsWith('/media.rlmedia')) controller.abort();
        return new Response(
          bodies.get(url.endsWith('/pack.json') ? item.pack.path : item.media.path),
        );
      },
    }),
    { name: 'AbortError' },
  );
});
