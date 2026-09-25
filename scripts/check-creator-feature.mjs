#!/usr/bin/env node
/** Run the complete local creator/community acceptance cohort from one command. */
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testRoot = path.join(root, 'game', 'test');
const options = new Set(process.argv.slice(2));
const allowedOptions = new Set(['--help', '--runtime-only', '--service-only']);
for (const option of options) {
  if (!allowedOptions.has(option)) throw new Error(`Unknown creator acceptance option: ${option}`);
}
if (options.has('--runtime-only') && options.has('--service-only'))
  throw new Error('Choose at most one of --runtime-only and --service-only.');
if (options.has('--help')) {
  console.log(`Usage: npm run test:creator-feature -- [--runtime-only | --service-only]

Runs the complete browser/runtime creator cohort followed by the community service suite.`);
  process.exit(0);
}
const exactRootTests = new Set([
  'flight-media-pins.test.mjs',
  'mediabunny-trim-adapter.test.mjs',
  'mission-library-custom-source.test.mjs',
  'mission-library-metadata-custom-source.test.mjs',
  'mission-library-team-source.test.mjs',
  'practice-media-v3-host.test.mjs',
  'profile-shared-media.test.mjs',
  'still-workshop-build.test.mjs',
  'story-media-store.test.mjs',
  'team-installed-campaigns.test.mjs',
  'team-installed-host.test.mjs',
  'team-media-campaign.test.mjs',
]);
const rootTestPrefixes = [
  'community-',
  'creator-',
  'managed-media-',
  'media-',
  'still-media-',
  'video-',
];

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} stopped after ${signal}.`));
      else if (code !== 0) reject(new Error(`${command} exited with code ${code}.`));
      else resolve();
    });
  });
}

const files = (await readdir(testRoot))
  .filter(
    (name) =>
      name.endsWith('.test.mjs') &&
      (exactRootTests.has(name) || rootTestPrefixes.some((prefix) => name.startsWith(prefix))),
  )
  .sort();

for (const required of exactRootTests) {
  if (!files.includes(required)) throw new Error(`Creator acceptance test is missing: ${required}`);
}
if (files.length < 20)
  throw new Error(`Creator acceptance discovery is unexpectedly small: ${files.length}`);

if (!options.has('--service-only')) {
  console.log(`Running ${files.length} browser/runtime creator acceptance files.`);
  await run(process.execPath, ['--test', ...files.map((name) => path.join(testRoot, name))], root);
}
if (!options.has('--runtime-only')) {
  console.log('Running the self-hosted community service acceptance suite.');
  await run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['test'],
    path.join(root, 'services', 'community'),
  );
}
