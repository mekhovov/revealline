import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const launcherFile = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(launcherFile), '..');
const ARCHIVE_VALUE_OPTIONS = new Set([
  '--source',
  '--license',
  '--artist',
  '--styles',
  '--batch-id',
  '--batch-title',
  '--description',
  '--rights-evidence',
  '--attribution',
  '--title',
  '--derivative-notice',
]);
const PRIVATE_UNSUPPORTED_VALUE_OPTIONS = new Set(
  [...ARCHIVE_VALUE_OPTIONS].filter((option) => option !== '--license'),
);
const PRIVATE_UNSUPPORTED_FLAGS = new Set(['--confirm-rights', '--open-pr']);

export const LAUNCHER_USAGE = `Usage from the RevealLine game repository:
  node intake/add-music.mjs <mp3-or-folder> [archive intake options]
    [--archive-root /path/to/revealline-soundtracks-02]

Private unknown-rights UA-FPV intake:
  node intake/add-music.mjs <folder> --license unknown
    --private-output /path/to/new-empty-private-directory

The launcher forwards the request to a clean RevealLine Soundtracks 02 checkout.
Set REVEALLINE_SOUNDTRACK_ARCHIVE or pass --archive-root when it is not in a
standard location. Run the archive command with --help for all intake options.

Public intake requires recording-specific redistribution and web-game playback
rights. A YouTube page alone is not permission. --license unknown builds private
local UA-FPV .rlsound packs and never writes to the public archive. See
docs/ua-fpv-upload-guide.md.`;

export function splitLauncherArguments(argv) {
  const forwarded = [];
  let archiveRoot = '',
    privateOutput = '';
  let archiveRootCount = 0,
    privateOutputCount = 0;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--archive-root') {
      archiveRootCount += 1;
      if (archiveRootCount > 1) throw new Error('--archive-root may be provided only once.');
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--archive-root requires a directory path.');
      }
      archiveRoot = next;
      index += 1;
    } else if (value.startsWith('--archive-root=')) {
      archiveRootCount += 1;
      if (archiveRootCount > 1) throw new Error('--archive-root may be provided only once.');
      archiveRoot = value.slice('--archive-root='.length);
      if (!archiveRoot) throw new Error('--archive-root requires a directory path.');
    } else if (value === '--private-output') {
      privateOutputCount += 1;
      if (privateOutputCount > 1) throw new Error('--private-output may be provided only once.');
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--private-output requires a directory path.');
      }
      privateOutput = next;
      index += 1;
    } else if (value.startsWith('--private-output=')) {
      privateOutputCount += 1;
      if (privateOutputCount > 1) throw new Error('--private-output may be provided only once.');
      privateOutput = value.slice('--private-output='.length);
      if (!privateOutput) throw new Error('--private-output requires a directory path.');
    } else {
      forwarded.push(value);
    }
  }
  return { archiveRoot, privateOutput, forwarded };
}

function licenseValues(argv) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--license') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error('--license requires a value.');
      values.push(next);
      index += 1;
    } else if (value.startsWith('--license=')) {
      const license = value.slice('--license='.length);
      if (!license) throw new Error('--license requires a value.');
      values.push(license);
    } else if (ARCHIVE_VALUE_OPTIONS.has(value)) {
      index += 1;
    }
  }
  return values;
}

function privateUnknownInput(argv, currentDirectory) {
  const inputs = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--license') {
      index += 1;
    } else if (value.startsWith('--license=')) {
      continue;
    } else if (PRIVATE_UNSUPPORTED_VALUE_OPTIONS.has(value)) {
      throw new Error(`${value} is not used with private --license unknown intake.`);
    } else if (
      [...PRIVATE_UNSUPPORTED_VALUE_OPTIONS].some((option) => value.startsWith(`${option}=`))
    ) {
      const option = value.slice(0, value.indexOf('='));
      throw new Error(`${option} is not used with private --license unknown intake.`);
    } else if (PRIVATE_UNSUPPORTED_FLAGS.has(value)) {
      throw new Error(
        `${value} cannot be used with --license unknown because unknown-rights intake is private-only.`,
      );
    } else if (value.startsWith('-')) {
      throw new Error(`Unsupported private intake option: ${value}`);
    } else {
      inputs.push(value);
    }
  }
  if (inputs.length !== 1) {
    throw new Error('--license unknown requires exactly one source folder.');
  }
  return path.resolve(currentDirectory, inputs[0]);
}

