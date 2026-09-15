import { emptyLibrary } from '../../library.mjs';
import { emptyPackLibrary } from '../../packs.mjs';
import { prepareStoredStillMedia } from '../../media-storage-record.mjs';
import { createStoryFixture } from './victory-story-fixture.mjs';
import { pngBytes } from './media-fixtures.mjs';
import { fixture } from './soundtrack-fixtures.mjs';

export async function backupSetFixture() {
  const f = createStoryFixture(),
    decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    still = await prepareStoredStillMedia(
      f.library,
      [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }],
      { executionCatalog: f.catalog, decodeImage },
    ),
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
