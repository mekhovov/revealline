// Source-only compiler/transport checks. No site build, browser or public network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalJSON } from '../data-json.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { EXTERNAL_CATALOG, prepareExternalDownload } from '../external-chapter-catalog.mjs';
import { readExternalDistributionEntries } from '../../scripts/external-distribution.mjs';
import {
  preparePack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  PACK_LIMITS,
} from '../packs.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const entries = await readExternalDistributionEntries(root, {
  format: 'revealline-external-distribution.v1',
  catalog: 'game/content/external-worlds.json',
});
const bodies = new Map(entries.map((e) => [e.name, e.bytes]));
const themes = ['ukraine', 'retro', 'coupa'];
// Native compiler decodes every actual original; repeated transport checks model
// image dimensions from those same bytes and make no browser codec claim.
const decodeImage = async (blob) => {
  const b = Buffer.from(await blob.arrayBuffer());
  return { naturalWidth: b.readUInt32BE(16), naturalHeight: b.readUInt32BE(20) };
};
test('eight explicit producers emit sixteen exact bodies while preserving all five earlier authorities', async () => {
  assert.equal(SOURCE_EXTERNAL_CHAPTERS.length, 8);
  assert.equal(
    sha(canonicalJSON(SOURCE_EXTERNAL_CHAPTERS.slice(0, 5))),
    '83ba162b7fd1f7d6520081e70fa3d6abe4f0cff3f4b8e0b95ab2d0cd1206b32c',
  );
  assert.equal(
    sha(canonicalJSON(EXTERNAL_CATALOG.chapters.slice(0, 5))),
    'dc1ef7d0995578a9af50a134a1f20339128e133e97f54cf93d45b797708fb4c7',
  );
  assert.equal(entries.length, 16);
  assert.equal(bodies.size, 16);
  assert.equal(
    entries.reduce((n, e) => n + e.bytes.length, 0),
    64546929,
  );
  assert.equal(
    entries.slice(0, 10).reduce((n, e) => n + e.bytes.length, 0),
    41373627,
  );
  for (const item of EXTERNAL_CATALOG.chapters)
    for (const kind of ['pack', 'media']) {
      const actual = bodies.get(item[kind].path);
      assert.equal(actual.length, item[kind].bytes);
      assert.equal(sha(actual), item[kind].sha256);
    }
  for (const [i, theme] of themes.entries())
    assert.deepEqual(
      SOURCE_EXTERNAL_CHAPTERS[i + 5],
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
  assert(
    !files.some((f) =>
      /authoring\/library\/sentinel-theme-(art|chapters)\//.test(
        typeof f === 'string' ? f : f.path,
      ),
    ),
  );
});
for (const [i, theme] of themes.entries())
  test(`explicit ${theme} transport resolves only that exact owner and all three null-story originals`, async () => {
    const item = EXTERNAL_CATALOG.chapters[i + 5],
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
    assert.deepEqual(prepared.descriptor, SOURCE_EXTERNAL_CHAPTERS[i + 5]);
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
  const item = EXTERNAL_CATALOG.chapters[5],
    other = EXTERNAL_CATALOG.chapters[6];
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
test('eight external choices plus five embedded choices do not relax twelve installed packs or evict owners', async () => {
  const legacy = JSON.parse(
    await readFile(new URL('../content/optional-worlds.json', import.meta.url)),
  );
  assert.equal(legacy.packs.length, 5);
  assert.equal(EXTERNAL_CATALOG.chapters.length + legacy.packs.length, 13);
  assert.equal(PACK_LIMITS.installed, 12);
  assert.equal(PACK_LIMITS.libraryBytes, 48 * 1024 * 1024);
  let installed = emptyPackLibrary();
  for (const item of EXTERNAL_CATALOG.chapters)
    installed = installPack(
      installed,
      (await preparePack(bodies.get(item.pack.path).toString())).pack,
    );
  const source = JSON.parse(bodies.get(EXTERNAL_CATALOG.chapters[5].pack.path));
  let refused;
  for (let i = 0; i < 5; i++) {
    const value = structuredClone(source);
    value.id = `capacity-control-${i}`;
    value.campaigns[0].id = value.id;
    const { pack } = await preparePack(value);
    if (i < 4) installed = installPack(installed, pack);
    else refused = pack;
  }
  const before = exportPackLibrary(installed);
  assert.throws(() => installPack(installed, refused), /At most 12/);
  assert.equal(exportPackLibrary(installed), before);
  assert.deepEqual(
    installed.packs.slice(0, 8).map((p) => p.id),
    SOURCE_EXTERNAL_CHAPTERS.map((d) => d.id),
  );
});
