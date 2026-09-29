import { createHash } from 'node:crypto';
import { format } from 'prettier';
import { retainPresentationManifests } from './write-presentation.mjs';

const own = (files) => new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Prepare fresh compiler output for write/check, retaining original archive bytes.
 * This pure step never adopts a source ledger, theme default or filesystem tree. */
export async function preparePresentationOutput(
  files,
  { formatOptions = {}, previous = null } = {},
) {
  const fresh = own(files),
    prior = previous === null ? null : own(previous),
    options = { ...formatOptions };
  if ([...fresh.keys()].some((name) => /^runtime\.[a-f0-9]{64}\.json$/.test(name)))
    throw new Error('Prepare fresh compiler output; pass retained files as previous.');
  // Authenticate compiler-owned inputs before any formatter sees their contents.
  await retainPresentationManifests(fresh, fresh);
  const manifest = JSON.parse(fresh.get('manifest.json').toString('utf8'));
  const formatted = own(fresh);
  for (const [name, body] of formatted) {
    if (name === 'manifest.json' || !/\.(json|css)$/.test(name)) continue;
    formatted.set(
      name,
      Buffer.from(
        await format(body.toString('utf8'), {
          ...options,
          parser: name.endsWith('.json') ? 'json' : 'css',
        }),
      ),
    );
  }
  const formatManifest = (value) =>
    format(JSON.stringify({ format: value.format, source: value.source, files: value.files }), {
      ...options,
      parser: 'json',
    });
  formatted.set(
    'manifest.json',
    Buffer.from(
      await formatManifest({
        ...manifest,
        files: [...formatted]
          .filter(([name]) => name !== 'manifest.json')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([path, body]) => ({ path, bytes: body.length, sha256: hash(body) })),
      }),
    ),
  );
  const prepared = await retainPresentationManifests(formatted, prior ?? formatted);
  // Retention rebuilds ownership metadata. Format that one file, never archives.
  prepared.set(
    'manifest.json',
    Buffer.from(await formatManifest(JSON.parse(prepared.get('manifest.json').toString('utf8')))),
  );
  return prepared;
}
