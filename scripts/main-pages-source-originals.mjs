import { createHash } from 'node:crypto';
import path from 'node:path';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';

const catalogPath = 'game/presentation/current-art-sources.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new Error(`Main Pages original projection: ${message}`);
};
function literal(node) {
  if (node?.type === 'Literal' && !node.regex && !node.bigint) return node.value;
  if (
    node?.type === 'UnaryExpression' &&
    ['-', '+'].includes(node.operator) &&
    node.argument?.type === 'Literal' &&
    typeof node.argument.value === 'number'
  )
    return node.operator === '-' ? -node.argument.value : node.argument.value;
  if (node?.type === 'ArrayExpression' && node.elements.every(Boolean))
    return node.elements.map(literal);
  if (node?.type === 'ObjectExpression') {
    const result = Object.create(null);
    for (const item of node.properties) {
      if (
        item.type !== 'Property' ||
        item.kind !== 'init' ||
        item.method ||
        item.computed ||
        item.shorthand
      )
        fail('current-art metadata must contain only literal properties.');
      const key = item.key.type === 'Identifier' ? item.key.name : literal(item.key);
      if (typeof key !== 'string' || Object.hasOwn(result, key) || key === '__proto__')
        fail('current-art metadata contains an ambiguous key.');
      result[key] = literal(item.value);
    }
    return result;
  }
  fail('current-art metadata must be a literal, never executable build input.');
}
export function readCurrentArtSourceMetadata(bytes) {
  const ast = parse(bytes.toString('utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  if (ast.body.length !== 1 || ast.body[0].type !== 'ExportNamedDeclaration')
    fail('expected one explicit current-art source export.');
  const declaration = ast.body[0].declaration;
  if (
    declaration?.type !== 'VariableDeclaration' ||
    declaration.kind !== 'const' ||
    declaration.declarations.length !== 1 ||
    declaration.declarations[0].id?.name !== 'CURRENT_ART_SOURCES'
  )
    fail('current-art source export changed.');
  const sources = literal(declaration.declarations[0].init);
  if (!Array.isArray(sources) || new Set(sources.map((row) => row.id)).size !== sources.length)
    fail('current-art source identities are incomplete or duplicated.');
  return sources;
}

// These published registries retain exact source pins. Their browser consumers
// use the shared verified fallback; none is permission to omit an unregistered path.
const pinRegistries = new Set([
  catalogPath,
  'authoring/design-atlas/reveal-audit-sources.mjs',
  'authoring/design-atlas/reveal-audit.json',
  'authoring/design-atlas/reveal-production-plan.json',
  'authoring/production/register.json',
  'authoring/production/register-sentinel-themes.json',
  'authoring/library/four-worlds-source/catalog.json',
  'authoring/library/fpv-route-choices/distribution.json',
  'authoring/library/sentinel-theme-art/provenance.json',
  'game/build-config.json',
]);

const productionReader = 'authoring/production/preview.mjs';
const atlasReader = 'authoring/design-atlas/reveal-audit.mjs';
const atlasThumbnails = 'authoring/design-atlas/reveal-audit-thumbnails.mjs';
const atlasViewer = 'authoring/design-atlas/reveal-audit-viewer.mjs';
function consumerDependencies(byPath, omittedPaths, originalPath) {
  const needsProduction = [
    'authoring/production/register.json',
    'authoring/production/register-sentinel-themes.json',
  ].some((name) => !omittedPaths.has(name) && byPath.get(name)?.bytes.includes(originalPath));
  const needsAtlas =
    !omittedPaths.has('authoring/design-atlas/reveal-audit-sources.mjs') &&
    byPath.get('authoring/design-atlas/reveal-audit-sources.mjs')?.bytes.includes(originalPath);
  const links = [];
  if (needsProduction || needsAtlas)
    links.push([
      productionReader,
      'game/presentation/current-art.mjs',
      ['findCurrentArtOriginal', 'readCurrentArtImage'],
    ]);
  if (needsAtlas)
    links.push(
      [atlasReader, atlasThumbnails, ['mountRevealAuditThumbnails']],
      [atlasThumbnails, productionReader, ['loadProductionImage']],
      [atlasViewer, productionReader, ['loadProductionImage']],
    );
  return links
    .filter(([from, to, imports]) => {
      const entry = byPath.get(from);
      if (!entry || !byPath.has(to) || omittedPaths.has(from) || omittedPaths.has(to)) return true;
      const ast = parse(entry.bytes.toString('utf8'), {
        ecmaVersion: 'latest',
        sourceType: 'module',
      });
      return !imports.every((name) =>
        ast.body.some(
          (node) =>
            node.type === 'ImportDeclaration' &&
            path.posix.normalize(path.posix.join(path.posix.dirname(from), node.source.value)) ===
              to &&
            node.specifiers.some(
              (item) => item.type === 'ImportSpecifier' && item.imported.name === name,
            ),
        ),
      );
    })
    .map(([from, to]) => `Published original reader lacks its shared resolver: ${from} -> ${to}`);
}

/** Finite main-pages-only selection. Full releases keep their authored PNG paths.
 * Every owner needs its exact retained native fallback and the workshop download
 * receives those same dependencies before redundant original paths are removed. */
export function mainPagesSourceOriginals(entries, catalogue, omittedPaths = new Set()) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const metadata = byPath.get(catalogPath);
  if (!metadata) return { paths: new Set(), dependencies: new Set(), candidates: [] };
  if (byPath.size !== entries.length) fail('duplicate build paths.');
  const sources = readCurrentArtSourceMetadata(metadata.bytes);
  const files = new Map(catalogue.files.map((file) => [file.path, file]));
  const identities = new Map();
  const identity = (path) => {
    if (!identities.has(path)) {
      const item = byPath.get(path);
      identities.set(path, item ? { bytes: item.bytes.length, sha256: hash(item.bytes) } : null);
    }
    return identities.get(path);
  };
  const exact = (pin) => {
    const actual = identity(pin?.path);
    return actual && actual.bytes === pin.bytes && actual.sha256 === pin.sha256;
  };
  const browserSources = entries.filter(
    (entry) =>
      /\.(?:m?js|html|css|json)$/.test(entry.name) &&
      !omittedPaths.has(entry.name) &&
      !pinRegistries.has(entry.name),
  );
  const paths = new Set(),
    dependencies = new Set(),
    candidates = [];
  for (const path of [
    ...new Set(sources.map((row) => row.sourceImagePath).filter(Boolean)),
  ].sort()) {
    if (!byPath.has(path) || omittedPaths.has(path)) continue;
    const owners = catalogue.groups.filter((group) => group.files.includes(path));
    const descriptors = sources.filter((row) => row.sourceImagePath === path);
    const row = { path, owners: owners.map((group) => group.id), descriptors: [], reasons: [] };
    candidates.push(row);
    row.reasons.push(...consumerDependencies(byPath, omittedPaths, path));
    if (owners.length !== 1 || owners[0].id !== 'tooling:workshop' || !files.has(path))
      row.reasons.push('Original has a core, gameplay, or other download owner.');
    const consumers = browserSources
      .filter((entry) => entry.bytes.includes(path))
      .map((entry) => entry.name);
    if (consumers.length) row.reasons.push(`Other published references: ${consumers.join(', ')}`);
    const fallback = new Set();
    for (const descriptor of descriptors) {
      const pins =
        descriptor.kind === 'embedded'
          ? [descriptor.source]
          : descriptor.kind === 'external'
            ? [descriptor.source.pack, descriptor.source.media]
            : [];
      const record = {
        id: descriptor.id,
        kind: descriptor.kind,
        fallbackPaths: pins.map((pin) => pin.path),
        reasons: [],
      };
      row.descriptors.push(record);
      if (!exact({ ...descriptor.image, path }))
        record.reasons.push('Original differs from its exact image pin.');
      if (!pins.length) record.reasons.push('No native fallback.');
      for (const pin of pins) {
        if (pin.path === path)
          record.reasons.push(`Fallback cannot depend on its omitted original: ${pin.path}`);
        else if (omittedPaths.has(pin.path) || !byPath.has(pin.path))
          record.reasons.push(`Fallback is not retained: ${pin.path}`);
        else if (!exact(pin))
          record.reasons.push(`Fallback differs from its exact pin: ${pin.path}`);
        else if (!files.has(pin.path))
          record.reasons.push(`Fallback is not an explicit download: ${pin.path}`);
        else fallback.add(pin.path);
      }
      row.reasons.push(...record.reasons);
    }
    row.eligible = row.reasons.length === 0;
    if (row.eligible) {
      const original = identity(path);
      row.bytes = original.bytes;
      row.sha256 = original.sha256;
      paths.add(path);
      for (const dependency of fallback) dependencies.add(dependency);
    }
  }
  return { paths, dependencies, candidates };
}