async function isArchiveRoot(candidate) {
  if (!candidate) return false;
  const root = path.resolve(candidate);
  const script = path.join(root, 'intake', 'add-music.mjs');
  if (script === launcherFile) return false;
  try {
    await access(script);
    return true;
  } catch {
    return false;
  }
}

export async function findArchiveRoot({
  explicitRoot = '',
  environment = process.env,
  homeDirectory = os.homedir(),
  repositoryRoot = gameRoot,
} = {}) {
  if (explicitRoot) {
    if (await isArchiveRoot(explicitRoot)) return path.resolve(explicitRoot);
    throw new Error(
      `The explicit --archive-root is not a RevealLine Soundtracks 02 checkout: ${explicitRoot}`,
    );
  }
  const candidates = [
    environment.REVEALLINE_SOUNDTRACK_ARCHIVE,
    path.resolve(repositoryRoot, '..', 'revealline-soundtracks-02'),
    path.join(homeDirectory, '.codex', 'worktrees', 'revealline-soundtracks-02'),
  ];
  for (const candidate of candidates) {
    if (await isArchiveRoot(candidate)) return path.resolve(candidate);
  }
  return null;
}

export function resolveForwardedInput(argv, currentDirectory = process.cwd()) {
  const resolved = [];
  let foundInput = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    resolved.push(value);
    if (ARCHIVE_VALUE_OPTIONS.has(value)) {
      if (index + 1 < argv.length) resolved.push(argv[++index]);
    } else if (!value.startsWith('-') && !foundInput) {
      resolved[resolved.length - 1] = path.resolve(currentDirectory, value);
      foundInput = true;
    }
  }
  return resolved;
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Archive intake stopped by ${signal}.`));
      else resolve(code ?? 1);
    });
  });
}

export async function launchMusicIntake(argv, dependencies = {}) {
  const {
    archiveRoot: explicitRoot,
    privateOutput,
    forwarded: rawForwarded,
  } = splitLauncherArguments(argv);
  const currentDirectory = dependencies.currentDirectory ?? process.cwd();
  const runner = dependencies.run ?? run;
  const licenses = licenseValues(rawForwarded);
  if (licenses.length > 1) throw new Error('--license may be provided only once.');
  if (licenses[0] === 'unknown') {
    if (!privateOutput) {
      throw new Error('--license unknown requires --private-output with a new empty directory.');
    }
    if (explicitRoot) {
      throw new Error('--archive-root is not used with private --license unknown intake.');
    }
    const input = privateUnknownInput(rawForwarded, currentDirectory);
    const output = path.resolve(currentDirectory, privateOutput);
    const script = path.join(gameRoot, 'scripts', 'ua-fpv-local-pack.mjs');
    console.log('Unknown licence selected: building private local UA-FPV packs only.');
    console.log(`Private output directory: ${output}`);
    return runner(process.execPath, [script, '--source-dir', input, '--output-dir', output], {
      cwd: gameRoot,
      stdio: 'inherit',
    });
  }
  if (privateOutput) {
    throw new Error('--private-output is supported only with --license unknown.');
  }
  const forwarded = resolveForwardedInput(rawForwarded, currentDirectory);
  const archiveRoot = await findArchiveRoot({
    explicitRoot,
    environment: dependencies.environment,
    homeDirectory: dependencies.homeDirectory,
    repositoryRoot: dependencies.repositoryRoot,
  });
  if (!archiveRoot) {
    if (forwarded.length === 1 && ['--help', '-h'].includes(forwarded[0])) {
      console.log(LAUNCHER_USAGE);
      return 0;
    }
    throw new Error(
      'RevealLine Soundtracks 02 was not found. Clone ' +
        'https://github.com/mekhovov/revealline-soundtracks-02.git and pass ' +
        '--archive-root /path/to/revealline-soundtracks-02.',
    );
  }
  const script = path.join(archiveRoot, 'intake', 'add-music.mjs');
  console.log(`Using soundtrack archive checkout: ${archiveRoot}`);
  return runner(process.execPath, [script, ...forwarded], {
    cwd: archiveRoot,
    stdio: 'inherit',
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === launcherFile) {
  try {
    process.exitCode = await launchMusicIntake(process.argv.slice(2));
  } catch (error) {
    console.error(`Soundtrack intake launcher failed: ${error.message}`);
    console.error('Run with --help for setup instructions.');
    process.exitCode = 1;
  }
}
