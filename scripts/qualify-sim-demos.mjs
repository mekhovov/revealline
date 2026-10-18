#!/usr/bin/env node
/** Independently verifies every required catalogue variant; missing entries fail. */
import { readFile, writeFile } from 'node:fs/promises';
import { simDemoInventory } from '../optional-practice/civilian-fpv/demo-inventory.mjs';
import {
  verifySimDemo,
  createSimDemoPlayer,
} from '../optional-practice/civilian-fpv/demo-player.mjs';
import { worldStateIdentity } from '../optional-practice/civilian-fpv/world-model.mjs';
import { dataIdentity } from '../game/data-json.mjs';

const root = new URL('../optional-practice/civilian-fpv/demo-data/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));
const required = simDemoInventory(),
  outcomes = [],
  missing = [],
  failures = [];
const writeCheckpoints = process.argv.includes('--write-checkpoints');
for (const item of required) {
  const candidates = catalog.entries.filter(
    (row) =>
      row.levelId === item.levelId &&
      row.variantId === item.variantId &&
      row.sourceIdentity === item.sourceIdentity,
  );
  if (!candidates.length) {
    missing.push(item.id);
    continue;
  }
  for (const candidate of candidates) {
    const started = performance.now();
    try {
      const file = new URL(candidate.file, root),
        payload = JSON.parse(await readFile(file, 'utf8'));
      const result = await verifySimDemo(item.entry, payload, { yieldControl: async () => {} });
      if (writeCheckpoints) {
        const player = await createSimDemoPlayer(item.entry, payload, {
          yieldControl: async () => {},
        });
        const checkpoints = [];
        try {
          player.play();
          while (player.phase !== 'complete') {
            player.advance(0.02);
            if (player.state.ticks % 250 === 0 || player.phase === 'complete')
              checkpoints.push({
                tick: player.state.ticks,
                stateIdentity: item.entry.legacy
                  ? dataIdentity(player.state)
                  : worldStateIdentity(player.state),
              });
          }
        } finally {
          player.dispose();
        }
        payload.checkpoints = checkpoints;
        await writeFile(file, JSON.stringify(payload) + '\n');
      }
      outcomes.push({
        id: item.id,
        sourceId: candidate.id,
        outcome: result.state.status,
        ticks: result.state.ticks,
        progress: result.state.step,
        elapsedMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      failures.push({ id: item.id, sourceId: candidate.id, reason: error.message });
    }
    if ((outcomes.length + failures.length) % 20 === 0)
      console.log(
        JSON.stringify({
          verified: outcomes.length,
          failures: failures.length,
          required: required.length,
        }),
      );
  }
}
const report = {
  format: 'SimDemoCoverage.v1',
  required: required.length,
  availableExactRecordings: catalog.entries.length,
  verifiedRecordings: outcomes.length,
  verified: !missing.length && !failures.length,
  missing,
  failures,
  outcomes,
};
await writeFile(new URL('coverage.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    required: required.length,
    verified: outcomes.length,
    missing: missing.length,
    failures: failures.length,
  }),
);
if (!report.verified) process.exitCode = 1;
