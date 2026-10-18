/** Bounded lossless command decoding. Proof identities stay in their native format. */
export function decodeSimDemoPayload(payload) {
  if (payload?.format !== 'SimDemoPayload.v1') throw new Error('Unsupported SIM demo payload');
  const { width, count, data } = payload.framePack ?? {};
  if (
    ![4, 5].includes(width) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 36000 ||
    typeof data !== 'string' ||
    data.length > 2 * 1024 * 1024
  )
    throw new Error('Invalid SIM demo frame pack');
  const bytes = Uint8Array.from(globalThis.atob(data), (character) => character.charCodeAt(0));
  let offset = 0;
  const read = () => {
    let value = 0,
      factor = 1;
    for (let index = 0; index < 5; index++) {
      if (offset >= bytes.length) throw new Error('Truncated SIM demo frame pack');
      const byte = bytes[offset++];
      value += (byte & 127) * factor;
      if (!(byte & 128)) return value % 2 ? -(value + 1) / 2 : value / 2;
      factor *= 128;
    }
    throw new Error('Oversized SIM demo frame value');
  };
  const previous = Array(width).fill(0),
    frames = [];
  for (let row = 0; row < count; row++)
    frames.push(
      previous.map((value, index) => {
        const next = value + read();
        if (!Number.isInteger(next) || Math.abs(next) > 1000)
          throw new Error('Invalid SIM demo control');
        previous[index] = next;
        return next;
      }),
    );
  if (offset !== bytes.length) throw new Error('Trailing SIM demo frame bytes');
  return { ...payload.proof, frames };
}
