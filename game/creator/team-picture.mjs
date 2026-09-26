import { required } from '../data-json.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { prepareCreatorImage } from './image.mjs';
import { CREATOR_TEAM_MEDIA_LIMITS } from './team-media.mjs';

const canvasBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Canvas could not export the Team picture.')),
      'image/png',
    );
  });

/**
 * Prepare the exact 2:1 reward derivative required by portable Team campaigns.
 * The ordinary creator image pipeline owns source validation, EXIF orientation,
 * metadata removal and fit/crop review. This final bounded resize keeps Team's
 * runtime contract independent from private source bytes and filenames.
 */
export async function prepareCreatorTeamPicture(
  source,
  { alt, fit },
  {
    signal,
    decodeBitmap = (blob, settings) => createImageBitmap(blob, settings),
    createCanvas = () => document.createElement('canvas'),
    prepareImage = prepareCreatorImage,
  } = {},
) {
  const prepared = await prepareImage(source, { alt, fit }, { signal, decodeBitmap, createCanvas });
  let bitmap;
  const canvas = createCanvas();
  try {
    bitmap = await decodeBitmap(prepared.runtime.blob, { imageOrientation: 'none' });
    if (signal?.aborted)
      throw new DOMException('Team picture preparation cancelled.', 'AbortError');
    required(
      bitmap &&
        Number.isFinite(bitmap.width) &&
        bitmap.width > 0 &&
        Number.isFinite(bitmap.height) &&
        bitmap.height > 0,
      'Browser did not decode the reviewed picture derivative.',
    );
    canvas.width = CREATOR_TEAM_MEDIA_LIMITS.width;
    canvas.height = CREATOR_TEAM_MEDIA_LIMITS.height;
    const context = canvas.getContext('2d');
    required(context, 'Team picture preparation needs a Canvas 2D context.');
    context.fillStyle = '#101923';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const output = await canvasBlob(canvas);
    if (signal?.aborted)
      throw new DOMException('Team picture preparation cancelled.', 'AbortError');
    const exact = await prepareStillAsset(
      output,
      {
        id: 'creator-team-picture',
        provenance: {
          kind: 'user-supplied',
          credit: 'Creator-reviewed Team reward',
          source: 'Team campaign creator',
        },
      },
      {
        signal,
        decodeImage: async () => ({
          naturalWidth: CREATOR_TEAM_MEDIA_LIMITS.width,
          naturalHeight: CREATOR_TEAM_MEDIA_LIMITS.height,
        }),
      },
    );
    required(
      exact.asset.width === CREATOR_TEAM_MEDIA_LIMITS.width &&
        exact.asset.height === CREATOR_TEAM_MEDIA_LIMITS.height,
      'Prepared Team picture has the wrong dimensions.',
    );
    return Object.freeze({
      blob: exact.blob,
      sha256: exact.asset.sha256,
      bytes: exact.asset.bytes,
      mime: exact.asset.mime,
      width: exact.asset.width,
      height: exact.asset.height,
      alt: alt.trim(),
      fit,
    });
  } finally {
    bitmap?.close?.();
    canvas.width = 0;
    canvas.height = 0;
  }
}
