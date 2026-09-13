import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mediaFixture, libraryRecord, pngBytes } from './media-fixtures.mjs';
import { validateMediaLibrary } from '../../media-library.mjs';
import { createPresentationPins } from '../../presentation-pins.mjs';
import { prepareVictoryStory, VICTORY_STORY_FORMAT } from '../../victory-story.mjs';

export const videoBytes = await readFile(
  new URL('../fixtures/video/owned-poster-fixture.mp4', import.meta.url),
);
export function createStoryFixture() {
  const f = mediaFixture(true),
    raw = libraryRecord(f.identity),
    png = pngBytes();
  raw.assets[0].sha256 = createHash('sha256').update(png).digest('hex');
  raw.assets[0].bytes = png.length;
  const library = validateMediaLibrary(raw, { identityCatalog: f.identityCatalog });
  const { executionKey, levelId, levelRevision } = f.request();
  const pin = createPresentationPins({
    library,
    identityCatalog: f.identityCatalog,
    executionKey,
    levelId,
    levelRevision,
    themeIds: ['fpv'],
  }).choices[0];
  const descriptor = {
    format: VICTORY_STORY_FORMAT,
    id: 'owned-diagnostic-story',
    revision: 1,
    picturePin: pin,
    source: {
      sha256: createHash('sha256').update(videoBytes).digest('hex'),
      bytes: videoBytes.length,
      mime: 'video/mp4',
      width: 640,
      height: 360,
      durationSeconds: 6,
    },
    segment: { startSeconds: 2, endSeconds: 4 },
    description:
      'Owned diagnostic color and timecode clip. A static description, not gameplay instructions.',
  };
  return {
    ...f,
    library,
    pin,
    descriptor,
    blob: new Blob([videoBytes], { type: 'application/octet-stream' }),
  };
}

// Actual MP4 bytes and SHA; native codec/metadata events are explicitly modeled.
export function inspectionEnvironment({ automatic = true, facts = {} } = {}) {
  const videos = [],
    urls = new Map(),
    revoked = [];
  let next = 1;
  class Video extends EventTarget {
    readyState = 0;
    duration = NaN;
    videoWidth = 0;
    videoHeight = 0;
    paused = true;
    src = '';
    pause() {
      this.paused = true;
    }
    play() {
      throw new Error('Inspection must remain silent.');
    }
    removeAttribute(name) {
      if (name === 'src') this.src = '';
    }
    metadata() {
      this.readyState = 2;
      this.duration = facts.durationSeconds ?? 6;
      this.videoWidth = facts.width ?? 640;
      this.videoHeight = facts.height ?? 360;
      this.dispatchEvent(new Event('loadedmetadata'));
    }
    load() {
      if (this.src && automatic) queueMicrotask(() => this.metadata());
    }
  }
  const options = {
    createVideo() {
      const v = new Video();
      videos.push(v);
      return v;
    },
    createCanvas() {
      throw new Error('Inspection does not encode another poster.');
    },
    URLImpl: {
      createObjectURL(blob) {
        const url = `blob:inspection-${next++}`;
        urls.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
        urls.delete(url);
      },
    },
  };
  return { options, videos, urls, revoked };
}
export async function prepareStoryFixture() {
  const fixture = createStoryFixture(),
    inspection = inspectionEnvironment();
  const prepared = await prepareVictoryStory(fixture, inspection.options);
  return { ...fixture, prepared, inspection };
}
