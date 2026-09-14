/** Explicit source adapters; never imports a game module or runs a producer. */
import { readFile, lstat, realpath, open } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'espree';
import { canonical, validateProductionRegister, validateSourcePath } from './model.mjs';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const equal = (a, b) => canonical(a) === canonical(b);
const own = (d, o) => ({
  baseCampaignKey: d.campaignKey,
  levelId: o.levelId,
  levelRevision: o.levelRevision ?? '1',
  themeId: d.themeId,
});
const PATHS = Object.freeze({
  pressure: 'authoring/library/four-worlds-source/catalog.json',
  route: 'authoring/library/fpv-route-choices/distribution.json',
  world: 'authoring/library/route-worlds/editions.json',
  sentinel: 'authoring/library/sentinel-circuit-external/descriptor.json',
  'sentinel-world': 'authoring/library/sentinel-theme-chapters/editions.json',
  fracture: 'authoring/library/fracture-lines-chapter/edition.json',
  'fracture-world': 'authoring/library/fracture-theme-chapters/editions.json',
  countercurrent: 'authoring/library/countercurrent-chapters/editions.json',
  body: 'game/content/themes.json',
  dawn: 'authoring/still-media/examples/dawn-signal/manifest.json',
  synth: 'game/ui/music.mjs',
});
const FRACTURE_LAYOUTS = 'authoring/library/fracture-lines/layouts.json';
const FRACTURE_MISSIONS = ['split-ring', 'fault-fan', 'frayed-causeway'];
const COUNTERCURRENT_LAYOUTS = 'authoring/library/countercurrent/layouts.json';
const COUNTERCURRENT_ART = 'authoring/library/countercurrent-art';
const COUNTERCURRENT_MISSIONS = ['offset-docks', 'sandbar-braid', 'crossing-watch'];
export async function ordinaryPath(root, name) {
  validateSourcePath(name);
  const resolved = await realpath(root);
  let p = resolved;
  for (const part of name.split('/')) {
    p = path.join(p, part);
    const s = await lstat(p);
    if (s.isSymbolicLink()) throw new Error(`Symlink source refused: ${name}`);
  }
  if (!(await lstat(p)).isFile()) throw new Error(`Ordinary source file required: ${name}`);
  return p;
}
async function boundedRead(root, name, max = 4 * 1024 * 1024) {
  const p = await ordinaryPath(root, name);
  const f = await open(p, 'r');
  try {
    const s = await f.stat();
    if (s.size > max) throw new Error(`Metadata too large: ${name}`);
    const b = await f.readFile();
    if (b.length !== s.size || b.length > max)
      throw new Error(`Source changed while reading: ${name}`);
    return b;
  } finally {
    await f.close();
  }
}
// Archived metadata is explicit data authority, not a fallback for changed bodies.
const HISTORY_ROOT = 'authoring/production/history';
const historyKey = (p) => canonical([p.path, p.bytes, p.sha256]);
async function metadataHistory(root) {
  let raw;
  try {
    raw = await boundedRead(root, `${HISTORY_ROOT}/index.json`, 32768);
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
  const index = JSON.parse(raw.toString('utf8'));
  if (
    !index ||
    Object.keys(index).sort().join(',') !== 'entries,format' ||
    index.format !== 'revealline-production-metadata-history.v1' ||
    !Array.isArray(index.entries) ||
    index.entries.length > 64
  )
    throw new Error('Invalid production metadata history index');
  const result = new Map();
  for (const pin of index.entries) {
    if (
      !pin ||
      Object.keys(pin).sort().join(',') !== 'bytes,path,sha256' ||
      typeof pin.path !== 'string' ||
      !pin.path.endsWith('.json') ||
      pin.path.startsWith(`${HISTORY_ROOT}/`) ||
      !Number.isSafeInteger(pin.bytes) ||
      pin.bytes < 1 ||
      pin.bytes > 4 * 1024 * 1024 ||
      typeof pin.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(pin.sha256)
    )
      throw new Error('Invalid production metadata history entry');
    validateSourcePath(pin.path);
    const key = historyKey(pin);
    if (result.has(key)) throw new Error('Duplicate production metadata history entry');
    result.set(key, `${HISTORY_ROOT}/${pin.sha256}.json`);
  }
  return result;
}
// Source snapshots authenticate the old recipe implementation as inert bytes.
// Keep this separate from the existing JSON-only metadata history contract.
const SOURCE_HISTORY_PATHS = new Set([
  'authoring/motion-lab/render-character.mjs',
  'game/ui/actor-presentation.mjs',
]);
async function sourceHistory(root) {
  let raw;
  try {
    raw = await boundedRead(root, `${HISTORY_ROOT}/source-index.json`, 32768);
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
  const index = JSON.parse(raw.toString('utf8'));
  if (
    !index ||
    Object.keys(index).sort().join(',') !== 'entries,format' ||
    index.format !== 'revealline-production-source-history.v1' ||
    !Array.isArray(index.entries) ||
    index.entries.length > 64
  )
    throw new Error('Invalid production source history index');
  const result = new Map();
  for (const pin of index.entries) {
    if (
      !pin ||
      Object.keys(pin).sort().join(',') !== 'bytes,path,sha256' ||
      !SOURCE_HISTORY_PATHS.has(pin.path) ||
      !Number.isSafeInteger(pin.bytes) ||
      pin.bytes < 1 ||
      pin.bytes > 4 * 1024 * 1024 ||
      typeof pin.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(pin.sha256)
    )
      throw new Error('Invalid production source history entry');
    const key = historyKey(pin);
    if (result.has(key)) throw new Error('Duplicate production source history entry');
    result.set(key, `${HISTORY_ROOT}/${pin.sha256}.source`);
  }
  return result;
}
function literal(node) {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression')
    return Object.fromEntries(
      node.properties.map((p) => {
        if (p.type !== 'Property' || p.computed || p.method || p.kind !== 'init')
          throw new Error('Unsupported recipe literal');
        return [p.key.name ?? p.key.value, literal(p.value)];
      }),
    );
  throw new Error('Recipe is not literal data');
}
function synthRecipes(bytes) {
  const ast = parse(bytes.toString('utf8'), { ecmaVersion: 2022, sourceType: 'module' });
  const d = ast.body
    .find(
      (n) =>
        n.type === 'ExportNamedDeclaration' &&
        n.declaration?.declarations?.some((v) => v.id.name === 'DEFAULT_TRACKS'),
    )
    ?.declaration.declarations.find((v) => v.id.name === 'DEFAULT_TRACKS');
  const n = d?.init;
  if (
    n?.type !== 'CallExpression' ||
    n.callee.object?.name !== 'Object' ||
    n.callee.property?.name !== 'freeze' ||
    n.arguments.length !== 1
  )
    throw new Error('Unknown synth declaration');
  const a = n.arguments[0];
  if (
    a.type !== 'CallExpression' ||
    a.callee.property?.name !== 'map' ||
    a.arguments.length !== 1 ||
    a.arguments[0].object?.name !== 'Object' ||
    a.arguments[0].property?.name !== 'freeze'
  )
    throw new Error('Unknown synth recipe wrapper');
  return literal(a.callee.object);
}
/** Metadata validation always checks pinned authority files. --files additionally hashes originals. */
export async function verifyProductionSources(input, { root, files = false } = {}) {
  const r = validateProductionRegister(input);
  if (!root) throw new Error('Explicit source root required');
  const declared = new Map(
    [
      ...r.authorities,
      ...r.works.map((w) => w.source),
      ...r.works.flatMap((w) => w.dependencies),
      ...r.layouts.map((l) => l.source),
      ...r.enemies.map((e) => e.source),
      ...r.assessments.flatMap((a) => a.evidence),
      ...r.deliveries.map((d) => d.evidence),
    ].map((p) => [p.path, p]),
  );
  const history = new Map([...(await metadataHistory(root)), ...(await sourceHistory(root))]);
  const cache = new Map();
  const bytes = async (name) => {
    if (!cache.has(name)) {
      const pin = declared.get(name);
      if (!pin) throw new Error(`Undeclared or changed authority: ${name}`);
      const source = history.get(historyKey(pin)) ?? name;
      cache.set(
        name,
        boundedRead(root, source).then((b) => {
          if (b.length !== pin.bytes || sha(b) !== pin.sha256)
            throw new Error(`Undeclared or changed authority: ${name}`);
          return b;
        }),
      );
    }
    return cache.get(name);
  };
  const json = async (name) => JSON.parse((await bytes(name)).toString('utf8'));
  const verifyPin = async (p) => {
    const b = await bytes(p.path);
    if (b.length !== p.bytes || sha(b) !== p.sha256)
      throw new Error(`Source identity changed: ${p.path}`);
  };
  const descriptorRows = async (name) => {
    const d = await json(name);
    if (d.format !== 'revealline-external-chapter.v1')
      throw new Error(`Unknown descriptor: ${name}`);
    return d;
  };
  const catalog = await json(PATHS.pressure),
    dist = await json('authoring/library/four-worlds-chapters/distribution.json'),
    route = await json(PATHS.route),
    editions = await json(PATHS.world),
    themes = await json(PATHS.body),
    classes = await json('game/content/classes.json');
  if (
    !equal(
      classes.map((c) => c.id),
      r.basis.classes,
    ) ||
    !equal(
      themes.themes.map((t) => t.id),
      r.basis.themes,
    )
  )
    throw new Error('Runtime class/theme basis changed');
  const matchesFile = (w, f) => {
    const actual = w.files.find((x) => x.role === 'original')?.file;
    if (!actual || actual.bytes !== f.bytes || actual.sha256 !== f.sha256)
      throw new Error(`Original mismatch: ${w.id}`);
  };
  // These two finite cohorts are data authorities, not executable compiler adapters.
  const fractureCache = new Map();
  const fractureEdition = async (theme) => {
    if (fractureCache.has(theme)) return fractureCache.get(theme);
    if (!r.basis.themes.includes(theme)) throw new Error('Unknown Fracture theme');
    const fpv = theme === 'fpv';
    const cohort = await json(PATHS[fpv ? 'fracture' : 'fracture-world']);
    if (
      cohort.format !==
      (fpv ? 'revealline-fracture-chapter-edition.v1' : 'revealline-fracture-theme-editions.v1')
    )
      throw new Error('Unknown Fracture cohort');
    const edition = fpv ? cohort : cohort.editions.find((e) => e.themeId === theme);
    const artRoot = `authoring/library/${fpv ? 'fracture-lines' : `fracture-${theme}`}-art`;
    if (
      edition?.id !== `fracture-lines-${theme}` ||
      edition.themeId !== theme ||
      edition.images?.length !== 3 ||
      (!fpv && edition.artRoot !== artRoot)
    )
      throw new Error('Unknown Fracture edition');
    const descriptor = await descriptorRows(
      fpv
        ? 'authoring/library/fracture-lines-chapter/descriptor.json'
        : `authoring/library/fracture-theme-chapters/descriptors/${theme}.json`,
    );
    if (
      descriptor.id !== edition.id ||
      descriptor.themeId !== theme ||
      descriptor.source.id !== 'fracture-lines' ||
      descriptor.originals.length !== 3 ||
      !new RegExp(`^${edition.id}/${descriptor.revision}/[a-f0-9]{16}$`).test(
        descriptor.campaignKey,
      )
    )
      throw new Error('Fracture descriptor owner differs');
    let provenance;
    if (!fpv) {
      const name = `${artRoot}/provenance.json`;
      provenance = await json(name);
      if (
        edition.provenanceSha256 !== declared.get(name)?.sha256 ||
        provenance.format !== 'revealline-source-art-provenance.v1' ||
        provenance.images?.length !== 3
      )
        throw new Error('Fracture provenance differs');
    }
    const originals = [];
    for (const [index, mission] of FRACTURE_MISSIONS.entries()) {
      const source = edition.images[index],
        original = descriptor.originals[index];
      const levelId = `fracture-lines-${mission}`;
      const assetId = fpv ? `${levelId}-fpv` : `${edition.id}-poster-${index + 1}`;
      const relative = `originals/${mission}-${theme}.png`;
      const filename = `${artRoot}/${relative}`;
      if (
        source.sourceLevelId !== levelId ||
        original.levelId !== levelId ||
        original.levelRevision !== '1' ||
        original.assetId !== assetId ||
        original.presentationId !== `${assetId}-presentation` ||
        original.mime !== 'image/png' ||
        original.sha256 !== source.sha256 ||
        source.path !== (fpv ? filename : relative)
      )
        throw new Error('Fracture source/owner differs');
      let image;
      if (fpv) {
        const metadataPath = `${artRoot}/${mission}-fpv.json`;
        if (source.assetId !== assetId || source.metadataPath !== metadataPath)
          throw new Error('Fracture source metadata differs');
        image = await json(metadataPath);
        if (
          image.format !== 'revealline-generated-source-art.v1' ||
          image.assetId !== assetId ||
          image.workspacePath !== relative
        )
          throw new Error('Fracture original metadata differs');
      } else {
        const cellId = `fracture-lines/${mission}/${theme}`;
        image = provenance.images.find((p) => p.cellId === cellId);
        if (
          source.sourceCellId !== cellId ||
          !image ||
          image.themeId !== theme ||
          image.sourceLevelId !== levelId ||
          image.missionSlot !== mission ||
          image.path !== relative
        )
          throw new Error('Fracture original provenance differs');
      }
      for (const k of ['bytes', 'sha256', 'width', 'height'])
        if (image[k] !== original[k]) throw new Error(`Fracture original ${k} differs`);
      originals.push({ ...original, path: filename });
    }
    const result = { descriptor, originals };
    fractureCache.set(theme, result);
    return result;
  };
  // All four Countercurrent themes use one finite, uniform source-art cohort.
  // Authenticate metadata relationships here without importing its compiler.
  const countercurrentCache = new Map();
  const countercurrentEdition = async (theme) => {
    if (countercurrentCache.has(theme)) return countercurrentCache.get(theme);
    const cohort = await json(PATHS.countercurrent);
    if (
      !r.basis.themes.includes(theme) ||
      cohort.format !== 'revealline-countercurrent-editions.v1' ||
      !equal(
        cohort.editions?.map((e) => e.themeId),
        r.basis.themes,
      )
    )
      throw new Error('Unknown Countercurrent cohort');
    const edition = cohort.editions.find((e) => e.themeId === theme);
    if (
      edition.id !== `countercurrent-${theme}` ||
      edition.artRoot !== COUNTERCURRENT_ART ||
      edition.images?.length !== 3
    )
      throw new Error('Unknown Countercurrent edition');
    const descriptor = await descriptorRows(
      `authoring/library/countercurrent-chapters/descriptors/${theme}.json`,
    );
    if (
      descriptor.id !== edition.id ||
      descriptor.revision !== 1 ||
      descriptor.themeId !== theme ||
      descriptor.source.id !== 'countercurrent' ||
      descriptor.originals.length !== 3 ||
      typeof descriptor.campaignKey !== 'string' ||
      !new RegExp(`^${edition.id}/1/[a-f0-9]{16}$`).test(descriptor.campaignKey)
    )
      throw new Error('Countercurrent descriptor owner differs');
    const provenancePath = `${COUNTERCURRENT_ART}/provenance.json`;
    const provenance = await json(provenancePath);
    const manifest = await json(`${COUNTERCURRENT_ART}/manifest.json`);
    const cells = r.basis.themes.flatMap((t) =>
      COUNTERCURRENT_MISSIONS.map((mission) => `countercurrent/${mission}/${t}`),
    );
    if (
      edition.provenanceSha256 !== declared.get(provenancePath)?.sha256 ||
      provenance.format !== 'revealline-source-art-provenance.v1' ||
      manifest.format !== 'revealline-source-art-manifest.v1' ||
      !equal(
        provenance.images?.map((image) => image.cellId),
        cells,
      ) ||
      !equal(
        manifest.images?.map((image) => image.cellId),
        cells,
      )
    )
      throw new Error('Countercurrent provenance differs');
    const originals = [];
    for (const [index, mission] of COUNTERCURRENT_MISSIONS.entries()) {
      const source = edition.images[index],
        original = descriptor.originals[index];
      const levelId = `countercurrent-${mission}`;
      const cellId = `countercurrent/${mission}/${theme}`;
      const assetId = `${edition.id}-poster-${index + 1}`;
      const relative = `originals/${mission}-${theme}.png`;
      const image = provenance.images.find((p) => p.cellId === cellId);
      const listed = manifest.images.find((p) => p.cellId === cellId);
      if (
        source.sourceCellId !== cellId ||
        source.sourceLevelId !== levelId ||
        source.path !== relative ||
        original.levelId !== levelId ||
        original.levelRevision !== '1' ||
        original.assetId !== assetId ||
        original.presentationId !== `${assetId}-presentation` ||
        original.mime !== 'image/png' ||
        original.sha256 !== source.sha256 ||
        image.themeId !== theme ||
        image.sourceLevelId !== levelId ||
        image.missionSlot !== mission ||
        image.path !== relative ||
        image.runtimeBinding !== null ||
        image.sourceBytesEqual !== true ||
        image.width !== 1774 ||
        image.height !== 887 ||
        !Number.isSafeInteger(image.bytes) ||
        image.bytes < 1 ||
        image.bytes > 4 * 1024 * 1024 ||
        !Object.entries(listed).every(([key, value]) => equal(image[key], value))
      )
        throw new Error('Countercurrent source/owner differs');
      for (const key of ['bytes', 'sha256', 'width', 'height'])
        if (image[key] !== original[key]) throw new Error(`Countercurrent original ${key} differs`);
      originals.push({ ...original, path: `${COUNTERCURRENT_ART}/${relative}` });
    }
    const result = { descriptor, originals };
    countercurrentCache.set(theme, result);
    return result;
  };
  for (const w of r.works) {
    await verifyPin(w.source);
    for (const dep of w.dependencies) await verifyPin(dep);
    if (w.adapter !== 'authored' && w.source.path !== PATHS[w.adapter])
      throw new Error(`Wrong adapter authority: ${w.id}`);
    let owners = [];
    if (w.adapter === 'pressure') {
      const image = catalog.images.find((i) => i.id === w.sourceId);
      if (!image) throw new Error(`Unknown pressure original: ${w.id}`);
      matchesFile(w, image);
      if (
        w.files[0].file.path !== image.source ||
        w.files[0].width !== image.width ||
        w.files[0].height !== image.height
      )
        throw new Error('Pressure original path/dimensions differ');
      for (const p of dist.packs)
        for (const m of p.maps)
          if (m.sourceImageId === image.id) owners.push(own(p, { levelId: m.id }));
      const pilot = await descriptorRows(
        'authoring/library/external-chapter-pilot/descriptor.json',
      );
      for (const o of pilot.originals) if (o.sha256 === image.sha256) owners.push(own(pilot, o));
    } else if (w.adapter === 'route') {
      const image = route.maps.find((m) => m.imageId === w.sourceId);
      if (!image) throw new Error('Unknown route picture');
      matchesFile(w, { bytes: image.imageBytes, sha256: image.imageSha256 });
      if (
        w.files[0].file.path !==
        `authoring/library/challenge-chapter-art/originals/${image.imageId}.png`
      )
        throw new Error('Route source path differs');
      const prov = await json('authoring/library/challenge-chapter-art/provenance.json');
      const dimensions = prov.images.find((i) => i.id === image.imageId);
      if (
        !dimensions ||
        w.files[0].width !== dimensions.width ||
        w.files[0].height !== dimensions.height
      )
        throw new Error('Route dimensions differ');
      owners = [own(route, image)];
    } else if (w.adapter === 'world') {
      const e = editions.editions.find((e) => e.themeId === w.themeId),
        image = e?.images.find((i) => i.id === w.sourceId);
      if (!image) throw new Error('Unknown world picture');
      const d = await descriptorRows(
        `authoring/library/route-worlds/descriptors/${e.themeId}.json`,
      );
      const i = e.images.indexOf(image),
        original = d.originals[i];
      matchesFile(w, original);
      if (
        w.files[0].file.path !== `${e.artRoot}/originals/${image.id}.png` ||
        w.files[0].width !== original.width ||
        w.files[0].height !== original.height
      )
        throw new Error('World source path/dimensions differ');
      owners = [own(d, original)];
    } else if (w.adapter === 'sentinel') {
      const d = await descriptorRows(PATHS.sentinel),
        o = d.originals.find((o) => o.assetId === w.sourceId);
      if (!o) throw new Error('Unknown Sentinel poster');
      matchesFile(w, o);
      const names = ['listening-court', 'switchyard-gates', 'open-the-circuit'];
      if (
        w.files[0].file.path !==
          `authoring/library/sentinel-circuit-art/originals/${names[d.originals.indexOf(o)]}.png` ||
        w.files[0].width !== o.width ||
        w.files[0].height !== o.height
      )
        throw new Error('Sentinel source path/dimensions differ');
      owners = [own(d, o)];
    } else if (w.adapter === 'sentinel-world') {
      const cohort = await json(PATHS['sentinel-world']);
      if (
        cohort.format !== 'revealline-sentinel-theme-editions.v1' ||
        cohort.artRoot !== 'authoring/library/sentinel-theme-art' ||
        cohort.provenanceSha256 !==
          declared.get('authoring/library/sentinel-theme-art/provenance.json')?.sha256 ||
        !['ukraine', 'retro', 'coupa'].includes(w.themeId)
      )
        throw new Error('Unknown Sentinel theme cohort');
      const edition = cohort.editions.find((e) => e.themeId === w.themeId);
      if (!edition || edition.id !== `sentinel-circuit-${w.themeId}`)
        throw new Error('Unknown Sentinel theme edition');
      const d = await descriptorRows(
        `authoring/library/sentinel-theme-chapters/descriptors/${w.themeId}.json`,
      );
      const index = d.originals.findIndex((o) => o.assetId === w.sourceId),
        original = d.originals[index],
        source = edition.images[index];
      if (
        d.id !== edition.id ||
        d.themeId !== w.themeId ||
        !original ||
        !source ||
        original.sha256 !== source.sha256 ||
        !source.sourceLevelId.startsWith('sentinel-circuit-') ||
        original.levelId !== source.sourceLevelId.replace('sentinel-circuit-', `${edition.id}-`) ||
        !source.path.startsWith(`${w.themeId}/originals/`) ||
        source.sourceCellId !==
          `sentinel-circuit/${source.path
            .split('/')
            .at(-1)
            .replace(/\.png$/, '')}/${w.themeId}`
      )
        throw new Error('Sentinel theme source/owner differs');
      matchesFile(w, original);
      if (
        w.files.length !== 1 ||
        w.files[0].file.path !== `${cohort.artRoot}/${source.path}` ||
        w.files[0].width !== original.width ||
        w.files[0].height !== original.height
      )
        throw new Error('Sentinel theme original path/dimensions differ');
      owners = [own(d, original)];
    } else if (w.adapter === 'fracture' || w.adapter === 'fracture-world') {
      if ((w.adapter === 'fracture') !== (w.themeId === 'fpv'))
        throw new Error('Wrong Fracture adapter theme');
      const { descriptor, originals } = await fractureEdition(w.themeId);
      const original = originals.find((o) => o.assetId === w.sourceId);
      if (!original) throw new Error('Unknown Fracture original');
      matchesFile(w, original);
      if (
        w.files[0].file.path !== original.path ||
        w.files[0].width !== original.width ||
        w.files[0].height !== original.height ||
        w.files[0].durationSeconds !== null
      )
        throw new Error('Fracture original path/dimensions differ');
      owners = [own(descriptor, original)];
    } else if (w.adapter === 'countercurrent') {
      const { descriptor, originals } = await countercurrentEdition(w.themeId);
      const original = originals.find((o) => o.assetId === w.sourceId);
      if (!original) throw new Error('Unknown Countercurrent original');
      matchesFile(w, original);
      if (
        w.files[0].file.path !== original.path ||
        w.files[0].width !== original.width ||
        w.files[0].height !== original.height ||
        w.files[0].durationSeconds !== null
      )
        throw new Error('Countercurrent original path/dimensions differ');
      owners = [own(descriptor, original)];
    } else if (w.adapter === 'dawn') {
      const d = await json(PATHS.dawn);
      if (w.sourceId !== d.story.id || w.revision !== d.story.revision)
        throw new Error('Dawn story identity differs');
      for (const [role, metadata, name] of [
        ['movie', d.movie, 'dawn-signal.mp4'],
        ['poster', d.poster, 'frame-95.png'],
      ]) {
        const f = w.files.find((f) => f.role === role);
        if (
          f.file.sha256 !== metadata.sha256 ||
          f.file.bytes !== metadata.bytes ||
          f.file.path !== `authoring/library/dawn-signal-story/candidate-v1/${name}`
        )
          throw new Error('Dawn source differs');
        if (
          f.width !== (metadata.width ?? metadata.naturalWidth) ||
          f.height !== (metadata.height ?? metadata.naturalHeight) ||
          f.durationSeconds !== (role === 'movie' ? metadata.durationSeconds : null)
        )
          throw new Error('Dawn dimensions/duration differ');
      }
      owners = [d.identity];
    } else if (w.adapter === 'body') {
      if (
        w.kind !== 'presentation' ||
        w.files.length !== 1 ||
        !themes.themes.some((t) => Object.values(t.classBodies).includes(w.sourceId))
      )
        throw new Error('Unknown shared body');
      const presets = await json('authoring/motion-lab/presets.json');
      const body = presets.characters[w.sourceId];
      if (!body || w.files[0].file.path !== `authoring/motion-lab/${body.src}`)
        throw new Error('Body concept source differs');
      for (const b of r.bindings.filter(
        (b) => b.workId === w.id && b.workRevision === w.revision,
      )) {
        const h = b.handle;
        if (themes.themes.find((t) => t.id === h.themeId)?.classBodies[h.classId] !== h.bodyId)
          throw new Error('Body does not serve this class/theme');
      }
    } else if (w.adapter === 'synth') {
      if (
        w.kind !== 'track' ||
        w.files.length ||
        !synthRecipes(await bytes(PATHS.synth)).some((t) => t.id === w.sourceId)
      )
        throw new Error('Unknown synth recipe');
    } else {
      // Existing raster media-tool record: reference it, do not duplicate its storage.
      const m = await json(w.source.path),
        a = m.assets?.find((a) => a.id === w.sourceId);
      if (
        m.mediaVersion !== '1.0.0' ||
        w.kind !== 'picture' ||
        !['imported', 'reviewed'].includes(a?.status) ||
        !a?.file
      )
        throw new Error('Produced raster media record required');
      matchesFile(w, a.file);
      const f = w.files[0];
      if (
        f.file.path !== path.posix.join(path.posix.dirname(w.source.path), a.file.path) ||
        f.width !== a.file.width ||
        f.height !== a.file.height
      )
        throw new Error('Media-tool file differs');
      if (a.kind === 'derivative') {
        const parent =
          w.derivedFrom &&
          r.works.find(
            (p) => p.id === w.derivedFrom.workId && p.revision === w.derivedFrom.workRevision,
          );
        if (
          !parent ||
          parent.sourceId !== a.provenance?.parentAssetId ||
          parent.files[0].file.sha256 !== a.provenance?.parentSha256
        )
          throw new Error('Media derivative parent differs');
      } else if (a.kind !== 'original') throw new Error('Unknown media asset kind');
      owners = w.owners;
    }
    if (
      !equal(
        [...owners].sort((a, b) => canonical(a).localeCompare(canonical(b))),
        [...w.owners].sort((a, b) => canonical(a).localeCompare(canonical(b))),
      )
    )
      throw new Error(`Authored owners changed: ${w.id}`);
  }
  for (const p of r.authorities) await verifyPin(p);
  for (const l of r.layouts) {
    await verifyPin(l.source);
    if (l.id.startsWith('countercurrent-') || l.source.path === COUNTERCURRENT_LAYOUTS) {
      const index = COUNTERCURRENT_MISSIONS.indexOf(l.id.slice('countercurrent-'.length));
      const layouts = await json(COUNTERCURRENT_LAYOUTS);
      if (
        index < 0 ||
        l.source.path !== COUNTERCURRENT_LAYOUTS ||
        l.variantOf !== null ||
        layouts.format !== 'revealline-countercurrent-layouts.v1' ||
        layouts.levels[index]?.id !== l.id
      )
        throw new Error('Countercurrent layout source differs');
      const owners = [];
      for (const theme of r.basis.themes) {
        const { descriptor, originals } = await countercurrentEdition(theme);
        owners.push(own(descriptor, originals[index]));
      }
      if (!equal(l.owners, owners)) throw new Error('Countercurrent layout owners differ');
      continue;
    }
    if (!l.id.startsWith('fracture-') && l.source.path !== FRACTURE_LAYOUTS) continue;
    const mission = l.id.slice('fracture-'.length),
      index = FRACTURE_MISSIONS.indexOf(mission);
    const layouts = await json(FRACTURE_LAYOUTS);
    if (
      index < 0 ||
      l.source.path !== FRACTURE_LAYOUTS ||
      l.variantOf !== null ||
      layouts.format !== 'revealline-fracture-layouts.v1' ||
      layouts.levels[index]?.id !== `fracture-lines-${mission}`
    )
      throw new Error('Fracture layout source differs');
    const owners = [];
    for (const theme of r.basis.themes) {
      const { descriptor, originals } = await fractureEdition(theme);
      owners.push(own(descriptor, originals[index]));
    }
    if (!equal(l.owners, owners)) throw new Error('Fracture layout owners differ');
  }
  for (const e of r.enemies) await verifyPin(e.source);
  for (const a of r.assessments) for (const p of a.evidence) await verifyPin(p);
  for (const d of r.deliveries) await verifyPin(d.evidence);
  const bodies = new Map();
  for (const work of r.works) {
    for (const { file } of work.files) {
      const prior = bodies.get(file.path);
      if (prior && (prior.bytes !== file.bytes || prior.sha256 !== file.sha256))
        throw new Error(`Conflicting original identity at ${file.path}`);
      bodies.set(file.path, file);
    }
  }
  const availability = [];
  for (const p of bodies.values()) {
    if (!files) {
      availability.push({ path: p.path, status: 'unverified' });
      continue;
    }
    try {
      const filename = await ordinaryPath(root, p.path),
        s = await lstat(filename);
      if (s.size !== p.bytes) throw new Error('byte count differs');
      const h = createHash('sha256'),
        f = await open(filename, 'r');
      let n = 0;
      try {
        for await (const chunk of f.createReadStream()) {
          n += chunk.length;
          if (n > p.bytes) throw new Error('file grew');
          h.update(chunk);
        }
      } finally {
        await f.close();
      }
      if (n !== p.bytes || h.digest('hex') !== p.sha256) throw new Error('original hash differs');
      availability.push({ path: p.path, status: 'verified' });
    } catch (error) {
      availability.push({ path: p.path, status: 'unavailable', reason: error.message });
    }
  }
  return {
    metadata: 'verified',
    authorityFiles: cache.size,
    originals: availability,
    originalBytesVerified: files && availability.every((a) => a.status === 'verified'),
    limits: 'Byte identity is not decode, visual, listening or human production approval.',
  };
}
