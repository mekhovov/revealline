import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNativeSite } from './resources.mjs';
import { NATIVE_MARKER } from './policy.mjs';
import { hardenPackage, readMacIcon } from './package-security.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_FILES = ['main.mjs', 'policy.mjs', 'resources.mjs'];
async function absent(target) {
  try {
    await fs.lstat(target);
    return false;
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
}

/** Stage only validated site/runtime files; never copy node_modules or authoring source. */
export async function packageDesktop({
  directory = ROOT,
  label,
  packagerImplementation,
  fuseAPI,
} = {}) {
  const info = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
  const site = await loadNativeSite(path.join(directory, 'site'));
  const version = site.version.replace(/^v/, '');
  if (version !== info.version || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))
    throw new Error('Desktop package version must match the staged native site.');
  const outputLabel = label ?? `v${version}`;
  if (
    !/^v\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*)?$/.test(outputLabel) ||
    outputLabel.length > 64
  )
    throw new Error('Desktop output label must be a safe version such as v0.3.0-candidate-01.');
  const outParent = path.join(directory, 'out');
  const out = path.join(outParent, outputLabel);
  if (!(await absent(out)))
    throw new Error(`Desktop output already exists; it will not be overwritten: ${out}`);
  const branding = process.platform === 'darwin' ? await readMacIcon(directory) : null;
  await fs.mkdir(outParent, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(outParent, '.package-'));
  try {
    const input = path.join(temporary, 'app'),
      output = path.join(temporary, 'output');
    const icon = branding ? path.join(temporary, 'revealline.icns') : null;
    if (icon) await fs.writeFile(icon, branding.bytes);
    await fs.mkdir(path.join(input, 'site'), { recursive: true });
    for (const name of RUNTIME_FILES)
      await fs.copyFile(path.join(directory, name), path.join(input, name));
    const runtimePackage = {
      name: info.name,
      productName: info.productName,
      version,
      description: info.description,
      type: 'module',
      main: 'main.mjs',
    };
    await fs.writeFile(
      path.join(input, 'package.json'),
      `${JSON.stringify(runtimePackage, null, 2)}\n`,
    );
    const manifest = JSON.parse(await fs.readFile(path.join(site.root, 'manifest.json'), 'utf8'));
    const marker = JSON.parse(await fs.readFile(path.join(site.root, NATIVE_MARKER), 'utf8'));
    if (
      manifest.sourceRevision !== undefined &&
      manifest.sourceRevision !== null &&
      !/^[a-f0-9]{40,64}$/.test(manifest.sourceRevision)
    )
      throw new Error('The source revision must be a full Git object ID or null.');
    for (const name of [
      ...manifest.files.map((file) => file.path),
      'manifest.json',
      NATIVE_MARKER,
    ]) {
      const target = path.join(input, 'site', name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(site.root, name), target);
    }
    const copied = await loadNativeSite(path.join(input, 'site'));
    if (copied.manifestSha256 !== site.manifestSha256)
      throw new Error(
        'The staged site changed while packaging. Try again after staging is complete.',
      );
    const packager = packagerImplementation || (await import('@electron/packager')).packager;
    await packager({
      dir: input,
      out: output,
      name: 'Reveal Line',
      platform: process.platform,
      arch: process.arch,
      electronVersion: info.devDependencies.electron,
      appVersion: version,
      appBundleId: 'app.revealline.desktop',
      appCategoryType: 'public.app-category.games',
      ...(icon ? { icon } : {}),
      asar: false,
      prune: false,
      overwrite: false,
    });
    const artifacts = await fs.readdir(output);
    if (artifacts.length !== 1) throw new Error('Expected one host-platform desktop application.');
    const artifactPath = path.join(output, artifacts[0]);
    const artifactInfo = await fs.lstat(artifactPath);
    if (!artifactInfo.isDirectory() || artifactInfo.isSymbolicLink())
      throw new Error('Packager output must be a regular application directory.');
    const fuses = await hardenPackage(artifactPath, { api: fuseAPI });
    // mkdir is exclusive: a concurrent build cannot replace an earlier version.
    await fs.mkdir(out);
    for (const name of artifacts) await fs.rename(path.join(output, name), path.join(out, name));
    const report = {
      format: 'revealline-desktop-package.v1',
      version,
      label: outputLabel,
      electronVersion: info.devDependencies.electron,
      platform: process.platform,
      arch: process.arch,
      manifestSha256: site.manifestSha256,
      sourceManifestSha256: marker.sourceManifestSha256 ?? site.manifestSha256,
      sourceRevision: manifest.sourceRevision ?? null,
      icon: branding
        ? { source: branding.source, sha256: branding.sha256, bytes: branding.bytes.length }
        : null,
      fuses,
      signing: process.platform === 'darwin' ? 'ad-hoc-only' : 'unsigned',
      signed: false,
      notarized: false,
      artifacts,
    };
    await fs.writeFile(
      path.join(out, 'native-package.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    return { ...report, out };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--label'))
    throw new Error(
      'Usage: npm run package -- [--label v0.3.0-candidate-01]. Packaging targets the current host.',
    );
  console.log(JSON.stringify(await packageDesktop({ label: args[1] }), null, 2));
}
