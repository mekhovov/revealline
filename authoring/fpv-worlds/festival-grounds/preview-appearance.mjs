import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Wrapper appearance is separate from the historical admitted player. Copy live
// source into immutable fixture files; never hardlink it to a mutable checkout.
export async function stagePreviewAppearance(output) {
  const root = fileURLToPath(new URL('../../../', import.meta.url)),
    files = [],
    seen = new Set();
  async function copy(relative) {
    if (seen.has(relative)) return;
    if (!relative.startsWith('game/') || relative.split('/').includes('..'))
      throw Error('Preview appearance dependency escapes game: ' + relative);
    seen.add(relative);
    const bytes = await fs.readFile(path.join(root, relative)),
      target = 'appearance/' + relative;
    await fs.mkdir(path.dirname(path.join(output, target)), { recursive: true });
    await fs.writeFile(path.join(output, target), bytes, { flag: 'wx' });
    files.push({
      path: target,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    if (relative.endsWith('.css'))
      for (const match of bytes.toString().matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
        const value = match[1];
        if (value.startsWith('data:')) continue;
        if (!value.startsWith('.')) throw Error('Nonlocal preview appearance asset: ' + value);
        await copy(path.posix.normalize(path.posix.join(path.posix.dirname(relative), value)));
      }
  }
  for (const name of ['theme-bootstrap.mjs', 'industrial-workshop.css'])
    await copy('game/presentation/' + name);
  return files;
}

export async function previewHTML(url) {
  return Buffer.from(
    (await fs.readFile(url, 'utf8')).replaceAll(
      '../../../game/presentation/',
      './appearance/game/presentation/',
    ),
  );
}
