/** Small synthetic application for package-boundary tests, not simulator or release evidence. */
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { buildOptionalPractice } from '../scripts/build-optional-practice.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from './optional-package-policy.mjs';

export async function optionalFPVSourceFixture(t) {
  const source = new URL('../', import.meta.url).pathname;
  const root = await mkdtemp(path.join(tmpdir(), 'optional-fpv-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const prior = await buildOptionalPractice(source);
  const files = new Map(prior.inputs);
  const policy = OPTIONAL_PACKAGE_POLICIES['civilian-fpv'];
  for (const name of [...policy.sharedFiles, ...policy.localeInputs])
    if (name !== 'game/i18n/catalogs.mjs') files.set(name, await readFile(path.join(source, name)));
  for (const template of [policy.template, policy.launcherTemplate])
    files.set(template, await readFile(path.join(source, template)));
  for (const name of policy.localFiles) {
    const target = policy.root + name;
    if (name.startsWith('vendor/')) files.set(target, await readFile(path.join(source, target)));
    else
      files.set(
        target,
        Buffer.from(name.endsWith('.mjs') ? '// Synthetic package fixture.\n' : ''),
      );
  }
  files.set(
    policy.root + 'index.html',
    Buffer.from(
      '<!doctype html><link rel="stylesheet" href="style.css"><script type="module" src="app.mjs"></script>\n',
    ),
  );
  files.set(policy.root + 'app.mjs', Buffer.from("import './renderer.mjs';\n"));
  files.set(
    policy.root + 'renderer.mjs',
    Buffer.from(
      "import * as THREE from './vendor/three.module.js';\nexport const revision = THREE.REVISION;\n",
    ),
  );
  const manifest = JSON.parse(
    prior.inputs.get('optional-practice/civilian-flight/app.webmanifest'),
  );
  Object.assign(manifest, {
    id: './civilian-fpv',
    name: 'Synthetic FPV fixture',
    short_name: 'FPV fixture',
  });
  files.set(policy.root + 'app.webmanifest', Buffer.from(JSON.stringify(manifest)));
  for (const [name, bytes] of files) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return { root, files, policy };
}
