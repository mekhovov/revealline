import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const TREE_BYTES = 16 * 1024 * 1024;
const BLOB_BYTES = 4 * 1024 * 1024;
const SETUP_FILES = [
  'package.json',
  'package-lock.json',
  '.npmrc',
  'authoring/fpv-worlds/package.json',
  'authoring/fpv-worlds/package-lock.json',
  'authoring/fpv-worlds/.npmrc',
];
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const safePath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 4096 &&
  !value.startsWith('/') &&
  !/[\u0000-\u001f\u007f\\]/u.test(value) &&
  !value.split('/').some((part) => !part || part === '.' || part === '..');
const gitBlob = (bytes) =>
  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

async function boundedRegularFile(filename) {
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > BLOB_BYTES)
      throw new Error('Configuration must be a bounded regular file.');
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    if (length !== stat.size) throw new Error('Configuration changed during read.');
    return bytes.subarray(0, length);
  } finally {
    await handle.close();
  }
}

// The only checked-out candidate bodies needed here are package/lock/config
// data. Test names and kinds come from exact Git objects, so preflight can use a
// tiny sparse checkout. No candidate script, import or test is executed.
export async function acquireFocusedGitInputs(
  commands,
  root,
  { expectedSource, loadInputs, readShellSemantics, spawn = spawnSync } = {},
) {
  if (
    !sha(expectedSource) ||
    typeof loadInputs !== 'function' ||
    typeof readShellSemantics !== 'function'
  )
    throw new Error('Exact focused source and trusted input readers are required.');
  root = path.resolve(root);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  Object.assign(env, {
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_LAZY_FETCH: '1',
  });
  const git = (args, maxBuffer = BLOB_BYTES) => {
    const result = spawn(
      'git',
      [
        '--no-replace-objects',
        '-C',
        root,
        '-c',
        'core.fsmonitor=false',
        '-c',
        'gc.auto=0',
        ...args,
      ],
      {
        env,
        encoding: null,
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer,
        timeout: 30000,
      },
    );
    if (result.error || result.signal || result.status !== 0 || !Buffer.isBuffer(result.stdout))
      throw new Error('Focused Git source metadata unavailable or outside its bound.');
    return result.stdout;
  };
  const currentHead = () => git(['rev-parse', '--verify', 'HEAD']).toString('utf8').trim();
  if (currentHead() !== expectedSource)
    throw new Error('Focused source HEAD differs from admission.');
  const sourceTree = git(['rev-parse', '--verify', `${expectedSource}^{tree}`])
    .toString('utf8')
    .trim();
  if (!sha(sourceTree)) throw new Error('Invalid focused source tree.');
  const bytes = git(['ls-tree', '-r', '-t', '-z', '--full-tree', expectedSource], TREE_BYTES);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes) || !text.endsWith('\0'))
    throw new Error('Invalid focused Git tree encoding.');
  const records = text.slice(0, -1).split('\0');
  if (records.length > 100000) throw new Error('Focused Git tree exceeds its entry bound.');
  const entries = new Map();
  for (const record of records) {
    const match = /^([0-7]{6}) (blob|tree|commit) ([a-f0-9]{40})\t([\s\S]+)$/u.exec(record);
    if (!match || !safePath(match[4]) || entries.has(match[4]))
      throw new Error('Malformed or duplicate focused Git tree entry.');
    const [, mode, type, object, name] = match;
    if (
      !(
        (type === 'blob' && ['100644', '100755', '120000'].includes(mode)) ||
        (type === 'tree' && mode === '040000') ||
        (type === 'commit' && mode === '160000')
      )
    )
      throw new Error('Unsupported focused Git tree mode.');
    entries.set(name, { mode, type, sha: object, path: name });
  }
  const blobCache = new Map();
  let acquisitionError = null;
  const blob = (entry) => {
    if (entry?.type !== 'blob') throw new Error('Expected a focused Git blob.');
    if (!blobCache.has(entry.sha)) {
      try {
        const body = git(['cat-file', 'blob', entry.sha]);
        if (gitBlob(body) !== entry.sha) throw new Error('Focused Git blob identity mismatch.');
        blobCache.set(entry.sha, body);
      } catch (error) {
        acquisitionError = error;
        throw error;
      }
    }
    return blobCache.get(entry.sha);
  };
  const configurationSnapshot = async () => {
    const result = [];
    for (const name of SETUP_FILES) {
      const entry = entries.get(name);
      if (!entry) {
        try {
          await fs.lstat(path.join(root, name));
          throw new Error(`Untracked focused configuration: ${name}`);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        result.push({ path: name, gitBlob: null });
        continue;
      }
      if (!['100644', '100755'].includes(entry.mode))
        throw new Error(`Focused configuration must be regular: ${name}`);
      const body = await boundedRegularFile(path.join(root, name));
      if (gitBlob(body) !== entry.sha)
        throw new Error(`Focused configuration differs from exact source: ${name}`);
      result.push({ path: name, gitBlob: entry.sha });
    }
    return result;
  };
  const setupFiles = await configurationSnapshot();
  let unsupportedLink = null;
  const resolve = (name, visited = new Set()) => {
    if (name === '.') return { path: '.', mode: '040000', type: 'tree', sha: sourceTree };
    if (!safePath(name)) throw new Error('Invalid virtual source path.');
    const pieces = name.split('/');
    for (let i = 1; i <= pieces.length; i++) {
      const prefix = pieces.slice(0, i).join('/'),
        entry = entries.get(prefix);
      if (!entry)
        throw Object.assign(new Error('Missing virtual source entry.'), { code: 'ENOENT' });
      if (entry.mode === '120000') {
        const targetBytes = blob(entry);
        const target = targetBytes.toString('utf8');
        const destination = path.posix.normalize(
          path.posix.join(path.posix.dirname(prefix), target, ...pieces.slice(i)),
        );
        if (
          !Buffer.from(target).equals(targetBytes) ||
          !target.length ||
          target.startsWith('/') ||
          !safePath(destination) ||
          visited.has(prefix) ||
          visited.size >= 32
        ) {
          unsupportedLink = new Error('Unverifiable outside/cyclic focused source symlink.');
          throw unsupportedLink;
        }
        return resolve(destination, new Set([...visited, prefix]));
      }
      if (i < pieces.length && entry.type !== 'tree')
        throw Object.assign(new Error('Virtual source parent is not a directory.'), {
          code: 'ENOTDIR',
        });
      if (i === pieces.length) return entry;
    }
  };
  const relative = (filename) => {
    const value = path.relative(root, path.resolve(filename)).split(path.sep).join('/');
    if (value === '') return '.';
    if (!safePath(value)) throw new Error('Focused input escaped its source root.');
    return value;
  };
  const shellSemantics = readShellSemantics(root);
  if (![null, 'posix'].includes(shellSemantics))
    throw new Error('Unknown focused shell semantics.');
  const inputs = await loadInputs(commands, root, {
    shellSemantics,
    readFile: async (filename, encoding) => {
      const name = relative(filename);
      if (name !== 'package.json') throw new Error('Unexpected focused source body read.');
      const bytes = blob(resolve(name));
      return encoding ? bytes.toString(encoding) : bytes;
    },
    statPath: async (filename) => {
      const entry = resolve(relative(filename));
      return { isFile: () => ['100644', '100755'].includes(entry.mode) };
    },
    readDirectory: async (filename) => {
      const directory = resolve(relative(filename));
      if (directory.type !== 'tree') throw new Error('Focused glob parent is not a directory.');
      return [...entries.values()]
        .filter((entry) => path.posix.dirname(entry.path) === directory.path)
        .map((entry) => ({
          name: path.posix.basename(entry.path),
          isFile: () => ['100644', '100755'].includes(entry.mode),
          isSymbolicLink: () => entry.mode === '120000',
        }));
    },
  });
  if (acquisitionError) throw acquisitionError;
  if (unsupportedLink) throw unsupportedLink;
  if (currentHead() !== expectedSource)
    throw new Error('Focused source HEAD changed during planning.');
  if (JSON.stringify(await configurationSnapshot()) !== JSON.stringify(setupFiles))
    throw new Error('Focused setup configuration changed during planning.');
  return {
    sourceRevision: expectedSource,
    sourceTree,
    // A changed test absent from the admitted Git tree was deleted (or renamed
    // away). Files absent only from a sparse/dirty checkout must still run.
    deletedTests: commands
      .flatMap((command) => {
        const name = command.args?.[1];
        return command.command === 'node' &&
          command.args.length === 2 &&
          command.args[0] === '--test' &&
          command.id === `changed-test:${name}` &&
          !entries.has(name)
          ? [name]
          : [];
      })
      .sort(),
    setupFiles,
    inputs: { ...inputs, repositoryFiles: [...inputs.repositoryFiles].sort() },
  };
}
