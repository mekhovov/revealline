import { createRewardCosmeticRegistry, resolveRewardCosmetic } from '../game/rewards/cosmetics.mjs';
import { inspectImageDataUrl } from '../game/content.mjs';
import { rewardMediaReferences, inspectRewardMediaBytes } from '../game/rewards/media-format.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createThemeBootstrapSeed } from './refresh-theme-bootstrap.mjs';
import { parse } from 'acorn';
import { canonicalJSON, boundedJSON, required } from '../game/data-json.mjs';
import { compileContentProject } from '../game/content-design/project.mjs';
import { loadPreviewArtwork } from '../game/content-design/assets.mjs';
import {
  validateEditionCampaignProject,
  validateEditionLessonBundle,
  validateEditionRewardBundle,
} from '../game/editions/project.mjs';
import { verifyCampaignLocalization } from '../game/editions/localization.mjs';
import {
  createEditionRuntimeCatalog,
  editionRelativePath,
  validateEditionRuntimeCatalog,
  validateEditionAsset,
  resolveEditionAssets,
  resolveEditionSelection,
  resolveEditionAppearanceDefault,
  resolveEditionAppearanceThemes,
} from '../game/editions/model.mjs';
import { mergeEditionProjects } from '../game/editions/bootstrap.mjs';
import { validateCompletionRewards } from '../game/rewards/model.mjs';
import {
  editionIdentityId,
  validateEditionId,
  resolveEditionContext,
} from '../game/edition-context.mjs';
import {
  validateEditionSourceInventory,
  editionPublicationAssets,
} from '../publishing/edition-admission.mjs';
import { buildEditionOfflineFiles } from './edition-offline.mjs';
import { projectEditionLocalization } from './edition-localization.mjs';
import { projectEditionCodeIndentation } from './edition-code-indentation.mjs';
import {
  EDITION_RUNTIME_ADAPTERS,
  EDITION_RUNTIME_PAGES,
  EDITION_RUNTIME_RESOURCES,
  EDITION_RUNTIME_ASSET_LEDGER,
  EDITION_HOST_JSON_REQUESTS,
  projectEditionRuntimeImports,
  projectEditionRuntimeIndentation,
  projectEditionMenuResourcePaths,
  editionMenuSceneResources,
  projectEditionMenuScenes,
  DEFAULT_GAME_WORDMARK,
  projectEditionBrandIdentity,
  validateEditionHostRequests,
} from './edition-runtime.mjs';
import { validateEditionPresentation } from '../game/editions/presets.mjs';
import {
  projectEditionThemeSelection,
  projectEditionGuideScenario,
} from '../game/editions/selected-presentation.mjs';
import { validateRetainedPresentation } from '../game/editions/retained-presentation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(canonicalJSON(value) + '\n');
const readJSON = (bytes) =>
  boundedJSON(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 100000,
    maxArray: 4096,
  });
const ordered = (values) => [...values].sort();

// The shared platform adapter conditionally loads this generated bridge only
// under capacitor://localhost. Company artifacts target web/PWA; a native stage
// must supply and qualify the bridge independently. No other computed imports
// can bypass the web artifact's exact local dependency inventory.
function isOptionalIOSBridge(name, node) {
  const source = node.source,
    url = source?.object,
    base = url?.arguments?.[1];
  return (
    name === 'game/platform.mjs' &&
    node.type === 'ImportExpression' &&
    source?.type === 'MemberExpression' &&
    source.computed === false &&
    source.property?.name === 'href' &&
    url?.type === 'NewExpression' &&
    url.callee?.type === 'Identifier' &&
    url.callee.name === 'URL' &&
    url.arguments.length === 2 &&
    url.arguments[0]?.type === 'Literal' &&
    url.arguments[0].value === '../native/bridge.mjs' &&
    base?.type === 'MemberExpression' &&
    base.computed === false &&
    base.property?.name === 'url' &&
    base.object?.type === 'MetaProperty' &&
    base.object.meta?.name === 'import' &&
    base.object.property?.name === 'meta'
  );
}

/** Compute data dependencies before reading any payload. A source registry may
 * contain restricted entries; only a fully public selected closure can publish. */
export function selectEditionClosure(source, editionIds) {
  const catalog = validateEditionRuntimeCatalog(source);
  if (Array.isArray(editionIds)) editionIds = editionIds.map(editionIdentityId);
  required(
    Array.isArray(editionIds) &&
      editionIds.length > 0 &&
      new Set(editionIds).size === editionIds.length,
    'Choose unique editions for this build.',
  );
  const editions = editionIds.map((id) => {
    validateEditionId(id);
    const edition = catalog.editions.find((item) => item.id === id);
    required(edition, 'Edition is not registered.');
    return edition;
  });
  const campaignIds = new Set(editions.flatMap((edition) => edition.campaignIds));
  const campaigns = catalog.campaigns.filter((campaign) => campaignIds.has(campaign.id));
  const brands = catalog.brands.filter((brand) =>
    editions.some((edition) => edition.brandId === brand.id),
  );
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const selectedIds = new Set();
  const include = (id) => {
    if (selectedIds.has(id)) return;
    selectedIds.add(id);
    assets.get(id).dependencies.forEach(include);
  };
  [...brands, ...campaigns, ...editions].flatMap((item) => item.assetIds ?? []).forEach(include);
  return createEditionRuntimeCatalog({
    publication: 'public',
    defaultEditionId: editionIds[0],
    brands,
    editions,
    campaigns,
    assets: catalog.assets.filter((asset) => selectedIds.has(asset.id)),
    ...(catalog.appearanceThemes
      ? { appearanceThemes: resolveEditionAppearanceThemes(catalog, { editionIds }) }
      : {}),
  });
}

