import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT, CELL } from '../game/core/index.mjs';
import { retainedCaptureCells } from '../game/core/capture-regions.mjs';
import { campaignKey } from '../game/library.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import {
  projectClassicCurrentRulesEntry,
  CLASSIC_RULES_CURRENT,
} from '../game/mission-library/classic-current-rules.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';

// Offline route search, not a player assist. Speculative captures rank candidate
// paths only. Every accepted move and the independent final replay use stepRun
// with ordinary directional input, the unmodified level, and active enemies.
const directions = [
  ['up', 0, -1],
  ['right', 1, 0],
  ['down', 0, 1],
  ['left', -1, 0],
];
const indexOfPlayer = (run) => Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
const neighbor = (run, i, d) => {
  const [, dx, dy] = directions[d],
    x = (i % run.width) + dx,
    y = Math.floor(i / run.width) + dy;
  return x >= 0 && y >= 0 && x < run.width && y < run.height ? y * run.width + x : -1;
};
function safePaths(run) {
  const start = indexOfPlayer(run),
    queue = [start];
  const parent = new Int32Array(run.cells.length).fill(-1),
    distance = new Int32Array(run.cells.length).fill(-1);
  distance[start] = 0;
  for (let p = 0; p < queue.length; p++)
    for (let d = 0; d < 4; d++) {
      const n = neighbor(run, queue[p], d);
      if (n >= 0 && distance[n] < 0 && run.cells[n] === CELL.SAFE) {
        parent[n] = queue[p];
        distance[n] = distance[queue[p]] + 1;
        queue.push(n);
      }
    }
  const path = (i) => {
    const result = [];
    for (; i !== -1; i = parent[i]) result.push(i);
    return result.reverse();
  };
  return { queue, distance, path };
}
function candidates(run, safe) {
  const result = [],
    unique = new Set();
  const add = (path) => {
    if (path.length < 3 || run.cells[path.at(-1)] !== CELL.SAFE) return;
    const key = path
      .slice()
      .sort((a, b) => a - b)
      .join(',');
    if (unique.has(key)) return;
    unique.add(key);
    result.push(path);
  };
  const walk = (path, d, limit = 80) => {
    const copy = [...path];
    for (let i = 0; i < limit; i++) {
      const n = neighbor(run, copy.at(-1), d);
      if (
        n < 0 ||
        copy.includes(n) ||
        run.cells[n] === CELL.WALL ||
        (run.cells[n] !== CELL.SAFE && run.classic.terrain[n] === 2)
      )
        break;
      copy.push(n);
      if (run.cells[n] === CELL.SAFE) {
        add(copy);
        break;
      }
    }
    return copy;
  };
  const turns = [1, 2, 3, 5, 8, 12, 18, 26, 40, 60];
  for (const start of safe.queue)
    for (let d = 0; d < 4; d++) {
      const n = neighbor(run, start, d);
      if (n < 0 || run.cells[n] !== CELL.FIELD || run.classic.terrain[n] === 2) continue;
      const straight = walk([start], d);
      for (const depth of turns) {
        if (depth >= straight.length || run.cells[straight[depth]] === CELL.SAFE) break;
        const stem = straight.slice(0, depth + 1);
        for (const turn of [(d + 1) % 4, (d + 3) % 4]) {
          const arm = walk(stem, turn);
          for (const span of [1, 2, 4, 8, 16]) {
            if (depth + span >= arm.length || run.cells[arm[depth + span]] === CELL.SAFE) break;
            walk(arm.slice(0, depth + span + 1), (d + 2) % 4);
          }
        }
      }
    }
  // A motif may need a winding return that no straight/rectangular cut covers.
  for (const start of safe.queue) {
    const queue = [],
      parent = new Int32Array(run.cells.length).fill(-1);
    parent[start] = start;
    for (let d = 0; d < 4; d++) {
      const n = neighbor(run, start, d);
      if (n >= 0 && run.cells[n] === CELL.FIELD && run.classic.terrain[n] !== 2) {
        parent[n] = start;
        queue.push(n);
      }
    }
    let found = false;
    for (let p = 0; p < queue.length && !found; p++)
      for (let d = 0; d < 4; d++) {
        const n = neighbor(run, queue[p], d);
        if (
          n < 0 ||
          parent[n] !== -1 ||
          run.cells[n] === CELL.WALL ||
          (run.cells[n] !== CELL.SAFE && run.classic.terrain[n] === 2)
        )
          continue;
        parent[n] = queue[p];
        if (run.cells[n] === CELL.SAFE) {
          const path = [n];
          for (let i = queue[p]; i !== start; i = parent[i]) path.push(i);
          path.push(start);
          add(path.reverse());
          found = true;
          break;
        }
        queue.push(n);
      }
  }
  return result;
}
function pushInput(segments, direction) {
  if (segments.at(-1)?.[0] === direction) segments.at(-1)[1]++;
  else segments.push([direction, 1]);
}
function executePath(source, path) {
  const run = structuredClone(source),
    segments = [];
  for (const i of path) {
    const target = { x: (i % run.width) + 0.5, y: Math.floor(i / run.width) + 0.5 };
    for (let attempt = 0; attempt < 80; attempt++) {
      const dx = target.x - run.player.x,
        dy = target.y - run.player.y;
      if (Math.abs(dx) < 0.045 && Math.abs(dy) < 0.045) break;
      // A cell-centre route must never correct diagonally across another cell.
      const direction =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      const before = [run.player.x, run.player.y];
      stepRun(run, { direction }, FIXED_DT);
      pushInput(segments, direction);
      if (run.classic.livesLost || run.status === 'lost' || run.status === 'respawning')
        return null;
      if (run.status === 'won') return { run, segments };
      if (Math.hypot(run.player.x - before[0], run.player.y - before[1]) < 1e-8) return null;
      if (attempt === 79) return null;
    }
  }
  return run.player.cutting ? null : { run, segments };
}
function rank(run, safe, paths) {
  // The ranking may speculate about captures, but cannot enter the receipt.
  return paths
    .map((path) => {
      const cells = Uint8Array.from(run.cells);
      for (const i of path) cells[i] = CELL.SAFE;
      const retained = retainedCaptureCells({ ...run, cells });
      let claimed = 0;
      for (let i = 0; i < cells.length; i++)
        if (run.cells[i] === CELL.FIELD && (cells[i] === CELL.SAFE || !retained[i]))
          claimed += run.classic.coverageEligible[i];
      const gain = claimed / run.totalClaimable;
      return {
        path,
        gain,
        score: gain / Math.pow(path.length + safe.distance[path[0]] * 0.5, 0.55),
      };
    })
    .filter((c) => c.gain > 0)
    .sort((a, b) => b.score - a.score);
}
async function qualify(level, options, maxRounds) {
  let run = createRun(level, options),
    segments = [],
    backtracks = 0;
  const history = [];
  for (let round = 0; round < maxRounds && run.status === 'running'; round++) {
    const safe = safePaths(run),
      ranked = rank(run, safe, candidates(run, safe));
    let best = null,
      count = 0;
    const choices = [];
    for (const delay of [0, 15, 30, 60, 120, 240, 360]) {
      const departure = structuredClone(run);
      for (let t = 0; t < delay && departure.status === 'running'; t++)
        stepRun(departure, {}, FIXED_DT);
      if (departure.status !== 'running' || departure.classic.livesLost) continue;
      count = 0;
      for (const candidate of ranked.slice(0, 160)) {
        const traveled = executePath(departure, [
          ...safe.path(candidate.path[0]),
          ...candidate.path.slice(1),
        ]);
        count++;
        if (!traveled || traveled.run.coverage <= run.coverage) continue;
        if (delay) traveled.segments.unshift([null, delay]);
        const score =
          (traveled.run.coverage - run.coverage) / Math.pow(traveled.run.tick - run.tick, 0.55);
        choices.push({ ...traveled, score });
        if (!best || score > best.score) best = { ...traveled, score };
        if (traveled.run.status === 'won') {
          best = traveled;
          break;
        }
        if (choices.length >= 3 && count >= 12) break;
      }
      if (best) break;
    }
    if (!best) {
      while (history.length && !history.at(-1).choices.length) history.pop();
      if (history.length && backtracks++ < 60) {
        const previous = history.at(-1),
          alternative = previous.choices.shift();
        run = alternative.run;
        segments = [...previous.segments, ...alternative.segments];
        console.log(`${level.id}: trying an earlier alternate return (${backtracks})`);
        continue;
      }
      return {
        status: 'search-incomplete',
        levelId: level.id,
        options,
        segments,
        round,
        coverage: run.coverage,
        time: run.time,
        candidates: ranked.length,
        player: run.player,
      };
    }
    history.push({
      segments,
      choices: choices.filter((c) => c.run !== best.run).sort((a, b) => b.score - a.score),
    });
    if (history.length > 10) history.shift();
    run = best.run;
    segments = [...segments, ...best.segments];
    console.log(
      `${level.id}: search step ${round + 1}, ${(run.coverage * 100).toFixed(1)}%, ${run.time.toFixed(1)}s`,
    );
  }
  if (run.status !== 'won')
    return {
      status: 'search-incomplete',
      levelId: level.id,
      options,
      segments,
      coverage: run.coverage,
      time: run.time,
    };
  const receipt = replaySegments(level, options, segments);
  if (!receipt || authoritativeCheckpoint(run).hash !== receipt.checkpoint)
    throw new Error('Search result differs from its independent input replay');
  return receipt;
}

