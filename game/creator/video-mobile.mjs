import { VIDEO_POSTER_LIMITS } from '../video-poster.mjs';

const OUTPUT_MIME = 'video/mp4';
const abortError = () => new DOMException('Mobile video preparation cancelled.', 'AbortError');

function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}

async function defaultLibrary() {
  return import('../vendor/mediabunny-1.59.1.min.mjs');
}

function inputFormats(media, mime) {
  if (mime === 'video/mp4') return [media.MP4];
  if (mime === 'video/webm') return [media.WEBM];
  throw new TypeError('Mobile video preparation requires an MP4 or WebM file.');
}

/** Remuxes compatible tracks and transcodes other browser-supported sources to
 * H.264/AAC MP4. BufferTarget plus fastStart places MP4 playback metadata ahead
 * of the media bytes, which is required for reliable iPhone blob playback. */
export async function prepareMobileCreatorVideo(
  source,
  { signal, loadLibrary = defaultLibrary } = {},
) {
  checkAbort(signal);
  if (!(source instanceof Blob) || !['video/mp4', 'video/webm'].includes(source.type))
    throw new TypeError('Choose an MP4 or WebM video for mobile preparation.');
  if (source.size <= 0 || source.size > VIDEO_POSTER_LIMITS.sourceBytes)
    throw new TypeError('Video exceeds the 64 MiB source budget.');

  const media = await loadLibrary();
  checkAbort(signal);
  const input = new media.Input({
      source: new media.BlobSource(source),
      formats: inputFormats(media, source.type),
    }),
    target = new media.BufferTarget(),
    output = new media.Output({
      format: new media.Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });
  let conversion;
  try {
    conversion = await media.Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { codec: 'avc' },
      audio: { codec: 'aac' },
      copy: { mode: 'preferred' },
      tags: {},
      showWarnings: false,
    });
    checkAbort(signal);
    if (!conversion.isValid)
      throw new TypeError(
        'This browser cannot prepare the selected recording as an iPhone-compatible H.264/AAC MP4.',
      );
    const cancel = () => void conversion.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      await conversion.execute();
      checkAbort(signal);
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
    if (!(target.buffer instanceof ArrayBuffer) || target.buffer.byteLength === 0)
      throw new TypeError('Video preparation produced no MP4 bytes.');
    if (target.buffer.byteLength > VIDEO_POSTER_LIMITS.sourceBytes)
      throw new TypeError('Prepared video exceeds the 64 MiB campaign budget.');
    return new Blob([target.buffer], { type: OUTPUT_MIME });
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw error;
  } finally {
    if (conversion && !['done', 'canceled'].includes(conversion.state)) await conversion.cancel();
    input.dispose();
  }
}
