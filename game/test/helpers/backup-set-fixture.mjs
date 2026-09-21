import { validateMediaLibrary } from '../../media-library.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPresentationPins } from '../../presentation-pins.mjs';
import { emptyLibrary } from '../../library.mjs';
import { emptyPackLibrary } from '../../packs.mjs';
import { prepareStoredStillMedia } from '../../media-storage-record.mjs';
import { createStoryFixture } from './victory-story-fixture.mjs';
import { fixture } from './soundtrack-fixtures.mjs';
import {
  emptySoundtrackLibrary,
  resolveCatalogueTrack,
  resolveSoundtrackCatalogue,
  resolveSoundtrackLibrary,
  setCatalogueTracks,
} from '../../soundtrack.mjs';

export async function backupSetFixture() {
  const f = createStoryFixture(),
    png = await readFile(
      new URL('../../assets/field-kit/sprites/enemy-border-patrol.png', import.meta.url),
    ),
    width = png.readUInt32BE(16),
    height = png.readUInt32BE(20),
    sha256 = createHash('sha256').update(png).digest('hex'),
    library = structuredClone(f.library);
  // A current tracked, valid-CRC PNG; the native decoder remains modeled.
  Object.assign(library.assets[0], { sha256, bytes: png.length, width, height });
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
  const decodeImage = async () => ({ naturalWidth: width, naturalHeight: height }),
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

/** Distinct structurally valid MPEG fixtures; no audible-quality assertion. */
export async function catalogueBackupAudio(f, { restricted = true, modern = true } = {}) {
  const free = await fixture('backup-free'),
    limited = await fixture('backup-restricted'),
    entry = (raw, slug, denied = false) => {
      const id = `builtin.catalog.backup-${slug}`;
      return resolveCatalogueTrack({
        ...raw.track,
        id,
        title: `Backup ${slug}`,
        edition: 'backup-1',
        path: `optional/soundtracks/backup-${slug}.mp3`,
        tags: { genres: ['synth90s'], role: 'any', energy: 3, themes: ['retro'] },
        ...(modern
          ? {
              policy: {
                id,
                sha256: raw.track.asset.sha256,
                webPlayback: 'allowed',
                offlineCache: 'allowed',
                redistribute: denied ? 'denied' : 'allowed',
                modify: 'allowed',
                gameplayVideo: 'allowed',
                contentId: 'unknown',
              },
              websites: [{ label: 'Creator', url: 'https://example.test/creator' }],
              fileName: `backup-${slug}.mp3`,
            }
          : {}),
      });
    },
    allowedTrack = entry(free, 'free'),
    restrictedTrack = entry(limited, 'restricted', true),
    tracks = restricted ? [allowedTrack, restrictedTrack] : [allowedTrack],
    catalogue = resolveSoundtrackCatalogue({
      format: `revealline-soundtrack-catalogue.v${modern ? 2 : 1}`,
      edition: 'backup-1',
      tracks,
    }),
    library = modern
      ? resolveSoundtrackLibrary({
          ...setCatalogueTracks(emptySoundtrackLibrary(), tracks),
          // These recovery tests model a deliberately selected offloaded album,
          // not the automatically adopted, unused online discovery catalogue.
          selection: { playlistId: 'builtin.playlist.mix' },
        })
      : resolveSoundtrackLibrary({
          ...emptySoundtrackLibrary({ catalogue: true, version: 2 }),
          catalogTracks: tracks,
        }),
    requests = [];
  f.source.catalogue = catalogue;
  f.source.readAudio = async () => ({ generation: f.metadata.audio, library, assets: [] });
  f.source.readAudioAsset = async (sha256, options) => {
    requests.push({ sha256, purpose: options.purpose });
    if (sha256 !== free.track.asset.sha256) throw new Error('Restricted audio must not be read.');
    return free.blob;
  };
  return { free, limited, allowedTrack, restrictedTrack, catalogue, library, requests };
}