/** Read selected current inputs first, then only explicitly pinned historical
 * media. The reader supplies filesystem/commit boundaries and byte budgets. */
export async function collectEditionSelectedFiles({ catalog, editionIds, read }) {
  const selected = selectEditionClosure(catalog, editionIds),
    files = new Map();
  const paths = new Set([
    ...selected.assets.map((asset) => asset.path),
    ...selected.campaigns.flatMap((campaign) => [
      campaign.sourcePath,
      ...(campaign.lessonPath ? [campaign.lessonPath] : []),
      ...(campaign.rewardPath ? [campaign.rewardPath] : []),
      ...(campaign.localizationPath ? [campaign.localizationPath] : []),
    ]),
    ...selected.editions.flatMap((edition) => [
      ...Object.values(edition.boot ?? {}),
      ...(edition.presentationHistory ?? []).map((record) => record.path),
    ]),
  ]);
  for (const name of ordered(paths)) files.set(name, await read(name));
  for (const asset of editionPublicationAssets(selected, files))
    if (!files.has(asset.path)) files.set(asset.path, await read(asset.path));
  return files;
}

/** A brand registry can describe every campaign, but an audience artifact must
 * contain only its home theme and themes referenced by its selected missions. */
export function projectSelectedEditionThemes(catalog, sourceFiles) {
  const files = new Map(sourceFiles),
    brandThemes = new Map(catalog.brands.map((brand) => [brand.id, new Set([brand.themeId])]));
  for (const edition of catalog.editions) {
    const brand = catalog.brands.find((item) => item.id === edition.brandId),
      projects = [];
    if (!brand.themeIds) continue;
    for (const descriptor of catalog.campaigns.filter((item) =>
      edition.campaignIds.includes(item.id),
    )) {
      const project = validateEditionCampaignProject(
        readJSON(files.get(descriptor.sourcePath)),
        descriptor,
      );
      projects.push(project.source);
    }
    const themes = readJSON(files.get(edition.boot.themes));
    validateEditionPresentation({
      catalog,
      editionId: edition.id,
      themes,
      presets: readJSON(files.get(edition.boot.presets)),
    });
    const projected = projectEditionThemeSelection({ brand, projects, themes });
    files.set(edition.boot.themes, jsonBytes(projected.themes));
    for (const id of projected.brand.themeIds) brandThemes.get(brand.id).add(id);
  }
  const { format: _format, ...selectedCatalog } = catalog;
  return {
    files,
    catalog: createEditionRuntimeCatalog({
      ...selectedCatalog,
      brands: catalog.brands.map((brand) => ({
        ...brand,
        ...(brand.themeIds
          ? { themeIds: brand.themeIds.filter((id) => brandThemes.get(brand.id).has(id)) }
          : {}),
      })),
    }),
  };
}

/** Static imports and renderer resources only; manifest-selected JSON and media
 * are closed separately. Executable roots remain release-owned inputs. */
export function editionCodeDependencies(name, bytes) {
  const dependencies = new Set();
  const resolve = (target, bare = false) => {
    if (bare && target.startsWith('#')) return;
    required(
      !/^(?:[a-z]+:|\/)/i.test(target) && (bare || /^\.\.?\//.test(target)),
      `Edition executable and presentation dependencies must be local: ${name}.`,
    );
    const dependency = path.posix.normalize(
      path.posix.join(path.posix.dirname(name), target.split(/[?#]/)[0]),
    );
    required(editionRelativePath(dependency), `Edition dependency escapes its root: ${name}.`);
    dependencies.add(dependency);
  };
  const source = new TextDecoder().decode(bytes);
  if (/\.(?:mjs|js)$/.test(name)) {
    const tree = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
    });
    const bootBindings = [];
    const findBootBinding = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'VariableDeclaration')
        for (const entry of node.declarations)
          if (
            entry.id?.name === (name === 'game/ui/direct-tool-launch.js' ? 'moduleURL' : 'appURL')
          )
            bootBindings.push({ init: entry.init, constant: node.kind === 'const' });
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(findBootBinding);
        else if (child && typeof child === 'object') findBootBinding(child);
      }
    };
    if (['game/boot.mjs', 'game/ui/direct-tool-launch.js'].includes(name)) findBootBinding(tree);
    const binding = bootBindings[0]?.init,
      url = binding?.object,
      base = url?.arguments?.[1];
    const bootApp =
      name === 'game/boot.mjs' &&
      bootBindings.length === 1 &&
      bootBindings[0].constant &&
      binding?.type === 'MemberExpression' &&
      binding.computed === false &&
      binding.property?.name === 'href' &&
      url?.type === 'NewExpression' &&
      url.callee?.name === 'URL' &&
      url.arguments.length === 2 &&
      url.arguments[0]?.value === './app.mjs' &&
      base?.type === 'MemberExpression' &&
      base.computed === false &&
      base.property?.name === 'src' &&
      base.object?.type === 'MemberExpression' &&
      base.object.computed === false &&
      base.object.property?.name === 'currentScript' &&
      base.object.object?.name === 'doc';
    const target = url?.arguments?.[0];
    const toolModule =
      name === 'game/ui/direct-tool-launch.js' &&
      bootBindings.length === 1 &&
      bootBindings[0].constant &&
      binding?.type === 'MemberExpression' &&
      binding.computed === false &&
      binding.property?.name === 'href' &&
      url?.type === 'NewExpression' &&
      url.callee?.name === 'URL' &&
      url.arguments.length === 2 &&
      target?.type === 'MemberExpression' &&
      target.computed === false &&
      target.property?.name === 'module' &&
      target.object?.type === 'MemberExpression' &&
      target.object.computed === false &&
      target.object.property?.name === 'dataset' &&
      target.object.object?.name === 'script' &&
      base?.type === 'MemberExpression' &&
      base.computed === false &&
      base.property?.name === 'baseURI' &&
      base.object?.name === 'doc';
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (
        [
          'ImportDeclaration',
          'ExportNamedDeclaration',
          'ExportAllDeclaration',
          'ImportExpression',
        ].includes(node.type) &&
        node.source
      ) {
        if (typeof node.source.value === 'string') resolve(node.source.value);
        else if (bootApp && node.source.type === 'Identifier' && node.source.name === 'appURL')
          resolve('./app.mjs');
        else if (
          toolModule &&
          node.source.type === 'Identifier' &&
          node.source.name === 'moduleURL'
        ) {
          // The exact executable path is declared by each HTML data-module
          // attribute and checked below, not supplied by imported content.
        } else
          required(isOptionalIOSBridge(name, node), `Unresolved computed edition import: ${name}.`);
      }
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(tree);
  } else if (name.endsWith('.css')) {
    for (const match of source.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))
      resolve(match[1], true);
  } else if (name.endsWith('.html')) {
    for (const match of source.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/g)) resolve(match[1], true);
    for (const match of source.matchAll(
      /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g,
    ))
      resolve(match[1], true);
    for (const match of source.matchAll(/\bdata-module\s*=\s*["']([^"']+)["']/g))
      resolve(match[1], true);
  }
  return [...dependencies].sort();
}

