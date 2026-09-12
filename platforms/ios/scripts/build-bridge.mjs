import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile, appendFile } from 'node:fs/promises';
const result = await build({
  entryPoints: [fileURLToPath(new URL('../bridge/bridge-entry.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('../bridge/dist/bridge.mjs', import.meta.url)),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['safari15.4'],
  legalComments: 'inline',
  metafile: true,
  logLevel: 'info',
});
for (const output of Object.values(result.metafile.outputs)) {
  if (output.imports.some((entry) => entry.external))
    throw new Error('Native bridge still contains external imports.');
}

// Preserve complete runtime notices inside the file that is shipped in the iOS app.
const notices = [];
for (const name of [
  '@capacitor/core',
  '@capacitor/ios',
  '@capacitor/app',
  '@capacitor/filesystem',
  '@capacitor/share',
]) {
  const directory = new URL(`../node_modules/${name}/`, import.meta.url);
  const info = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
  const license = await readFile(new URL('LICENSE', directory), 'utf8');
  notices.push(`${info.name} ${info.version}\n${license}`);
}
const tslibRoot = new URL('../node_modules/tslib/', import.meta.url);
for (const name of ['CopyrightNotice.txt', 'LICENSE.txt']) {
  const license = await readFile(new URL(name, tslibRoot), 'utf8');
  notices.push(`tslib / ${name}\n${license}`);
}
await appendFile(
  new URL('../bridge/dist/bridge.mjs', import.meta.url),
  `\n// Native runtime notices\n${notices
    .join('\n\n')
    .split(/\r?\n/)
    .map((line) => `// ${line}`)
    .join('\n')}\n`,
);