function replaySegments(level, options, segments) {
  const final = createRun(level, options),
    recorder = createRecorder(level, options, 'neon-moving-enemy-feasibility-not-human-balance');
  const compact = [],
    denominator = final.totalClaimable;
  for (const [direction, ticks] of segments) {
    if (
      ![null, 'up', 'right', 'down', 'left'].includes(direction) ||
      !Number.isSafeInteger(ticks) ||
      ticks < 1 ||
      ticks > 216000
    )
      throw new Error('Invalid route segment');
    for (let i = 0; i < ticks; i++) {
      if (final.status === 'won') break;
      if (final.status !== 'running') return null;
      recordInput(recorder, { direction });
      stepRun(final, { direction }, FIXED_DT);
      pushInput(compact, direction);
      if (final.classic.livesLost || final.totalClaimable !== denominator) return null;
    }
    if (final.status === 'won') break;
  }
  if (final.status !== 'won') return null;
  const replay = exportReplay(recorder, final),
    verification = verifyReplay(replay);
  if (!verification.match || verification.state.status !== 'won') throw new Error('Replay failed');
  return {
    format: 'revealline-neon-win-receipt.v1',
    scope: 'Deterministic moving-enemy feasibility; not human balance or device approval.',
    status: 'won',
    levelId: level.id,
    revision: level.revision,
    levelSHA256: createHash('sha256').update(JSON.stringify(level)).digest('hex'),
    options,
    time: final.time,
    livesLost: final.classic.livesLost,
    coverage: final.coverage,
    totalClaimable: final.totalClaimable,
    checkpoint: authoritativeCheckpoint(final).hash,
    segments: compact,
  };
}

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const filter = arg('level', ''),
  difficulty = arg('difficulty', 'standard'),
  turnPolicy = arg('steering', 'grid-center');
