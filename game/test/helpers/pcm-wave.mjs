/** Valid uncompressed container for tests that observe the native decode boundary. */
export function pcmWave({
  seconds = 0.1,
  sampleRate = 8000,
  channels = 1,
  bits = 16,
  encoding = 1,
  extensible = false,
} = {}) {
  const frames = Math.round(seconds * sampleRate),
    dataBytes = frames * channels * (bits / 8),
    formatBytes = extensible ? 40 : 16,
    dataStart = 20 + formatBytes,
    bytes = new Uint8Array(dataStart + 8 + dataBytes + (dataBytes % 2)),
    view = new DataView(bytes.buffer),
    text = (offset, value) => bytes.set(new TextEncoder().encode(value), offset);
  text(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, formatBytes, true);
  view.setUint16(20, extensible ? 0xfffe : encoding, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bits / 8), true);
  view.setUint16(32, channels * (bits / 8), true);
  view.setUint16(34, bits, true);
  if (extensible) {
    view.setUint16(36, 22, true);
    view.setUint16(38, bits, true);
    bytes.set([encoding, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113], 44);
  }
  text(dataStart, 'data');
  view.setUint32(dataStart + 4, dataBytes, true);
  return bytes;
}

export const pcmWaveBlob = (options) => new Blob([pcmWave(options)], { type: 'audio/wav' });
