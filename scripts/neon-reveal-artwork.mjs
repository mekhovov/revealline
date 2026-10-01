import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { inspectImageDataUrl } from '../game/content.mjs';

/** Each arena embeds its own reviewed illustration for offline reveal play. */
export async function neonRevealBackground(id, title) {
  assert.match(id, /^[a-z][a-z-]*$/);
  const bytes = await readFile(
    new URL(`../authoring/library/neon-artwork/backgrounds/${id}.jpg`, import.meta.url),
  );
  const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  const inspected = inspectImageDataUrl(dataUrl);
  assert.equal(inspected.valid, true, `${id}: ${inspected.errors.join('; ')}`);
  return {
    dataUrl,
    name: title,
    fit: 'contain',
    metadata: {
      title,
      description: 'Original neon artwork inspired by this arena’s words, symbols or layout.',
      author: 'Reveal Line · AI-assisted original artwork',
      license: 'Original project artwork',
      rightsStatus:
        'Original AI-generated project illustration; source and effective prompt retained separately.',
    },
  };
}
