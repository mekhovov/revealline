#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
try {
  git('fetch', 'origin', 'main');
  const main = git('rev-parse', 'origin/main');
  if (git('merge-base', 'HEAD', main) !== main)
    throw new Error(
      `Localization is behind origin/main (${main.slice(0, 12)}). Preserve current edits and rebase onto origin/main, then extract and translate new text before checking again.`,
    );
  console.log(`Localization includes latest main: ${main}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
