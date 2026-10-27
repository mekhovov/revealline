import { createHash } from 'node:crypto';
import path from 'node:path';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';

const catalogPath = 'game/presentation/current-art-sources.mjs';
// Preserve all original-image paths positively present in main d282197a metadata
// 696461b38a506a54c0dd71b3941a4c215c10afa7. Of these, 103 paths have exact
// byte/digest pins in the independently accepted 101934a7 Pages inventory.
// Native preview fallback is not permission to retire a direct raw origin URL.
const preservedCurrentMainOriginalPaths = new Set([
  "authoring/library/1994-forever-art/originals/last-train-cassette.png",
  "authoring/library/1994-forever-art/originals/midnight-arcade.png",
  "authoring/library/1994-forever-art/originals/rainy-video-rental.png",
  "authoring/library/challenge-chapter-art/originals/crosswind-depot.png",
  "authoring/library/challenge-chapter-art/originals/signal-switchback.png",
  "authoring/library/challenge-chapter-art/originals/split-signal-foundry.png",
  "authoring/library/classic-reveal-artwork/backgrounds/fieldcraft-01.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/fieldcraft-02.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/fieldcraft-03.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/fieldcraft-04.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/living-threads-01.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/living-threads-02.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/living-threads-03.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/night-shift-01.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/night-shift-02.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/night-shift-03.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/sentinel-relay-01.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-01.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-02.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-03.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-04.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-05.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-06.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-07.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-08.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-09.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-10.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-11.jpg",
  "authoring/library/classic-reveal-artwork/backgrounds/signal-12.jpg",
  "authoring/library/countercurrent-art/originals/crossing-watch-fpv.png",
  "authoring/library/countercurrent-art/originals/crossing-watch-retro.png",
  "authoring/library/countercurrent-art/originals/crossing-watch-ukraine.png",
  "authoring/library/countercurrent-art/originals/offset-docks-fpv.png",
  "authoring/library/countercurrent-art/originals/offset-docks-retro.png",
  "authoring/library/countercurrent-art/originals/offset-docks-ukraine.png",
  "authoring/library/countercurrent-art/originals/sandbar-braid-fpv.png",
  "authoring/library/countercurrent-art/originals/sandbar-braid-retro.png",
  "authoring/library/countercurrent-art/originals/sandbar-braid-ukraine.png",
  "authoring/library/equipment-workshop/backgrounds/workshop-01.png",
  "authoring/library/equipment-workshop/backgrounds/workshop-02.png",
  "authoring/library/fpv-arcade/backgrounds/night-signal.png",
  "authoring/library/fpv-arcade/backgrounds/orchard-window.png",
  "authoring/library/fpv-arcade/backgrounds/split-courtyard.png",
  "authoring/library/fpv-pressure-art/originals/courtyard-exits.png",
  "authoring/library/fpv-pressure-art/originals/night-crossfire.png",
  "authoring/library/fpv-pressure-art/originals/orchard-crossing.png",
  "authoring/library/fracture-lines-art/originals/fault-fan-fpv.png",
  "authoring/library/fracture-lines-art/originals/frayed-causeway-fpv.png",
  "authoring/library/fracture-lines-art/originals/split-ring-fpv.png",
  "authoring/library/fracture-retro-art/originals/fault-fan-retro.png",
  "authoring/library/fracture-retro-art/originals/frayed-causeway-retro.png",
  "authoring/library/fracture-retro-art/originals/split-ring-retro.png",
  "authoring/library/fracture-ukraine-art/originals/fault-fan-ukraine.png",
  "authoring/library/fracture-ukraine-art/originals/frayed-causeway-ukraine.png",
  "authoring/library/fracture-ukraine-art/originals/split-ring-ukraine.png",
  "authoring/library/homeward-skies/backgrounds/homeward-01.png",
  "authoring/library/homeward-skies/backgrounds/homeward-02.png",
  "authoring/library/homeward-skies/backgrounds/homeward-03.png",
  "authoring/library/neon-artwork/backgrounds/arrows.jpg",
  "authoring/library/neon-artwork/backgrounds/bandura.jpg",
  "authoring/library/neon-artwork/backgrounds/barvinok.jpg",
  "authoring/library/neon-artwork/backgrounds/berehynia.jpg",
  "authoring/library/neon-artwork/backgrounds/bezkonechnyk.jpg",
  "authoring/library/neon-artwork/backgrounds/chambers.jpg",
  "authoring/library/neon-artwork/backgrounds/channels.jpg",
  "authoring/library/neon-artwork/backgrounds/conduit.jpg",
  "authoring/library/neon-artwork/backgrounds/crossfire.jpg",
  "authoring/library/neon-artwork/backgrounds/crossgrid.jpg",
  "authoring/library/neon-artwork/backgrounds/crossroads.jpg",
  "authoring/library/neon-artwork/backgrounds/deer.jpg",
  "authoring/library/neon-artwork/backgrounds/didukh.jpg",
  "authoring/library/neon-artwork/backgrounds/drone-aid.jpg",
  "authoring/library/neon-artwork/backgrounds/fish.jpg",
  "authoring/library/neon-artwork/backgrounds/fly-free.jpg",
  "authoring/library/neon-artwork/backgrounds/fpv-drone.jpg",
  "authoring/library/neon-artwork/backgrounds/fpv-line.jpg",
  "authoring/library/neon-artwork/backgrounds/fpv.jpg",
  "authoring/library/neon-artwork/backgrounds/hearts.jpg",
  "authoring/library/neon-artwork/backgrounds/horse.jpg",
  "authoring/library/neon-artwork/backgrounds/kalyna.jpg",
  "authoring/library/neon-artwork/backgrounds/kosiv-pitcher.jpg",
  "authoring/library/neon-artwork/backgrounds/labyrinth.jpg",
  "authoring/library/neon-artwork/backgrounds/oak.jpg",
  "authoring/library/neon-artwork/backgrounds/opishnia-ram.jpg",
  "authoring/library/neon-artwork/backgrounds/ornek-tulip.jpg",
  "authoring/library/neon-artwork/backgrounds/petrykivka.jpg",
  "authoring/library/neon-artwork/backgrounds/pinwheels.jpg",
  "authoring/library/neon-artwork/backgrounds/prism.jpg",
  "authoring/library/neon-artwork/backgrounds/pysanka.jpg",
  "authoring/library/neon-artwork/backgrounds/reveal.jpg",
  "authoring/library/neon-artwork/backgrounds/rushnyk.jpg",
  "authoring/library/neon-artwork/backgrounds/ruzha.jpg",
  "authoring/library/neon-artwork/backgrounds/sdua.jpg",
  "authoring/library/neon-artwork/backgrounds/social-drone.jpg",
  "authoring/library/neon-artwork/backgrounds/spines.jpg",
  "authoring/library/neon-artwork/backgrounds/spirals.jpg",
  "authoring/library/neon-artwork/backgrounds/stork.jpg",
  "authoring/library/neon-artwork/backgrounds/swallow.jpg",
  "authoring/library/neon-artwork/backgrounds/switchback.jpg",
  "authoring/library/neon-artwork/backgrounds/switchyards.jpg",
  "authoring/library/neon-artwork/backgrounds/tree-of-life.jpg",
  "authoring/library/neon-artwork/backgrounds/trembita.jpg",
  "authoring/library/neon-artwork/backgrounds/tryzub.jpg",
  "authoring/library/neon-artwork/backgrounds/tsymbaly.jpg",
  "authoring/library/neon-artwork/backgrounds/ukraine.jpg",
  "authoring/library/neon-artwork/backgrounds/vd.jpg",
  "authoring/library/neon-artwork/backgrounds/victory-drones.jpg",
  "authoring/library/neon-artwork/backgrounds/vinok.jpg",
  "authoring/library/neon-artwork/backgrounds/vyshyvanka.jpg",
  "authoring/library/neon-artwork/backgrounds/wavebands.jpg",
  "authoring/library/neon-artwork/backgrounds/wheat.jpg",
  "authoring/library/retro-route-art/originals/crosswind-courier.png",
  "authoring/library/retro-route-art/originals/midnight-workshop.png",
  "authoring/library/retro-route-art/originals/signal-thread.png",
  "authoring/library/sentinel-circuit-art/originals/listening-court.png",
  "authoring/library/sentinel-circuit-art/originals/open-the-circuit.png",
  "authoring/library/sentinel-circuit-art/originals/switchyard-gates.png",
  "authoring/library/sentinel-theme-art/retro/originals/listening-court.png",
  "authoring/library/sentinel-theme-art/retro/originals/open-the-circuit.png",
  "authoring/library/sentinel-theme-art/retro/originals/switchyard-gates.png",
  "authoring/library/sentinel-theme-art/ukraine/originals/listening-court.png",
  "authoring/library/sentinel-theme-art/ukraine/originals/open-the-circuit.png",
  "authoring/library/sentinel-theme-art/ukraine/originals/switchyard-gates.png",
  "authoring/library/ukraine-atlas-art/originals/carpathian-woven-dawn.png",
  "authoring/library/ukraine-atlas-art/originals/dnipro-autumn-watch.png",
  "authoring/library/ukraine-atlas-art/originals/petrykivka-sun-courtyard.png",
  "authoring/library/ukraine-route-art/originals/carpathian-thread-relay.png",
  "authoring/library/ukraine-route-art/originals/crosswind-market-depot.png",
  "authoring/library/ukraine-route-art/originals/two-lanes-forge.png"
]);
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
    // Earlier profile exclusions cannot retire a baseline original URL.
    if (preservedCurrentMainOriginalPaths.has(path)) {
      if (!byPath.has(path))
        fail(`Preserved current-main original is missing from build entries: ${path}`);
      omittedPaths.delete(path);
    }
    if (!byPath.has(path) || omittedPaths.has(path)) continue;
    const owners = catalogue.groups.filter((group) => group.files.includes(path));
    const descriptors = sources.filter((row) => row.sourceImagePath === path);
    const row = { path, owners: owners.map((group) => group.id), descriptors: [], reasons: [] };
    candidates.push(row);
    if (preservedCurrentMainOriginalPaths.has(path))
      row.reasons.push('Current-main original URL is protected from omission.');
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
