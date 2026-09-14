// Actual producers and original bytes; finite transport/decoder boundaries.
// No site build, browser or public network runs in this source test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  emptyExternalChapterIndex,
  validateExternalChapterIndex,
  EXTERNAL_CHAPTER_LIMITS,
} from '../external-chapter.mjs';
import { PACK_LIMITS } from '../packs.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { SOURCE_EXTERNAL_CHAPTERS, SOURCE_EXTERNAL_EDITIONS } from '../external-chapter-source.mjs';
import {
  EXTERNAL_CATALOG,
  prepareExternalCatalog,
  prepareExternalDownload,
} from '../external-chapter-catalog.mjs';
import { readExternalDistributionEntries } from '../../scripts/external-distribution.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const entries = await readExternalDistributionEntries(root, {
  format: 'revealline-external-distribution.v1',
  catalog: 'game/content/external-worlds.json',
});
const bodies = new Map(entries.map((entry) => [entry.name, entry.bytes]));
const themes = ['fpv', 'ukraine', 'retro', 'coupa'];
const levels = [
  'countercurrent-offset-docks',
  'countercurrent-sandbar-braid',
  'countercurrent-crossing-watch',
];
const decodeImage = async (blob) => {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20) };
};

test('four Countercurrent producers append exact pairs without changing the twelve earlier authorities', async () => {
  assert.equal(SOURCE_EXTERNAL_CHAPTERS.length, 16);
  assert.equal(entries.length, 32);
  assert.equal(bodies.size, 32);
  // Independently extracted literal descriptors/catalog from accepted merged UI
  // 7c6e0d684d11cb0e6894e303beb8ff4ea8e08688, before this adoption.
  assert.equal(
    sha(canonicalJSON(SOURCE_EXTERNAL_CHAPTERS.slice(0, 12))),
    'ab91ff15ec5ace5dc9b4ba2d6d9b006a886cab59b2226bb9cfedfcc6e34e9bbd',
  );
  assert.equal(
    sha(canonicalJSON(EXTERNAL_CATALOG.chapters.slice(0, 12))),
    'dc168fbcb680663a94fe31becf5bea69cc723a58e25afa244ba0c83059f1156a',
  );
  assert.equal(
    entries.reduce((n, entry) => n + entry.bytes.length, 0),
    130442755,
  );
  assert.equal(
    entries.slice(0, 24).reduce((n, entry) => n + entry.bytes.length, 0),
    98674097,
  );
  assert.equal(
    entries.slice(24).reduce((n, entry) => n + entry.bytes.length, 0),
    31768658,
  );
  for (const entry of EXTERNAL_CATALOG.chapters)
    for (const kind of ['pack', 'media']) {
      assert.equal(bodies.get(entry[kind].path).length, entry[kind].bytes);
      assert.equal(sha(bodies.get(entry[kind].path)), entry[kind].sha256);
    }
  for (const [index, theme] of themes.entries()) {
    const descriptor = SOURCE_EXTERNAL_CHAPTERS[index + 12];
    const source = `../../authoring/library/countercurrent-chapters/descriptors/${theme}.json`;
    assert.deepEqual(descriptor, JSON.parse(await readFile(new URL(source, import.meta.url))));
    assert.equal(descriptor.id, `countercurrent-${theme}`);
    assert.equal(descriptor.themeId, theme);
    assert.deepEqual(
      descriptor.originals.map((original) => original.levelId),
      levels,
    );
    assert.equal(SOURCE_EXTERNAL_EDITIONS[index + 12].mode, 'Arcade');
    assert.equal(SOURCE_EXTERNAL_EDITIONS[index + 12].levels, 3);
  }
  assert.equal(
    prepareExternalCatalog(
      await readFile(new URL('../content/external-worlds.json', import.meta.url), 'utf8'),
    ),
    EXTERNAL_CATALOG,
  );
  const files = await collectBuildFiles(root);
  assert(
    !files.some((file) =>
      /authoring\/library\/countercurrent(?:-art|-chapters)?\//.test(
        typeof file === 'string' ? file : file.path,
      ),
    ),
  );
});

