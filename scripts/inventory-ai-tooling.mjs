#!/usr/bin/env node
/** Produce the tracked AI-authoring and automation inventory used by DeepWiki. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'docs/deepwiki/ai-tooling.json');
const supportedExtensions = new Set(['.mjs', '.py', '.sh']);
const supportedToolingExtensions = new Set(['.mjs', '.js', '.py']);

async function filesAt(relative, predicate = () => true) {
  const absolute = path.join(ROOT, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await filesAt(child, predicate)));
    else if (entry.isFile() && predicate(child)) files.push(child);
  }
  return files;
}

async function packageScripts(relative) {
  const manifest = JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));
  return Object.entries(manifest.scripts ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, command]) => ({ path: relative, name, command }));
}

const paths = {
  skills: await Promise.all([
    filesAt('authoring/skills', (file) => file.endsWith('/SKILL.md')),
    filesAt('.cursor/skills', (file) => file.endsWith('/SKILL.md')),
  ]).then((groups) => groups.flat().sort()),
  skillFiles: await Promise.all([filesAt('authoring/skills'), filesAt('.cursor/skills')]).then(
    (groups) => groups.flat().sort(),
  ),
  promptCatalogs: await filesAt('authoring/prompts', (file) => file.endsWith('.json')),
  toolingModules: (
    await Promise.all([
      filesAt('authoring', (file) => supportedToolingExtensions.has(path.extname(file))),
      filesAt('game', (file) => supportedToolingExtensions.has(path.extname(file))),
    ])
  )
    .flat()
    .filter((file) => /(?:helper|tool|prompt)/i.test(path.posix.basename(file)))
    .sort(),
  automationScripts: await filesAt('scripts', (file) =>
    supportedExtensions.has(path.extname(file)),
  ),
  workflows: await filesAt('.github/workflows', (file) => /\.ya?ml$/.test(file)),
  packageScripts: (
    await Promise.all(
      [
        'package.json',
        'services/community/package.json',
        'platforms/desktop/package.json',
        'platforms/ios/package.json',
        'authoring/fpv-worlds/package.json',
      ].map(packageScripts),
    )
  ).flat(),
};

const inventory = {
  format: 'revealline-ai-tooling-inventory.v1',
  scope:
    'Tracked repository-local skills and support files, prompt catalogs, helper/tool/prompt modules, automation scripts, workflow definitions, and package commands. Per-user or plugin-installed skills outside this repository are intentionally excluded.',
  generatedBy: 'scripts/inventory-ai-tooling.mjs',
  counts: Object.fromEntries(
    Object.entries(paths).map(([kind, entries]) => [kind, entries.length]),
  ),
  paths,
};

await writeFile(OUTPUT, `${JSON.stringify(inventory, null, 2)}\n`);
