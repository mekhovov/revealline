#!/usr/bin/env node
/** Legal-input completion proofs for all indexed expansion maps. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { findRoute, replayProof, digest } from './verify-campaign.mjs';
import { boundedJSON, exactKeys, required } from '../game/data-json.mjs';
import {
  validatePack,
  PACK_LIMITS,
  ENCOUNTER_PACK_VERSION,
  WIDE_PACK_VERSION,
} from '../game/packs.mjs';
import { campaignKey } from '../game/library.mjs';
import { snapshotReplay, verifyReplay, recordInput } from '../game/replay.mjs';
import {
  ENCOUNTER_VERSIONS,
  LEGACY_VERSIONS,
  WIDE_VERSIONS,
  versionsForCampaign,
} from '../game/core/versions.mjs';
const root = new URL('../', import.meta.url);
const proofFile = new URL('game/replays/expansion-routes.json', root);
const encounterProofFile = new URL('game/replays/sentinel-routes.json', root);
const wideProofFile = new URL('game/replays/first-light-routes.json', root);
const policies = ['immediate', 'grid-center'];
const routeKey = (pack, campaign, level, policy) =>
  `${pack.id}/${campaign.id}/${level.id}/${policy}`;
const proofCopy = (value) =>
  boundedJSON(value, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 100000,
    maxDepth: 18,
    maxArray: 20000,
    maxString: 4096,
  });
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
    proof = JSON.parse(await readFile(proofFile, 'utf8')),
    encounterProof = packs.some((pack) => pack.format === ENCOUNTER_PACK_VERSION)
      ? JSON.parse(await readFile(encounterProofFile, 'utf8'))
      : null,
    wideProof = packs.some((pack) => pack.format === WIDE_PACK_VERSION)
      ? JSON.parse(await readFile(wideProofFile, 'utf8'))
      : null;
  return verifyExpansionProofs({ packs, proof, encounterProof, wideProof });
}

/** Owned proof data; verify one outcome per exact indexed pack/campaign/map/policy.
 * Extra Sentinel demonstrations are structurally checked, never counted as new map coverage.
 */
