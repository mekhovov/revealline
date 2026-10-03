#!/usr/bin/env node
/** Recheck the real browser receipt's retained proof payloads with the exact fixed-step runtime. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'Usage: node scripts/qualify-fpv-pack-removal.mjs --input PASSED_BROWSER_RECEIPT.json --output NEW_RECEIPT.json\nReplays retained completed and interrupted commands; output must not exist. No browser/storage simulation or unit suite.',
    );
    return;
  }
  if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--output')
    throw Error('Expected --input browser-receipt.json --output new-receipt.json');
  const bytes = await readFile(path.resolve(args[1]));
  if (bytes.length > 4 * 1024 * 1024) throw Error('Receipt exceeds 4 MiB bound');
  const receipt = JSON.parse(bytes);
  if (
    receipt.format !== 'FPVPackRemovalBrowserEvidence.v1' ||
    receipt.status !== 'passed' ||
    !receipt.checks?.length ||
    receipt.checks.some((c) => !c.passed) ||
    receipt.proofs?.length !== 3 ||
    !receipt.preservation?.length
  )
    throw Error('Expected complete passed pack-removal browser evidence');
  if (new Set(receipt.preservation.map((p) => p.sha256)).size !== 1)
    throw Error('Retained independent data changed across removal/restoration');
  await initWorldRuntime();
  const results = [];
  for (const row of receipt.proofs) {
    const restored = await replayWorldFlight(row.course, row.proof, {
      yieldControl: async () => {},
    });
    if (
      restored.state.status !== 'complete' ||
      worldStateIdentity(restored.state) !== row.proof.finalStateIdentity
    )
      throw Error('Completed proof does not reproduce');
    const prefix = await replayWorldFlight(row.course, row.prefix, {
      yieldControl: async () => {},
    });
    if (
      prefix.state.status !== 'active' ||
      worldStateIdentity(prefix.state) !== row.prefix.finalStateIdentity
    )
      throw Error('Interrupted prefix does not reproduce');
    results.push({
      course: row.course.id,
      revision: row.course.revision,
      mode: row.proof.mode,
      packIdentity: row.packIdentity,
      completedTicks: restored.state.ticks,
      prefixTicks: prefix.state.ticks,
      finalStateIdentity: row.proof.finalStateIdentity,
      prefixStateIdentity: row.prefix.finalStateIdentity,
    });
  }
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  const sources = Object.fromEntries(
    await Promise.all(
      [
        'optional-practice/civilian-fpv/world-model.mjs',
        'optional-practice/civilian-fpv/world-store.mjs',
        'optional-practice/civilian-fpv/world-app.mjs',
        'scripts/qualify-fpv-pack-removal.mjs',
      ].map(async (p) => [p, hash(await readFile(path.join(ROOT, p)))]),
    ),
  );
  const output = {
    format: 'FPVPackRemovalFunctionalEvidence.v1',
    status: 'passed',
    browserReceiptSha256: hash(bytes),
    browserChecks: receipt.checks.length,
    preservationSnapshots: receipt.preservation.length,
    sources,
    results,
    qualification:
      'Independent exact-command replay of completed and interrupted proof bytes retained through the actual native IndexedDB browser flow. Browser UI assertions remain in the input receipt. No new unit suite or hardware/eviction/performance qualification.',
  };
  await writeFile(path.resolve(args[3]), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      status: 'passed',
      proofs: results.length,
      prefixes: results.length,
      output: path.resolve(args[3]),
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
