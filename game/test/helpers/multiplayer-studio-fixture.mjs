import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeAuditPNG } from '../../../scripts/audit-practice-png-capacity.mjs';
import { decodePresentationDocument } from '../../presentation/document-codec.mjs';
import { resolvePresentation, FORMATS } from '../../presentation/model.mjs';
import { reviseStudioTheme } from '../../presentation/studio-session.mjs';
import { RasterImage } from './raster-image.mjs';

// Full PNG scanline decoding; DOM events and drawing remain modeled in Node.
export async function decodeStudioPNG(blob) {
  const bytes =
    typeof blob === 'string'
      ? blob.startsWith('data:image/png;base64,')
        ? Buffer.from(blob.split(',')[1], 'base64')
        : Buffer.from(await (await fetch(blob)).arrayBuffer())
      : Buffer.from(await blob.arrayBuffer());
  const { width, height, rgba } = decodeAuditPNG(bytes);
  return { width, height, naturalWidth: width, naturalHeight: height, rgba, close() {} };
}
export async function inspectStudioPNG(blob) {
  const { naturalWidth, naturalHeight } = await decodeStudioPNG(blob);
  return { naturalWidth, naturalHeight };
}
export class StudioPNGImage extends RasterImage {
  inspect(blob) {
    return decodeStudioPNG(blob);
  }
}

export async function multiplayerStudioFixture() {
  const shippedDocument = decodePresentationDocument(
    await readFile(new URL('../../presentation/compiled/studio.json', import.meta.url), 'utf8'),
  );
  const shipped = resolvePresentation(shippedDocument);
  // The portable collection targets the actual loaded Studio slot contract.
  // Newly authored, unreleased slot families are not part of this recovery case.
  const base = structuredClone(shippedDocument);
  const assets = [],
    bytes = new Map(),
    bindings = {};
  for (const asset of base.assets) {
    if (!asset.file || bytes.has(asset.file.sha256)) continue;
    const extension = { 'image/png': 'png', 'font/woff2': 'woff2' }[asset.file.mime];
    if (!extension) throw new Error('Unreviewed shipped media type in Studio fixture');
    bytes.set(
      asset.file.sha256,
      new Blob(
        [
          await readFile(
            new URL(
              `../../presentation/compiled/assets/${asset.file.sha256}.${extension}`,
              import.meta.url,
            ),
          ),
        ],
        { type: asset.file.mime },
      ),
    );
  }
  for (const slot of ['terrain.slow', 'player.scout.compact', 'player.scout.detailed']) {
    const asset = structuredClone(shipped.assets[slot]);
    asset.id = `multiplayer-review.${slot}`;
    asset.revision = 1;
    asset.provenance.parent = null;
    asset.quality = { stage: 'produced', evidence: [] };
    assets.push(asset);
    bindings[slot] = { id: asset.id, revision: 1 };
    const blob = new Blob(
      [
        await readFile(
          new URL(`../../presentation/compiled/assets/${asset.file.sha256}.png`, import.meta.url),
        ),
      ],
      { type: 'image/png' },
    );
    await decodeStudioPNG(blob);
    bytes.set(asset.file.sha256, blob);
    if (slot.startsWith('player.'))
      for (const seat of [1, 2])
        for (const state of ['normal', 'cutting'])
          bindings[`team.pilot.p${seat}.${state}.${slot.split('.').at(-1)}`] = bindings[slot];
  }
  const wav = await readFile(new URL('../../audio/effects/confirm.wav', import.meta.url));
  const sha256 = createHash('sha256').update(wav).digest('hex');
  const cue = {
    format: FORMATS.asset,
    id: 'multiplayer-review.audio.confirm',
    revision: 1,
    kind: 'audio',
    description: 'Existing project confirm cue, reused for portable Studio verification.',
    provenance: {
      creator: 'RevealLine',
      source: 'game/audio/effects/confirm.wav',
      license: 'Project-authored audio',
      prompt: '',
      parent: null,
    },
    file: { sha256, bytes: wav.length, mime: 'audio/wav', width: null, height: null },
    geometry: null,
    recipe: null,
    quality: { stage: 'produced', evidence: [] },
  };
  assets.push(cue);
  bytes.set(sha256, new Blob([wav], { type: 'audio/wav' }));
  bindings['audio.confirm'] = { id: cue.id, revision: 1 };
  return {
    document: reviseStudioTheme(base, { assets, bindings }),
    assets: bytes,
    bindings,
  };
}
