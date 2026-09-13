import assert from 'node:assert/strict';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { crc32 } from '../../../scripts/game-cli.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import {
  createMediaIdentityCatalog,
  MEDIA_LIBRARY_FORMAT,
  MEDIA_PRESENTATION_FORMAT,
} from '../../../game/media-library.mjs';
import { prepareStillAsset } from '../../../game/media-still.mjs';
import { prepareStoredStillMedia } from '../../../game/media-storage-record.mjs';
import { createPresentationPins } from '../../../game/presentation-pins.mjs';
import { exportMediaBundle, importMediaBundle } from '../../../game/media-bundle.mjs';
import { exportStoryBundle, inspectStoryBundle } from '../../../game/story-bundle.mjs';
import {
  changeStoredStoryBinding,
  STORY_STORAGE_FORMAT,
} from '../../../game/story-storage-record.mjs';
import { VICTORY_STORY_FORMAT } from '../../../game/victory-story.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ORIGINAL = 'authoring/library/dawn-signal-story/candidate-v1/';
const POSTER_HASH = '7f851f9806a1be994b2279f3d1acc4f2f39884ac6cf2fdf6b8a7813e61c73745';
const MOVIE_HASH = 'd643a6ebbf92b93dc57a0cfe65ca4bcf484ceecd8ed632ed6476707ec720e85a';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const owned = async (path, bytes, hash) => {
  const raw = await readFile(resolve(ROOT, path));
  assert.equal(raw.length, bytes, `Changed owned input: ${path}`);
  assert.equal(sha256(raw), hash, `Changed owned input: ${path}`);
  return raw;
};

/** Fully inflate and reconstruct the one pinned native RGB PNG, including all
 * row filters and chunk CRCs. This is a bounded Node decoder, not a browser claim.
 */
