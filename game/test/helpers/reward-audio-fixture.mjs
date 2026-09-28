/** Original one-second, mono PCM silence generated in the test; no licensed recording. */
export function rewardAudioFixture() {
  const bytes = new Uint8Array(16044),
    view = new DataView(bytes.buffer);
  const ascii = (offset, value) =>
    [...value].forEach((char, index) => {
      bytes[offset + index] = char.charCodeAt(0);
    });
  ascii(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, 16000, true);
  return bytes;
}