export function verifyExpansionProofs(source) {
  const request = boundedJSON(source, {
    maxBytes: PACK_LIMITS.libraryBytes + 8 * 1024 * 1024,
    maxNodes: 360000,
    maxDepth: 20,
    maxArray: 20000,
    maxString: PACK_LIMITS.maxBytes,
  });
  exactKeys(request, ['packs', 'proof', 'encounterProof', 'wideProof'], 'proof request');
  const packs = boundedJSON(request.packs, {
    maxBytes: PACK_LIMITS.libraryBytes,
    maxNodes: 160000,
    maxDepth: 18,
    maxArray: 4096,
    maxString: PACK_LIMITS.maxBytes,
  });
  const proof = proofCopy(request.proof),
    encounter = request.encounterProof === null ? null : proofCopy(request.encounterProof),
    wide = request.wideProof == null ? null : proofCopy(request.wideProof);
  required(Array.isArray(packs) && packs.length <= PACK_LIMITS.installed, 'Invalid indexed packs.');
  const expected = new Map(),
    packIds = new Set();
  for (const pack of packs) {
    const checked = validatePack(pack);
    required(checked.valid, `Invalid indexed pack: ${checked.errors.join('; ')}`);
    required(!packIds.has(pack.id), 'Duplicate indexed pack.');
    packIds.add(pack.id);
    for (const campaign of pack.campaigns)
      for (const level of campaign.levels)
        for (const policy of policies) {
          const key = routeKey(pack, campaign, level, policy);
          required(!expected.has(key), 'Duplicate indexed map identity.');
          expected.set(key, {
            pack,
            campaign,
            level,
            ruleset: versionsForCampaign(campaign).ruleset,
          });
        }
  }
  exactKeys(proof, ['format', 'examined', 'simulatedTicks', 'routes', 'method'], 'expansion proof');
  required(
    proof.format === 'xonix-expansion-proof.v1' && Array.isArray(proof.routes),
    'Invalid expansion proof.',
  );
  const results = [],
    seen = new Set();
  const identify = (packId, levelId, policy) => {
    const item = [...expected.values()].find(
      (item) => item.pack.id === packId && item.level.id === levelId,
    );
    required(item && policies.includes(policy), 'Unknown expansion map or turn policy.');
    const key = routeKey(item.pack, item.campaign, item.level, policy);
    required(!seen.has(key), 'Duplicate proof.');
    return { ...item, key };
  };
  for (const route of proof.routes) {
    exactKeys(
      route,
      [
        'packId',
        'levelId',
        'levelRevision',
        'levelSha256',
        'classesSha256',
        'seed',
        'turnPolicy',
        'classId',
        'segments',
        'expected',
        'releaseAfter',
      ],
      'legacy route',
    );
    const { pack, campaign, level, key, ruleset } = identify(
      route.packId,
      route.levelId,
      route.turnPolicy,
    );
    required(
      ruleset === LEGACY_VERSIONS.ruleset &&
        route.expected?.ruleset === ruleset &&
        route.levelRevision === level.revision,
      'Legacy proof simulation or map revision differs.',
    );
    required(
      route.releaseAfter === undefined || route.releaseAfter === false,
      'Legacy proof cannot ignore releaseAfter.',
    );
    required(Array.isArray(route.segments), 'Invalid legacy proof segments.');
    const inputCheck = { ticks: 0, releaseAfter: false, segments: [] };
    for (const segment of route.segments) {
      exactKeys(segment, ['ticks', 'input', 'releaseBefore'], 'legacy segment');
      required(
        segment.releaseBefore === undefined || segment.releaseBefore === false,
        'Legacy proof cannot ignore releaseBefore.',
      );
      recordInput(inputCheck, segment.input);
    }
    const recipes = pack.classRecipes.filter(
      (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
    );
    const summary = replayProof(level, recipes, route);
    if (JSON.stringify(summary) !== JSON.stringify(route.expected))
      throw new Error(`Expansion result changed: ${key}`);
    seen.add(key);
    results.push(summary);
  }
  if (encounter !== null) {
    exactKeys(
      encounter,
      [
        'format',
        'packId',
        'packVersion',
        'packSha256',
        'levelSha256',
        'classesSha256',
        'campaignKey',
        'method',
        'routes',
      ],
      'encounter proof',
    );
    const pack = packs.find((item) => item.id === encounter.packId);
    required(
      encounter.format === 'xonix-sentinel-proof.v1' && pack?.format === ENCOUNTER_PACK_VERSION,
      'Invalid or unknown encounter proof.',
    );
    required(
      pack.campaigns.length === 1 && pack.campaigns[0].levels.length === 1,
      'This encounter proof needs one campaign/map.',
    );
    const campaign = {
        ...pack.campaigns[0],
        classRecipes: pack.classRecipes.filter(
          (recipe) => !pack.campaigns[0].classIds || pack.campaigns[0].classIds.includes(recipe.id),
        ),
      },
      level = campaign.levels[0];
    required(
      encounter.packVersion === pack.version &&
        encounter.packSha256 === digest(pack) &&
        encounter.levelSha256 === digest(level) &&
        encounter.classesSha256 === digest(pack.classRecipes) &&
        encounter.campaignKey === campaignKey(campaign),
      'Encounter proof content identity changed.',
    );
    required(
      Array.isArray(encounter.routes) && encounter.routes.length <= 128,
      'Invalid encounter route list.',
    );
    const routeIds = new Set();
    for (const route of encounter.routes) {
      exactKeys(
        route,
        [
          'id',
          'levelId',
          'turnPolicy',
          'classId',
          'seed',
          'variant',
          'segments',
          'releaseAfter',
          'expected',
          'checkpoint',
          'phases',
          'events',
        ],
        'encounter route',
      );
      required(
        route.levelId === level.id &&
          policies.includes(route.turnPolicy) &&
          route.seed === 1 &&
          campaign.classRecipes.some((recipe) => recipe.id === route.classId) &&
          ['ordinary', 'missed-windows', 'isolation', 'recovered'].includes(route.variant) &&
          route.id === `${level.id}/${route.turnPolicy}/${route.variant}/${route.classId}`,
        'Unsupported encounter route identity.',
      );
      required(!routeIds.has(route.id), 'Duplicate encounter proof route.');
      routeIds.add(route.id);
      required(
        Array.isArray(route.phases) && Array.isArray(route.events),
        'Encounter proof observations must be arrays.',
      );
      required(
        route.expected?.ruleset === ENCOUNTER_VERSIONS.ruleset &&
          route.expected.levelId === level.id &&
          route.expected.revision === level.revision &&
          route.expected.turnPolicy === route.turnPolicy &&
          route.expected.classId === route.classId &&
          route.expected.seed === route.seed,
        'Encounter expected identity differs.',
      );
      const recording = snapshotReplay({
        version: ENCOUNTER_VERSIONS.replayVersion,
        build: 'aggregate-expansion-proof',
        ruleset: ENCOUNTER_VERSIONS.ruleset,
        level,
        options: {
          seed: route.seed,
          classId: route.classId,
          turnPolicy: route.turnPolicy,
          classRecipes: campaign.classRecipes,
        },
        segments: route.segments,
        releaseAfter: route.releaseAfter,
        ticks: route.expected.tick,
        summary: route.expected,
        checkpoint: route.checkpoint,
      });
      if (route.variant !== 'ordinary' || route.classId !== 'interceptor') continue;
      const { key } = identify(pack.id, level.id, route.turnPolicy);
      const verified = verifyReplay(recording);
      required(
        verified.match && verified.state.status === 'won',
        `Encounter result changed: ${key}`,
      );
      seen.add(key);
      results.push(verified.actual.summary);
    }
  }
  if (wide !== null) {
    exactKeys(
      wide,
      ['format', 'packId', 'packVersion', 'packSha256', 'campaignId', 'campaignKey', 'routes'],
      'wide proof',
    );
    const pack = packs.find((item) => item.id === wide.packId);
    required(
      wide.format === 'revealline-first-light-proof.v1' &&
        wide.packId === 'fpv-arcade' &&
        pack?.format === WIDE_PACK_VERSION &&
        pack.campaigns.length === 1 &&
        wide.campaignId === 'fpv-first-light' &&
        pack.campaigns[0].id === wide.campaignId &&
        pack.campaigns[0].levels.length === 3,
      'Invalid or unknown wide proof campaign.',
    );
    const campaign = {
      ...pack.campaigns[0],
      classRecipes: pack.classRecipes.filter(
        (recipe) => !pack.campaigns[0].classIds || pack.campaigns[0].classIds.includes(recipe.id),
      ),
    };
    required(
      wide.packVersion === pack.version &&
        wide.packSha256 === digest(pack) &&
        wide.campaignKey === campaignKey(campaign),
      'Wide proof content identity changed.',
    );
    required(Array.isArray(wide.routes) && wide.routes.length === 6, 'Invalid wide route list.');
    for (const route of wide.routes) {
      exactKeys(
        route,
        [
          'levelId',
          'turnPolicy',
          'levelSha256',
          'classesSha256',
          'segments',
          'expected',
          'checkpoint',
        ],
        'wide route',
      );
      const { level, key, ruleset } = identify(pack.id, route.levelId, route.turnPolicy);
      required(
        ruleset === WIDE_VERSIONS.ruleset &&
          route.levelSha256 === digest(level) &&
          route.classesSha256 === digest(campaign.classRecipes),
        'Wide proof map or roster identity changed.',
      );
      required(
        route.expected?.ruleset === ruleset &&
          route.expected.levelId === level.id &&
          route.expected.revision === level.revision &&
          route.expected.turnPolicy === route.turnPolicy &&
          route.expected.classId === 'scout' &&
          route.expected.seed === 1,
        'Wide expected identity differs.',
      );
      required(Array.isArray(route.segments), 'Invalid wide proof segments.');
      const segments = route.segments.map((segment) => {
        exactKeys(segment, ['ticks', 'input'], 'wide segment');
        required(
          ['up', 'right', 'down', 'left'].includes(segment.input?.direction),
          'Wide Arcade proof requires deliberate cardinal directions.',
        );
        // The authored proof uses commands; public replay RLE requires all input
        // defaults and an explicit release flag. Normalize through the recorder.
        const normalized = { ticks: 0, releaseAfter: false, segments: [] };
        recordInput(normalized, segment.input);
        return { ticks: segment.ticks, input: normalized.segments[0].input, releaseBefore: false };
      });
      const recording = snapshotReplay({
        version: WIDE_VERSIONS.replayVersion,
        build: 'aggregate-wide-proof',
        ruleset,
        level,
        options: {
          seed: 1,
          classId: 'scout',
          turnPolicy: route.turnPolicy,
          classRecipes: campaign.classRecipes,
        },
        segments,
        releaseAfter: false,
        ticks: route.expected.tick,
        summary: route.expected,
        checkpoint: route.checkpoint,
      });
      const verified = verifyReplay(recording);
      required(
        verified.match &&
          verified.state.status === 'won' &&
          verified.state.lives === verified.state.rules.lives,
        `Wide result changed: ${key}`,
      );
      seen.add(key);
      results.push(verified.actual.summary);
    }
  }
  required(
    seen.size === expected.size && [...expected.keys()].every((key) => seen.has(key)),
    'Incomplete expansion proof.',
  );
  return { verified: results.length, results };
}
/** Discovery owns only ordinary maps; never replace historical proofs with an unhandled encounter search. */
export function assertDiscoverySupported(packs) {
  required(
    packs.every(
      (pack) =>
        pack.format !== ENCOUNTER_PACK_VERSION &&
        pack.campaigns.every(
          (campaign) => versionsForCampaign(campaign).ruleset === LEGACY_VERSIONS.ruleset,
        ),
    ),
    'Staged encounter discovery is unsupported. Use separately reviewed authored routes; existing proofs were not changed.',
  );
}
async function discover() {
  const packs = await expansionSources(),
    routes = [];
  assertDiscoverySupported(packs);
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