const output = arg('output', '/tmp/neon-route-receipts');
const archivePath = arg('receipts', '');
const archive = archivePath ? JSON.parse(await readFile(archivePath, 'utf8')) : null;
if (archive && archive.format !== 'revealline-neon-win-archive.v1')
  throw new Error('Unsupported receipt archive');
const savedReceipts = new Map(
  (archive?.receipts ?? []).map((row) => [
    `${row.levelId}-${row.difficulty}-${row.options.turnPolicy}`,
    row,
  ]),
);
const readReceipt = async (key) =>
  savedReceipts.get(key) ??
  (await readFile(`${output}/${key}.json`, 'utf8')
    .then(JSON.parse)
    .catch(() => null));
const packFilter = arg('pack', ''),
  maxRounds = Number(arg('rounds', '300'));
if (!['standard', 'gentle'].includes(difficulty)) throw new Error('Unsupported difficulty');
if (!['grid-center', 'immediate'].includes(turnPolicy)) throw new Error('Unsupported steering');
if (!['', 'neon-reference-pack', 'neon-mosaic-pack'].includes(packFilter))
  throw new Error('Unsupported pack');
if (!Number.isSafeInteger(maxRounds) || maxRounds < 1 || maxRounds > 10000)
  throw new Error('Rounds must be an integer from 1 to 10000');
