/** A ratchet for newly introduced presentation debt; baseline debt stays reviewable. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseJS } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditSource } from './localization-audit.mjs';
import {
  inspectTranslationSource,
  interpolationArguments,
  parseCatalog,
} from './localization-contracts.mjs';
import {
  localizationGit,
  localizationGitBlobs,
  localizationExtraFiles,
  localizationRoots,
  localizationSources,
  isLocalizationSource,
} from './localization-sources.mjs';

const rawKinds = new Set([
  'html',
  'attribute',
  'dom',
  'dom-factory',
  'canvas-or-option',
  'interpolation',
]);
const identity = (item) => JSON.stringify([item.kind, item.text, item.key, item.missing]);
export function addedDiagnostics(before, after) {
  const counts = new Map();
  for (const item of before) counts.set(identity(item), (counts.get(identity(item)) || 0) + 1);
  return after.filter((item) => {
    const key = identity(item),
      count = counts.get(key) || 0;
    if (!count) return true;
    counts.set(key, count - 1);
    return false;
  });
}
export function inspectCopyChanges(before, after, file, oldResources, resources) {
  const previous = inspectTranslationSource(before, file, oldResources);
  const current = inspectTranslationSource(after, file, resources);
  const allowances = new Map();
  const comment = (text, line) => {
    const reason = text.match(/^\s*i18n-allow:\s*(\S.*)$/)?.[1]?.trim();
    if (reason) allowances.set(line, reason);
  };
  if (before === after) {
    // Catalog-only changes still check callers, but cannot add raw source copy.
  } else if (file.endsWith('.html')) {
    const visit = (node) => {
      if (node.nodeName === '#comment') comment(node.data, node.sourceCodeLocation?.endLine);
      node.childNodes?.forEach(visit);
      if (node.content) visit(node.content);
    };
    visit(parseHTML(after, { sourceCodeLocationInfo: true }));
  } else
    parseJS(after, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      onComment: (_block, text, _start, _end, _startLoc, endLoc) => comment(text, endLoc.line),
    });
  const exceptions = [];
  const raw = (
    before === after ? [] : addedDiagnostics(auditSource(before, file), auditSource(after, file))
  )
    .filter((item) => rawKinds.has(item.kind))
    .filter((item) => {
      // A real reasoned comment applies to its own or next source line only.
      const reason = allowances.get(item.line) || allowances.get(item.line - 1);
      if (!reason) return true;
      exceptions.push({ ...item, reason });
      return false;
    });
  const references = (result, catalog) =>
    result.references
      .filter(({ key }) => {
        const [namespace, name] = key.split(':');
        return !catalog.en[namespace]?.[name] && !catalog.en[namespace]?.[`${name}_other`];
      })
      .map((item) => ({ ...item, kind: 'unknown-key', message: `Uncatalogued key: ${item.key}` }));
  return {
    errors: [
      ...raw.map((item) => ({
        ...item,
        message: `New owned display text must use a catalog: ${item.text}`,
      })),
      ...addedDiagnostics(previous.issues, current.issues),
      ...addedDiagnostics(references(previous, oldResources), references(current, resources)),
    ],
    unverified: current.unverified,
    exceptions,
  };
}
async function catalogsAt(directory, ref) {
  const files = (
    await localizationGit(directory, ['ls-tree', '-r', '--name-only', ref, '--', 'game/locales/en'])
  )
    .trim()
    .split('\n')
    .filter((file) => file.endsWith('.json'));
  const en = {};
  const blobs = await localizationGitBlobs(
    directory,
    files.map((file) => `${ref}:${file}`),
  );
  for (const file of files)
    en[path.basename(file, '.json')] = parseCatalog(blobs.get(`${ref}:${file}`), file);
  if (!files.length) throw new Error(`No canonical English catalogs at base ${ref}.`);
  return { en };
}
export function catalogContractsChanged(before, after) {
  for (const [namespace, entries] of Object.entries(before.en))
    for (const key of Object.keys(entries))
      if (!Object.hasOwn(after.en[namespace] || {}, key)) return true;
  for (const [namespace, entries] of Object.entries(after.en))
    for (const [key, text] of Object.entries(entries)) {
      const previous = before.en[namespace]?.[key];
      if (previous === undefined && /_(?:zero|one|two|few|many|other)$/.test(key)) return true;
      if (
        interpolationArguments(previous || '')
          .sort()
          .join('|') !== interpolationArguments(text).sort().join('|')
      )
        return true;
    }
  return false;
}
export async function checkLocalizationChanges(directory, base) {
  if (!base)
    throw new Error(
      'An explicit --base <commit> is required; this command never fetches or changes branches.',
    );
  const ref = (
    await localizationGit(directory, ['rev-parse', '--verify', `${base}^{commit}`])
  ).trim();
  const previousResources = await catalogsAt(directory, ref);
  const resources = { en: {} };
  for (const file of await fs.readdir(path.join(directory, 'game/locales/en'))) {
    if (file.endsWith('.json'))
      resources.en[file.slice(0, -5)] = parseCatalog(
        await fs.readFile(path.join(directory, 'game/locales/en', file), 'utf8'),
        `game/locales/en/${file}`,
      );
  }
  const changed = new Set(
    (await localizationGit(directory, ['diff', '--name-only', '-z', ref, '--'])).split('\0'),
  );
  const untracked = (
    await localizationGit(directory, [
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      ...localizationRoots,
      ...localizationExtraFiles,
    ])
  ).split('\0');
  untracked.forEach((file) => changed.add(file));
  const changedContracts = catalogContractsChanged(previousResources, resources);
  const baseFiles = new Set(
    (
      await localizationGit(directory, [
        'ls-tree',
        '-r',
        '--name-only',
        '-z',
        ref,
        '--',
        ...localizationRoots,
        'scripts',
      ])
    )
      .split('\0')
      .filter(isLocalizationSource),
  );
  const result = { base: ref, files: 0, errors: [], unverified: [], exceptions: [] };
  const sources = (await localizationSources(directory)).filter(
    ({ file }) => changedContracts || changed.has(file),
  );
  const previous = await localizationGitBlobs(
    directory,
    sources
      .filter(({ file }) => changed.has(file) && baseFiles.has(file))
      .map(({ file }) => `${ref}:${file}`),
  );
  for (const { file, read } of sources) {
    const after = await read();
    const before = changed.has(file) ? (previous.get(`${ref}:${file}`) ?? '') : after;
    const report = inspectCopyChanges(before, after, file, previousResources, resources);
    result.files++;
    result.errors.push(...report.errors);
    result.unverified.push(...report.unverified);
    result.exceptions.push(...report.exceptions);
  }
  result.status = result.errors.length
    ? 'failed'
    : result.unverified.length
      ? 'passed-with-manual-review'
      : 'passed';
  result.note =
    'Only new, statically provable issues fail. Dynamic keys/arguments are unverified and require focused runtime evidence; this is not complete translation coverage.';
  return result;
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--base')
    throw new Error('Usage: node scripts/localization-changes.mjs --base <commit>');
  const directory = fileURLToPath(new URL('..', import.meta.url));
  const report = await checkLocalizationChanges(directory, args[1]);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
