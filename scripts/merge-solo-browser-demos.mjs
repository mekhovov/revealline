#!/usr/bin/env node
/** Adopt only complete independent browser qualification receipts. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateDemoCatalog, demoInputTraceIdentity } from '../game/demo-catalog.mjs';
import { commitDemoMetadata } from './build-demo-recordings.mjs';

const root = new URL('../', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalogs = new Map();
for (const path of [
  'catalog.json',
  'catalog.journey-current.json',
  'catalog.journey-archive.json',
]) {
  try {
    catalogs.set(path, validateDemoCatalog(await read(`game/demo-data/${path}`)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
for (const receiptPath of process.argv.slice(2)) {
  const receipt = JSON.parse(
    await readFile(
      pathToFileURL(receiptPath.startsWith('/') ? receiptPath : `${process.cwd()}/${receiptPath}`),
      'utf8',
    ),
  );
  if (!receipt.complete || receipt.failures.length || receipt.required !== receipt.verified.length)
    throw new Error(`Browser qualification is incomplete: ${receiptPath}`);
  for (const performance of [...receipt.variants, ...receipt.performances]) {
    const clip = [...catalogs.values()]
      .flatMap((catalog) => catalog.clips)
      .find((clip) => clip.id === performance.id);
    if (!clip) throw new Error(`Missing catalog source ${performance.id}`);
    const replay = await read(`game/${performance.replayURL.slice(2)}`);
    const diagnostics = await read(`game/${performance.diagnosticURL.slice(2)}`);
    const evidence = receipt.verified.find((item) => item.id === clip.id);
    if (
      performance.engine !== receipt.engine ||
      !evidence ||
      evidence.checkpoint !== replay.checkpoint.hash ||
      performance.checkpoint !== replay.checkpoint.hash ||
      evidence.outcome !== performance.outcome ||
      replay.summary.status !== performance.outcome ||
      performance.recordingIdentity !== clip.recordingIdentity ||
      demoInputTraceIdentity(replay) !== performance.inputTraceIdentity ||
      diagnostics.inputTraceIdentity !== performance.inputTraceIdentity ||
      replay.ticks / 120 !== performance.durationSeconds ||
      replay.options.turnPolicy !== performance.turnPolicy
    )
      throw new Error(`Qualification evidence no longer matches ${clip.id}/${receipt.engine}`);
    const fields = [
      'engine',
      'outcome',
      'recordingIdentity',
      'replayURL',
      'inputTraceIdentity',
      'durationSeconds',
      'turnPolicy',
    ];
    const descriptor = Object.fromEntries(fields.map((key) => [key, performance[key]]));
    clip.runtimePerformances = [
      ...(clip.runtimePerformances ?? []).filter((item) => item.engine !== receipt.engine),
      descriptor,
    ];
  }
}
for (const [path, catalog] of catalogs) {
  validateDemoCatalog(catalog);
  await commitDemoMetadata(new URL(`game/demo-data/${path}`, root), catalog);
  console.log(
    `${path}: ${catalog.clips.length} clips, ${Buffer.byteLength(JSON.stringify(catalog))} metadata bytes`,
  );
}
