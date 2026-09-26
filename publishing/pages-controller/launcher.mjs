import fs from 'node:fs/promises';
import path from 'node:path';
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
  await fs.mkdir(path.join(output, 'app'), { recursive: true });
  for (const file of files) {
    const bytes = await fs.readFile(path.join(source, 'app', file));
    if (bytes.length > 128 * 1024) throw new Error('Frozen launcher exceeded its file budget.');
    await fs.writeFile(path.join(output, 'app', file), bytes);
  }
  await fs.writeFile(
    path.join(output, 'app/current.json'),
    JSON.stringify({ version, scope: `../releases/${version}/site/` }),
  );
  return true;
}
