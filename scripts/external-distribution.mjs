import { readFile, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { exactKeys, required, canonicalJSON } from '../game/data-json.mjs';

export function validateExternalDistributionConfig(value) {
  exactKeys(value, ['format', 'catalog'], 'External distribution config');
  required(
    value.format === 'revealline-external-distribution.v1' &&
      value.catalog === 'game/content/external-worlds.json',
    'Unsupported external chapter distribution opt-in.',
  );
  return value;
}
async function ordinary(root, relative, directory = false) {
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(
      !(await lstat(target)).isSymbolicLink(),
      'External distribution cannot use symbolic links.',
    );
  }
  const stat = await lstat(target);
  required(
    directory ? stat.isDirectory() : stat.isFile(),
    'External distribution needs ordinary source files.',
  );
  return target;
}
async function ordinaryTree(root, relative) {
  const target = await ordinary(root, relative, true);
  for (const name of await readdir(target)) {
    const next = `${relative}/${name}`,
      stat = await lstat(path.join(root, next));
    required(!stat.isSymbolicLink(), 'External distribution cannot use symbolic links.');
    if (stat.isDirectory()) await ordinaryTree(root, next);
    else required(stat.isFile(), 'External distribution needs ordinary source files.');
  }
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
/** Explicit build only. All producers read the selected source tree; all twenty-four
 * exact paired bodies join loose/ZIP inventories, never legacy pack metadata. */
export async function readExternalDistributionEntries(root, option) {
  if (option === undefined) return [];
  validateExternalDistributionConfig(option);
  const catalogPath = await ordinary(root, option.catalog);
  const raw = await readFile(catalogPath);
  required(raw.length <= 65536, 'External chapter catalog exceeds its byte budget.');
  for (const relative of [
    'game/external-chapter-catalog.mjs',
    'game/external-chapter-source.mjs',
    'game/content/themes.json',
    'authoring/library/four-worlds-chapters/packs/original-fpv-pressure.json',
    'authoring/library/fpv-route-choices/packs/fpv-route-choices.json',
  ])
    await ordinary(root, relative);
  for (const name of [
    'external-chapter-pilot',
    'route-worlds',
    'ukraine-route-art',
    'retro-route-art',
    'spend-route-art',
    'sentinel-circuit',
    'sentinel-circuit-art',
    'sentinel-circuit-external',
    'sentinel-theme-art',
    'sentinel-theme-chapters',
    'fracture-lines',
    'fracture-lines-art',
    'fracture-lines-chapter',
    'fracture-ukraine-art',
    'fracture-retro-art',
    'fracture-coupa-art',
    'fracture-theme-chapters',
  ])
    await ordinaryTree(root, `authoring/library/${name}`);
  const { prepareExternalCatalog } = await import(
    pathToFileURL(path.join(root, 'game/external-chapter-catalog.mjs'))
  );
  const { SOURCE_EXTERNAL_CHAPTERS } = await import(
    pathToFileURL(path.join(root, 'game/external-chapter-source.mjs'))
  );
  const catalog = prepareExternalCatalog(raw.toString('utf8'));
  const { buildExternalPilot } = await import(
    pathToFileURL(path.join(root, 'authoring/library/external-chapter-pilot/build.mjs'))
  );
  const { buildRouteWorld } = await import(
    pathToFileURL(path.join(root, 'authoring/library/route-worlds/build.mjs'))
  );
  const { buildExternalSentinel } = await import(
    pathToFileURL(path.join(root, 'authoring/library/sentinel-circuit-external/build.mjs'))
  );
  const { buildSentinelTheme } = await import(
    pathToFileURL(path.join(root, 'authoring/library/sentinel-theme-chapters/build.mjs'))
  );
  const { buildFractureChapter } = await import(
    pathToFileURL(path.join(root, 'authoring/library/fracture-lines-chapter/build.mjs'))
  );
  const { buildFractureTheme } = await import(
    pathToFileURL(path.join(root, 'authoring/library/fracture-theme-chapters/build.mjs'))
  );
  const producers = new Map([
    ['original-fpv-pressure-external', buildExternalPilot],
    ['route-worlds-ukraine', () => buildRouteWorld('ukraine')],
    ['route-worlds-retro', () => buildRouteWorld('retro')],
    ['route-worlds-coupa', () => buildRouteWorld('coupa')],
    ['sentinel-circuit-fpv', buildExternalSentinel],
    ['sentinel-circuit-ukraine', () => buildSentinelTheme('ukraine')],
    ['sentinel-circuit-retro', () => buildSentinelTheme('retro')],
    ['sentinel-circuit-coupa', () => buildSentinelTheme('coupa')],
    ['fracture-lines-fpv', buildFractureChapter],
    ['fracture-lines-ukraine', () => buildFractureTheme('ukraine')],
    ['fracture-lines-retro', () => buildFractureTheme('retro')],
    ['fracture-lines-coupa', () => buildFractureTheme('coupa')],
  ]);
  required(
    SOURCE_EXTERNAL_CHAPTERS.length === producers.size &&
      catalog.chapters.length === producers.size &&
      SOURCE_EXTERNAL_CHAPTERS.every((descriptor) => producers.has(descriptor.id)),
    'Expected exactly twelve registered external editions and producers.',
  );
  const entries = [],
    names = new Set();
  for (const descriptor of SOURCE_EXTERNAL_CHAPTERS) {
    const result = await producers.get(descriptor.id)();
    required(
      canonicalJSON(result.descriptor) === canonicalJSON(descriptor),
      `Compiled external descriptor differs: ${descriptor.id}`,
    );
    const item = catalog.chapters.find((entry) => entry.id === descriptor.id);
    for (const kind of ['pack', 'media']) {
      const bytes = Buffer.from(await result.payloads[kind].arrayBuffer()),
        entry = item[kind];
      required(
        bytes.length === entry.bytes && hash(bytes) === entry.sha256,
        `Compiled external payload differs: ${descriptor.id}/${kind}`,
      );
      required(!names.has(entry.path), 'Duplicate external distribution path.');
      names.add(entry.path);
      entries.push({ name: entry.path, bytes });
    }
  }
  return entries;
}
