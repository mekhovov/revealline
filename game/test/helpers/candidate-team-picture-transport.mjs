import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

/** Exact candidate bytes with finite bitmap decode for real Team host tests. */
export async function candidateTeamPictureTransport(source) {
  const originals = new Map(
    await Promise.all(
      source.assets.map(async (asset) => [
        asset.path,
        await readFile(new URL('../../' + asset.path, import.meta.url)),
      ]),
    ),
  );
  return (install) => {
    const BaseImage = globalThis.Image,
      upstream = globalThis.fetch;
    class CandidateImage extends BaseImage {
      async decode() {
        if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
        const bytes = Buffer.from(this.source.split(',')[1], 'base64');
        this.width = this.naturalWidth = bytes.readUInt32BE(16);
        this.height = this.naturalHeight = bytes.readUInt32BE(20);
      }
    }
    install('Image', { value: CandidateImage });
    install('crypto', { value: webcrypto });
    install('fetch', {
      value: async (url, options = {}) => {
        const pathname = new URL(url).pathname,
          asset = source.assets.find((row) => pathname.endsWith('/' + row.path));
        return asset ? new Response(originals.get(asset.path)) : upstream(url, options);
      },
    });
  };
}
