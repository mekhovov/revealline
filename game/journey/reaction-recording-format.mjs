/** Conservative pre-decode admission for local speech. Unknown containers stay
 * untouched in storage and use captions until converted to an admitted format. */
const unsupported = () =>
  new Error('Use mono/stereo PCM WAV or AAC-LC M4A (8–96 kHz), up to 15 seconds.');
const requireValue = (condition) => {
  if (!condition) throw unsupported();
};
const rates = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];
export function inspectRecordingContainer(buffer) {
  requireValue(
    buffer instanceof ArrayBuffer &&
      buffer.byteLength >= 16 &&
      buffer.byteLength <= 2 * 1024 * 1024,
  );
  const data = new DataView(buffer),
    bytes = new Uint8Array(buffer);
  const text = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  const u32 = (offset) => data.getUint32(offset),
    u16 = (offset) => data.getUint16(offset);
  function compatible(channels, sampleRate, maxDecodedSeconds, format, decodeChannels = channels) {
    requireValue(
      (channels === 1 || channels === 2) &&
        sampleRate >= 8000 &&
        sampleRate <= 96000 &&
        maxDecodedSeconds > 0 &&
        maxDecodedSeconds <= 15.25,
    );
    return Object.freeze({ channels, decodeChannels, sampleRate, maxDecodedSeconds, format });
  }
  if (text(0, 4) === 'RIFF' && text(8, 4) === 'WAVE') {
    requireValue(data.getUint32(4, true) + 8 === bytes.length);
    let offset = 12,
      format = null,
      audioBytes = null;
    while (offset < bytes.length) {
      requireValue(offset + 8 <= bytes.length);
      const kind = text(offset, 4),
        size = data.getUint32(offset + 4, true),
        start = offset + 8;
      requireValue(start + size <= bytes.length);
      if (kind === 'fmt ') {
        requireValue(!format && size >= 16);
        let codec = data.getUint16(start, true);
        const channels = data.getUint16(start + 2, true),
          sampleRate = data.getUint32(start + 4, true),
          byteRate = data.getUint32(start + 8, true),
          align = data.getUint16(start + 12, true),
          bits = data.getUint16(start + 14, true);
        if (codec === 0xfffe) {
          requireValue(size >= 40 && data.getUint16(start + 16, true) >= 22);
          codec = data.getUint32(start + 24, true);
          requireValue(
            text(start + 28, 12) ===
              String.fromCharCode(0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113),
          );
        }
        requireValue(
          (codec === 1 && [8, 16, 24, 32].includes(bits)) || (codec === 3 && bits === 32),
        );
        requireValue(align === (channels * bits) / 8 && byteRate === sampleRate * align);
        format = { channels, sampleRate, align };
      } else if (kind === 'data') {
        requireValue(audioBytes === null);
        audioBytes = size;
      }
      offset = start + size + (size % 2);
    }
    requireValue(
      format && audioBytes > 0 && audioBytes % format.align === 0 && offset === bytes.length,
    );
    return compatible(
      format.channels,
      format.sampleRate,
      audioBytes / format.align / format.sampleRate,
      'pcm-wav',
    );
  }
  function boxes(start, end) {
    const result = [];
    while (start < end) {
      requireValue(result.length < 2048);
      requireValue(start + 8 <= end);
      let size = u32(start),
        header = 8;
      if (size === 1) {
        requireValue(start + 16 <= end && u32(start + 8) === 0);
        size = u32(start + 12);
        header = 16;
      }
      if (size === 0) size = end - start;
      requireValue(size >= header && start + size <= end);
      result.push({ kind: text(start + 4, 4), start: start + header, end: start + size });
      start += size;
    }
    return result;
  }
  const one = (entries, kind) => {
    const matched = entries.filter((entry) => entry.kind === kind);
    requireValue(matched.length === 1);
    return matched[0];
  };
  const children = (box) => boxes(box.start, box.end);
  const root = boxes(0, bytes.length);
  requireValue(!root.some((box) => box.kind === 'moof'));
  one(root, 'ftyp');
  one(root, 'mdat');
  const movie = children(one(root, 'moov'));
  requireValue(!movie.some((box) => box.kind === 'mvex'));
  const tracks = movie.filter((box) => box.kind === 'trak');
  requireValue(tracks.length === 1);
  const media = children(one(children(tracks[0]), 'mdia'));
  const handler = one(media, 'hdlr');
  requireValue(handler.end - handler.start >= 12 && text(handler.start + 8, 4) === 'soun');
  const header = one(media, 'mdhd'),
    version = bytes[header.start];
  requireValue(
    (version === 0 && header.end - header.start >= 24) ||
      (version === 1 && header.end - header.start >= 36),
  );
  const scale = u32(header.start + (version === 0 ? 12 : 20));
  requireValue(scale > 0);
  let duration;
  if (version === 0) duration = u32(header.start + 16);
  else {
    requireValue(u32(header.start + 24) === 0);
    duration = u32(header.start + 28);
  }
  requireValue(duration > 0 && duration / scale <= 15.25);
  const table = children(one(children(one(media, 'minf')), 'stbl'));
  const description = one(table, 'stsd');
  requireValue(description.end - description.start >= 8 && u32(description.start + 4) === 1);
  const entry = one(boxes(description.start + 8, description.end), 'mp4a');
  requireValue(entry.end - entry.start >= 28 && u16(entry.start + 8) === 0);
  const declaredChannels = u16(entry.start + 16),
    declaredRate = u16(entry.start + 24);
  requireValue(declaredChannels === 1 || declaredChannels === 2);
  const descriptors = one(boxes(entry.start + 28, entry.end), 'esds');
  requireValue(descriptors.end - descriptors.start >= 6);
  function descriptor(start, end) {
    requireValue(start + 2 <= end);
    const tag = bytes[start++];
    let size = 0,
      count = 0,
      value;
    do {
      requireValue(start < end && count++ < 4);
      value = bytes[start++];
      size = size * 128 + (value & 127);
    } while (value & 128);
    requireValue(start + size <= end);
    return { tag, start, end: start + size };
  }
  const es = descriptor(descriptors.start + 4, descriptors.end);
  requireValue(es.tag === 3 && es.end - es.start >= 3);
  const flags = bytes[es.start + 2];
  requireValue(flags === 0);
  const decoder = descriptor(es.start + 3, es.end);
  requireValue(decoder.tag === 4 && decoder.end - decoder.start >= 13);
  requireValue(bytes[decoder.start] === 0x40 && ((bytes[decoder.start + 1] >> 2) & 63) === 5);
  const config = descriptor(decoder.start + 13, decoder.end);
  requireValue(config.tag === 5 && config.end - config.start === 2);
  const packed = u16(config.start),
    object = packed >> 11,
    frequency = (packed >> 7) & 15,
    channels = (packed >> 3) & 15;
  requireValue(object === 2 && frequency < rates.length && (packed & 7) === 0);
  const sampleRate = rates[frequency];
  requireValue(sampleRate === declaredRate);
  const timing = one(table, 'stts');
  requireValue(timing.end - timing.start >= 8);
  const count = u32(timing.start + 4);
  requireValue(count > 0 && count <= 1600 && timing.start + 8 + count * 8 === timing.end);
  let packets = 0,
    ticks = 0;
  for (let index = 0; index < count; index++) {
    const at = timing.start + 8 + index * 8,
      n = u32(at),
      delta = u32(at + 4);
    requireValue(n > 0 && delta > 0);
    packets += n;
    ticks += n * delta;
  }
  const sizes = one(table, 'stsz');
  requireValue(sizes.end - sizes.start >= 12 && u32(sizes.start + 8) === packets);
  return compatible(
    channels,
    sampleRate,
    Math.max(duration / scale, ticks / scale, (packets * 1024) / sampleRate),
    'aac-lc-m4a',
    Math.max(channels, declaredChannels),
  );
}
