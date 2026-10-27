import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import {
  CLASSIC_RULES_CURRENT,
  projectClassicCurrentRulesEntry,
} from '../game/mission-library/classic-current-rules.mjs';
import { authoritativeCheckpoint } from '../game/replay.mjs';
import { boundedJSON, required } from '../game/data-json.mjs';
import { readPackJSON } from './pack-indexes.mjs';
import { PACK_LIMITS } from '../game/packs.mjs';

export const NEON_PROOF_PACKS = Object.freeze(['neon-reference-pack', 'neon-mosaic-pack']);
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Replay existing Current-rules receipts; never search for or approve new routes. */
export function verifyNeonRoute(level, options, receipt) {
  required(
    receipt.levelId === level.id && receipt.levelSHA256 === hash(level),
    'Neon route level identity changed.',
  );
  required(
    receipt.rulesEdition === CLASSIC_RULES_CURRENT &&
      receipt.status === 'won' &&
      hash(receipt.options) === hash(options),
    'Neon route execution options changed.',
  );
  const run = replayNeonRoute(level, options, receipt.segments);
  required(
    authoritativeCheckpoint(run).hash === receipt.checkpoint,
    'Neon route no longer reproduces its winning checkpoint.',
  );
  return { levelId: level.id, turnPolicy: options.turnPolicy, status: run.status };
}

export function replayNeonRoute(level, options, segments) {
  required(
    Array.isArray(segments) && segments.length <= 20000,
    'Neon route segment limit exceeded.',
  );
  const run = createRun(level, options),
    denominator = run.totalClaimable;
  let ticks = 0;
  for (const segment of segments) {
    required(Array.isArray(segment) && segment.length === 2, 'Invalid Neon route segment.');
    const [direction, count] = segment;
    required(
      [null, 'up', 'right', 'down', 'left'].includes(direction) &&
        Number.isSafeInteger(count) &&
        count > 0 &&
        count <= 216000,
      'Invalid Neon route input.',
    );
    ticks += count;
    required(ticks <= 216000, 'Neon route tick limit exceeded.');
    for (let i = 0; i < count && run.status === 'running'; i++) {
      stepRun(run, { direction }, FIXED_DT);
      required(
        !run.classic.livesLost && run.totalClaimable === denominator,
        'Neon route lost a life or changed its capture denominator.',
      );
    }
  }
  required(run.status === 'won', 'Neon route no longer wins.');
  return run;
}

export async function verifyIndexedNeonRoutes(root, entries) {
  if (!entries.length) return { standard: 0, gentle: 0, packs: [] };
  const source = await readFile(
    new URL('../docs/qualification/neon-level-completion/winning-routes.json', import.meta.url),
  );
  const archive = boundedJSON(JSON.parse(source), {
    maxBytes: 8 * 1024 * 1024,
    maxNodes: 200000,
    maxDepth: 20,
    maxArray: 20000,
    maxString: 4096,
  });
  required(archive.format === 'revealline-neon-win-archive.v1', 'Invalid Neon proof archive.');
  const key = (r) => `${r.packId}/${r.levelId}/${r.difficulty}/${r.options.turnPolicy}`;
  const receipts = new Map(archive.receipts.map((r) => [key(r), r]));
  required(receipts.size === archive.receipts.length, 'Duplicate Neon route proof.');
  const seen = new Set(),
    result = { standard: 0, gentle: 0, packs: [] };
  for (const entry of entries) {
    required(NEON_PROOF_PACKS.includes(entry.id), 'Unknown Neon proof owner.');
    const { value: pack } = await readPackJSON(
      root,
      `game/content/packs/${entry.path}`,
      PACK_LIMITS.maxBytes,
    );
    required(pack.id === entry.id, 'Neon proof pack identity changed.');
    for (const authored of pack.campaigns) {
      const original = {
        ...authored,
        classRecipes: pack.classRecipes.filter((r) => authored.classIds.includes(r.id)),
      };
      const projected = projectClassicCurrentRulesEntry(
        { campaign: original },
        CLASSIC_RULES_CURRENT,
      );
      for (const difficulty of ['standard', 'gentle']) {
        const { campaign } = createDifficultyContext(projected.campaign, difficulty);
        for (const level of campaign.levels)
          for (const turnPolicy of ['grid-center', 'immediate']) {
            const options = {
              seed: 1,
              turnPolicy,
              classId: 'scout',
              classRecipes: campaign.classRecipes,
            };
            const id = key({ packId: pack.id, levelId: level.id, difficulty, options });
            required(!seen.has(id) && receipts.has(id), 'Missing or duplicate indexed Neon route.');
            verifyNeonRoute(level, options, receipts.get(id));
            seen.add(id);
            result[difficulty]++;
          }
      }
    }
    result.packs.push(pack.id);
  }
  required(
    archive.receipts.filter((r) => result.packs.includes(r.packId)).length === seen.size,
    'Neon archive includes an unowned route.',
  );
  return result;
}
