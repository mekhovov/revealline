import { CURRENT_ART_SOURCES } from './current-art-sources.mjs';
import { freezePresentation } from './model.mjs';
import { hashPresentationBytes } from './bundle.mjs';
import { canonicalJSON, required } from '../data-json.mjs';
import { validatePack } from '../packs.mjs';
import { campaignKey } from '../library.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { prepareExternalDownload } from '../external-chapter-catalog.mjs';
import { createSceneArt } from '../ui/scene-art.mjs';

const sources = new Map(
  CURRENT_ART_SOURCES.map((row) => [
    row.id,
    freezePresentation({
      ...row,
      availability: {
        status: row.kind === 'procedural' ? 'local-procedure' : 'request-required',
        sourceOriginalBytes: row.image?.bytes ?? 0,
        distributionBytes:
          row.kind === 'procedural'
            ? 0
            : row.kind === 'external'
              ? row.source.pack.bytes + row.source.media.bytes
              : row.source.bytes,
        label:
          row.kind === 'procedural'
            ? 'No image download; original scene renderer with preview seed 0.'
            : 'Original loads only on request. A source checkout uses its exact PNG; published releases use the matching pack or external media download. Availability depends on this host and connection.',
      },
    }),
  ]),
);
const rootURL = new URL('../../', import.meta.url);
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Source picture preview cancelled.', 'AbortError');
};
const dataURL = (bytes, mime) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return `data:${mime};base64,${btoa(binary)}`;
};
const embeddedBytes = (value) => {
  const header = inspectImageDataUrl(value);
  required(header.valid, `Invalid original picture: ${header.errors.join('; ')}`);
  return {
    bytes: Uint8Array.from(atob(value.split(',')[1]), (c) => c.charCodeAt(0)),
    mime: header.mime,
  };
};
const dimensions = (image) => ({
  width: image?.naturalWidth ?? image?.width,
  height: image?.naturalHeight ?? image?.height,
});
async function decodeBitmap(blob, { signal }) {
  required(
    typeof globalThis.createImageBitmap === 'function',
    'This browser cannot decode a source picture preview.',
  );
  abort(signal);
  const image = await globalThis.createImageBitmap(blob);
  if (signal.aborted) {
    image.close();
    abort(signal);
  }
  return image;
}
export class CurrentArtUnavailableError extends Error {
  constructor(status, relative) {
    super(
      `Original picture source unavailable (HTTP ${status}): ${relative}. Open its matching built release or retry when connected.`,
    );
    this.name = 'CurrentArtUnavailableError';
    this.status = status;
  }
}
/** Lookup is code-owned and performs no IO. Uploaded manifests cannot add locators. */
export function describeCurrentArt(slotId) {
  return typeof slotId === 'string' ? (sources.get(slotId) ?? null) : null;
}
async function readPinned(relative, pin, { baseURL, fetch: request, signal, onBytes }) {
  abort(signal);
  const base = new URL(baseURL),
    url = new URL(relative, base);
  required(
    ['https:', 'http:'].includes(base.protocol) &&
      base.href.endsWith('/') &&
      !base.username &&
      !base.password &&
      !base.search &&
      !base.hash &&
      url.origin === base.origin &&
      url.href.startsWith(base.href),
    'Source previews require the matching same-origin game distribution.',
  );
  const response = await request(url.href, {
    signal,
    redirect: 'error',
    credentials: 'same-origin',
  });
  let reader,
    finished = false;
  try {
    abort(signal);
    if (!response.ok) throw new CurrentArtUnavailableError(response.status, relative);
    required(
      !response.redirected && (!response.url || response.url === url.href),
      'Source picture request changed location.',
    );
    const length = response.headers.get('content-length');
    required(
      length === null || (/^\d+$/.test(length) && Number(length) === pin.bytes),
      'Source picture length differs from its source pin.',
    );
    required(response.body?.getReader, 'Bounded source picture downloads are unavailable.');
    reader = response.body.getReader();
  } catch (error) {
    await response.body?.cancel?.().catch(() => {});
    throw error;
  }
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  const parts = [];
  let total = 0;
  try {
    for (;;) {
      abort(signal);
      const part = await reader.read();
      abort(signal);
      if (part.done) {
        finished = true;
        break;
      }
      total += part.value.byteLength;
      required(total <= pin.bytes, 'Source picture response exceeds its exact byte budget.');
      parts.push(part.value);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  required(total === pin.bytes, 'Source picture response is truncated.');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  required(
    (await hashPresentationBytes(bytes)) === pin.sha256,
    'Source picture hash differs from its immutable source.',
  );
  abort(signal);
  onBytes(total);
  return bytes;
}
async function checkedPicture(bytes, pin, decodeImage, signal) {
  required(
    bytes.length === pin.bytes && (await hashPresentationBytes(bytes)) === pin.sha256,
    'Original picture bytes differ from the exact owner pin.',
  );
  abort(signal);
  const header = inspectImageDataUrl(dataURL(bytes, pin.mime));
  required(
    header.valid &&
      header.mime === pin.mime &&
      header.width === pin.width &&
      header.height === pin.height,
    'Original picture header differs from its source pin.',
  );
  const image = await decodeImage(new Blob([bytes], { type: pin.mime }), { signal });
  try {
    abort(signal);
    const size = dimensions(image);
    required(
      size.width === pin.width && size.height === pin.height,
      'Decoded original picture dimensions differ.',
    );
    return image;
  } catch (error) {
    image?.close?.();
    throw error;
  }
}
/** Explicit, read-only previews. Each instance owns one request and image;
 * cancellation closes late decode results and never writes player or studio data. */
export function createCurrentArtPreview({
  fetch: request = globalThis.fetch,
  baseURL = rootURL,
  decodeImage = decodeBitmap,
  canvasFactory = () => document.createElement('canvas'),
} = {}) {
  let active = null,
    closed = false;
  function cancel() {
    const state = active;
    active = null;
    if (state) {
      state.controller.abort();
      state.dispose();
    }
  }
  return Object.freeze({
    cancel,
    close() {
      closed = true;
      cancel();
    },
    async load(slotId, { signal } = {}) {
      required(!closed, 'This source preview is closed.');
      const descriptor = describeCurrentArt(slotId);
      required(descriptor, 'This slot has no registered exact source picture.');
      abort(signal);
      cancel();
      const controller = new AbortController();
      let image = null,
        releasedImage = null,
        disposed = false,
        downloadBytes = 0;
      const externalAbort = () => {
        controller.abort();
        dispose();
      };
      function dispose() {
        signal?.removeEventListener('abort', externalAbort);
        disposed = true;
        if (image && releasedImage !== image) {
          releasedImage = image;
          image.close?.();
          if (descriptor.kind === 'procedural') {
            image.width = 0;
            image.height = 0;
          }
        }
      }
      const state = { controller, dispose };
      active = state;
      signal?.addEventListener('abort', externalAbort, { once: true });
      const transport = {
        baseURL,
        fetch: request,
        signal: controller.signal,
        onBytes: (n) => {
          downloadBytes += n;
        },
      };
      let origin,
        level = descriptor.level,
        theme = descriptor.theme;
      try {
        abort(signal);
        abort(controller.signal);
        if (descriptor.kind === 'procedural') {
          image = createSceneArt(theme, level, descriptor.seed, canvasFactory);
          origin = {
            kind: 'procedural',
            path: descriptor.source.path,
            label: 'Original procedural scene · exact source theme and level · preview seed 0',
          };
        } else {
          let bytes;
          if (descriptor.sourceImagePath) {
            try {
              bytes = await readPinned(descriptor.sourceImagePath, descriptor.image, transport);
              origin = {
                kind: 'source-original',
                path: descriptor.sourceImagePath,
                label: 'Exact source PNG · original bytes verified',
              };
            } catch (error) {
              if (!(error instanceof CurrentArtUnavailableError) || error.status !== 404)
                throw error;
            }
          }
          if (!bytes && descriptor.kind === 'embedded') {
            const raw = await readPinned(descriptor.source.path, descriptor.source, transport);
            const text = new TextDecoder('utf-8', { fatal: true }).decode(raw),
              checked = validatePack(text);
            required(checked.valid, `Current source pack is invalid: ${checked.errors.join('; ')}`);
            const pack = JSON.parse(text),
              campaign = pack.campaigns.find((c) => c.id === descriptor.source.campaignId);
            required(
              pack.id === descriptor.source.packId &&
                campaign &&
                campaignKey({
                  ...campaign,
                  classRecipes: pack.classRecipes.filter(
                    (r) => !campaign.classIds || campaign.classIds.includes(r.id),
                  ),
                }) === descriptor.owner.baseCampaignKey,
              'Source pack owner identity differs.',
            );
            level = campaign.levels.find((l) => l.id === descriptor.owner.levelId);
            theme = pack.themes.find((t) => t.id === descriptor.owner.themeId);
            required(
              level?.revision === descriptor.owner.levelRevision && theme,
              'Source level/theme identity differs.',
            );
            const visual =
              pack.levelVisuals.find((v) => v.levelId === level.id)?.visualOverrides.background ??
              pack.visualOverrides.background;
            required(
              visual && (visual.fit ?? 'cover') === descriptor.fit,
              'Source picture fit or binding differs.',
            );
            bytes = embeddedBytes(visual.dataUrl).bytes;
            origin = {
              kind: descriptor.source.kind,
              path: descriptor.source.path,
              label: `Exact ${descriptor.source.kind} pack original · downloaded only for this preview`,
            };
          }
          if (!bytes && descriptor.kind === 'external') {
            const checkedDecode = async (source) => {
              abort(controller.signal);
              const blob =
                typeof source === 'string' ? new Blob([embeddedBytes(source).bytes]) : source;
              const candidate = await decodeImage(blob, { signal: controller.signal });
              try {
                abort(controller.signal);
                const size = dimensions(candidate);
                return { naturalWidth: size.width, naturalHeight: size.height };
              } finally {
                candidate?.close?.();
              }
            };
            const prepared = await prepareExternalDownload(descriptor.source.descriptorId, {
              baseURL,
              fetch: request,
              signal: controller.signal,
              decodeImage: checkedDecode,
            });
            downloadBytes += descriptor.source.pack.bytes + descriptor.source.media.bytes;
            const original = prepared.descriptor.originals.find(
              (o) =>
                o.levelId === descriptor.owner.levelId &&
                o.levelRevision === descriptor.owner.levelRevision,
            );
            required(
              original && original.sha256 === descriptor.image.sha256,
              'External source owner differs.',
            );
            const presentation = prepared.imported.document.library.presentations.find(
              (p) => p.id === original.presentationId,
            );
            required(
              canonicalJSON(presentation.identity) === canonicalJSON(descriptor.owner) &&
                presentation.poster.fit === descriptor.fit,
              'External source presentation differs.',
            );
            const blob = prepared.imported.assets.find((a) => a.sha256 === original.sha256)?.blob;
            required(blob, 'The selected external original is unavailable.');
            bytes = new Uint8Array(await blob.arrayBuffer());
            level = prepared.pack.campaigns[0].levels.find(
              (l) => l.id === descriptor.owner.levelId,
            );
            theme = prepared.pack.themes.find((t) => t.id === descriptor.owner.themeId);
            origin = {
              kind: 'external',
              path: descriptor.source.media.path,
              label: 'Exact original from the validated paired external download · no installation',
            };
          }
          image = await checkedPicture(bytes, descriptor.image, decodeImage, controller.signal);
        }
        if (disposed || active !== state) {
          dispose();
          abort(controller.signal);
          throw new DOMException('Source preview replaced.', 'AbortError');
        }
        abort(controller.signal);
        return Object.freeze({
          kind: descriptor.kind === 'procedural' ? 'procedural' : 'image',
          image,
          fit: descriptor.fit,
          sampling: descriptor.sampling,
          descriptor,
          origin: freezePresentation(origin),
          theme: freezePresentation(theme),
          level: freezePresentation(level),
          downloadBytes,
          dispose: () => {
            if (active === state) cancel();
            else dispose();
          },
        });
      } catch (error) {
        dispose();
        if (active === state) active = null;
        throw error;
      }
    },
  });
}
