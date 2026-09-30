/** Local working-tree verification only. This is not the release admission CLI. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  collectEditionEngineFiles,
  collectEditionSelectedFiles,
  compileEdition,
  validateEditionCodeClosure,
  writeEdition,
} from './compile-edition.mjs';
import { resolveMenuScene } from '../game/ui/menu-scene-catalog.mjs';
import { editionMenuSceneResources } from './edition-runtime.mjs';
import {
  editionPublicSlug,
  validateCompanyInstallationReference,
} from '../game/edition-context.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] ?? '/private/tmp/revealline-menu-editions-check');
await fs.mkdir(output);
const catalog = JSON.parse(await fs.readFile(path.join(root, 'game/editions/catalog.json')));
const engine = await collectEditionEngineFiles({ root });
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'))).version;
const required = [
  'game/ui/native-menus.mjs',
  'game/ui/native-menu-icons.mjs',
  'game/ui/native-menu.css',
  'game/ui/menu-scenes.mjs',
  'game/ui/menu-scenes.css',
  'game/ui/menu-scene-catalog.mjs',
  'game/ui/fonts/departure-mono/DepartureMono-Regular.woff2',
  'game/ui/fonts/departure-mono/LICENSE',
  'service-worker.js',
  'offline-cache.json',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = {
  kind: 'local-working-tree-menu-verification',
  releaseAdmitted: false,
  sourceRevision: 'development',
  version,
  sourceHashes: Object.fromEntries([...engine].map(([name, bytes]) => [name, hash(bytes)])),
  editions: [],
};
for (const edition of catalog.editions) {
  const scenePaths = editionMenuSceneResources([edition.id]);
  const files = new Map(engine);
  const selected = await collectEditionSelectedFiles({
    catalog,
    editionIds: [edition.id],
    read: (name) => fs.readFile(path.join(root, name)),
  });
  for (const [name, bytes] of selected) files.set(name, bytes);
  const result = await compileEdition({
    catalog,
    editionIds: [edition.id],
    files,
    enginePaths: [...engine.keys()],
    version,
    sourceRevision: 'development',
    offline: { basePath: '/' },
  });
  validateEditionCodeClosure(result.files);
  const html = result.files.get('game/index.html').toString();
  if (html.includes('__REVEALLINE_VERSION__') || !html.includes(`data-build-version="${version}"`))
    throw new Error(`${edition.id}: release version was not bound in the landing HTML`);
  for (const name of [...required, ...scenePaths])
    if (!result.files.has(name)) throw new Error(`${edition.id}: missing ${name}`);
  const packagedScenes = await import(
    `data:text/javascript;base64,${result.files.get('game/ui/menu-scene-catalog.mjs').toString('base64')}`
  );
  if (
    Object.keys(packagedScenes.MENU_SCENES).length !== 2 ||
    packagedScenes.resolveMenuScene({ editionId: edition.id }).id !==
      resolveMenuScene({ editionId: edition.id }).id
  )
    throw new Error(`${edition.id}: projected profile lookup differs`);
  const offline = JSON.parse(result.files.get('offline-cache.json'));
  for (const name of required.filter((name) => name.startsWith('game/')).concat(scenePaths))
    if (!offline.files.some((file) => file.path === name))
      throw new Error(`${edition.id}: offline inventory missing ${name}`);
  const definition = result.runtimeCatalog.editions[0];
  const theme = JSON.parse(result.files.get(definition.boot.themes)).themes[0];
  // The native edition home intentionally uses edition context. The brand's
  // general home theme is retained for gameplay, not supplied as an explicit
  // menu theme that could shadow the individual campaign's scene.
  const scene = resolveMenuScene({ editionId: edition.id });
  const base = path.join(output, 'editions', editionPublicSlug(edition.id));
  const site = path.join(base, 'releases', `v${version.replace(/^v/, '')}`, 'site');
  await fs.mkdir(path.dirname(site), { recursive: true });
  await writeEdition(site, result);
  // Local-only layout equivalent to edition-promotion's stable launcher and
  // immutable release route. This does not invoke or bypass release admission.
  for (const [name, bytes] of result.files) {
    if (!name.startsWith('app/') || name === 'app/current.json') continue;
    await fs.mkdir(path.dirname(path.join(base, name)), { recursive: true });
    await fs.writeFile(path.join(base, name), bytes);
  }
  const current = {
    editionId: edition.id,
    version,
    scope: `../releases/v${version.replace(/^v/, '')}/site/`,
    entry: 'game/company.html',
  };
  validateCompanyInstallationReference(current, {
    editionId: edition.id,
    baseURL: `http://127.0.0.1:8788/editions/${editionPublicSlug(edition.id)}/app/`,
    editionRoot: `/editions/${editionPublicSlug(edition.id)}/`,
  });
  await fs.writeFile(path.join(base, 'app/current.json'), JSON.stringify(current) + '\n');
  const row = {
    id: edition.id,
    scene: scene.id,
    bootBrandTheme: theme.id,
    files: result.files.size,
    offlineFiles: offline.files.length,
    offlineBytes: offline.totalBytes,
    sceneImages: scenePaths.filter((name) => name.endsWith('.webp')),
    manifestSha256: hash(result.files.get('edition-build.json')),
    site: path.relative(output, site),
  };
  report.editions.push(row);
  console.log(JSON.stringify(row));
}
await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Local verification complete: ${report.editions.length} editions at ${output}`);
