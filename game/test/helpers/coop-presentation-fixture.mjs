import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { waitFor as elapsedWaitFor } from './wait-for.mjs';
import { validateCompiledPresentation } from '../../presentation/host.mjs';
import {
  canvasPresentation,
  imagePresentation,
  presentationCSSVariables,
} from '../../presentation/runtime.mjs';
import { inspectImageDataUrl } from '../../content.mjs';
import { mountPresentationPage } from '../../presentation/page.mjs';
import { COOP_PICTURE_BINDINGS } from '../../couch/coop-picture-bindings.mjs';

const runtimeBytes = await readFile(
  new URL('../../presentation/compiled/runtime.json', import.meta.url),
);
const compiled = validateCompiledPresentation(JSON.parse(runtimeBytes));
const manifestSha256 = createHash('sha256').update(runtimeBytes).digest('hex');
const originals = new Map(
  await Promise.all(
    COOP_PICTURE_BINDINGS.map(async (row) => [
      row.picture.slot,
      await readFile(
        new URL(
          `../../presentation/compiled/${compiled.urls[row.picture.sha256]}`,
          import.meta.url,
        ),
      ),
    ]),
  ),
);

// Finite decoded Team frames from the exact compiled originals. Browser pixels
// remain a separate gate; this fixture must not silently omit selected images.
const teamFrames = new Map(
  await Promise.all(
    Object.entries(compiled.resolved.assets)
      .filter(([id, asset]) => id.startsWith('team.') && asset.kind === 'image')
      .map(async ([id, asset]) => {
        const bytes = await readFile(
          new URL(
            `../../presentation/compiled/${compiled.urls[asset.file.sha256]}`,
            import.meta.url,
          ),
        );
        const digest = createHash('sha256').update(bytes).digest('hex');
        const header = inspectImageDataUrl(
          `data:${asset.file.mime};base64,${bytes.toString('base64')}`,
        );
        if (
          digest !== asset.file.sha256 ||
          bytes.length !== asset.file.bytes ||
          !header.valid ||
          header.width !== asset.file.width ||
          header.height !== asset.file.height
        )
          throw new Error(`Changed compiled Team image: ${id}`);
        return [
          id,
          {
            asset,
            geometry: imagePresentation(asset),
            image: { width: header.width, height: header.height, sha256: digest },
          },
        ];
      }),
  ),
);

export function preparedTeamImage(id) {
  return teamFrames.get(id) ?? null;
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export async function waitFor(check, diagnostic = () => '') {
  try {
    await elapsedWaitFor(check, { message: 'Observable Team condition did not settle.' });
  } catch (error) {
    error.message += ` ${diagnostic()}`;
    throw error;
  }
}

// The real document page loader is shared by production and this injected host.
// Exact compiled metadata/original PNG bytes are real; browser decode is finite.
export function installCoopPresentation({ doc, win, install, read, decode, load } = {}) {
  const css = presentationCSSVariables(compiled.resolved);
  const snapshot = {
    source: compiled.source,
    manifestSha256,
    resolved: structuredClone(compiled.resolved),
    image: (id) => teamFrames.get(id) ?? null,
    canvas: canvasPresentation(compiled.resolved),
    fonts: { ui: css['--fk-font-ui'], numeric: css['--fk-font-mono'] },
  };
  const calls = { loads: 0, reads: [], decodes: [], urls: [], releases: [], closes: 0 },
    blobs = new Map();
  let sequence = 0;
  class PictureURL extends URL {
    static createObjectURL(blob) {
      const url = `blob:team-fixture-${++sequence}`;
      blobs.set(url, blob);
      calls.urls.push(url);
      return url;
    }
    static revokeObjectURL(url) {
      calls.releases.push(url);
      blobs.delete(url);
    }
  }
  class PictureImage {
    naturalWidth = 1152;
    naturalHeight = 576;
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this.source;
    }
    removeAttribute(name) {
      if (name === 'src') this.source = '';
    }
    async decode() {
      const blob = blobs.get(this.source);
      this.sha256 = createHash('sha256')
        .update(Buffer.from(await blob.arrayBuffer()))
        .digest('hex');
      calls.decodes.push(this);
      await decode?.({ image: this, blob, calls });
    }
  }
  install('Image', { value: PictureImage });
  install('URL', { value: PictureURL });
  const lease = mountPresentationPage({
    document: doc,
    window: win,
    createHost: () => ({
      async load() {
        calls.loads++;
        await load?.({ snapshot, calls });
        return snapshot;
      },
      apply() {},
      async readPicture(slot, options) {
        calls.reads.push({ slot, options });
        await read?.({ slot, options, calls });
        return {
          asset: snapshot.resolved.assets[slot],
          blob: new Blob([originals.get(slot)], { type: 'image/png' }),
        };
      },
      close() {
        calls.closes++;
      },
    }),
  });
  return { snapshot, calls, lease };
}
