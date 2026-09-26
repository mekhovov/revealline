import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { loadEditionBootstrap } from '../game/editions/bootstrap.mjs';
import { captureEditionPresentation } from '../game/editions/retained-presentation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function captureCompanyPresentations({ editionIds, suffix, write = true }) {
  required(
    Array.isArray(editionIds) &&
      editionIds.length > 0 &&
      editionIds.every((id) => /^[a-z0-9-]+$/.test(id)),
    'Choose one or more company edition IDs.',
  );
  required(/^[a-z0-9-]+$/.test(suffix), 'Choose a safe snapshot suffix.');
  const read = async (name) => fs.readFile(path.join(root, name), 'utf8');
  const fetcher = async (url) => {
    const target = new URL(url, 'https://edition.invalid/');
    required(target.origin === 'https://edition.invalid', 'Snapshot input escaped the repository.');
    try {
      return new Response(await read(target.pathname.slice(1)));
    } catch (error) {
      if (error.code === 'ENOENT') return new Response('', { status: 404 });
      throw error;
    }
  };
  const descriptors = [];
  for (const editionId of editionIds) {
    const bootstrap = await loadEditionBootstrap({
      editionId,
      allowMissing: false,
      catalogURL: 'https://edition.invalid/game/editions/catalog.json',
      contentBaseURL: 'https://edition.invalid/',
      fetcher,
    });
    const snapshot = await captureEditionPresentation(bootstrap);
    const bytes = Buffer.from(canonicalJSON(snapshot) + '\n');
    const relativePath = `game/editions/retained/${editionId}-${suffix}.json`;
    const descriptor = {
      id: snapshot.authoredPresentationSha256,
      path: relativePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    };
    if (write) {
      const target = path.join(root, relativePath);
      try {
        await fs.writeFile(target, bytes, { flag: 'wx' });
      } catch (error) {
        if (error.code === 'EEXIST') throw new Error(`Snapshot already exists: ${relativePath}`);
        throw error;
      }
    }
    descriptors.push(descriptor);
  }
  return descriptors;
}

async function main(args) {
  const suffixIndex = args.indexOf('--suffix');
  required(suffixIndex >= 0 && args[suffixIndex + 1], 'Use --suffix <safe-name>.');
  const suffix = args[suffixIndex + 1];
  const editionIds = args.filter((_, index) => index !== suffixIndex && index !== suffixIndex + 1);
  const descriptors = await captureCompanyPresentations({ editionIds, suffix });
  process.stdout.write(`${JSON.stringify(descriptors, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