async function inspectDawnPoster(blob) {
  assert.equal(blob.size, 442522, 'Use the exact owned Dawn ending-frame PNG.');
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(sha256(bytes), POSTER_HASH, 'Use the exact owned Dawn ending-frame PNG.');
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];
  let offset = 8,
    width,
    height,
    ended = false;
  while (offset < bytes.length) {
    const n = bytes.readUInt32BE(offset),
      type = bytes.subarray(offset + 4, offset + 8).toString();
    assert.ok(offset + 12 + n <= bytes.length);
    assert.equal(
      crc32(bytes.subarray(offset + 4, offset + 8 + n)),
      bytes.readUInt32BE(offset + 8 + n),
    );
    const data = bytes.subarray(offset + 8, offset + 8 + n);
    if (type === 'IHDR') {
      assert.equal(offset, 8);
      assert.equal(n, 13);
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(width, 640);
      assert.equal(height, 360);
      assert.deepEqual([...data.subarray(8)], [8, 2, 0, 0, 0]);
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') {
      assert.equal(n, 0);
      ended = true;
    }
    offset += 12 + n;
    if (ended) break;
  }
  assert.equal(ended, true);
  assert.equal(offset, bytes.length);
  const stride = width * 3,
    length = height * (stride + 1);
  const rows = inflateSync(Buffer.concat(chunks), { maxOutputLength: length });
  assert.equal(rows.length, length);
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = rows[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x,
        left = x >= 3 ? pixels[i - 3] : 0,
        up = y ? pixels[i - stride] : 0,
        corner = y && x >= 3 ? pixels[i - stride - 3] : 0;
      let prediction = 0;
      if (filter === 1) prediction = left;
      if (filter === 2) prediction = up;
      if (filter === 3) prediction = Math.floor((left + up) / 2);
      if (filter === 4) {
        const p = left + up - corner,
          a = Math.abs(p - left),
          b = Math.abs(p - up),
          c = Math.abs(p - corner);
        prediction = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      pixels[i] = (rows[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  return { naturalWidth: width, naturalHeight: height, decodedRgbSha256: sha256(pixels) };
}
export async function decodeDawnPoster(blob) {
  const { naturalWidth, naturalHeight } = await inspectDawnPoster(blob);
  return { naturalWidth, naturalHeight };
}

/** A finite authored example. No browser profile, IndexedDB, awards or download
 * destination is read. Public bundle APIs retain the two exact original files.
 */
export async function buildDawnSignalPair() {
  const [png, movie, campaign, classes, themeDocument] = await Promise.all([
    owned(`${ORIGINAL}frame-95.png`, 442522, POSTER_HASH),
    owned(`${ORIGINAL}dawn-signal.mp4`, 713732, MOVIE_HASH),
    owned(
      'game/content/campaign.json',
      18487,
      'fd46e787fec3568b8215497a7004b759d45965123ab2e33cd2d654a41aee1718',
    ).then((b) => JSON.parse(b.toString())),
    owned(
      'game/content/classes.json',
      2227,
      '2f776b0dfd099478ffe78465c7b602cd98896206a222a0ed7fd4405a4a643f84',
    ).then((b) => JSON.parse(b.toString())),
    owned(
      'game/content/themes.json',
      4266,
      '93582f7d9ba53753106df7b63928f086820fc0f68357d3c08f26c0b89fb84774',
    ).then((b) => JSON.parse(b.toString())),
  ]);
  assert.equal(campaign.id, 'first-signal');
  assert.equal(campaign.revision, '2');
  const executionCatalog = createExecutionCatalog([
    {
      campaign: { ...campaign, classRecipes: classes },
      classRecipes: classes,
      themes: themeDocument.themes,
    },
  ]);
  const standard = executionCatalog.entries.find((entry) => entry.difficulty === 'standard');
  const identityCatalog = createMediaIdentityCatalog(executionCatalog);
  const request = {
    executionKey: standard.executionKey,
    levelId: 'signal-01',
    levelRevision: '1',
    themeId: 'fpv',
  };
  const identity = identityCatalog.resolve(request);
  assert.ok(identity, 'Exact source First Signal / FPV must exist.');
  const poster = new Blob([png], { type: 'image/png' });
  const prepared = await prepareStillAsset(
    poster,
    {
      id: 'dawn-signal-ending-frame-v1',
      provenance: {
        kind: 'original',
        credit: 'RevealLine original artwork and animation',
        source:
          'Owned Dawn Signal candidate v1, unchanged native ending frame at 95/12 seconds; source commit 5fa9e74ce7d1b8d4a8d8f965941de7a81c95c8c1.',
      },
    },
    { decodeImage: decodeDawnPoster },
  );
  const library = {
    format: MEDIA_LIBRARY_FORMAT,
    assets: [prepared.asset],
    presentations: [
      {
        format: MEDIA_PRESENTATION_FORMAT,
        id: 'dawn-signal-first-signal-v1',
        revision: 1,
        identity,
        poster: { assetId: prepared.asset.id, fit: 'contain', sampling: 'nearest' },
        story: null,
        description:
          'Dawn Signal: a small FPV drone arrives above a glowing coastal station at sunrise.',
      },
    ],
    assignments: [{ identity, presentationId: 'dawn-signal-first-signal-v1', revision: 1 }],
  };
  const stored = await prepareStoredStillMedia(
    library,
    [{ sha256: prepared.asset.sha256, blob: prepared.blob }],
    { executionCatalog, decodeImage: decodeDawnPoster },
  );
  const pin = createPresentationPins({
    library: stored.library.library,
    identityCatalog,
    ...request,
    themeIds: ['fpv'],
  }).choices[0];
  const descriptor = {
    format: VICTORY_STORY_FORMAT,
    id: 'dawn-signal-story-v1',
    revision: 1,
    picturePin: pin,
    source: {
      sha256: MOVIE_HASH,
      bytes: movie.length,
      mime: 'video/mp4',
      width: 640,
      height: 360,
      durationSeconds: 8,
    },
    segment: { startSeconds: 0, endSeconds: 8 },
    description:
      'Dawn Signal — follow the drone approaching the coastal station as the morning lights awaken.',
  };
  const document = await changeStoredStoryBinding(
    { format: STORY_STORAGE_FORMAT, stories: [descriptor], originals: [MOVIE_HASH] },
    { picturePin: pin, story: { id: descriptor.id, revision: 1 } },
    stored.library,
  );
  const media = await exportMediaBundle(stored.library, stored.assets, {
    decodeImage: decodeDawnPoster,
  });
  const story = await exportStoryBundle(
    document,
    [{ sha256: MOVIE_HASH, blob: new Blob([movie], { type: 'video/mp4' }) }],
    { still: stored.library },
  );
  const mediaCheck = await importMediaBundle(media, { decodeImage: decodeDawnPoster });
  const storyCheck = await inspectStoryBundle(story);
  assert.deepEqual(Buffer.from(await mediaCheck.assets[0].blob.arrayBuffer()), png);
  assert.deepEqual(Buffer.from(await storyCheck.assets[0].blob.arrayBuffer()), movie);
  const files = [
    { name: 'Dawn-Signal-originals.rlmedia', blob: media },
    { name: 'Dawn-Signal-stories.rlstory', blob: story },
  ];
  const manifest = {
    format: 'revealline-authored-story-example.v1',
    title: 'Dawn Signal',
    producer: 'CLI; not a native browser export',
    sourceCommit: '5fa9e74ce7d1b8d4a8d8f965941de7a81c95c8c1',
    identity,
    picturePin: pin,
    story: document.bindings[0].story,
    movie: descriptor.source,
    segment: descriptor.segment,
    poster: {
      sha256: POSTER_HASH,
      bytes: png.length,
      observedNativeFrameSeconds: 95 / 12,
      ...(await inspectDawnPoster(poster)),
    },
    files: await Promise.all(
      files.map(async (item) => ({
        name: item.name,
        bytes: item.blob.size,
        sha256: sha256(Buffer.from(await item.blob.arrayBuffer())),
      })),
    ),
    restore: [
      'Open this edition’s Picture Workshop. Review and explicitly restore the .rlmedia originals first.',
      'Choose Reload saved media and installed maps after the picture restore; other editing actions remain disabled until this reload.',
      'Review the .rlstory file with Restore incoming bindings and explicitly restore it.',
      'Choose base-game First Signal, mission First Signal, world FPV Front. Start a fresh attempt; earn the picture before Play story.',
    ],
    limits: [
      'No profile, earned result or saved flight is included or changed by generation.',
      'Use preserve assignments unless deliberately replacing that map’s picture; saved attempts keep prior pins.',
      'CLI fully decodes the owned PNG and verifies original bundle bytes. Movie facts come from retained native inspection; fresh browser import must inspect the codec again.',
      'Native download-to-disk remains unqualified in the observed Codex browser session.',
    ],
  };
  return { files, manifest };
}

export async function writeDawnSignalPair(relativeOutput) {
  assert.equal(typeof relativeOutput, 'string');
  const output = resolve(ROOT, relativeOutput),
    rel = relative(ROOT, output);
  assert.ok(
    rel.startsWith(`.cache${sep}`) && !rel.split(sep).includes('..'),
    'Choose a fresh output directory below this checkout’s .cache.',
  );
  const result = await buildDawnSignalPair();
  let cursor = ROOT;
  for (const part of rel.split(sep).slice(0, -1)) {
    cursor = resolve(cursor, part);
    try {
      await mkdir(cursor);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const info = await lstat(cursor);
    assert.ok(
      info.isDirectory() && !info.isSymbolicLink(),
      'Output parents must be ordinary directories.',
    );
  }
  await mkdir(output); // Exclusive: never overwrite an existing candidate.
  for (const item of result.files)
    await writeFile(resolve(output, item.name), Buffer.from(await item.blob.arrayBuffer()), {
      flag: 'wx',
    });
  await writeFile(
    resolve(output, 'manifest.json'),
    JSON.stringify(result.manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  return { output, manifest: result.manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3)
    throw new Error(
      'Usage: node authoring/library/dawn-signal-example/build.mjs .cache/NEW-DIRECTORY',
    );
  const result = await writeDawnSignalPair(process.argv[2]);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
