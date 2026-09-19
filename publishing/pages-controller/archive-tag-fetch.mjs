/** Read-only archive preflight: every locked release needs its exact local tag ref. */
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const LIMIT = 1024 * 1024;

function directBlock(lines, start, end, key, indent) {
  const properties = [];
  for (let index = start; index < end; index++) {
    if (new RegExp(`^ {${indent}}${key}:`).test(lines[index])) properties.push(index);
  }
  if (properties.length !== 1 || lines[properties[0]].trim() !== `${key}:`)
    throw new Error(`Use the explicit archive jobs/build/steps template (${key}).`);
  const first = properties[0] + 1;
  let last = first;
  for (; last < end; last++) {
    const line = lines[last];
    if (line.trim() && !line.trimStart().startsWith('#') && line.search(/\S/) <= indent) break;
  }
  return [first, last];
}

export function checkArchiveTagFetch(lock, workflow) {
  if (
    lock?.format !== 'revealline-archive-originals.v2' ||
    !Array.isArray(lock.releases) ||
    !lock.releases.length ||
    lock.releases.length > 1024 ||
    typeof workflow !== 'string' ||
    Buffer.byteLength(workflow) > LIMIT
  )
    throw new Error('Expected a bounded archive originals v2 source lock and workflow.');
  const required = lock.releases.map((release) => release?.version);
  if (
    required.some((version) => !VERSION.test(version)) ||
    new Set(required).size !== required.length
  )
    throw new Error('Source lock contains invalid or duplicate release versions.');

  // Deliberately support the archive template's explicit one-line steps only.
  // Comments, shell expressions, multiline scripts and conditional steps cannot
  // establish coverage. This checks declared refs, not successful hosted execution.
  const fetched = new Set();
  const lines = workflow.replace(/\r\n/g, '\n').split('\n');
  const jobs = directBlock(lines, 0, lines.length, 'jobs', 0);
  const build = directBlock(lines, ...jobs, 'build', 2);
  const steps = directBlock(lines, ...build, 'steps', 4);
  for (let index = steps[0]; index < steps[1]; index++) {
    if (!/^ {6}- name: /.test(lines[index])) continue;
    const indent = 6;
    const properties = new Map();
    for (let next = index + 1; next < steps[1]; next++) {
      const line = lines[next];
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      if (line.search(/\S/) <= indent) break;
      const property = new RegExp(`^ {${indent + 2}}([a-z-]+): (.*)$`).exec(line);
      if (!property) continue;
      if (properties.has(property[1])) throw new Error('Duplicate archive step property.');
      properties.set(property[1], property[2]);
    }
    if (properties.get('working-directory') !== 'source' || properties.has('if')) continue;
    const command = properties.get('run') ?? '';
    if (!command.startsWith('git fetch ')) continue;
    const tokens = command.split(' ');
    if (
      tokens.shift() !== 'git' ||
      tokens.shift() !== 'fetch' ||
      tokens.shift() !== '--depth=1' ||
      tokens.shift() !== 'origin' ||
      !tokens.length
    )
      throw new Error(
        'Use the explicit archive fetch template: git fetch --depth=1 origin <refs>.',
      );
    for (const token of tokens) {
      const match = /^refs\/tags\/(v\d+\.\d+\.\d+):refs\/tags\/\1$/.exec(token);
      if (!match || !VERSION.test(match[1]))
        throw new Error('Archive fetch must map each exact immutable tag to the same local tag.');
      fetched.add(match[1]);
    }
  }
  const missing = required.filter((version) => !fetched.has(version));
  if (missing.length)
    throw new Error(
      `Archive workflow does not explicitly fetch every locked tag: ${missing.join(', ')}.`,
    );
  return { required, fetched: [...fetched], missing, hostedExecutionVerified: false };
}

async function readBounded(file) {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > LIMIT)
      throw new Error('Archive input must be an ordinary file <=1 MiB.');
    const bytes = Buffer.alloc(LIMIT + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > LIMIT) throw new Error('Archive input grew beyond 1 MiB.');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--source-lock' || args[2] !== '--workflow')
      throw new Error('Usage: archive-tag-fetch.mjs --source-lock <file> --workflow <file>');
    const lock = JSON.parse(await readBounded(args[1]));
    const workflow = await readBounded(args[3]);
    console.log(JSON.stringify(checkArchiveTagFetch(lock, workflow), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
