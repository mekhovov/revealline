import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalJSON, required, dataIdentity } from '../game/data-json.mjs';
import { validateThemeBundle, resolvePresentation, LIMITS } from '../game/presentation/model.mjs';
import {
  verifyThemeAssets,
  hashPresentationBytes,
  importThemeBundle,
} from '../game/presentation/bundle.mjs';
import {
  presentationCSSVariables,
  presentationFontDescriptors,
} from '../game/presentation/runtime.mjs';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { campaignKey } from '../game/library.mjs';
import { validatePack } from '../game/packs.mjs';

const extensions = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff2': 'woff2',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
});
const encode = (value) => new TextEncoder().encode(value);
/** Pure deterministic compilation. Input records never provide executable code
 * or filesystem paths; all output asset names derive from verified hashes. */
export async function compilePresentation(
  source,
  sourceAssets = new Map(),
  { themeId, collectionId, decodeImage = null } = {},
) {
  const document = validateThemeBundle(source),
    assets = await verifyThemeAssets(document, sourceAssets, { decodeImage });
  const options = {};
  if (themeId !== undefined) options.themeId = themeId;
  if (collectionId !== undefined) options.collectionId = collectionId;
  const resolved = resolvePresentation(document, options),
    files = new Map(),
    urls = {};
  const selected = new Map(
    Object.values(resolved.assets)
      .filter((asset) => asset.file)
      .map((asset) => [asset.file.sha256, asset]),
  );
  // The studio retains immutable history; runtime URLs still expose only the
  // selected snapshot. Hash-addressed bytes are written once for both readers.
  for (const asset of document.assets.filter((item) => item.file)) {
    const { sha256: hash, mime } = asset.file;
    const name = `assets/${hash}.${extensions[mime]}`;
    if (!files.has(name)) files.set(name, new Uint8Array(await assets.get(hash).arrayBuffer()));
  }
  for (const [hash, asset] of [...selected].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const name = `assets/${hash}.${extensions[asset.file.mime]}`;
    required(
      /^assets\/[a-f0-9]{64}\.(png|jpg|webp|ttf|otf|woff2|wav|ogg|mp3)$/.test(name),
      'Unexpected compiler asset path.',
    );
    files.set(name, new Uint8Array(await assets.get(hash).arrayBuffer()));
    urls[hash] = `./${name}`;
  }
  const variables = presentationCSSVariables(resolved);
  const fonts = [...selected]
    .filter(([, asset]) => asset.kind === 'font')
    .map(
      ([hash]) =>
        `@font-face { font-family: 'RLAsset-${hash}'; src: url('${urls[hash]}'); font-weight: ${presentationFontDescriptors(resolved, hash).weight}; font-style: normal; font-display: swap; }`,
    );
  const css = [
    ...fonts,
    '.field-kit {',
    ...Object.keys(variables)
      .sort()
      .map((name) => `  ${name}: ${variables[name]};`),
    '}',
    '',
  ].join('\n');
  files.set('theme.css', encode(css));
  files.set('studio.json', encode(canonicalJSON(document) + '\n'));
  files.set(
    'runtime.json',
    encode(
      canonicalJSON({
        format: 'revealline-compiled-presentation.v1',
        source: { id: document.id, revision: document.revision },
        resolved,
        urls,
      }) + '\n',
    ),
  );
  const inventory = [];
  for (const [name, bytes] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    inventory.push({ path: name, bytes: bytes.length, sha256: await hashPresentationBytes(bytes) });
  files.set(
    'manifest.json',
    encode(
      canonicalJSON({
        format: 'revealline-presentation-build.v1',
        source: { id: document.id, revision: document.revision },
        files: inventory,
      }) + '\n',
    ),
  );
  return Object.freeze({ files, resolved, imagesDecoded: typeof decodeImage === 'function' });
}

/** Preserve the production v1 record and return its validated read-only view.
 * This is an inspection adapter, never an implicit import or quality approval. */
export async function inspectProductionAdapter(source, { previous = null } = {}) {
  const { validateProductionRegister, listProductionSlots } = await import(
    '../authoring/production/model.mjs'
  );
  const document = validateProductionRegister(source, { previous });
  return Object.freeze({
    format: 'revealline-production-inspection.v1',
    document,
    slots: listProductionSlots(document),
  });
}

/** Code-owned current catalogs only: never reads a path from a theme upload.
 * Returned owner inventory contains no embedded images and changes no packs. */
export async function inventoryCurrentPictures() {
  const read = async (relative) =>
    JSON.parse(await fs.readFile(path.join(projectRoot, relative), 'utf8'));
  const rows = new Map();
  const add = (owner, label, dimensions) => {
    const id = `picture.${owner.themeId}.${dataIdentity(owner)}`;
    const record = { id, label: label.slice(0, 120), dimensions, owner };
    const existing = rows.get(id);
    required(
      !existing || canonicalJSON(existing.owner) === canonicalJSON(owner),
      'Picture owner ID collision.',
    );
    rows.set(id, record);
  };
  const addCampaign = (campaign, themes) => {
    const baseCampaignKey = campaignKey(campaign);
    for (const level of campaign.levels)
      for (const theme of themes)
        add(
          { baseCampaignKey, levelId: level.id, levelRevision: level.revision, themeId: theme.id },
          `${campaign.title} · ${level.name} · ${theme.name ?? theme.id}`,
          [level.width * 16, level.height * 16],
        );
  };
  const base = await read('game/content/campaign.json');
  base.classRecipes = await read('game/content/classes.json');
  addCampaign(base, (await read('game/content/themes.json')).themes);
  for (const index of ['index.json', 'archive-index.json']) {
    for (const entry of (await read(`game/content/packs/${index}`)).packs) {
      required(/^[a-zA-Z0-9._-]+\.json$/.test(entry.path), 'Unexpected current pack path.');
      const pack = await read(`game/content/packs/${entry.path}`),
        checked = validatePack(pack);
      required(checked.valid, 'Current picture inventory needs valid source packs.');
      for (const campaign of pack.campaigns)
        addCampaign(
          {
            ...campaign,
            classRecipes: pack.classRecipes.filter(
              (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
            ),
          },
          pack.themes,
        );
    }
  }
  for (const entry of (await read('game/content/optional-worlds.json')).packs) {
    required(
      /^authoring\/library\/[a-z0-9-]+\/packs\/[a-z0-9-]+\.json$/.test(entry.path),
      'Unexpected optional pack path.',
    );
    const pack = await read(entry.path),
      checked = validatePack(pack);
    required(checked.valid, 'Optional picture inventory needs valid source packs.');
    for (const campaign of pack.campaigns)
      addCampaign(
        {
          ...campaign,
          classRecipes: pack.classRecipes.filter(
            (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
          ),
        },
        pack.themes,
      );
  }
  const { SOURCE_EXTERNAL_EDITIONS } = await import('../game/external-chapter-source.mjs');
  for (const { descriptor, name } of SOURCE_EXTERNAL_EDITIONS)
    for (const original of descriptor.originals) {
      // External descriptors pin exact originals, not board geometry. Retain the
      // actual original dimensions instead of inferring a collider/grid from art.
      add(
        {
          baseCampaignKey: descriptor.campaignKey,
          levelId: original.levelId,
          levelRevision: original.levelRevision,
          themeId: descriptor.themeId,
        },
        `${name} · ${original.levelId}`,
        [original.width, original.height],
      );
    }
  return Object.freeze([...rows.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function ordinary(file, max) {
  const stat = await fs.lstat(file);
  required(stat.isFile() && stat.size <= max, 'Compiler input must be an ordinary bounded file.');
  return fs.readFile(file);
}
async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    required(
      ['--manifest', '--assets', '--bundle', '--out'].includes(args[i]) &&
        args[i + 1] &&
        !Object.hasOwn(options, args[i]),
      'Usage: node scripts/compile-presentation.mjs [--bundle FILE | --manifest FILE --assets DIR] [--out NEW_CACHE_DIR]',
    );
    options[args[i]] = args[i + 1];
  }
  required(
    !options['--bundle'] || (!options['--manifest'] && !options['--assets']),
    'Choose a portable bundle or a manifest/asset directory.',
  );
  const imported = options['--bundle']
    ? await importThemeBundle(
        new Blob([await ordinary(path.resolve(options['--bundle']), LIMITS.bundleBytes)]),
        { decodeImage: null },
      )
    : null;
  const document =
    imported?.document ??
    (options['--manifest']
      ? validateThemeBundle(
          await ordinary(path.resolve(options['--manifest']), LIMITS.manifestBytes).then((b) =>
            b.toString('utf8'),
          ),
        )
      : createDefaultThemeBundle());
  const assets = imported?.assets ?? new Map();
  for (const asset of imported ? [] : document.assets.filter((item) => item.file)) {
    required(options['--assets'], 'File assets require an explicit --assets directory.');
    const directory = path.resolve(options['--assets']);
    required(
      (await fs.lstat(directory)).isDirectory() && (await fs.realpath(directory)) === directory,
      'Assets directory cannot contain symlink aliases.',
    );
    const file = path.join(directory, `${asset.file.sha256}.${extensions[asset.file.mime]}`);
    assets.set(
      asset.file.sha256,
      new Blob([await ordinary(file, LIMITS.assetBytes)], { type: asset.file.mime }),
    );
  }
  const result = await compilePresentation(document, assets);
  if (options['--out']) {
    const out = path.resolve(options['--out']),
      cache = path.join(projectRoot, '.cache');
    required(
      out.startsWith(`${cache}${path.sep}`),
      'Compiler output must be a new directory under project .cache.',
    );
    await fs.mkdir(cache, { recursive: true });
    required((await fs.realpath(cache)) === cache, 'Cache directory cannot be a symlink.');
    // Reject aliases in existing ancestors before creating an output tree.
    let parent = path.dirname(out);
    while (parent !== cache) {
      try {
        required((await fs.realpath(parent)) === parent, 'Output parent cannot be a symlink.');
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        parent = path.dirname(parent);
      }
    }
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.mkdir(out);
    for (const [name, bytes] of result.files) {
      if (name.startsWith('assets/')) await fs.mkdir(path.join(out, 'assets'), { recursive: true });
      await fs.writeFile(path.join(out, name), bytes, { flag: 'wx' });
    }
  }
  process.stdout.write(
    `${JSON.stringify({ source: document.id, revision: document.revision, slots: document.slots.length, files: result.files.size, output: options['--out'] ?? null, qualification: 'Validated manifest, file hashes and headers; browser image/font/audio and gameplay review are separate.' })}\n`,
  );
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
