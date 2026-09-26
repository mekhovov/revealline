import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const launcherFile = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(launcherFile), '..');

export const LAUNCHER_USAGE = `Usage from the RevealLine game repository:
  node intake/add-music.mjs <mp3-or-folder> [archive intake options]
    [--archive-root /path/to/revealline-soundtracks-02]

The launcher forwards the request to a clean RevealLine Soundtracks 02 checkout.
Set REVEALLINE_SOUNDTRACK_ARCHIVE or pass --archive-root when it is not in a
standard location. Run the archive command with --help for all intake options.

Public intake requires recording-specific redistribution and web-game playback
rights. A YouTube page alone is not permission. Unknown-rights MP3s should use
the private UA-FPV pack workflow described in docs/ua-fpv-upload-guide.md.`;

export function splitLauncherArguments(argv) {
  const forwarded = [];
  let archiveRoot = '';
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--archive-root') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--archive-root requires a directory path.');
      }
      archiveRoot = next;
      index += 1;
    } else if (value.startsWith('--archive-root=')) {
      archiveRoot = value.slice('--archive-root='.length);
      if (!archiveRoot) throw new Error('--archive-root requires a directory path.');
    } else {
      forwarded.push(value);
    }
  }
  return { archiveRoot, forwarded };
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
  const candidates = [
    explicitRoot,
    environment.REVEALLINE_SOUNDTRACK_ARCHIVE,
    path.resolve(repositoryRoot, '..', 'revealline-soundtracks-02'),
    path.join(homeDirectory, '.codex', 'worktrees', 'revealline-soundtracks-02'),
  ];
  for (const candidate of candidates) {
    if (await isArchiveRoot(candidate)) return path.resolve(candidate);
  }
  return null;
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
  const { archiveRoot: explicitRoot, forwarded } = splitLauncherArguments(argv);
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
  const runner = dependencies.run ?? run;
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
