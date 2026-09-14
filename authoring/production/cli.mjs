#!/usr/bin/env node
import { readFile, open, lstat, realpath, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  validateProductionRegister,
  summarizeProduction,
  inspectProductionSlot,
  proposeProductionBinding,
  validateSourcePath,
} from './model.mjs';
import { ordinaryPath, verifyProductionSources } from './sources.mjs';
const usage =
  'Usage: cli.mjs validate|report|inspect|propose-binding REGISTER [--root DIR] [--json] [--files] [--slot ID --work ID --revision N --expected-binding N|none --handle JSON --out NEW.json]';
export async function runProductionCli(argv, { write = (s) => process.stdout.write(s) } = {}) {
  const [command, name, ...rest] = argv;
  if (!['validate', 'report', 'inspect', 'propose-binding'].includes(command) || !name)
    throw new Error(usage);
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (
      ![
        '--root',
        '--json',
        '--files',
        '--previous',
        '--slot',
        '--work',
        '--revision',
        '--expected-binding',
        '--handle',
        '--out',
      ].includes(k) ||
      k in options
    )
      throw new Error(`Unknown/duplicate option ${k}`);
    options[k] = ['--json', '--files'].includes(k) ? true : rest[++i];
    if (options[k] === undefined) throw new Error(`Missing value for ${k}`);
  }
  const allowed = {
    validate: ['--root', '--json', '--files', '--previous'],
    report: ['--root', '--json'],
    inspect: ['--root', '--json', '--slot'],
    'propose-binding': [
      '--root',
      '--json',
      '--slot',
      '--work',
      '--revision',
      '--expected-binding',
      '--handle',
      '--out',
    ],
  }[command];
  if (Object.keys(options).some((k) => !allowed.includes(k)))
    throw new Error('Option does not apply to this command');
  const root = await realpath(options['--root'] ?? process.cwd());
  const filename = await ordinaryPath(root, name);
  const stat = await lstat(filename);
  if (stat.size > 2 * 1024 * 1024) throw new Error('Register exceeds 2 MiB');
  const raw = await readFile(filename);
  if (raw.length > 2 * 1024 * 1024) throw new Error('Register exceeds 2 MiB');
  const r = validateProductionRegister(JSON.parse(raw));
  let result;
  if (command === 'validate') {
    if (options['--previous']) {
      const oldPath = await ordinaryPath(root, options['--previous']);
      if ((await lstat(oldPath)).size > 2 * 1024 * 1024)
        throw new Error('Previous register exceeds 2 MiB');
      const oldRaw = await readFile(oldPath);
      if (oldRaw.length > 2 * 1024 * 1024) throw new Error('Previous register exceeds 2 MiB');
      validateProductionRegister(r, { previous: JSON.parse(oldRaw) });
    }
    result = await verifyProductionSources(r, { root, files: options['--files'] === true });
  }
  if (command === 'report') result = summarizeProduction(r);
  if (command === 'inspect') result = inspectProductionSlot(r, options['--slot']);
  if (command === 'propose-binding') {
    for (const k of ['--slot', '--work', '--revision', '--expected-binding', '--handle', '--out'])
      if (!options[k]) throw new Error(`Missing ${k}`);
    const numeric = (v) => {
      if (!/^[1-9][0-9]{0,5}$/.test(v)) throw new Error('Positive decimal revision required');
      return Number(v);
    };
    const next = proposeProductionBinding(r, {
      slotId: options['--slot'],
      workId: options['--work'],
      workRevision: numeric(options['--revision']),
      expectedBinding:
        options['--expected-binding'] === 'none' ? null : numeric(options['--expected-binding']),
      handle: JSON.parse(options['--handle']),
    });
    // Validate authority before any publication. Missing originals remain explicit metadata;
    // this command neither imports their bytes nor grants runtime readiness.
    await verifyProductionSources(next, { root });
    const out = validateSourcePath(options['--out']);
    if (!out.startsWith('authoring/production/'))
      throw new Error('Proposal must be inside authoring/production');
    const parent = path.posix.dirname(out);
    let dir = root;
    for (const part of parent.split('/')) {
      dir = path.join(dir, part);
      const s = await lstat(dir);
      if (s.isSymbolicLink() || !s.isDirectory())
        throw new Error('Ordinary existing proposal directory required');
    }
    const temporary = path.join(dir, `.production-${randomUUID()}.tmp`);
    const f = await open(temporary, 'wx', 0o600);
    try {
      try {
        await f.writeFile(JSON.stringify(next, null, 2) + '\n');
        await f.sync();
      } finally {
        await f.close();
      }
      if (!(await readFile(await ordinaryPath(root, name))).equals(raw))
        throw new Error('Input register changed during proposal');
      await link(temporary, path.join(root, out));
    } finally {
      await unlink(temporary);
    }
    result = {
      output: out,
      revision: next.revision,
      adoption: 'proposal only; runtime/media/history unchanged',
    };
  }
  if (options['--json'] || command !== 'report') write(JSON.stringify(result, null, 2) + '\n');
  else {
    write(
      `Production register revision ${result.revision}\nMaps: ${result.maps.proposed} proposed, ${result.maps.approved} approved, ${result.maps.unassigned} unassigned / 29\n`,
    );
    for (const [kind, d] of Object.entries(result.domains))
      write(
        `${kind}: ${d.bound}/${d.target} bound; ${d.missing} missing; ${d.stages.released} fully qualified released\n`,
      );
    write(
      `Unique selected pictures: ${result.uniquePictureWorks}; distinct reserve candidates: ${result.uniqueReserveWorks}; shared presentation recipes: ${result.sharedPresentationWorks}; synth recipes: ${result.recipeTracks}\nHistorical delivery: ${result.historicalDelivery.pictures} pictures, ${result.historicalDelivery.stories} stories (separate from full quality stages)\n`,
    );
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  runProductionCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
