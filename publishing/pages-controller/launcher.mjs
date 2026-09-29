import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_LIMIT = 128 * 1024;
const OPTIONAL_CLOSURE = [
  ['edition-context.mjs', 'installed-app.mjs', './edition-context.mjs'],
  ['profile-writer.mjs', 'installed-app.mjs', './profile-writer.mjs'],
  ['i18n/index.mjs', 'app.mjs', './i18n/index.mjs'],
  ['i18n/bootstrap.mjs', 'i18n/index.mjs', './bootstrap.mjs'],
  ['i18n/catalogs.mjs', 'i18n/index.mjs', './catalogs.mjs'],
  ['i18n/style.css', 'index.html', 'i18n/style.css'],
  ['vendor/i18next-26.4.2.min.js', 'i18n/index.mjs', '../vendor/i18next-26.4.2.min.js'],
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
  await fs.writeFile(
    path.join(output, 'app/current.json'),
    JSON.stringify({ version, scope: '../releases/' + version + '/site/' }),
  );
  return true;
}
