#!/usr/bin/env node
/** Legal-input completion proofs for all indexed expansion maps. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { findRoute, replayProof, digest } from './verify-campaign.mjs';
const root = new URL('../', import.meta.url);
const proofFile = new URL('game/replays/expansion-routes.json', root);
export async function expansionSources() {
  const index = JSON.parse(await readFile(new URL('game/content/packs/index.json', root), 'utf8'));
  return Promise.all(
    index.packs.map(async (entry) =>
      JSON.parse(await readFile(new URL(`game/content/packs/${entry.path}`, root), 'utf8')),
    ),
  );
}
export async function verifyExpansionRoutes() {
  const packs = await expansionSources(),
    proof = JSON.parse(await readFile(proofFile, 'utf8'));
  if (proof.format !== 'xonix-expansion-proof.v1' || !Array.isArray(proof.routes))
    throw new Error('Invalid expansion proof.');
  const expectedCount = packs.reduce(
    (count, pack) =>
      count + pack.campaigns.reduce((n, campaign) => n + campaign.levels.length * 2, 0),
    0,
  );
  if (proof.routes.length !== expectedCount) throw new Error('Incomplete expansion proof.');
  const results = [],
    seen = new Set();
  for (const route of proof.routes) {
    const id = `${route.packId}/${route.levelId}/${route.turnPolicy}`;
    if (seen.has(id)) throw new Error('Duplicate proof.');
    seen.add(id);
    const pack = packs.find((p) => p.id === route.packId),
      level = pack?.campaigns.flatMap((c) => c.levels).find((l) => l.id === route.levelId);
    if (!level) throw new Error('Unknown expansion map.');
    const summary = replayProof(level, pack.classRecipes, route);
    if (JSON.stringify(summary) !== JSON.stringify(route.expected))
      throw new Error(`Expansion result changed: ${id}`);
    results.push(summary);
  }
  return { verified: results.length, results };
}
async function discover() {
  const packs = await expansionSources(),
    routes = [];
  let examined = 0,
    simulatedTicks = 0;
  for (const pack of packs)
    for (const campaign of pack.campaigns)
      for (const level of campaign.levels) {
        const route = findRoute(level, pack.classRecipes, 'immediate');
        console.log(
          `${level.id}: ${route.won ? 'won' : 'UNSOLVED'}; ${route.examined} legal cut candidates; ${Math.round(route.milliseconds)} ms`,
        );
        if (!route.won) throw new Error(route.reason);
        examined += route.examined;
        simulatedTicks += route.simulatedTicks;
        for (const turnPolicy of ['immediate', 'grid-center']) {
          const entry = {
            packId: pack.id,
            levelId: level.id,
            levelRevision: level.revision,
            levelSha256: digest(level),
            classesSha256: digest(pack.classRecipes),
            seed: 1,
            turnPolicy,
            classId: 'interceptor',
            segments: route.segments,
          };
          entry.expected = replayProof(level, pack.classRecipes, entry);
          routes.push(entry);
        }
      }
  const proof = { format: 'xonix-expansion-proof.v1', examined, simulatedTicks, routes };
  await writeFile(proofFile, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ verified: routes.length, examined, simulatedTicks }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--discover')) await discover();
  else console.log(JSON.stringify(await verifyExpansionRoutes()));
}
