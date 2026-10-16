#!/usr/bin/env node
/** Ordinary input + earned-card reproduction; --ref replays retained Git source. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const mode = option('mode', 'park');
const wanted = Number(option('rank', '2'));
const seed = Number(option('seed', '17031991'));
const limit = Number(option('limit', '240'));
const revision = option('ref', null);
if (
  !['park', 'move'].includes(mode) ||
  ![1, 2, 3].includes(wanted) ||
  !Number.isSafeInteger(seed) ||
  seed < 1 ||
  !Number.isFinite(limit) ||
  limit <= 0
)
  throw new Error('Invalid experiment options.');
const paths = [
  'package.json',
  'game/data-json.mjs',
  'game/i18n/index.mjs',
  'game/i18n/catalogs.mjs',
  'game/i18n/bootstrap.mjs',
  'game/vendor/i18next-26.4.2.min.js',
  'game/overflight/core.mjs',
  'game/overflight/grid.mjs',
  'game/overflight/project.mjs',
  'game/overflight/review-pilot.mjs',
  'game/overflight/upgrades.mjs',
];
let temporary = null;
try {
  const source = revision
    ? (temporary = mkdtempSync(join(tmpdir(), 'overflight-balance-')))
    : repository;
  if (revision)
    for (const path of paths) {
      const bytes = execFileSync('git', ['show', `${revision}:${path}`], {
        cwd: repository,
        maxBuffer: 32 * 1024 * 1024,
      });
      mkdirSync(dirname(resolve(source, path)), { recursive: true });
      writeFileSync(resolve(source, path), bytes, { flag: 'wx' });
    }
  const sourceBindings = paths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(resolve(source, path)))
      .digest('hex'),
  }));
  const load = (path) => import(pathToFileURL(resolve(source, path)));
  const {
    createOverflightRun,
    startOverflight,
    stepOverflight,
    chooseOverflightUpgrade,
    rerollOverflightUpgrades,
  } = await load('game/overflight/core.mjs');
  const { compileOverflightProject, createOverflightProject } = await load(
    'game/overflight/project.mjs',
  );
  const { pilot } = await load('game/overflight/review-pilot.mjs');
  const run = createOverflightRun(compileOverflightProject(createOverflightProject({ seed })), {
    airframes: 1,
  });
  startOverflight(run);
  let rankEarnedAt = null,
    firstDamageAfterRank = null,
    hullAtRank = null,
    damageAtRank = 0,
    input = {};
  const samples = [];
  const score = (card) =>
    card.system === 'proximity-pulse'
      ? -100
      : card.system === 'primary' && card.branch === 'double'
        ? 0
        : card.system === 'slow-field'
          ? 10
          : card.system === 'shield'
            ? 20
            : card.system === 'repair'
              ? 30
              : 40;
  while (!['lost', 'won'].includes(run.phase) && run.time < limit) {
    while (run.phase === 'upgrade') {
      let cards = [...run.offers].sort((a, b) => score(a) - score(b));
      if (
        !run.build.combat.some(
          (module) => module.id === 'proximity-pulse' && module.rank >= wanted,
        ) &&
        cards[0].system !== 'proximity-pulse' &&
        run.progression.rerolls
      ) {
        rerollOverflightUpgrades(run);
        cards = [...run.offers].sort((a, b) => score(a) - score(b));
      }
      if (!chooseOverflightUpgrade(run, cards[0].id))
        throw new Error('An earned draft was rejected.');
      if (
        rankEarnedAt === null &&
        run.build.combat.some((module) => module.id === 'proximity-pulse' && module.rank >= wanted)
      ) {
        rankEarnedAt = run.time;
        hullAtRank = run.player.hull;
        damageAtRank = run.stats.damageTaken;
      }
    }
    if (run.tick % 6 === 0) input = mode === 'park' && rankEarnedAt !== null ? {} : pilot(run);
    stepOverflight(run, input);
    if (
      rankEarnedAt !== null &&
      firstDamageAfterRank === null &&
      run.stats.damageTaken > damageAtRank
    )
      firstDamageAfterRank = run.time;
    if (run.tick % 600 === 0)
      samples.push({
        time: run.time,
        hull: run.player.hull,
        kills: run.stats.kills,
        xp: run.progression.xp,
      });
  }
  console.log(
    JSON.stringify(
      {
        format: 'OverflightEarnedPulseBalanceV1',
        protocol:
          'One airframe, default front encounters, ordinary 10 Hz pilot until selected pulse rank, legal earned drafts throughout; park releases movement, move continues the same pilot.',
        injectedBuild: false,
        fixture: false,
        directStateWrites: false,
        mode,
        wanted,
        seed,
        limit,
        revision: revision ?? 'working-tree',
        sourceBindings,
        outcome: run.phase,
        time: run.time,
        rankEarnedAt,
        firstDamageAfterRank,
        hullAtRank,
        hull: run.player.hull,
        damageAfterRank: run.stats.damageTaken - damageAtRank,
        kills: run.stats.kills,
        xp: run.progression.xp,
        build: run.build,
        history: run.progression.history,
        samples,
      },
      null,
      2,
    ),
  );
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