export function validateEditionCodeClosure(files) {
  for (const [name, bytes] of files)
    for (const dependency of editionCodeDependencies(name, bytes))
      required(
        files.has(dependency),
        `Edition is missing a local dependency: ${name} -> ${dependency}.`,
      );
  if (files.has('runtime-dependencies.json')) {
    const inventory = readJSON(files.get('runtime-dependencies.json'));
    required(
      inventory.format === 'revealline-runtime-dependencies.v1' &&
        inventory.entry === 'game/company.html' &&
        inventory.canonicalEntry === 'game/index.html' &&
        Array.isArray(inventory.resources),
      'Invalid shared runtime dependency inventory.',
    );
    for (const dependency of [inventory.entry, inventory.canonicalEntry, ...inventory.resources])
      required(
        editionRelativePath(dependency) && files.has(dependency),
        `Edition is missing a declared runtime resource: ${dependency}.`,
      );
  }
}

/** Follow the selected entry without visiting repository globs or optional
 * authoring tools. Escaping symlinks fail before any source bytes are admitted. */
export async function collectEditionEngineFiles({ root, entries = ['game/company.html'] }) {
  const realRoot = await fs.realpath(root),
    files = new Map(),
    pending = [...entries];
  let sharedAssets = [];
  if (entries.includes('game/company.html') || entries.includes('game/index.html')) {
    const ledger = await fs.readFile(path.join(realRoot, EDITION_RUNTIME_ASSET_LEDGER));
    sharedAssets = readJSON(ledger).map(validateEditionAsset);
    files.set(EDITION_RUNTIME_ASSET_LEDGER, ledger);
  }
  while (pending.length) {
    const requested = pending.pop(),
      name = EDITION_RUNTIME_ADAPTERS[requested] ?? requested;
    if (files.has(name)) continue;
    required(editionRelativePath(name), 'Invalid edition engine root.');
    const real = await fs.realpath(path.resolve(realRoot, name));
    required(real.startsWith(`${realRoot}${path.sep}`), 'Edition source symlink escapes its root.');
    const bytes = await fs.readFile(real);
    validateEditionHostRequests(name, bytes);
    files.set(name, bytes);
    pending.push(
      ...editionCodeDependencies(name, projectEditionRuntimeImports(name, bytes)),
      ...(EDITION_RUNTIME_RESOURCES[name] ?? []),
    );
    const asset = sharedAssets.find((record) => record.path === name);
    if (asset)
      for (const id of asset.dependencies) {
        const dependency = sharedAssets.find((record) => record.id === id);
        required(dependency, 'Shared runtime asset dependency is missing.');
        pending.push(dependency.path);
      }
  }
  return files;
}

/** Produce a complete isolated input tree without writing the checkout. The
 * caller supplies a reviewed engine inventory and original bytes; all other
 * paths are derived from the selected catalog's dependency closure. */
