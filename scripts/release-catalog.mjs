import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safe = (name) => {
  if (
    typeof name !== 'string' ||
    !name ||
    name.startsWith('/') ||
    name.split('/').some((part) => !part || part === '..' || part === '.') ||
    name.includes('\\') ||
    name.includes('\0')
  )
    throw new Error('Invalid catalog presentation path.');
  return name;
};
const styles = ['fonts', 'tokens', 'components', 'surfaces', 'compiled'];

/** Copy only the shared page host and its literal dependency graph. The frozen
 * playable editions are never edited to style the release catalog. */
export async function copyCatalogPresentation(projectRoot, destination) {
  const manifestPath = path.join(projectRoot, 'game/presentation/compiled/manifest.json');
  try {
    await fs.access(manifestPath);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  const files = new Map();
  const copy = async (relative) => {
    safe(relative);
    if (files.has(relative)) return;
    const source = path.join(projectRoot, relative);
    if (!(await fs.lstat(source)).isFile())
      throw new Error('Catalog input must be a regular file.');
    const bytes = await fs.readFile(source);
    files.set(relative, bytes);
    const refs = [];
    const text = bytes.toString('utf8');
    if (/\.m?js$/.test(relative))
      for (const match of text.matchAll(
        /(?:^|[;\r\n])\s*(?:import\b\s*(?:[^;"']*?\bfrom\s*)?|export\b[^;"']*?\bfrom\s*)["']([^"']+)["']/g,
      )) {
        if (!match[1].startsWith('.')) throw new Error('Catalog host has a nonlocal dependency.');
        refs.push(match[1]);
      }
    if (relative.endsWith('.css'))
      for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))
        if (!match[1].startsWith('data:')) refs.push(match[1]);
    for (const ref of refs) {
      if (/^(?:[a-z][\w+.-]*:|\/)/i.test(ref))
        throw new Error('Catalog presentation resource must be local.');
      await copy(path.posix.normalize(path.posix.join(path.posix.dirname(relative), ref)));
    }
  };
  for (const part of styles) await copy(`game/ui/field-kit-${part}.css`);
  for (const notice of [
    'Handjet-OFL.txt',
    'Exo2-OFL.txt',
    'IBMPlexMono-OFL.txt',
    'provenance.json',
  ])
    await copy(`game/ui/fonts/field-kit/${notice}`);
  for (const file of ['OFL.txt', 'METADATA.pb', 'provenance.json'])
    await copy(`game/ui/fonts/${file}`);
  await copy('game/ui/field-kit-surfaces.mjs');
  await copy('game/presentation/page-entry.mjs');
  await copy('game/ui/operation-status.css');
  await copy('site/release-catalog.css');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.format !== 'revealline-presentation-build.v1' || !Array.isArray(manifest.files))
    throw new Error('Invalid catalog presentation inventory.');
  for (const entry of manifest.files) {
    const relative = `game/presentation/compiled/${safe(entry.path)}`;
    await copy(relative);
    const bytes = files.get(relative);
    if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256)
      throw new Error('Catalog presentation bytes changed.');
  }
  await copy('game/presentation/compiled/manifest.json');
  const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  if (totalBytes > 40 * 1024 * 1024) throw new Error('Catalog presentation exceeds its budget.');
  const target = path.join(destination, 'catalog-ui');
  await fs.mkdir(target); // The caller owns a new staging directory.
  for (const [relative, bytes] of files) {
    const output = path.join(target, relative);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, bytes, { flag: 'wx' });
  }
  return { files: files.size, bytes: totalBytes };
}

export function catalogShell(title, body, { presentation = false, prefix = '../' } = {}) {
  if (!['../', './'].includes(prefix)) throw new Error('Invalid catalog resource prefix.');
  const titleHTML = String(title).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
  const resources = presentation
    ? styles
        .map(
          (part) =>
            `<link rel="stylesheet" href="${prefix}catalog-ui/game/ui/field-kit-${part}.css">`,
        )
        .join('') +
      `<link rel="stylesheet" href="${prefix}catalog-ui/site/release-catalog.css"><script type="module" src="${prefix}catalog-ui/game/presentation/page-entry.mjs"></script><script type="module" src="${prefix}catalog-ui/game/ui/field-kit-surfaces.mjs"></script>`
    : '<style>body{margin:0;background:#070b12;color:#f3f0db;font:18px/1.6 system-ui}main{max-width:960px;margin:auto;padding:32px 20px}a{color:#78dce8}li{margin-block:24px}code{overflow-wrap:anywhere}</style>';
  const sizeControl = presentation
    ? '<label class="field-kit-page-text"><span data-field-kit-copy="display.textSize">Text size</span><select data-field-kit-text-size><option value="standard" data-field-kit-copy="display.standard">Standard</option><option value="large" data-field-kit-copy="display.large">Large</option></select></label>'
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${titleHTML}</title>${resources}</head><body class="field-kit field-kit-support release-catalog" data-field-kit-page="catalog"><main>${sizeControl}${body}</main></body></html>\n`;
}
