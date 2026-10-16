import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import { LIMITS, validateThemeBundle, resolvePresentation } from './model.mjs';
import { verifyThemeAssets, hashPresentationBytes } from './bundle.mjs';
import {
  candidateFromPresentation,
  validateThemeCandidate,
  THEME_PREVIEW_LIMIT,
  studioCandidateOptions,
} from './theme-preview.mjs';
import { COMPILED_PRESENTATION_FORMAT, validateCompiledPresentation } from './host.mjs';
import {
  inspectPresentationDependencies,
  verifyPresentationDependencies,
} from './dependencies.mjs';

export const RUNTIME_THEME_MIME = 'application/vnd.revealline.runtime-theme';
const MAGIC = new TextEncoder().encode('RLRUN2\r\n');
const OLD_MAGIC = new TextEncoder().encode('RLRUN1\r\n');
const envelopeLimit = LIMITS.manifestBytes + THEME_PREVIEW_LIMIT;
const encode = (value) => new TextEncoder().encode(canonicalJSON(value) + '\n');
const decode = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const nativeSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
const extensions = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff2': 'woff2',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
};
const cancelled = (signal) => {
  if (signal?.aborted) throw new DOMException('Runtime export cancelled.', 'AbortError');
};

/** A compiled snapshot has its own identity boundary. Do not flatten a theme
 * under its existing authoring revision or pretend that missing history exists.
 * Selected asset revisions and provenance remain byte-for-byte equivalent. */
export function compileStudioRuntime(source) {
  const document = validateThemeBundle(source),
    resolved = resolvePresentation(document),
    urls = {};
  for (const asset of Object.values(resolved.assets))
    if (asset.file)
      urls[asset.file.sha256] = `./assets/${asset.file.sha256}.${extensions[asset.file.mime]}`;
  return validateCompiledPresentation({
    format: COMPILED_PRESENTATION_FORMAT,
    source: { id: document.id, revision: document.revision },
    resolved,
    urls,
  });
}

/** The closed presentation and candidate descriptors share one source identity.
 * Builtin procedural SIM resources are installed-engine dependencies, not files
 * claimed to be bundled or an instruction to fetch/install executable code. */
export function compileRuntimeEnvelope(source, options) {
  const presentation = compileStudioRuntime(source);
  return validateRuntimeEnvelope({
    format: 'RuntimeTheme.v2',
    presentation,
    candidate: candidateFromPresentation(presentation, studioCandidateOptions(source, options)),
  });
}

export function validateRuntimeEnvelope(input) {
  const value = boundedJSON(input, {
    maxBytes: envelopeLimit,
    maxNodes: 101000,
    maxDepth: 20,
    maxArray: 2048,
    maxString: 8192,
  });
  exactKeys(value, ['format', 'presentation', 'candidate'], 'runtime theme');
  required(value.format === 'RuntimeTheme.v2', 'Unsupported runtime theme envelope.');
  const presentation = validateCompiledPresentation(value.presentation),
    candidate = validateThemeCandidate(value.candidate);
  required(
    canonicalJSON(candidate) ===
      canonicalJSON(
        candidateFromPresentation(presentation, { ...candidate.basis, format: candidate.format }),
      ),
    'Runtime candidate differs from its source presentation.',
  );
  return Object.freeze({ format: value.format, presentation, candidate });
}

/** Compact runtime transfer: exactly one compiled manifest and selected original
 * files, in dependency-inventory order. Authoring history is exported separately. */
export async function exportRuntimeTheme(
  source,
  sourceAssets,
  { signal, familyId, familyRevision, interfaceId, interfaceRevision } = {},
) {
  cancelled(signal);
  const assets = await verifyThemeAssets(source, sourceAssets, { signal });
  const envelope = compileRuntimeEnvelope(source, {
      familyId,
      familyRevision,
      interfaceId,
      interfaceRevision,
    }),
    manifest = encode(envelope),
    presentationBytes = encode(envelope.presentation);
  const inventory = await inspectPresentationDependencies(presentationBytes, { signal });
  required(
    44 + manifest.byteLength + inventory.files.reduce((sum, file) => sum + file.bytes, 0) <=
      LIMITS.bundleBytes,
    'Runtime theme exceeds its byte budget.',
  );
  const header = new Uint8Array(44);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, manifest.length);
  header.set(
    Uint8Array.from((await hashPresentationBytes(manifest)).match(/../g), (byte) =>
      parseInt(byte, 16),
    ),
    12,
  );
  cancelled(signal);
  return new Blob([header, manifest, ...inventory.files.map((file) => assets.get(file.sha256))], {
    type: RUNTIME_THEME_MIME,
  });
}

/** Read-only runtime transfer boundary. Never feeds a partial document into an
 * authoring workspace or changes shared preferences. Rendering still decodes the
 * selected original files through the regular presentation host. */
export async function importRuntimeTheme(source, { signal } = {}) {
  cancelled(signal);
  let size;
  try {
    size = nativeSize.call(source);
  } catch {
    throw new TypeError('A native runtime Blob is required.');
  }
  required(size >= 12 && size <= LIMITS.bundleBytes, 'Runtime theme exceeds its byte budget.');
  const blob = Blob.prototype.slice.call(source, 0, size);
  const header = new Uint8Array(await blob.slice(0, 44).arrayBuffer());
  const version = MAGIC.every((byte, i) => byte === header[i])
    ? 2
    : OLD_MAGIC.every((byte, i) => byte === header[i])
      ? 1
      : null;
  required(version !== null, 'Unsupported runtime theme.');
  const length = new DataView(header.buffer).getUint32(8);
  const headerBytes = version === 2 ? 44 : 12;
  required(
    length > 0 &&
      length <= (version === 2 ? envelopeLimit : LIMITS.manifestBytes) &&
      headerBytes + length <= size,
    'Invalid runtime manifest length.',
  );
  const payloadBytes = new Uint8Array(
    await blob.slice(headerBytes, headerBytes + length).arrayBuffer(),
  );
  let envelope = null;
  if (version === 2) {
    const expected = [...header.slice(12, 44)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    required(
      (await hashPresentationBytes(payloadBytes)) === expected,
      'Runtime manifest hash differs.',
    );
    envelope = validateRuntimeEnvelope(decode(payloadBytes));
  }
  const manifestBytes = envelope ? encode(envelope.presentation) : payloadBytes;
  const inventory = await inspectPresentationDependencies(manifestBytes, { signal }),
    assets = new Map();
  let offset = headerBytes + length;
  for (const file of inventory.files) {
    required(offset + file.bytes <= size, 'Truncated runtime asset.');
    assets.set(file.sha256, blob.slice(offset, offset + file.bytes, file.mime));
    offset += file.bytes;
  }
  required(offset === size, 'Unexpected trailing runtime bytes.');
  const verified = await verifyPresentationDependencies(manifestBytes, {
    signal,
    read: async (file) => new Uint8Array(await assets.get(file.sha256).arrayBuffer()),
  });
  return Object.freeze({
    version,
    envelope,
    candidate: envelope?.candidate ?? null,
    manifest: envelope?.presentation ?? validateCompiledPresentation(decode(manifestBytes)),
    manifestBytes,
    assets,
    inventory: verified.inventory,
    status: verified.status,
    mediaDecoded: false,
  });
}