for (const [index, theme] of themes.entries())
  test(`exact ${theme} pair remains within its edition prefix and authenticates its three originals`, async () => {
    const item = EXTERNAL_CATALOG.chapters[index + 12];
    const descriptor = SOURCE_EXTERNAL_CHAPTERS[index + 12];
    const baseURL = [
      'https://example.test/',
      'https://example.test/revealline/',
      'https://example.test/releases/v0.39.0/site/',
      'https://example.test/archive/releases/v0.39.0/site/',
    ][index];
    const requests = [];
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
    assert.deepEqual(prepared.descriptor, descriptor);
    assert.equal(requests.length, 2);
    assert(
      requests.every(
        ({ options }) => options.redirect === 'error' && options.credentials === 'same-origin',
      ),
    );
    const library = prepared.imported.document.library;
    assert.equal(library.assets.length, 3);
    assert.equal(library.presentations.length, 3);
    for (const original of descriptor.originals) {
      const presentation = library.presentations.find(
        (value) => value.id === original.presentationId,
      );
      assert.equal(presentation.identity.baseCampaignKey, descriptor.campaignKey);
      assert.equal(presentation.identity.levelId, original.levelId);
      assert.equal(presentation.identity.levelRevision, original.levelRevision);
      assert.equal(presentation.identity.themeId, theme);
      assert.equal(presentation.story, null);
      const asset = library.assets.find((value) => value.id === original.assetId);
      assert.equal(asset.sha256, original.sha256);
      assert.equal(asset.bytes, original.bytes);
      assert.equal(asset.width, 1774);
      assert.equal(asset.height, 887);
    }
  });

test('a Countercurrent owner cannot accept a sibling pair or a cancelled originals response', async () => {
  const item = EXTERNAL_CATALOG.chapters[12],
    foreign = EXTERNAL_CATALOG.chapters[13];
  for (const crossed of ['pack', 'media']) {
    await assert.rejects(
      prepareExternalDownload(item.id, {
        baseURL: 'https://example.test/',
        decodeImage,
        fetch: async (url) => {
          const kind = url.endsWith('/pack.json') ? 'pack' : 'media';
          return new Response(bodies.get((kind === crossed ? foreign : item)[kind].path));
        },
      }),
      /length|incomplete|budget|differ/i,
    );
  }
  const controller = new AbortController();
  await assert.rejects(
    prepareExternalDownload(item.id, {
      baseURL: 'https://example.test/',
      decodeImage,
      signal: controller.signal,
      fetch: async (url) => {
        const kind = url.endsWith('/pack.json') ? 'pack' : 'media';
        if (kind === 'media') controller.abort();
        return new Response(bodies.get(item[kind].path));
      },
    }),
    { name: 'AbortError' },
  );
});

test('sixteen browsable authorities keep the exact twelve-installed and storage budgets', () => {
  const index = { ...emptyExternalChapterIndex(), chapters: SOURCE_EXTERNAL_CHAPTERS.slice(0, 12) };
  assert.equal(validateExternalChapterIndex(index).chapters.length, 12);
  assert.throws(() =>
    validateExternalChapterIndex({ ...index, chapters: SOURCE_EXTERNAL_CHAPTERS.slice(0, 13) }),
  );
  assert.equal(EXTERNAL_CHAPTER_LIMITS.catalogChoices, 36);
  assert.equal(EXTERNAL_CHAPTER_LIMITS.packBytes, 1048576);
  assert.equal(PACK_LIMITS.installed, 12);
  assert.equal(PACK_LIMITS.libraryBytes, 48 * 1048576);
  assert.equal(PACK_LIMITS.maxBytes, 24 * 1048576);
});
