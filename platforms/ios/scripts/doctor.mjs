import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJSON = async (name) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const exists = async (name) => {
  try {
    return (await stat(path.join(root, name))).isFile();
  } catch {
    return false;
  }
};
const command = (name, args) => {
  const result = spawnSync(name, args, { encoding: 'utf8', timeout: 10000 });
  return result.status === 0 ? result.stdout.trim() : null;
};

export function inspectConfiguration(config, pkg) {
  const errors = [];
  if (config.webDir !== 'www') errors.push('webDir must be www: stage the complete distribution.');
  if (config.ios?.path !== 'native') errors.push('Native project path must remain native.');
  if (config.server?.hostname !== 'localhost' || config.server?.iosScheme !== 'capacitor')
    errors.push('Preserve the capacitor://localhost origin so existing data remains reachable.');
  if (config.server?.appStartPath !== '/game/index.html')
    errors.push('appStartPath must preserve /game/index.html and sibling asset paths.');
  if (config.server?.url || config.server?.allowNavigation?.length || config.server?.cleartext)
    errors.push('This local-file scaffold does not permit a remote server or broad navigation.');
  if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*){2,}$/.test(config.appId ?? ''))
    errors.push('Use a valid reverse-domain bundle identifier.');
  for (const [group, name] of [
    ['dependencies', '@capacitor/core'],
    ['dependencies', '@capacitor/ios'],
    ['devDependencies', '@capacitor/cli'],
  ])
    if (pkg[group]?.[name] !== '8.5.2') errors.push(`${name} must match reviewed version 8.5.2.`);
  for (const [group, name, version] of [
    ['dependencies', '@capacitor/app', '8.1.1'],
    ['dependencies', '@capacitor/filesystem', '8.1.3'],
    ['dependencies', '@capacitor/share', '8.0.1'],
    ['devDependencies', 'esbuild', '0.28.2'],
  ])
    if (pkg[group]?.[name] !== version)
      errors.push(`${name} must match reviewed version ${version}.`);
  return { valid: errors.length === 0, errors };
}

export async function doctor() {
  const config = await readJSON('capacitor.config.json'),
    pkg = await readJSON('package.json');
  const configuration = inspectConfiguration(config, pkg);
  const developerDirectory = command('xcode-select', ['-p']);
  const xcode = command('xcodebuild', ['-version']);
  const major = Number(xcode?.match(/Xcode (\d+)/)?.[1] ?? 0);
  const project = await readFile(
    path.join(root, 'native/App/App.xcodeproj/project.pbxproj'),
    'utf8',
  ).catch(() => '');
  const report = {
    format: 'revealline-ios-doctor.v1',
    node: process.version,
    nodeSupported: Number(process.versions.node.split('.')[0]) >= 22,
    configuration,
    dependenciesInstalled: await exists('node_modules/@capacitor/cli/bin/capacitor'),
    stagedEntry: await exists('www/game/index.html'),
    stagedManifest: await exists('www/manifest.json'),
    nativeProject: await exists('native/App/App.xcodeproj/project.pbxproj'),
    nativeDeploymentTargets: [
      ...new Set(
        [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map((match) => match[1]),
      ),
    ],
    privacyManifestLinked:
      project.includes('PrivacyInfo.xcprivacy in Resources') &&
      (await exists('native/App/App/PrivacyInfo.xcprivacy')),
    developerDirectory,
    xcode,
    xcodeSupported: major >= 26,
    simulatorTool: command('xcrun', ['--find', 'simctl']),
    nativeRuntimeVerified: false,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!configuration.valid || !report.nodeSupported) process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await doctor();
