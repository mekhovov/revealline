/** New attempts own their interference seed; continuation never calls this. */
export function nextClassicHazardSeed(previous, random = globalThis.crypto) {
  const bytes = new Uint32Array(1);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (random?.getRandomValues) random.getRandomValues(bytes);
    else bytes[0] = Math.floor(Math.random() * 0x100000000);
    if (bytes[0] !== previous) return bytes[0];
  }
  return (previous + 0x9e3779b9) >>> 0;
}
