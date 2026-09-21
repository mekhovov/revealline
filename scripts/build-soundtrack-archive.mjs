#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { inspectMP3 } from '../game/mp3.mjs';
import { resolveSoundtrackCatalogue, soundtrackRights } from '../game/soundtrack.mjs';
import {
  SOUNDTRACK_ARCHIVE_FORMAT,
  SOUNDTRACK_ARCHIVE_LIMITS,
  resolveSoundtrackArchives,
  resolveSoundtrackArchiveInventory,
} from '../game/soundtrack-archive.mjs';
import { compilePublishedSoundtracks } from './soundtrack-distribution.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const RESERVE_BYTES = 1024 ** 3;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const markdown = (value) =>
  String(value)
    .replace(/[\\`*_{}\[\]<>#|]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ');
const link = (label, value) => {
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol))
      return `[${markdown(label)}](${url.href.replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'))})`;
  } catch {
    /* Non-URL provenance remains plain text. */
  }
  return markdown(value || label);
};

export function assertSoundtrackArchiveBudget({ files, bytes, freeBytes }) {
  required(
    Number.isSafeInteger(files) && files > 0 && files <= SOUNDTRACK_ARCHIVE_LIMITS.files,
    'Archive requires 1–512 unique approved recordings.',
  );
  required(
    Number.isSafeInteger(bytes) && bytes > 0 && bytes <= SOUNDTRACK_ARCHIVE_LIMITS.bytes,
    'Archive payload exceeds 800 MB.',
  );
  required(
    typeof freeBytes === 'bigint' && freeBytes >= BigInt(bytes + RESERVE_BYTES),
    'Archive staging must leave at least 1 GiB free.',
  );
}

async function availableBytes(root) {
  const stat = await fs.statfs(root, { bigint: true });
  return stat.bavail * stat.bsize;
}

async function checkOutput(root, outputDirectory) {
  const output = path.resolve(root, outputDirectory),
    relative = path.relative(root, output);
  required(
    relative.startsWith(`.cache${path.sep}`) && relative.length <= 512,
    'Archive output must be a fresh directory inside the source .cache.',
  );
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
    required(
      !stat.isSymbolicLink() && stat.isDirectory(),
      'Archive output cannot cross symbolic links or files.',
    );
    required(current !== output, 'Archive output already exists; choose a fresh directory.');
  }
  return output;
}

async function makeParents(root, output) {
  let current = root;
  for (const part of path.relative(root, path.dirname(output)).split(path.sep)) {
    current = path.join(current, part);
    try {
      await fs.mkdir(current);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const stat = await fs.lstat(current);
    required(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Archive output parent must be an ordinary directory.',
    );
  }
}

function credits(catalogue, archive) {
  return Buffer.from(
    [
      '# RevealLine soundtrack archive',
      '',
      'Staged repository payload. This command has not created a repository or published these files. The intended links work only after a separate approved deployment.',
      '',
      `Archive: ${markdown(archive.id)}. Edition: ${markdown(catalogue.edition)}.`,
      '',
      'Only exact recordings admitted by the source publication compiler are included. Review evidence stays in the source project. A licence grant does not imply endorsement or Content ID clearance.',
      '',
      '## Recording credits and MP3 downloads',
      '',
      ...catalogue.tracks.flatMap((track) => [
        `### ${markdown(track.title)} — ${markdown(track.artist)}`,
        '',
        `Credit: ${markdown(track.rights.credit)}`,
        '',
        `Licence: ${markdown(track.rights.license || 'Original recording; permission recorded in the source publication review')}. Source: ${link('Recording source', track.rights.source)}.`,
        '',
        ...(track.websites ?? []).map((website) => `${link(website.label, website.url)}  `),
        '',
        `${link('Download exact MP3', new URL(track.path, archive.baseURL).href)} (${track.asset.bytes} bytes). SHA-256: \`${track.asset.sha256}\`.`,
        '',
        `Track ID: \`${track.id}\`. Audio bytes are copied unchanged from the approved delivery file; any earlier source-to-MP3 conversion remains described in the credit/source evidence.`,
        '',
      ]),
      '## Deployment and game admission',
      '',
      'Preserve inventory.json, its exact hash, and every objects/<sha256>.mp3 path. archive-candidate.json is a reproducible review artifact for a later code-owned catalogue change; it is not automatically trusted or imported by the game. Do not add pending, personal-only, or restricted recordings.',
      '',
    ].join('\n'),
  );
}

/** Only the trusted publication compiler supplies audio. No network, approval
 * mutation, source catalogue rewrite, repository creation, or deployment. */
export async function buildSoundtrackArchive({
  root = projectRoot,
  archiveId,
  baseURL,
  outputDirectory,
} = {}) {
  required(
    typeof root === 'string' && typeof outputDirectory === 'string' && outputDirectory,
    'Supply a source root and fresh .cache output directory.',
  );
  const sourceRoot = await fs.realpath(root),
    output = await checkOutput(sourceRoot, outputDirectory),
    provisional = resolveSoundtrackArchives([
      { id: archiveId, baseURL, inventorySha256: '0'.repeat(64) },
    ])[0],
    built = await compilePublishedSoundtracks(sourceRoot, { delivery: 'source' }),
    sourceCatalogue = resolveSoundtrackCatalogue(built.catalogue);
  required(Array.isArray(built.files), 'Publication compiler did not return a file inventory.');
  const sourceFiles = new Map();
  for (const file of built.files) {
    required(
      file && typeof file.name === 'string' && Buffer.isBuffer(file.bytes),
      'Compiled archive source must contain exact byte buffers.',
    );
    const previous = sourceFiles.get(file.name);
    required(!previous || previous.equals(file.bytes), 'Conflicting compiled audio paths.');
    sourceFiles.set(file.name, file.bytes);
  }
  const objects = new Map(),
    used = new Set(),
    verified = new Map();
  for (const track of sourceCatalogue.tracks) {
    const rights = soundtrackRights(track, { catalogue: sourceCatalogue });
    required(
      track.policy && rights.redistribute === 'allowed' && rights.webPlayback === 'allowed',
      'Archive requires explicit redistribution and web-playback permission for every recording.',
    );
    const bytes = sourceFiles.get(track.path);
    required(
      bytes && bytes.length === track.asset.bytes && hash(bytes) === track.asset.sha256,
      'Archive recording differs from its approved byte/hash pin.',
    );
    let facts = verified.get(track.asset.sha256);
    if (!facts) {
      facts = await inspectMP3(new Blob([bytes]));
      verified.set(track.asset.sha256, facts);
    }
    required(
      canonicalJSON(facts) === canonicalJSON(track.asset),
      'Archive MP3 structure differs from its approved metadata.',
    );
    used.add(track.path);
    objects.set(`objects/${track.asset.sha256}.mp3`, bytes);
  }
  required(used.size === sourceFiles.size, 'Publication compiler returned unapproved extra audio.');
  if (sourceCatalogue.tracks.length === 0)
    return {
      status: 'empty',
      approvedTracks: 0,
      files: 0,
      outputDirectory: null,
      message: 'No approved redistributable recordings; no archive output created.',
    };
  const entries = [...objects].sort(([a], [b]) => lexical(a, b)),
    inventory = resolveSoundtrackArchiveInventory(
      {
        format: SOUNDTRACK_ARCHIVE_FORMAT,
        id: provisional.id,
        files: entries.map(([name, bytes]) => ({
          path: name,
          bytes: bytes.length,
          sha256: hash(bytes),
        })),
      },
      provisional,
    ),
    inventoryBytes = json(inventory),
    archive = resolveSoundtrackArchives([
      { ...provisional, inventorySha256: hash(inventoryBytes) },
    ])[0];
  required(
    inventoryBytes.length <= SOUNDTRACK_ARCHIVE_LIMITS.inventoryBytes,
    'Archive inventory exceeds its runtime bound.',
  );
  const catalogue = resolveSoundtrackCatalogue({
      ...sourceCatalogue,
      tracks: [...sourceCatalogue.tracks]
        .sort((a, b) => lexical(a.id, b.id))
        .map((track) => ({
          ...track,
          archiveId: archive.id,
          path: `objects/${track.asset.sha256}.mp3`,
        })),
    }),
    readme = credits(catalogue, archive),
    candidate = {
      format: 'revealline-soundtrack-archive-candidate.v1',
      status: 'staged-unpublished',
      sourceCatalogueSha256: hash(Buffer.from(canonicalJSON(sourceCatalogue))),
      archive,
      catalogue,
      payload: [
        ...inventory.files,
        { path: 'inventory.json', bytes: inventoryBytes.length, sha256: hash(inventoryBytes) },
        { path: 'README.md', bytes: readme.length, sha256: hash(readme) },
        { path: '.nojekyll', bytes: 0, sha256: hash(Buffer.alloc(0)) },
      ].sort((a, b) => lexical(a.path, b.path)),
    },
    candidateBytes = json(candidate),
    payload = [
      ...entries,
      ['inventory.json', inventoryBytes],
      ['README.md', readme],
      ['archive-candidate.json', candidateBytes],
      ['.nojekyll', Buffer.alloc(0)],
    ],
    totalBytes = payload.reduce((sum, [, bytes]) => sum + bytes.length, 0);
  assertSoundtrackArchiveBudget({
    files: objects.size,
    bytes: totalBytes,
    freeBytes: await availableBytes(sourceRoot),
  });
  // Recheck after compilation before creating anything: output is never replaced.
  await checkOutput(sourceRoot, output);
  await makeParents(sourceRoot, output);
  await fs.mkdir(output);
  try {
    await fs.mkdir(path.join(output, 'objects'));
    for (const [name, bytes] of payload) {
      required(
        (await availableBytes(sourceRoot)) >= BigInt(bytes.length + RESERVE_BYTES),
        'Archive staging must leave at least 1 GiB free.',
      );
      const target = path.join(output, name);
      await fs.writeFile(target, bytes, { flag: 'wx' });
      const written = await fs.readFile(target);
      required(
        written.length === bytes.length && hash(written) === hash(bytes),
        'Staged archive differs from its approved bytes.',
      );
    }
    required(
      (await availableBytes(sourceRoot)) >= BigInt(RESERVE_BYTES),
      'Archive staging must leave at least 1 GiB free.',
    );
  } catch (error) {
    await fs.rm(output, { recursive: true, force: true });
    throw error;
  }
  return {
    status: 'staged',
    approvedTracks: catalogue.tracks.length,
    files: objects.size,
    bytes: totalBytes,
    outputDirectory: output,
    archive,
    candidate: {
      path: 'archive-candidate.json',
      bytes: candidateBytes.length,
      sha256: hash(candidateBytes),
    },
  };
}

const HELP = `Usage: node scripts/build-soundtrack-archive.mjs --archive-id ID --base-url URL --out .cache/FRESH_DIRECTORY [--root SOURCE]\n\nStages only reviewed redistributable MP3s from the publication compiler.\nURL must be https://mekhovov.github.io/revealline-soundtracks-<digits>/.\nFresh .cache output only; no overwrite; 800 MB/512 objects; leaves 1 GiB free.\nZero approved recordings creates no output. Does not create or publish a repository.\n`;
async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(HELP);
    return;
  }
  const flags = {
      '--archive-id': 'archiveId',
      '--base-url': 'baseURL',
      '--out': 'outputDirectory',
      '--root': 'root',
    },
    options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = Object.hasOwn(flags, args[i]) ? flags[args[i]] : null;
    required(
      key && args[i + 1] && !args[i + 1].startsWith('--') && !Object.hasOwn(options, key),
      'Unknown, duplicate or missing option. Use --help.',
    );
    options[key] = args[i + 1];
  }
  process.stdout.write(JSON.stringify(await buildSoundtrackArchive(options), null, 2) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
