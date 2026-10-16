/** Validate the single generated JSON file with a bounded canonical fallback. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { boundedJSON, required } from '../game/data-json.mjs';
import { LIMITS, validateThemeBundle } from '../game/presentation/model.mjs';
import {
  decodePresentationDocument,
  encodePresentationDocument,
} from '../game/presentation/document-codec.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const text = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);

export async function checkPresentationMetadata(studioBytes, manifestBytes, { config = {} } = {}) {
  required(
    studioBytes instanceof Uint8Array &&
      studioBytes.length > 0 &&
      studioBytes.length <= LIMITS.manifestBytes,
    'Studio metadata exceeds its encoded byte budget.',
  );
  required(
    manifestBytes instanceof Uint8Array &&
      manifestBytes.length > 0 &&
      manifestBytes.length <= LIMITS.manifestBytes,
    'Presentation inventory exceeds its byte budget.',
  );
  const document = validateThemeBundle(decodePresentationDocument(text(studioBytes)));
  const canonical = encodePresentationDocument(document);
  const raw = Buffer.from(canonical);
  const fallback = raw.length < LIMITS.manifestBytes ? Buffer.from(canonical + '\n') : raw;
  const pretty = Buffer.from(await format(canonical, { ...config, parser: 'json' }));
  const expected = pretty.length <= LIMITS.manifestBytes ? pretty : fallback;
  required(
    Buffer.from(studioBytes).equals(expected),
    'Generated Studio metadata formatting is stale.',
  );
  const manifest = boundedJSON(text(manifestBytes), {
    maxBytes: LIMITS.manifestBytes,
    maxNodes: 110000,
    maxArray: 4096,
    maxDepth: 20,
    maxString: 8192,
  });
  required(
    manifest?.format === 'revealline-presentation-build.v1',
    'Invalid presentation inventory format.',
  );
  required(
    manifest.source?.id === document.id && manifest.source?.revision === document.revision,
    'Presentation inventory source does not match Studio metadata.',
  );
  required(Array.isArray(manifest.files), 'Invalid presentation inventory files.');
  const rows = manifest.files.filter((row) => row?.path === 'studio.json');
  required(rows.length === 1, 'Presentation inventory must bind Studio metadata exactly once.');
  required(
    rows[0].bytes === studioBytes.length && rows[0].sha256 === hash(studioBytes),
    'Presentation inventory Studio bytes or hash are stale.',
  );
  return {
    source: { id: document.id, revision: document.revision },
    bytes: studioBytes.length,
    sha256: hash(studioBytes),
    formatting: pretty.length <= LIMITS.manifestBytes ? 'prettier' : 'bounded-canonical',
  };
}

async function boundedFile(name) {
  const file = path.join(root, 'game/presentation/compiled', name);
  const stat = await fs.lstat(file);
  required(
    stat.isFile() && stat.size > 0 && stat.size <= LIMITS.manifestBytes,
    'Invalid or oversized generated metadata file.',
  );
  const bytes = await fs.readFile(file);
  required(
    bytes.length <= LIMITS.manifestBytes,
    'Generated metadata changed beyond its byte budget.',
  );
  return bytes;
}
async function main() {
  required(process.argv.length === 2, 'Generated metadata validation takes no arguments.');
  const [studio, manifest, config] = await Promise.all([
    boundedFile('studio.json'),
    boundedFile('manifest.json'),
    resolveConfig(path.join(root, 'game/build-config.json')),
  ]);
  process.stdout.write(
    JSON.stringify(await checkPresentationMetadata(studio, manifest, { config: config ?? {} })) +
      '\n',
  );
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main().catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
