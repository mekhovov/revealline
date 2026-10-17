/** Maintained presentation sources. Historical archives and authored media/data are not UI. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const localizationRoots = ['game', 'site', 'authoring', 'optional-practice', 'platforms'];
export const localizationExtraFiles = [
  'scripts/game-cli.mjs',
  'scripts/pages-current-entry.mjs',
  'scripts/produce-field-kit-sprites.mjs',
  'scripts/release-catalog.mjs',
];
const extraFiles = new Set(localizationExtraFiles);
const librarySurfaces = [
  'authoring/library/fpv-enemy-presentations/',
  'authoring/library/fpv-role-presentations/',
  'authoring/library/fpv-field-kit/prepared/reveals/',
  'authoring/library/fpv-field-kit/prepared/titles/',
];
const excludedParts = new Set([
  'vendor',
  'node_modules',
  'test',
  'tests',
  'assets',
  'fonts',
  'art',
  'dist',
  'out',
  'releases',
  'archives',
  'source-originals',
  'provenance',
]);
export function isLocalizationSource(file) {
  if (extraFiles.has(file)) return true;
  if (!/\.(?:mjs|js|html)$/.test(file) || /(?:^|\/)(?:test(?:-|\.)|.*\.test\.)/.test(file))
    return false;
  if (!localizationRoots.some((root) => file.startsWith(`${root}/`))) return false;
  if (file.split('/').some((part) => excludedParts.has(part))) return false;
  if (/^game\/(?:i18n|locales|library)\//.test(file)) return false;
  if (/^platforms\/(?:desktop\/(?:site|out)|ios\/(?:www|native|bridge\/dist))\//.test(file))
    return false;
  if (file.startsWith('authoring/library/')) {
    if (!librarySurfaces.some((prefix) => file.startsWith(prefix))) return false;
    // Registration/build scripts carry provenance and source text, not live UI.
    if (/(?:^|\/)(?:build|verify|render-previews|sources|review-sources)\.mjs$/.test(file))
      return false;
  }
  return true;
}
export async function localizationGit(directory, args) {
  const { stdout } = await exec('git', args, {
    cwd: directory,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}
/** Read only requested blobs in one process; no archive or worktree files are written. */
export async function localizationGitBlobs(directory, references) {
  const refs = [...new Set(references)];
  if (!refs.length) return new Map();
  if (refs.some((ref) => ref.includes('\0'))) throw new Error('Invalid Git blob reference.');
  const output = await new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch', '-z'], {
      cwd: directory,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks = [];
    let size = 0,
      failure = '';
    child.on('error', reject);
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > 128 * 1024 * 1024) {
        child.kill();
        reject(
          new Error(
            'Localization source batch exceeded 128 MiB; narrow maintained source coverage.',
          ),
        );
      } else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (failure.length < 65536) failure += chunk.toString();
    });
    child.stdin.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(`Git source batch failed (${code}): ${failure.trim()}`)),
    );
    child.stdin.end(`${refs.join('\0')}\0`);
  });
  const blobs = new Map();
  let offset = 0;
  for (const ref of refs) {
    const end = output.indexOf(10, offset);
    const header = end < 0 ? '' : output.toString('utf8', offset, end);
    const match = header.match(/^[a-f0-9]+ blob (\d+)$/);
    if (!match)
      throw new Error(`Cannot read localization source ${ref}: ${header || 'truncated batch'}`);
    const size = Number(match[1]);
    offset = end + 1;
    if (output[offset + size] !== 10) throw new Error(`Truncated localization source ${ref}.`);
    blobs.set(ref, output.toString('utf8', offset, offset + size));
    offset += size + 1;
  }
  return blobs;
}
/** Index fallback applies only to skip-worktree entries: a local deletion never resurrects. */
export async function localizationSources(directory) {
  const files = new Map();
  const sorted = () =>
    [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, read]) => ({ file, read }));
  let gitRoot;
  try {
    gitRoot = (await localizationGit(directory, ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    /* Small fixtures need no Git repository. */
  }
  if (gitRoot && (await fs.realpath(gitRoot)) === (await fs.realpath(directory))) {
    // Git supplies the inventory without walking large media/content trees.
    const tracked = await localizationGit(directory, [
      'ls-files',
      '-t',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...localizationRoots,
      ...extraFiles,
    ]);
    const sparse = [];
    for (const entry of tracked.split('\0')) {
      const file = entry.slice(2);
      if (!isLocalizationSource(file)) continue;
      try {
        const stat = await fs.lstat(path.join(directory, file));
        if (stat.isFile()) files.set(file, () => fs.readFile(path.join(directory, file), 'utf8'));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (entry.startsWith('S ')) sparse.push(file);
      }
    }
    let sparseBlobs;
    for (const file of sparse)
      files.set(file, async () => {
        sparseBlobs ||= localizationGitBlobs(
          directory,
          sparse.map((entry) => `:${entry}`),
        );
        return (await sparseBlobs).get(`:${file}`);
      });
    return sorted();
  }
  const walk = async (relative) => {
    let entries;
    try {
      entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const file = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (
          !excludedParts.has(entry.name) &&
          !/^game\/(?:i18n|locales|library)$/.test(file) &&
          !/^platforms\/(?:desktop\/(?:site|out)|ios\/(?:www|native|bridge\/dist))$/.test(file) &&
          (!file.startsWith('authoring/library/') ||
            librarySurfaces.some(
              (prefix) => prefix.startsWith(`${file}/`) || file.startsWith(prefix),
            ))
        )
          await walk(file);
      } else if (isLocalizationSource(file))
        files.set(file, () => fs.readFile(path.join(directory, file), 'utf8'));
    }
  };
  for (const root of localizationRoots) await walk(root);
  for (const file of extraFiles) {
    try {
      await fs.access(path.join(directory, file));
      files.set(file, () => fs.readFile(path.join(directory, file), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return sorted();
}