export async function compileEdition({
  catalog: source,
  editionIds,
  files: sourceFiles,
  enginePaths = [],
  version = 'DEV',
  sourceRevision = 'development',
  validateCode = true,
  offline = null,
} = {}) {
  required(sourceFiles instanceof Map, 'Edition compilation requires original source bytes.');
  const verifyCampaignHeroes = (catalog) => {
    for (const campaign of catalog.campaigns) {
      if (!campaign.heroAssetId) continue;
      const asset = catalog.assets.find((item) => item.id === campaign.heroAssetId),
        bytes = sourceFiles.get(asset.path);
      required(
        bytes instanceof Uint8Array && bytes.length === asset.bytes && hash(bytes) === asset.sha256,
        'Campaign artwork differs from its pinned bytes.',
      );
      const extension = asset.path.split('.').at(-1).toLowerCase(),
        mime = extension === 'jpg' ? 'jpeg' : extension;
      required(
        inspectImageDataUrl(`data:image/${mime};base64,${Buffer.from(bytes).toString('base64')}`)
          .valid,
        'Campaign artwork requires a bounded static raster image.',
      );
    }
  };
  const verifiedArtwork = new Set();
  const verifyArtwork = async (assets) => {
    for (const asset of assets) {
      const identity = canonicalJSON(asset);
      if (verifiedArtwork.has(identity)) continue;
      await loadPreviewArtwork(asset, {
        fetchAsset: async (name) => {
          const bytes = sourceFiles.get(`game/${name}`);
          required(bytes instanceof Uint8Array, `Campaign artwork bytes are missing: ${name}.`);
          return new Response(bytes);
        },
        digest: async (bytes) => createHash('sha256').update(bytes).digest(),
      });
      verifiedArtwork.add(identity);
    }
  };
  const verifyRewardMedia = (definitions, assets, presets, themes) => {
    const registry = createRewardCosmeticRegistry({ presets, themes, assets });
    for (const reward of definitions)
      for (const { role, reference } of [
        ...(reward.teaserImage ? [{ role: 'poster', reference: reward.teaserImage.asset }] : []),
        ...reward.payloads.flatMap((payload) => [
          ...rewardMediaReferences(payload),
          ...(payload.type === 'cosmetic' && resolveRewardCosmetic(registry, payload).image
            ? [{ role: 'poster', reference: resolveRewardCosmetic(registry, payload).image }]
            : []),
        ]),
      ]) {
        const asset = assets.find(
          (item) => item.id === reference.assetId && item.sha256 === reference.sha256,
        );
        required(asset, 'Reward media differs from its selected asset pin.');
        const bytes = sourceFiles.get(asset.path);
        required(
          bytes instanceof Uint8Array && hash(bytes) === asset.sha256,
          'Reward media differs from its exact SHA-256.',
        );
        inspectRewardMediaBytes(asset, role, bytes);
      }
  };
  const catalog = validateEditionRuntimeCatalog(source);
  let runtimeCatalog = selectEditionClosure(catalog, editionIds);
  editionIds = runtimeCatalog.editions.map((edition) => edition.id);
  required(
    Array.isArray(enginePaths) &&
      new Set(enginePaths).size === enginePaths.length &&
      enginePaths.every(editionRelativePath),
    'Engine inventory must contain unique relative paths.',
  );
  // An edition home follows edition identity, independent of gameplay theme.
  // Its own scene is also the fallback; unrelated home artwork otherwise
  // consumes several MiB of the deliberately bounded offline package.
  const menuResources = editionMenuSceneResources(editionIds);
  enginePaths = projectEditionMenuResourcePaths(enginePaths, editionIds);
  const selectedBrand =
    editionIds.length === 1 &&
    runtimeCatalog.brands.find((brand) => brand.id === runtimeCatalog.editions[0].brandId);
  const selectedLogo =
    selectedBrand && runtimeCatalog.assets.find((asset) => asset.id === selectedBrand.logoAssetId);
  if (selectedLogo) enginePaths = enginePaths.filter((name) => name !== DEFAULT_GAME_WORDMARK);
  const sharedLedger = sourceFiles.get(EDITION_RUNTIME_ASSET_LEDGER);
  if (sharedLedger) {
    const assets = readJSON(sharedLedger)
      .map(validateEditionAsset)
      .filter((asset) => enginePaths.includes(asset.path));
    const { format: _format, ...selected } = runtimeCatalog;
    runtimeCatalog = createEditionRuntimeCatalog({
      ...selected,
      assets: [...selected.assets, ...assets],
    });
  }
  verifyCampaignHeroes(runtimeCatalog);
  const selectedData = new Set(
    runtimeCatalog.campaigns.flatMap((campaign) => [
      campaign.sourcePath,
      ...(campaign.lessonPath ? [campaign.lessonPath] : []),
      ...(campaign.rewardPath ? [campaign.rewardPath] : []),
      ...(campaign.localizationPath ? [campaign.localizationPath] : []),
    ]),
  );
  for (const edition of runtimeCatalog.editions) {
    required(edition.boot, 'Standalone editions need an explicit boot inventory.');
    Object.values(edition.boot).forEach((file) => selectedData.add(file));
    for (const descriptor of edition.presentationHistory ?? []) {
      selectedData.add(descriptor.path);
      const bytes = sourceFiles.get(descriptor.path);
      required(
        bytes instanceof Uint8Array &&
          bytes.length === descriptor.bytes &&
          hash(bytes) === descriptor.sha256,
        'Retained presentation source bytes differ from their registration.',
      );
      const retained = await validateRetainedPresentation(readJSON(bytes), { edition });
      await verifyArtwork(retained.bootstrap.source.assets);
      verifyCampaignHeroes(retained.bootstrap.catalog);
      verifyRewardMedia(
        Object.values(retained.bootstrap.rewards ?? {}).flat(),
        resolveEditionAssets(retained.bootstrap.catalog, { editionId: edition.id }),
        retained.bootstrap.boot.presets,
        retained.bootstrap.boot.themes.themes,
      );
      required(
        retained.snapshot.authoredPresentationSha256 === descriptor.id,
        'Retained presentation identity differs from its registration.',
      );
    }
  }
  // Keep historical asset IDs inside their snapshot. A newer presentation can
  // reuse a logical ID while its original immutable media path remains pinned.
  const publicationAssets = editionPublicationAssets(
    runtimeCatalog,
    new Map([...selectedData].map((name) => [name, sourceFiles.get(name)])),
  );
  const selectedMedia = new Set(publicationAssets.map((asset) => asset.path));
  const excluded = new Set([
    ...catalog.campaigns
      .flatMap((campaign) => [
        campaign.sourcePath,
        ...(campaign.lessonPath ? [campaign.lessonPath] : []),
        ...(campaign.rewardPath ? [campaign.rewardPath] : []),
        ...(campaign.localizationPath ? [campaign.localizationPath] : []),
      ])
      .filter((file) => !selectedData.has(file)),
    ...catalog.assets.map((asset) => asset.path).filter((file) => !selectedMedia.has(file)),
    ...catalog.editions
      .flatMap((edition) => [
        ...Object.values(edition.boot ?? {}),
        ...(edition.presentationHistory ?? []).map((record) => record.path),
      ])
      .filter((file) => !selectedData.has(file)),
  ]);
  for (const file of enginePaths) {
    required(!excluded.has(file), 'The engine inventory includes omitted edition content.');
    required(
      !/^(?:game\/company-campaigns\/(?:content|catalog|brands|lessons|rewards|artwork)\.mjs|game\/editions\/(?:catalog|assets)\.json)$/.test(
        file,
      ),
      'Build-time company registries cannot enter a player edition.',
    );
    required(
      (!/\.(?:png|jpe?g|webp|svg|ttf|otf|woff2?|mp3|ogg|wav|m4a|mp4|webm|vtt)$/i.test(file) &&
        !/^game\/editions\/assets\/.*\.txt$/i.test(file)) ||
        selectedMedia.has(file),
      'Player media must belong to the approved asset closure.',
    );
  }
  let files = new Map();
  for (const file of ordered(new Set([...enginePaths, ...selectedData, ...selectedMedia]))) {
    const bytes = sourceFiles.get(file);
    required(bytes instanceof Uint8Array, `Edition source bytes are missing: ${file}.`);
    if (file === EDITION_RUNTIME_ASSET_LEDGER) continue;
    validateEditionHostRequests(file, bytes);
    files.set(
      file,
      file === 'game/ui/menu-scene-catalog.mjs'
        ? projectEditionMenuScenes(bytes, editionIds)
        : file === 'game/ui/brand-identity.mjs' && selectedLogo
          ? projectEditionBrandIdentity(bytes, selectedLogo.path)
          : enginePaths.includes(file)
            ? projectEditionRuntimeImports(file, bytes)
            : Buffer.from(bytes),
    );
  }
  ({ files, catalog: runtimeCatalog } = projectSelectedEditionThemes(runtimeCatalog, files));
  const guidePath = 'game/content/scenarios/line-impact-demo.json';
  if (files.has(guidePath)) {
    const edition = runtimeCatalog.editions.find(
      (item) => item.id === runtimeCatalog.defaultEditionId,
    );
    const brand = runtimeCatalog.brands.find((item) => item.id === edition.brandId);
    const theme = readJSON(files.get(edition.boot.themes)).themes.find(
      (item) => item.id === brand.themeId,
    );
    files.set(
      guidePath,
      jsonBytes(
        projectEditionGuideScenario(readJSON(files.get(guidePath)), {
          theme,
          classes: readJSON(files.get(edition.boot.classes)),
        }),
      ),
    );
  }
  for (const entry of ['game/company.html', 'game/index.html', ...EDITION_RUNTIME_PAGES])
    if (files.has(entry)) {
      let html = files.get(entry).toString('utf8');
      required(/<html\b[^>]*>/.test(html), 'Company entry needs an HTML root.');
      required(!/\bdata-edition-id=/.test(html), 'The source entry cannot pin a compiled edition.');
      html = html
        .replace(/<html\b/, `<html data-edition-id="${runtimeCatalog.defaultEditionId}"`)
        .replace(/<a\b[^>]*\bid=["']all-worlds["'][^>]*>[\s\S]*?<\/a>/g, '');
      const edition = runtimeCatalog.editions.find(
        (item) => item.id === runtimeCatalog.defaultEditionId,
      );
      const brand = runtimeCatalog.brands.find((item) => item.id === edition.brandId);
      const appearanceDefault = resolveEditionAppearanceDefault(
        resolveEditionSelection(runtimeCatalog, { editionId: edition.id }),
      );
      if (appearanceDefault)
        html = html.replace(
          /<html\b/,
          `<html data-appearance-family="${appearanceDefault.familyId}" data-appearance-revision="${appearanceDefault.revision}"`,
        );
      const candidate = runtimeCatalog.appearanceThemes?.find(
        (row) =>
          row.family.id === appearanceDefault?.familyId &&
          row.family.revision === appearanceDefault.revision,
      );
      if (candidate) {
        const hint = encodeURIComponent(JSON.stringify(createThemeBootstrapSeed(candidate)));
        html = html.replace(/<html\b/, `<html data-appearance-seed="${hint}"`);
      }
      const font = runtimeCatalog.assets.find((asset) => asset.id === brand.fontAssetId);
      const rootPrefix = '../'.repeat(entry.split('/').length - 1);
      if (font) {
        const format = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' }[
          font.path.split('.').at(-1).toLowerCase()
        ];
        html = html.replace(
          '</head>',
          `<style>@font-face{font-family:"Company Brand";src:url("${rootPrefix}${font.path}") format("${format}");font-display:swap}:root{--brand-font:"Company Brand",system-ui,sans-serif}</style></head>`,
        );
      }
      const escape = (value) =>
        String(value).replace(
          /[&<>"']/g,
          (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
        );
      html = html.replaceAll('__REVEALLINE_VERSION__', () => escape(version));
      const withoutCopyKey = (tag) => tag.replace(/\sdata-i18n="[^"]*"/g, '');
      const textSlot = (tag, id, value, fixedIdentity = false) => {
        html = html.replace(
          new RegExp(`(<${tag}\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</${tag}>)`),
          (_match, start, end) =>
            `${fixedIdentity ? withoutCopyKey(start) : start}${escape(value)}${end}`,
        );
      };
      html = html.replace(
        /<title\b[^>]*>[\s\S]*?<\/title>/,
        () => `<title>${escape(edition.name)}</title>`,
      );
      // A compiled audience has its identity before any script or stylesheet
      // downloads. Keep loader/status/recovery hooks intact; only the static
      // identity loses the default game's copy key, so locale refresh cannot
      // replace it. Runtime failures still supply their translated heading.
      textSlot('h1', 'boot-title', edition.name, true);
      const logo = runtimeCatalog.assets.find((item) => item.id === brand.logoAssetId);
      const icon = runtimeCatalog.assets.find((item) => item.id === brand.iconAssetId) ?? logo;
      // Shared source pages carry the default game's icons. The selected
      // edition owns its browser and home-screen identity in every compiled page.
      html = html.replace(
        /<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>/gi,
        '',
      );
      if (icon)
        html = html.replace(
          '</head>',
          `<link rel="icon" href="${rootPrefix}${icon.path}"><link rel="apple-touch-icon" href="${rootPrefix}${icon.path}"></head>`,
        );
      const brandMark = `${logo ? `<img class="edition-boot-logo" src="${rootPrefix}${logo.path}" alt="" /> ` : ''}${escape(brand.name)}`;
      html = html.replace(
        /<img\b[^>]*\bclass=["'][^"']*\bfpv-line-wordmark\b[^"']*["'][^>]*>/g,
        () => brandMark,
      );
      html = html.replace(
        /(<p\b[^>]*class="[^"]*\blaunch-kicker\b[^"]*"[^>]*>)[\s\S]*?(<\/p>)/,
        (_match, start, end) => `${withoutCopyKey(start)}${brandMark}${end}`,
      );
      if (EDITION_RUNTIME_PAGES.includes(entry)) {
        html = html.replace(
          /(<a\b[^>]*data-i18n="interface:revealLine"[^>]*>)[\s\S]*?(<\/a>)/,
          (_match, start, end) => `${withoutCopyKey(start)}${brandMark}${end}`,
        );
        html = html.replace(
          /(<span\b[^>]*data-i18n="interface:revealLineReplayTheater"[^>]*>)[\s\S]*?(<\/span>)/,
          (_match, start, end) => `${withoutCopyKey(start)}${brandMark}${end}`,
        );
      }
      textSlot('span', 'brand-name', brand.name);
      textSlot('h1', 'home-title', edition.name);
      textSlot('p', 'brand-description', brand.description);
      textSlot('span', 'footer-brand', edition.name);
      for (const [slot, id] of [
        ['brand-logo', brand.logoAssetId],
        ['home-art', brand.heroAssetId],
      ]) {
        const asset = runtimeCatalog.assets.find((item) => item.id === id);
        if (asset)
          html = html.replace(
            new RegExp(`<img\\b[^>]*\\bid="${slot}"[^>]*>`),
            () => `<img id="${slot}" src="${rootPrefix}${asset.path}" alt="" />`,
          );
      }
      const themeBytes = edition.boot?.themes && files.get(edition.boot.themes);
      const theme =
        themeBytes && readJSON(themeBytes).themes.find((item) => item.id === brand.themeId);
      if (theme?.palette) {
        const palette = Object.entries(theme.palette).filter(
          ([key, color]) => /^[a-z]+$/.test(key) && /^#[0-9a-f]{6}$/i.test(color),
        );
        const safe = Object.fromEntries(palette);
        html = html.replace(
          '</head>',
          `<style>:root{${palette.map(([key, color]) => `--${key}:${color}`).join(';')};--panel:${safe.grid ?? '#193866'}}
html[data-edition-id]:not([data-theme-styled="true"]) body{--fk-bg:var(--ink);--fk-panel:var(--field,var(--ink));--fk-text:var(--paper);--fk-muted:var(--muted,var(--paper));--fk-cyan:var(--accent);--fk-line:var(--grid);--fk-font-ui:var(--brand-font,system-ui,sans-serif);--fk-font-display:var(--brand-font,system-ui,sans-serif)}
html[data-edition-id]:not([data-theme-styled="true"])[data-boot-state]:not([data-boot-state="ready"]),html[data-edition-id]:not([data-theme-styled="true"])[data-boot-state]:not([data-boot-state="ready"]) body{background:var(--ink);color:var(--paper)}
html[data-edition-id]:not([data-theme-styled="true"]) #boot-screen{background:var(--ink);color:var(--paper);font-family:var(--brand-font,system-ui,sans-serif)}
html[data-edition-id]:not([data-theme-styled="true"]) #boot-screen .launch-card{background:var(--field,var(--ink));border-color:var(--grid)}
html[data-edition-id]:not([data-theme-styled="true"]) #boot-screen h1{color:var(--paper);font-family:var(--brand-font,system-ui,sans-serif)}
html[data-edition-id]:not([data-theme-styled="true"]) #boot-screen .launch-kicker,html[data-edition-id]:not([data-theme-styled="true"]) #boot-screen a{color:var(--accent)}
html[data-edition-id]:not([data-theme-styled="true"]) #boot-screen .launch-signal i{background:var(--accent)}
html[data-edition-id] .edition-boot-logo{display:inline-block;width:auto;height:3rem;max-width:9rem;object-fit:contain;vertical-align:middle}
</style></head>`,
        );
        html = html.replace(
          /(<meta\s+name="theme-color"\s+content=")[^"]*(")/,
          `$1${safe.ink ?? '#081D4D'}$2`,
        );
      }
      files.set(entry, Buffer.from(html));
    }
  files = projectEditionLocalization(files);
  for (const file of enginePaths) {
    if (files.has(file)) files.set(file, projectEditionRuntimeIndentation(file, files.get(file)));
  }
  if (files.has('game/index.html')) {
    files.set('game/build-config.json', jsonBytes({ version, entry: 'game/company.html' }));
    files.set(
      'runtime-dependencies.json',
      jsonBytes({
        format: 'revealline-runtime-dependencies.v1',
        entry: 'game/company.html',
        canonicalEntry: 'game/index.html',
        requests: EDITION_HOST_JSON_REQUESTS,
        resources: ordered(
          new Set([
            'game/build-info.json',
            'game/build-config.json',
            'edition-catalog.json',
            ...selectedData,
            ...selectedMedia,
            ...Object.entries(EDITION_RUNTIME_RESOURCES)
              .filter(([name]) => files.has(name))
              .flatMap(([name, paths]) =>
                name === 'game/ui/menu-scene-catalog.mjs'
                  ? menuResources
                  : name === 'game/ui/brand-identity.mjs' && selectedLogo
                    ? [selectedLogo.path]
                    : paths,
              ),
          ]),
        ),
        adapters: Object.entries(EDITION_RUNTIME_ADAPTERS)
          .filter(([, name]) => files.has(name))
          .map(([request, source]) => ({ request, source })),
      }),
    );
  }
  for (const descriptor of runtimeCatalog.campaigns) {
    const project = validateEditionCampaignProject(
      readJSON(files.get(descriptor.sourcePath)),
      descriptor,
    );
    for (const asset of project.assets) {
      required(
        runtimeCatalog.assets.some(
          (entry) =>
            entry.path === `game/${asset.path}` &&
            entry.sha256 === asset.sha256 &&
            entry.bytes === asset.bytes,
        ),
        'Campaign artwork is outside the selected approved asset closure.',
      );
    }
    await verifyArtwork(project.assets);
    if (descriptor.lessonPath)
      validateEditionLessonBundle(readJSON(files.get(descriptor.lessonPath)), project);
    if (descriptor.localizationPath)
      await verifyCampaignLocalization(
        readJSON(files.get(descriptor.localizationPath)),
        project,
        descriptor,
      );
  }
  for (const edition of runtimeCatalog.editions) {
    const rewards = [];
    const rewardSelection = resolveEditionSelection(runtimeCatalog, { editionId: edition.id });
    const selectedCampaigns = rewardSelection.campaigns;
    const editionRewards = selectedCampaigns.flatMap((descriptor) =>
      descriptor.rewardPath ? readJSON(files.get(descriptor.rewardPath)) : [],
    );
    const editionProject = editionRewards.some((reward) => reward?.scope?.kind === 'edition')
      ? mergeEditionProjects(
          rewardSelection,
          selectedCampaigns.map((descriptor) => readJSON(files.get(descriptor.sourcePath))),
        )
      : undefined;
    for (const descriptor of runtimeCatalog.campaigns.filter(
      (campaign) => edition.campaignIds.includes(campaign.id) && campaign.rewardPath,
    ))
      rewards.push(
        ...validateEditionRewardBundle(
          readJSON(files.get(descriptor.rewardPath)),
          readJSON(files.get(descriptor.sourcePath)),
          {
            descriptor,
            editionId: edition.id,
            presets: readJSON(files.get(edition.boot.presets)),
            themes: readJSON(files.get(edition.boot.themes)).themes,
            editionProject,
            lessons: selectedCampaigns.flatMap((campaign) =>
              campaign.lessonPath ? readJSON(files.get(campaign.lessonPath)) : [],
            ),
            assets: resolveEditionAssets(runtimeCatalog, { editionId: edition.id }),
          },
        ),
      );
    validateCompletionRewards(rewards);
    verifyRewardMedia(
      rewards,
      resolveEditionAssets(runtimeCatalog, { editionId: edition.id }),
      readJSON(files.get(edition.boot.presets)),
      readJSON(files.get(edition.boot.themes)).themes,
    );
    Object.values(edition.boot).forEach((file) => readJSON(files.get(file)));
    validateEditionPresentation({
      catalog: runtimeCatalog,
      editionId: edition.id,
      themes: readJSON(files.get(edition.boot.themes)),
      presets: readJSON(files.get(edition.boot.presets)),
    });
    const entry = runtimeCatalog.campaigns.find(
      (campaign) => campaign.id === edition.entryCampaignId,
    );
    const project = compileContentProject(readJSON(files.get(entry.sourcePath)));
    const bootCampaign = readJSON(files.get(edition.boot.campaign));
    required(
      Array.isArray(bootCampaign.levels) &&
        bootCampaign.levels.length > 0 &&
        bootCampaign.levels.every((level) =>
          project.missions.some((mission) => mission.id === level.id),
        ),
      'Boot campaign contains levels outside the entry campaign.',
    );
  }
  files.set('edition-catalog.json', jsonBytes(runtimeCatalog));
  const context = resolveEditionContext({
    editionId: editionIds.length === 1 ? editionIds[0] : undefined,
    version,
  });
  files.set(
    'game/build-info.json',
    jsonBytes({
      formatVersion: 1,
      version,
      sourceRevision,
      entry: 'game/company.html',
      ...(context.editionId ? { editionId: context.editionId } : {}),
      editionIds,
    }),
  );
  files = projectEditionCodeIndentation(files);
  if (offline !== null) {
    required(
      editionIds.length === 1,
      'An installed edition must select one stable edition identity.',
    );
    const edition = runtimeCatalog.editions[0],
      brand = runtimeCatalog.brands.find((item) => item.id === edition.brandId);
    const theme = readJSON(files.get(edition.boot.themes)).themes[0];
    const icon = runtimeCatalog.assets.find((asset) => asset.id === brand.iconAssetId);
    const iconPaths = icon
      ? [
          icon,
          ...icon.dependencies
            .map((id) => runtimeCatalog.assets.find((asset) => asset.id === id))
            .filter(
              (asset) =>
                asset.derivative?.width === 192 &&
                asset.derivative.sourceSha256 === icon.derivative.sourceSha256,
            ),
        ]
          .sort((left, right) => left.derivative.width - right.derivative.width)
          .map((asset) => asset.path)
      : [];
    const fontPath = runtimeCatalog.assets.find((asset) => asset.id === brand.fontAssetId)?.path;
    files = await buildEditionOfflineFiles({
      ...offline,
      files,
      editionId: editionIds[0],
      version,
      entry: 'game/company.html',
      name: runtimeCatalog.editions[0].name,
      iconPaths,
      fontPath,
      palette: { ink: theme.palette.ink, paper: theme.palette.paper, accent: theme.palette.accent },
    });
  }
  const assetPaths = new Map(publicationAssets.map((asset) => [asset.path, asset]));
  const eligibility = validateEditionSourceInventory({
    files,
    assets: [...assetPaths.values()],
    publication: 'public',
  });
  if (validateCode) validateEditionCodeClosure(files);
  const inventory = [...files]
    .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const manifest = Object.freeze({
    format: 'revealline-edition-build.v1',
    editionIds: [...editionIds],
    version,
    sourceRevision,
    catalogSha256: hash(files.get('edition-catalog.json')),
    files: inventory,
  });
  files.set('edition-build.json', jsonBytes(manifest));
  if (offline !== null) {
    const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
    if (files.size > 2000 || totalBytes > 64 * 1024 * 1024)
      throw Object.assign(
        new TypeError(
          `Final edition output exceeds 2000 files or 64 MiB (${files.size} files / ${totalBytes} bytes).`,
        ),
        { outputFiles: files.size, outputBytes: totalBytes },
      );
  }
  return Object.freeze({ files, runtimeCatalog, manifest, eligibility });
}

/** A new output directory is required: compilation never deletes unrelated
 * files or mutates an earlier immutable distribution. */
export async function writeEdition(output, result) {
  await fs.mkdir(output, { recursive: false });
  for (const [file, bytes] of result.files) {
    required(editionRelativePath(file), 'Invalid compiled edition output path.');
    await fs.mkdir(path.dirname(path.join(output, file)), { recursive: true });
    await fs.writeFile(path.join(output, file), bytes, { flag: 'wx' });
  }
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    required(
      [
        '--catalog',
        '--edition',
        '--engine-manifest',
        '--out',
        '--root',
        '--version',
        '--source-revision',
        '--offline-base-path',
      ].includes(args[i]) && args[i + 1],
      'Expected --catalog, --edition and --out; optional --engine-manifest, --version and --offline-base-path.',
    );
    options[args[i].slice(2)] = args[i + 1];
  }
  required(
    options.catalog && options.edition && options.out,
    'Catalog, edition and output are required.',
  );
  const root = path.resolve(options.root ?? '.'),
    catalog = readJSON(await fs.readFile(path.resolve(root, options.catalog)));
  const engineFiles = options['engine-manifest']
    ? new Map()
    : await collectEditionEngineFiles({ root });
  const engine = options['engine-manifest']
    ? readJSON(await fs.readFile(path.resolve(root, options['engine-manifest'])))
    : { paths: [...engineFiles.keys()] };
  const editionIds = options.edition.split(',');
  const files = new Map(engineFiles);
  const read = async (file) => {
    required(editionRelativePath(file), 'Unsafe source path.');
    const absolute = path.resolve(root, file),
      real = await fs.realpath(absolute);
    required(
      real.startsWith(`${await fs.realpath(root)}${path.sep}`),
      'Edition source symlink escapes its root.',
    );
    const stat = await fs.stat(real);
    required(
      stat.isFile() && stat.size <= 32 * 1024 * 1024,
      'Selected source exceeds its file budget.',
    );
    return fs.readFile(absolute);
  };
  for (const file of engine.paths) if (!files.has(file)) files.set(file, await read(file));
  for (const [name, bytes] of await collectEditionSelectedFiles({ catalog, editionIds, read }))
    files.set(name, bytes);
  const result = await compileEdition({
    catalog,
    editionIds,
    files,
    enginePaths: engine.paths,
    ...(options.version ? { version: options.version } : {}),
    ...(options['source-revision'] ? { sourceRevision: options['source-revision'] } : {}),
    ...(options['offline-base-path']
      ? { offline: { basePath: options['offline-base-path'] } }
      : {}),
  });
  await writeEdition(path.resolve(options.out), result);
  process.stdout.write(`Compiled ${editionIds.join(', ')}: ${result.files.size} files.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
