#!/usr/bin/env node
/** On-demand reference traces stay outside shipped game/optional-package trees. */
import { readFile, writeFile, mkdir, stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoTickAdapter } from './demo-tick-adapters.mjs';
import { captureDemoTickTrace, compareDemoTickTrace } from './demo-tick-trace.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = {};
for (const argument of process.argv.slice(2)) {
  if (argument === '--help') args.help = true;
  else {
    const equals = argument.indexOf('=');
    if (!argument.startsWith('--') || equals < 3) throw new TypeError('Use --name=value options.');
    const key = argument.slice(2, equals);
    if (Object.hasOwn(args, key)) throw new TypeError(`Repeated option: ${key}`);
    args[key] = argument.slice(equals + 1);
  }
}
const allowed = [
  'help',
  'mode',
  'recording',
  'entry',
  'variant',
  'capture',
  'reference',
  'receipt',
  'report',
  'runtime-engine',
  'runtime-version',
  'runtime-implementation',
];
for (const key of Object.keys(args))
  if (!allowed.includes(key)) throw new TypeError(`Unknown option: ${key}`);
if (args.help) {
  console.log(`Capture a strictly verified reference in its known-good runtime:
  node scripts/diagnose-demo-ticks.mjs --mode=sim --recording=path.json --capture=.cache/reference.trace.json

Compare the exact same recording in a candidate runtime:
  node scripts/diagnose-demo-ticks.mjs --mode=sim --recording=path.json --reference=.cache/reference.trace.json --report=.cache/comparison.json

Optional: --entry=authored-entry.json --variant=exact-variant
The detached reference receipt defaults to <trace-path>.receipt.json. Keep it independently trusted.
Capture never overwrites files. Trace/report outputs cannot target the shipped game or optional-package trees.
The browser-compatible captureDemoTickTrace/compareDemoTickTrace APIs support cross-engine reference/candidate diagnosis.
This tool does not accept recordings, change checkpoints, or replace native full verification.`);
  process.exit(0);
}
if (!args.mode || !args.recording || Boolean(args.capture) === Boolean(args.reference))
  throw new TypeError('Provide --mode, --recording, and exactly one of --capture or --reference.');
if (args.capture && (args.receipt || args.report))
  throw new TypeError(
    'Capture writes its paired receipt; --receipt and --report belong to comparison.',
  );

const MAX_JSON_BYTES = 32 * 1024 * 1024;
async function json(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > MAX_JSON_BYTES)
    throw new RangeError('Diagnostic input must be a file of at most 32 MiB.');
  const bytes = await readFile(file);
  if (bytes.length > MAX_JSON_BYTES) throw new RangeError('Diagnostic input grew beyond 32 MiB.');
  return JSON.parse(bytes);
}
async function outputPath(file) {
  const lexical = path.resolve(file);
  // Resolve the nearest existing ancestor so a cache symlink cannot accidentally
  // publish a diagnostic trace into a shipped source tree.
  let ancestor = path.dirname(lexical);
  let suffix = path.basename(lexical);
  for (;;) {
    try {
      ancestor = await realpath(ancestor);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      suffix = path.join(path.basename(ancestor), suffix);
      ancestor = path.dirname(ancestor);
    }
  }
  const target = path.join(ancestor, suffix);
  for (const directory of ['game', 'optional-practice', 'site', 'dist', 'releases']) {
    const shipped = path.join(root, directory);
    if (target === shipped || target.startsWith(shipped + path.sep))
      throw new Error('Diagnostic traces must remain outside shipped build and package trees.');
  }
  return target;
}
async function writeNew(file, value) {
  const target = await outputPath(file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value) + '\n', { flag: 'wx' });
  return target;
}
async function implementationIdentity() {
  const files = execFileSync('rg', ['--files', 'game', 'optional-practice', 'scripts'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter(
      (file) =>
        /\.(mjs|js)$/.test(file) &&
        !file.includes('/test/') &&
        !file.endsWith('.test.mjs') &&
        !path.basename(file).startsWith('test-'),
    )
    .sort();
  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(file + '\0');
    digest.update(
      createHash('sha256')
        .update(await readFile(path.join(root, file)))
        .digest(),
    );
  }
  return `sha256:${digest.digest('hex')}`;
}
const recording = await json(args.recording);
const runtime = {
  engine: args['runtime-engine'] ?? 'node',
  version: args['runtime-version'] ?? process.version,
  implementation: args['runtime-implementation'] ?? (await implementationIdentity()),
};
const adapter = await createDemoTickAdapter({
  modeId: args.mode,
  recording,
  ...(args.entry ? { entry: await json(args.entry) } : {}),
  ...(args.variant !== undefined ? { variantId: args.variant } : {}),
});
async function assertStableImplementation() {
  if (
    !args['runtime-implementation'] &&
    runtime.implementation !== (await implementationIdentity())
  )
    throw new Error(
      'Diagnostic implementation changed during observation; repeat with a stable source tree.',
    );
}
const controller = new AbortController();
const cancel = () =>
  controller.abort(new DOMException('Diagnostic command interrupted.', 'AbortError'));
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
try {
  if (args.capture) {
    const tracePath = await outputPath(args.capture);
    const receiptPath = await outputPath(args.capture + '.receipt.json');
    // Check both names before spending time on a native replay. Exclusive writes
    // below still defend against a new file created during reference capture.
    for (const file of [tracePath, receiptPath]) {
      try {
        await stat(file);
        throw new Error(`Refusing to overwrite existing diagnostic output: ${file}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    const packet = await captureDemoTickTrace(adapter, { runtime, signal: controller.signal });
    await assertStableImplementation();
    await writeNew(tracePath, packet.trace);
    await writeNew(receiptPath, packet.receipt);
    console.log(
      JSON.stringify(
        {
          operation: 'capture',
          trace: tracePath,
          receipt: receiptPath,
          binding: packet.trace.binding,
          verification: packet.trace.verification,
          observedTicks: packet.trace.hashes.length,
          ...packet.receipt,
        },
        null,
        2,
      ),
    );
  } else {
    const trace = await json(args.reference);
    const receipt = await json(args.receipt ?? args.reference + '.receipt.json');
    const result = await compareDemoTickTrace(
      adapter,
      { trace, receipt },
      { runtime, signal: controller.signal },
    );
    await assertStableImplementation();
    if (args.report) await writeNew(args.report, result);
    console.log(JSON.stringify(result, null, 2));
    if (!result.match) process.exitCode = 1;
  }
} finally {
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
