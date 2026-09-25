import { required } from '../data-json.mjs';

const nativeSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
export const creatorAbort = (signal) => {
  if (signal?.aborted) throw new DOMException('Creator operation cancelled.', 'AbortError');
};
export function ownCreatorBlob(source, maxBytes, label = 'File') {
  let size;
  try {
    size = nativeSize.call(source);
  } catch {
    throw new TypeError(`${label} must be a native file or Blob.`);
  }
  required(size > 0 && size <= maxBytes, `${label} exceeds its byte budget or is empty.`);
  return Blob.prototype.slice.call(source, 0, size);
}
export async function creatorSHA256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
export function imageDataURL(bytes, mime) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}
