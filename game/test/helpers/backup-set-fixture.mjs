import { validateMediaLibrary } from '../../media-library.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPresentationPins } from '../../presentation-pins.mjs';
import { emptyLibrary } from '../../library.mjs';
import { emptyPackLibrary } from '../../packs.mjs';
import { prepareStoredStillMedia } from '../../media-storage-record.mjs';
import { createStoryFixture } from './victory-story-fixture.mjs';
import { fixture } from './soundtrack-fixtures.mjs';

export async function backupSetFixture() {
  const f = createStoryFixture(),
    png = await readFile(
      new URL(
        '../../../authoring/library/runtime-sprite-candidates-v1/export/atlas-bell-warden-v1-aaa88f04dccaa141ffb121acbb6e1b4eb9b89c0ace3e8ebddc172ba4294eabce.png',
        import.meta.url,
      ),
    ),
    sha256 = createHash('sha256').update(png).digest('hex'),
    library = structuredClone(f.library);
  // Existing owned, valid-CRC 128×128 PNG; the native decoder remains modeled.
  Object.assign(library.assets[0], { sha256, bytes: png.length, width: 128, height: 128 });
  const validated = validateMediaLibrary(library, { identityCatalog: f.identityCatalog });
  const pin = createPresentationPins({
    library: validated,
    identityCatalog: f.identityCatalog,
    ...f.request(),
    themeIds: ['fpv'],
  }).choices[0];
  f.library = validated;
  f.pin = pin;
  f.descriptor = { ...f.descriptor, picturePin: pin };
  const decodeImage = async () => ({ naturalWidth: 128, naturalHeight: 128 }),
    still = await prepareStoredStillMedia(library, [{ sha256, blob: new Blob([png]) }], {
      executionCatalog: f.catalog,
      decodeImage,
    }),
    audio = await fixture(),
    story = {
      format: 'revealline-story-storage.v1',
      stories: [f.descriptor],
      originals: [f.descriptor.source.sha256],
    },
    contents = { library: emptyLibrary(), packs: emptyPackLibrary(), session: null },
    metadata = { media: 3, story: 2, audio: 5 },
    calls = [];
  let identity = 'current-game';
  const source = {
    edition: { version: 'candidate', channel: 'test-profile' },
    decodeImage,
    gameIdentity: () => identity,
    readGame: async () => ({ contents, options: { campaigns: [f.campaign] } }),
    readMetadata: async () => ({ ...metadata }),
    readStill: async () => {
      calls.push('media');
      return { generation: metadata.media, document: still.library, assets: still.assets };
    },
    readStory: async () => {
      calls.push('story');
      return {
        generation: metadata.story,
        document: story,
        assets: [{ sha256: f.descriptor.source.sha256, blob: f.blob }],
      };
    },
    readAudio: async () => {
      calls.push('audio');
      return { generation: metadata.audio, library: audio.library, assets: audio.assets };
    },
  };
  return {
    source,
    contents,
    metadata,
    calls,
    still,
    story,
    audio,
    f,
    changeGame: () => {
      identity = 'different-game';
    },
  };
}
