#!/usr/bin/env node
import { readFile, writeFile, copyFile, mkdir, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { renderPreviewSite } from '../authoring/library/licensed-audio/preview-site/render.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';

export async function prepareLicensedPreviewSite(outputDirectory) {
  const output = path.resolve(root, outputDirectory);
  if (!path.relative(root, output).startsWith(`.cache${path.sep}`))
    throw new Error('Prepare only a staged archive inside the isolated source .cache.');
  let cursor = root;
  for (const component of path.relative(root, output).split(path.sep)) {
    cursor = path.join(cursor, component);
    if (!(await lstat(cursor)).isDirectory() || (await lstat(cursor)).isSymbolicLink())
      throw new Error('Archive directory must be ordinary and already staged.');
  }
  const catalogueBytes = await readFile(path.join(output, 'preview-catalogue.json'));
  const catalogue = JSON.parse(catalogueBytes);
  const inventory = JSON.parse(await readFile(path.join(output, 'inventory.json'), 'utf8'));
  if (
    catalogue.tracks.length !== 70 ||
    catalogue.gameCatalogueAdmission !== false ||
    inventory.files.reduce((sum, item) => sum + item.bytes, 0) !== 354986122
  )
    throw new Error('This page assembly is pinned to the current 70-recording preview.');
  const templates = path.join(root, 'authoring/library/licensed-audio/preview-site');
  const write = (name, body) => writeFile(path.join(output, name), body, { flag: 'wx' });
  await write('index.html', renderPreviewSite(catalogue));
  for (const name of ['style.css', 'player.mjs', 'verify.mjs'])
    await write(name, await readFile(path.join(templates, name)));
  await mkdir(path.join(output, 'i18n'));
  for (const [name, source] of [
    ['i18next-26.4.2.min.js', 'game/vendor/i18next-26.4.2.min.js'],
    ['catalogs.mjs', 'game/i18n/catalogs.mjs'],
    ['bootstrap.mjs', 'game/i18n/bootstrap.mjs'],
    ['style.css', 'game/i18n/style.css'],
  ])
    await write(`i18n/${name}`, await readFile(path.join(root, source)));
  await write('.nojekyll', '');
  const credits = catalogue.tracks
    .flatMap((track) => [
      `## ${track.title} — ${track.artist}`,
      '',
      track.credit,
      '',
      `Creator: ${track.artistURL || track.source}`,
      `Source: ${track.source}`,
      `License: ${track.license} — ${track.licenseURL}`,
      `Changes: ${track.changes}`,
      `MP3: ${new URL(track.path, catalogue.archive.baseURL).href}`,
      `Filename: ${track.fileName}`,
      `Bytes: ${track.bytes}; SHA-256: ${track.sha256}`,
      '',
    ])
    .join('\n');
  await write('CREDITS.md', '# Recording credits and license notices\n\n' + credits);
  await write(
    'README.md',
    `# RevealLine music archive 01\n\n[Listen and download](${catalogue.archive.baseURL})\n\n70 creator recordings, 354,986,122 exact MP3 bytes. Every objects/<sha256>.mp3 file is committed for reuse. Files are free to use under their individually listed CC0, CC BY 3.0 or CC BY 4.0 licenses; retain the required attribution and change notices in [CREDITS.md](CREDITS.md). The creators do not endorse this game.\n\nThis is a preview music archive, separate from the frozen RevealLine game release. It does not approve musical quality, grant Content ID clearance or automatically admit tracks into the game's trusted catalogue. UA-FPV and rejected AI recordings are excluded. No master files or duplicate album packages are included.\n\n## Verify and deploy\n\nRun \`node verify.mjs\` to read and hash every public file. Run \`node verify.mjs --stage public\` to prepare the exact Pages payload. The GitHub Actions workflow independently verifies and publishes it on main. \`deployment-manifest.json\` pins public files, \`inventory.json\` pins every immutable MP3 object, and \`preview-catalogue.json\` maps recordings to creator/source/license/conversion metadata. Keep old object paths immutable when extending the archive.\n\nAuthoring sources: [RevealLine soundtrack PR](https://github.com/mekhovov/revealline/pull/209). Source register, authorization and inventory hashes are embedded in the catalogue and deployment manifest.\n`,
  );
  await mkdir(path.join(output, '.github/workflows'), { recursive: true });
  await copyFile(
    path.join(templates, 'pages.yml'),
    path.join(output, '.github/workflows/pages.yml'),
  );
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (['.github', '.git', 'verify.mjs'].includes(name)) continue;
      if (entry.isSymbolicLink()) throw new Error('Archive contains an unexpected link.');
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), name + '/');
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(directory, entry.name));
        files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
      } else throw new Error('Archive contains a special file.');
    }
  }
  await walk(output);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  await write(
    'deployment-manifest.json',
    json({
      format: 'revealline-soundtrack-preview-deployment.v1',
      id: inventory.id,
      expected: { trackCount: 70, audioBytes: 354986122 },
      files,
      provenance: {
        ...catalogue.source,
        previewCatalogueSha256: hash(catalogueBytes),
        userPublicationScope:
          'Exact licensed MP3 previews; no game-catalogue or listening approval.',
      },
    }),
  );
  return {
    output,
    publicFiles: files.length + 1,
    audioFiles: inventory.files.length,
    audioBytes: inventory.files.reduce((sum, item) => sum + item.bytes, 0),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3)
    throw new Error('Usage: node scripts/prepare-licensed-preview-site.mjs .cache/STAGED_ARCHIVE');
  console.log(json(await prepareLicensedPreviewSite(process.argv[2])));
}
