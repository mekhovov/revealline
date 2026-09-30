import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_LIMIT = 128 * 1024;
const OPTIONAL_CLOSURE = [
  ['navigation.css', 'index.html', 'navigation.css'],
  ['edition-context.mjs', 'installed-app.mjs', './edition-context.mjs'],
  ['profile-writer.mjs', 'installed-app.mjs', './profile-writer.mjs'],
  ['i18n/index.mjs', 'app.mjs', './i18n/index.mjs'],
  ['i18n/bootstrap.mjs', 'i18n/index.mjs', './bootstrap.mjs'],
  ['i18n/catalogs.mjs', 'i18n/index.mjs', './catalogs.mjs'],
  ['i18n/style.css', 'index.html', 'i18n/style.css'],
  ['vendor/i18next-26.4.2.min.js', 'i18n/index.mjs', '../vendor/i18next-26.4.2.min.js'],
  ['ui/launcher-navigation.mjs', 'app.mjs', './ui/launcher-navigation.mjs'],
  ['ui/controller-navigation.mjs', 'ui/launcher-navigation.mjs', './controller-navigation.mjs'],
  [
    'ui/controller-confirm-guard.mjs',
    'ui/launcher-navigation.mjs',
    './controller-confirm-guard.mjs',
  ],
  [
    'ui/controller-confirm-lifecycle.mjs',
    'ui/launcher-navigation.mjs',
    './controller-confirm-lifecycle.mjs',
  ],
  ['ui/controller-router.mjs', 'ui/launcher-navigation.mjs', './controller-router.mjs'],
  ['couch/controller-profiles.mjs', 'ui/controller-router.mjs', '../couch/controller-profiles.mjs'],
  ['ui/menu-navigation-groups.mjs', 'ui/controller-navigation.mjs', './menu-navigation-groups.mjs'],
  [
    'ui/controller-field-editor.mjs',
    'ui/controller-navigation.mjs',
    './controller-field-editor.mjs',
  ],
  [
    'ui/controller-field-editor.css',
    'ui/controller-field-editor.mjs',
    './controller-field-editor.css',
  ],
  ['ui/settings-panels.mjs', 'ui/controller-navigation.mjs', './settings-panels.mjs'],
  ['ui/controller-text-draft.mjs', 'ui/controller-field-editor.mjs', './controller-text-draft.mjs'],
  ['controller-bindings.mjs', 'ui/controller-router.mjs', '../controller-bindings.mjs'],
  ['controller-boost.mjs', 'ui/controller-router.mjs', '../controller-boost.mjs'],
  ['i18n/content.mjs', 'ui/controller-navigation.mjs', '../i18n/content.mjs'],
  ['data-json.mjs', 'i18n/content.mjs', '../data-json.mjs'],
  ['i18n/content-registry.mjs', 'i18n/content.mjs', './content-registry.mjs'],
];

/** Copy the frozen, small launcher only. Never duplicate a gameplay or soundtrack body. */
export async function publishOfflineLauncher(source, output, version) {
  const files = [
    'index.html',
    'app.mjs',
    'app.css',
    'installed-app.mjs',
    'manifest.webmanifest',
    'service-worker.js',
    'icon-180.png',
    'icon-192.png',
    'icon-512.png',
  ];
  try {
    await fs.access(path.join(source, 'app/manifest.webmanifest'));
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  const text = new Map();
  for (const file of ['index.html', 'app.mjs', 'installed-app.mjs'])
    text.set(file, await fs.readFile(path.join(source, 'app', file), 'utf8'));
  for (const [file, owner, reference] of OPTIONAL_CLOSURE) {
    const required = text.get(owner)?.includes(reference) === true;
    try {
      const bytes = await fs.readFile(path.join(source, 'app', file));
      if (required) {
        files.push(file);
        if (file.endsWith('.mjs')) text.set(file, bytes.toString());
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (required) throw new Error('Frozen launcher is missing an imported dependency: ' + file);
    }
  }
  await fs.mkdir(path.join(output, 'app'), { recursive: true });
  for (const file of files) {
    const bytes = await fs.readFile(path.join(source, 'app', file));
    if (bytes.length > FILE_LIMIT)
      throw new Error('Frozen launcher exceeded its file budget: ' + file);
    const target = path.join(output, 'app', file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
  // Historical launchers did not include an update surface. New ones share the
  // exact frozen download document while staying under the narrow app worker.
  let update;
  try {
    update = await fs.readFile(path.join(source, 'app/update.html'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (update !== undefined) {
    // A historical missing updater is allowed. Once supplied, its bridge is
    // required: do not publish a new update control whose destination is absent.
    const bridge = await fs.readFile(path.join(source, 'game-update.html'));
    if (!update.includes('<base href="../game/" />') || Buffer.byteLength(update) > FILE_LIMIT)
      throw new Error('Frozen updater has an invalid candidate base or file budget.');
    if (bridge.length > FILE_LIMIT)
      throw new Error('Frozen update bridge exceeded its file budget.');
    await fs.writeFile(
      path.join(output, 'app/update.html'),
      update.replace(
        '<base href="../game/" />',
        `<base href="../releases/${version}/site/game/" />`,
      ),
    );
    await fs.writeFile(path.join(output, 'game-update.html'), bridge);
  }
  let sourceRevision;
  try {
    sourceRevision = JSON.parse(
      await fs.readFile(path.join(source, 'app/current.json'), 'utf8'),
    ).sourceRevision;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.writeFile(
    path.join(output, 'app/current.json'),
    JSON.stringify({
      version,
      scope: '../releases/' + version + '/site/',
      ...(sourceRevision ? { sourceRevision } : {}),
    }),
  );
  return true;
}
