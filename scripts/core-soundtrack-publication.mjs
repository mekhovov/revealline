import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { boundedJSON, canonicalJSON, exactKeys, required } from '../game/data-json.mjs';
import { inspectMP3 } from '../game/mp3.mjs';
import { resolveSoundtrackCatalogue } from '../game/soundtrack.mjs';

const MANIFEST = 'authoring/library/licensed-audio/core-publication.json';
export const OPENING_THEME_TRACK_ID =
  'builtin.catalog.alexander-nakarada.carol-of-the-bells-metal-version';
export const OPENING_THEME_PLAYLIST_ID = 'builtin.album.ukrainian.shchedryk-opening';

async function ordinary(root, relative) {
  required(
    typeof relative === 'string' &&
      !path.isAbsolute(relative) &&
      !relative.includes('\\') &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Invalid core soundtrack path.',
  );
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(
      !(await lstat(target)).isSymbolicLink(),
      'Core soundtrack files cannot be symbolic links.',
    );
  }
  const stat = await lstat(target);
  required(stat.isFile(), 'Core soundtrack publication requires ordinary files.');
  return target;
}

export async function compileCoreSoundtrack(root, edition) {
  const manifestBody = await readFile(await ordinary(root, MANIFEST));
  required(manifestBody.length <= 64 * 1024, 'Core soundtrack manifest is oversized.');
  const publication = boundedJSON(manifestBody.toString('utf8'), {
    maxBytes: 64 * 1024,
    maxNodes: 256,
    maxDepth: 8,
    maxArray: 16,
    maxString: 2048,
  });
  exactKeys(
    publication,
    [
      'format',
      'status',
      'gameCatalogueAdmission',
      'openingTheme',
      'authorization',
      'review',
      'track',
      'collection',
    ],
    'core soundtrack publication',
  );
  required(
    publication.format === 'revealline-core-soundtrack-publication.v1' &&
      publication.status === 'user-direction-approved-qualification-pending' &&
      publication.gameCatalogueAdmission === true &&
      publication.openingTheme === true &&
      publication.authorization?.kind === 'explicit-project-owner-request' &&
      publication.review?.userMusicalDirection === true &&
      ['fullTrack', 'repeatedSession', 'inGameTransition', 'device', 'cultural'].every(
        (key) => publication.review[key] === false,
      ),
    'Core soundtrack admission must preserve its limited approval and pending qualification.',
  );
  const source = publication.track;
  exactKeys(
    source,
    [
      'id',
      'title',
      'artist',
      'fileName',
      'path',
      'asset',
      'rights',
      'tags',
      'policy',
      'websites',
      'provenance',
    ],
    'core soundtrack track',
  );
  required(
    source.id === OPENING_THEME_TRACK_ID &&
      source.path === `game/audio/soundtracks/${source.asset?.sha256}.mp3` &&
      source.asset?.bytes === 8_641_768 &&
      source.asset.sha256 === 'd4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58' &&
      canonicalJSON(source.tags?.genres) === canonicalJSON(['ukrainian', 'metal']) &&
      source.tags.role === 'any' &&
      source.policy?.id === source.id &&
      source.policy.sha256 === source.asset.sha256 &&
      source.policy.webPlayback === 'allowed' &&
      source.policy.offlineCache === 'allowed' &&
      source.policy.redistribute === 'allowed' &&
      source.policy.contentId === 'registered',
    'Core opening-theme identity, classification or rights differ.',
  );
  const body = await readFile(await ordinary(root, source.path));
  required(
    body.length === source.asset.bytes &&
      createHash('sha256').update(body).digest('hex') === source.asset.sha256,
    'Core opening-theme bytes differ from the approved recording.',
  );
  const inspected = await inspectMP3(new Blob([body], { type: 'audio/mpeg' }));
  required(
    canonicalJSON(inspected) === canonicalJSON(source.asset),
    'Core opening-theme MP3 structure differs from its pinned identity.',
  );
  const track = {
    format: 'revealline-audio-track.v1',
    id: source.id,
    kind: 'mp3',
    title: source.title,
    artist: source.artist,
    asset: source.asset,
    rights: source.rights,
    edition,
    path: source.path,
    tags: source.tags,
    policy: source.policy,
    fileName: source.fileName,
    websites: source.websites,
  };
  resolveSoundtrackCatalogue({
    format: 'revealline-soundtrack-catalogue.v2',
    edition,
    tracks: [track],
  });
  exactKeys(
    publication.collection,
    ['id', 'title', 'description', 'genre'],
    'core soundtrack collection',
  );
  required(
    publication.collection.id === OPENING_THEME_PLAYLIST_ID &&
      publication.collection.genre === 'ukrainian',
    'Core opening-theme collection differs.',
  );
  return Object.freeze({
    track: Object.freeze(track),
    bundled: Object.freeze({
      id: track.id,
      sha256: track.asset.sha256,
      bytes: track.asset.bytes,
      path: track.path,
    }),
    collection: Object.freeze({
      ...publication.collection,
      trackIds: Object.freeze([track.id]),
      order: 'ordered',
      repeat: 'all',
    }),
  });
}
