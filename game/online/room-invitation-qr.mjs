import { readRoomInvitation } from './room-content.mjs';

/** Accept the pinned invitation projection, never a seat credential or service URL. */
export function roomInvitationAddress(input) {
  if (typeof input !== 'string' || input.length > 4096)
    throw new TypeError('Invalid room invitation address.');
  const address = new URL(input);
  if (
    !['https:', 'http:'].includes(address.protocol) ||
    address.username ||
    address.password ||
    [...address.searchParams.keys()].some((key) => key !== 'lang') ||
    address.searchParams.getAll('lang').length > 1 ||
    !readRoomInvitation(address.href)?.expectedHash
  )
    throw new TypeError('Invalid room invitation address.');
  return address.href;
}

/** Local numeric SVG only; encoding an invitation never contacts a QR service. */
export async function createRoomInvitationQr(input) {
  const address = roomInvitationAddress(input);
  const { qrcodegen } = await import('../vendor/qrcodegen-1.8.0.mjs');
  const code = qrcodegen.QrCode.encodeText(address, qrcodegen.QrCode.Ecc.MEDIUM);
  const size = code.size + 8,
    squares = [];
  for (let y = 0; y < code.size; y++)
    for (let x = 0; x < code.size; x++)
      if (code.getModule(x, y)) squares.push(`M${x + 4},${y + 4}h1v1h-1z`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path d="${squares.join('')}" fill="black"/></svg>`;
  return Object.freeze({
    size,
    version: code.version,
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  });
}