let selected = 0,
  incomplete = 0;
await mkdir(output, { recursive: true });
for (const id of ['neon-reference-pack', 'neon-mosaic-pack']) {
  if (packFilter && id !== packFilter) continue;
  const pack = JSON.parse(
    await readFile(new URL(`../game/content/packs/${id}.json`, import.meta.url)),
  );
  for (const sourceCampaign of pack.campaigns) {
    const campaign = {
      ...sourceCampaign,
      classRecipes: pack.classRecipes.filter((recipe) =>
        sourceCampaign.classIds.includes(recipe.id),
      ),
    };
    const current = projectClassicCurrentRulesEntry({ campaign }, CLASSIC_RULES_CURRENT);
    const context = createDifficultyContext(current.campaign, difficulty);
    for (const level of context.campaign.levels) {
      if (filter && !level.id.includes(filter)) continue;
      selected++;
      const options = {
        seed: 1,
        turnPolicy,
        classId: 'scout',
        classRecipes: context.campaign.classRecipes,
      };
      const file = `${output}/${level.id}-${difficulty}-${turnPolicy}.json`;
      if (process.argv.includes('--resume') || process.argv.includes('--replay-only')) {
        const previous = await readReceipt(`${level.id}-${difficulty}-${turnPolicy}`);
        if (
          previous?.status === 'won' &&
          previous.levelSHA256 ===
            createHash('sha256').update(JSON.stringify(level)).digest('hex') &&
          JSON.stringify(previous.options) === JSON.stringify(options)
        ) {
          const verified = replaySegments(level, options, previous.segments);
          if (!verified || verified.checkpoint !== previous.checkpoint)
            throw new Error(`Stale route receipt: ${file}`);
          await writeFile(file, JSON.stringify({ ...previous, ...verified }, null, 2) + '\n');
          continue;
        }
        if (process.argv.includes('--replay-only'))
          throw new Error(`Missing or outdated receipt: ${file}`);
      }
      let reused = null;
      for (const candidateDifficulty of new Set([difficulty, 'standard'])) {
        const previous = await readReceipt(`${level.id}-${candidateDifficulty}-grid-center`);
        if (previous?.status === 'won') reused = replaySegments(level, options, previous.segments);
        if (reused) break;
      }
      const result = reused ?? (await qualify(level, options, maxRounds));
      if (result.status !== 'won') incomplete++;
      await writeFile(
        file,
        JSON.stringify(
          {
            packId: id,
            campaignKey: campaignKey(campaign),
            rulesEdition: CLASSIC_RULES_CURRENT,
            difficulty,
            ...result,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(
        JSON.stringify({
          id: level.id,
          status: result.status,
          coverage: result.coverage,
          time: result.time,
        }),
      );
    }
  }
}
if (!selected) throw new Error('No levels matched the requested filter');
console.log(`${selected - incomplete}/${selected} moving-enemy wins verified.`);
if (incomplete) process.exitCode = 1;
