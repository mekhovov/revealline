#!/usr/bin/env node
/** Offline additive installer. Produces a new candidate; never edits the registry.
 * Packed arrays are parsed as bounded JSON, never evaluated as JavaScript.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const usage =
  'Usage: node append-packed.mjs [--root REPOSITORY] --recordings DIRECTORY --out NEW_CANDIDATE.mjs [--registry EXISTING_MODULE]';
const args = process.argv.slice(2),
  options = { root: process.cwd() };
for (let index = 0; index < args.length; index++) {
  const key = {
    '--root': 'root',
    '--recordings': 'recordings',
    '--out': 'out',
    '--registry': 'registry',
  }[args[index]];
  if (!key || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(usage);
  if (Object.hasOwn(options, key) && key !== 'root')
    throw new Error('Repeated option: ' + args[index]);
  options[key] = resolve(args[++index]);
}
if (!options.recordings || !options.out) throw new Error(usage);
options.registry ??= resolve(
  options.root,
  'optional-practice/civilian-fpv/world-demonstrations.mjs',
);
if (options.registry === options.out)
  throw new Error('Candidate must not replace the input registry.');
const limits = {
  registryBytes: 8 * 1024 * 1024,
  artifactBytes: 2 * 1024 * 1024,
  batchBytes: 32 * 1024 * 1024,
  additions: 128,
  rows: 512,
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const moduleAt = (file) => import(pathToFileURL(resolve(options.root, file)));
const { parse } = createRequire(resolve(options.root, 'package.json'))('acorn');
const [{ boundedJSON, canonicalJSON, dataIdentity, exactKeys, required }, model, catalogue] =
  await Promise.all([
    moduleAt('game/data-json.mjs'),
    moduleAt('optional-practice/civilian-fpv/world-model.mjs'),
    moduleAt('optional-practice/civilian-fpv/world-catalogue.mjs'),
  ]);
const { validateWorldCourse, replayWorldFlight, WORLD_MAX_TICKS } = model;
const readBounded = async (file, maximum) => {
  const info = await stat(file);
  required(
    info.isFile() && info.size <= maximum,
    'Input exceeds file byte budget: ' + basename(file),
  );
  const bytes = await readFile(file);
  required(bytes.length <= maximum, 'Input grew beyond file byte budget: ' + basename(file));
  return bytes;
};
const ensureNew = async (file) => {
  try {
    await stat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error('Output already exists; no files were replaced: ' + basename(file));
};
await ensureNew(options.out);
await ensureNew(options.out + '.report.json');
const sourceFiles = [
  'game/data-json.mjs',
  'optional-practice/civilian-fpv/world-catalogue.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/world-collision.mjs',
  'optional-practice/civilian-fpv/model.mjs',
  'optional-practice/civilian-fpv/math.mjs',
  'optional-practice/civilian-fpv/radio-profile.mjs',
  'optional-practice/civilian-fpv/flight-sectors.mjs',
  'optional-practice/civilian-fpv/world-themes.mjs',
  'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
];
const sources = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (file) => [file, digest(await readFile(resolve(options.root, file)))]),
  ),
);
const original = await readBounded(options.registry, limits.registryBytes),
  text = original.toString('utf8');
const program = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const declarations = program.body
  .flatMap((node) => (node.type === 'VariableDeclaration' ? node.declarations : []))
  .filter(
    (node) => node.id.type === 'Identifier' && node.id.name === 'PACKED_WORLD_DEMONSTRATIONS',
  );
required(
  declarations.length === 1 && declarations[0].init?.type === 'ArrayExpression',
  'Expected exactly one packed JSON array.',
);
const array = declarations[0].init;
const packed = boundedJSON(text.slice(array.start, array.end), {
  maxBytes: limits.registryBytes,
  maxArray: limits.rows,
  maxString: 2 * 1024 * 1024,
  maxNodes: 100000,
  maxDepth: 12,
});
required(packed.length <= limits.rows, 'Too many existing recordings.');
const proofKeys = [
  'format',
  'session',
  'model',
  'backend',
  'course',
  'courseIdentity',
  'worldIdentity',
  'mode',
  'responseIdentity',
  'rulesIdentity',
  'conditionsIdentity',
  'response',
  'finalStateIdentity',
];
function decodeRow(row) {
  exactKeys(
    row,
    ['beforeProof', 'beforeFrames', 'framePack', 'afterFrames', 'afterProof'],
    'packed row',
  );
  exactKeys(row.beforeProof, ['sourceIdentity'], 'entry prefix');
  exactKeys(row.afterProof, [], 'entry suffix');
  exactKeys(row.beforeFrames, proofKeys, 'proof prefix');
  exactKeys(row.afterFrames, proofKeys, 'proof suffix');
  exactKeys(row.framePack, ['width', 'count', 'data'], 'frame pack');
  const { width, count, data } = row.framePack;
  required(
    width === 5 && Number.isInteger(count) && count >= 0 && count <= WORLD_MAX_TICKS,
    'Invalid frame dimensions.',
  );
  required(
    typeof data === 'string' &&
      data.length <= Math.ceil((count * width * 5) / 3) * 4 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data),
    'Invalid bounded frame data.',
  );
  const bytes = Buffer.from(data, 'base64'),
    previous = Array(width).fill(0),
    frames = [];
  let offset = 0;
  function read() {
    let value = 0,
      factor = 1;
    for (let index = 0; index < 5; index++) {
      required(offset < bytes.length, 'Truncated frame data.');
      const byte = bytes[offset++];
      value += (byte & 0x7f) * factor;
      if (!(byte & 0x80)) return value % 2 ? -(value + 1) / 2 : value / 2;
      factor *= 128;
    }
    throw new Error('Oversized frame varint.');
  }
  for (let tick = 0; tick < count; tick++) {
    const frame = [];
    for (let channel = 0; channel < width; channel++) {
      previous[channel] += read();
      required(
        Number.isSafeInteger(previous[channel]) &&
          previous[channel] >= (channel < 3 ? -1000 : 0) &&
          previous[channel] <= (channel === 4 ? 1 : 1000),
        'Invalid packed command.',
      );
      frame.push(previous[channel]);
    }
    frames.push(frame);
  }
  required(offset === bytes.length, 'Trailing frame bytes.');
  const entry = {
    ...row.beforeProof,
    proof: { ...row.beforeFrames, frames, ...row.afterFrames },
    ...row.afterProof,
  };
  required(
    /^[a-f0-9]{16}$/.test(entry.sourceIdentity) &&
      entry.proof.format === 'FlightAttempt.v2' &&
      entry.proof.session === 'demonstration' &&
      ['acro', 'self-level'].includes(entry.proof.mode),
    'Invalid demonstration envelope.',
  );
  return entry;
}
function packFrames(frames) {
  const previous = Array(5).fill(0),
    bytes = [];
  for (const frame of frames)
    for (let channel = 0; channel < 5; channel++) {
      const delta = frame[channel] - previous[channel];
      previous[channel] = frame[channel];
      let value = delta < 0 ? -delta * 2 - 1 : delta * 2;
      do {
        const rest = Math.floor(value / 128);
        bytes.push(value % 128 | (rest ? 128 : 0));
        value = rest;
      } while (value);
    }
  return {
    width: 5,
    count: frames.length,
    data: Buffer.from(bytes).toString('base64'),
  };
}
const key = (proof) => proof.course + ':' + proof.mode;
const existing = packed.map(decodeRow),
  seen = new Set();
for (const entry of existing) {
  required(!seen.has(key(entry.proof)), 'Duplicate existing course/mode key: ' + key(entry.proof));
  seen.add(key(entry.proof));
}
const reportBytes = await readBounded(
  resolve(options.recordings, 'report.json'),
  limits.artifactBytes,
);
const report = boundedJSON(reportBytes.toString('utf8'), {
  maxBytes: limits.artifactBytes,
  maxArray: 36000,
  maxNodes: 100000,
  maxDepth: 16,
});
required(
  report.passed === true &&
    Array.isArray(report.results) &&
    report.results.length > 0 &&
    report.results.length <= limits.additions,
  'A complete bounded generation report is required.',
);
required(
  packed.length + report.results.length <= limits.rows,
  'Candidate recording count exceeds budget.',
);
const selected = new Map(
  [...catalogue.WORLD_CATALOGUE, ...catalogue.BEGINNER_CATALOGUE]
    .filter((entry) => !entry.legacy)
    .map((entry) => [entry.id, entry]),
);
const additions = [],
  verified = [],
  artifactInputs = [];
let batchBytes = reportBytes.length;
for (const row of report.results) {
  required(
    row &&
      row.completed === true &&
      row.replayed === true &&
      typeof row.file === 'string' &&
      /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(row.file) &&
      row.file !== 'report.json',
    'Invalid qualified artifact descriptor.',
  );
  const file = resolve(options.recordings, row.file),
    bytes = await readBounded(file, limits.artifactBytes);
  batchBytes += bytes.length;
  required(batchBytes <= limits.batchBytes, 'Recording batch byte budget exceeded.');
  required(digest(bytes) === row.artifactSha256, 'Artifact hash differs: ' + row.file);
  const value = boundedJSON(bytes.toString('utf8'), {
    maxBytes: limits.artifactBytes,
    maxArray: WORLD_MAX_TICKS,
    maxNodes: WORLD_MAX_TICKS * 7 + 10000,
    maxDepth: 20,
  });
  exactKeys(value, ['course', 'proof'], 'recording artifact');
  const { course, proof } = value,
    entry = selected.get(proof?.course);
  required(
    entry &&
      proof.session === 'demonstration' &&
      row.id === proof.course &&
      row.mode === proof.mode,
    'Unknown or mismatched demonstration.',
  );
  required(!seen.has(key(proof)), 'Duplicate course/mode key: ' + key(proof));
  seen.add(key(proof));
  required(
    canonicalJSON(validateWorldCourse(course)) === canonicalJSON(validateWorldCourse(entry.course)),
    'Authored course differs from current catalogue.',
  );
  const sourceIdentity = dataIdentity(validateWorldCourse(entry.course));
  required(
    sourceIdentity === row.sourceIdentity && digest(JSON.stringify(proof)) === row.proofSha256,
    'Exact source/proof hash required.',
  );
  const replay = await replayWorldFlight(entry.course, proof, {
    yieldControl: async () => {},
  });
  required(
    replay.state.status === 'complete',
    'Demonstration must reproduce a completed challenge.',
  );
  const beforeFrames = {},
    afterFrames = {};
  let after = false;
  for (const [name, value] of Object.entries(proof)) {
    if (name === 'frames') {
      after = true;
      continue;
    }
    (after ? afterFrames : beforeFrames)[name] = value;
  }
  const packedRow = {
    beforeProof: { sourceIdentity },
    beforeFrames,
    framePack: packFrames(proof.frames),
    afterFrames,
    afterProof: {},
  };
  required(
    JSON.stringify(decodeRow(packedRow)) === JSON.stringify({ sourceIdentity, proof }),
    'Packing changed exact proof bytes.',
  );
  additions.push(packedRow);
  artifactInputs.push({ file, sha256: digest(bytes) });
  verified.push({
    course: proof.course,
    mode: proof.mode,
    sourceIdentity,
    proofSha256: row.proofSha256,
    artifactSha256: row.artifactSha256,
    ticks: proof.frames.length,
    health: replay.state.health,
    contacts: replay.state.contacts,
  });
}
const tail = array.end - 1;
required(text[tail] === ']', 'Packed array closing delimiter is missing.');
const candidate =
  text.slice(0, tail) +
  (packed.length ? ',' : '') +
  additions.map((row) => JSON.stringify(row)).join(',') +
  text.slice(tail);
required(
  Buffer.byteLength(candidate) <= limits.registryBytes,
  'Candidate module exceeds byte budget.',
);
required(
  digest(await readFile(options.registry)) === digest(original),
  'Registry changed during preparation.',
);
required(
  digest(await readFile(resolve(options.recordings, 'report.json'))) === digest(reportBytes),
  'Report changed during preparation.',
);
for (const { file, sha256 } of artifactInputs)
  required(digest(await readFile(file)) === sha256, 'Artifact changed during preparation.');
for (const [file, sha256] of Object.entries(sources))
  required(
    digest(await readFile(resolve(options.root, file))) === sha256,
    'Runtime source changed during preparation: ' + file,
  );
const receipt = {
  format: 'FPVPackedAppend.v1',
  passed: true,
  installerSha256: digest(await readFile(new URL(import.meta.url))),
  sources,
  limits,
  existing: existing.length,
  added: additions.length,
  total: existing.length + additions.length,
  originalSha256: digest(original),
  candidateSha256: digest(candidate),
  beforeBytes: original.length,
  afterBytes: Buffer.byteLength(candidate),
  existingPackedBytesPreserved: true,
  decoderBytesPreserved: true,
  generationReportSha256: digest(reportBytes),
  verified,
};
await writeFile(options.out, candidate, { flag: 'wx' });
await writeFile(options.out + '.report.json', JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    passed: true,
    existing: receipt.existing,
    added: receipt.added,
    total: receipt.total,
    candidateSha256: receipt.candidateSha256,
    bytes: receipt.afterBytes,
  }),
);
