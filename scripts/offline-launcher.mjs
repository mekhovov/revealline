import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function addOfflineLauncher(root, entries, version) {
  if (!entries.some((entry) => entry.name === 'game/installed-app.mjs')) return;
  const files = [
    ['index.html', 'game/offline/app.html'],
    ['app.mjs', 'game/offline/app.mjs'],
    ['app.css', 'game/downloads.css'],
    ['installed-app.mjs', 'game/installed-app.mjs'],
  ];
  const launcher = [];
  for (const [target, source] of files)
    launcher.push({ name: `app/${target}`, bytes: await fs.readFile(path.join(root, source)) });
  for (const size of [180, 192, 512])
    launcher.push({
      name: `app/icon-${size}.png`,
      bytes: entries.find((entry) => entry.name === `icons/icon-${size}.png`).bytes,
    });
  launcher.push({
    name: 'app/manifest.webmanifest',
    bytes: Buffer.from(
      JSON.stringify({
        id: './',
        name: 'Reveal Line',
        short_name: 'Reveal Line',
        start_url: './',
        scope: '../',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#091324',
        theme_color: '#091324',
        lang: 'en',
        icons: [192, 512].map((size) => ({
          src: `icon-${size}.png`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: 'any maskable',
        })),
      }),
    ),
  });
  const template = await fs.readFile(
    path.join(root, 'game/offline/app-worker.template.js'),
    'utf8',
  );
  const id = createHash('sha256')
    .update(template)
    .update(Buffer.concat(launcher.map((entry) => entry.bytes)))
    .digest('hex');
  launcher.push({
    name: 'app/service-worker.js',
    bytes: Buffer.from(
      template.replace(
        '__REVEALLINE_LAUNCHER_CONFIG__',
        JSON.stringify({
          id,
          files: launcher.map((entry) => ({
            path: entry.name.slice(4),
            bytes: entry.bytes.length,
            sha256: createHash('sha256').update(entry.bytes).digest('hex'),
          })),
        }),
      ),
    ),
  });
  launcher.push({
    name: 'app/current.json',
    bytes: Buffer.from(JSON.stringify({ version, scope: '../' })),
  });
  entries.push(...launcher);
}
