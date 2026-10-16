/** Public-input balance diagnostic. No injected upgrades, movement or healing. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import {
  createOverflightProject,
  compileOverflightProject,
} from '../../../../game/overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
} from '../../../../game/overflight/core.mjs';
import { createOverflightRiyMode } from '../../../../game/overflight/riy-mode.mjs';
import { pilot, selectCard } from '../../../../game/overflight/review-pilot.mjs';
import { overflightTerrainClear } from '../../../../game/overflight/terrain.mjs';
const base = {
  createRun: createOverflightRun,
  step: stepOverflight,
  pilot,
  selectCard,
  createProject: createOverflightProject,
  compileProject: compileOverflightProject,
  defaultProject: null,
};
const modes = { survivor: base, riy: createOverflightRiyMode(base) };
const sources = [
  'core',
  'raid-core',
  'motion',
  'coordinated-movement',
  'tactics',
  'battlefields',
  'terrain',
  'project',
  'riy-core',
  'riy-project',
  'worlds',
  'review-pilot',
];
const hashes = () =>
  Object.fromEntries(
    sources.map((id) => [
      id,
      createHash('sha256')
        .update(readFileSync(new URL(`../../../../game/overflight/${id}.mjs`, import.meta.url)))
        .digest('hex'),
    ]),
  );
const startHashes = hashes(),
  startedAt = new Date().toISOString();
const extended = process.argv.includes('--extended');
const policies = process.argv.includes('--lanes')
  ? ['straight-shuttle', 'heading-0', 'heading-2', 'heading-4', 'heading-6']
  : extended
    ? [
        'active',
        'park',
        'straight-shuttle',
        'tiny-circle',
        'wall',
        'orbit',
        ...Array.from({ length: 8 }, (_, i) => `heading-${i}`),
      ]
    : ['active', 'park'];
const cases = [];
for (const layout of ['field-crossing-broken-crossroads', 'freight-depot-loading-loop'])
  for (const modeId of ['survivor', 'riy'])
    for (const policy of policies) {
      const mode = modes[modeId],
        seed = 17031991,
        checkpoint = 120,
        maxSeconds = 240;
      const compiled = mode.compileProject(
        mode.createProject({ rulesVersion: 4, layout, seed, difficulty: 'standard' }),
      );
      const run = mode.createRun(compiled, { seed, airframes: 3 });
      startOverflight(run);
      const trace = [],
        windows = [];
      let input = {},
        before = null,
        safeStart = checkpoint,
        longest = { seconds: 0, kills: 0, collected: 0 },
        windowKills = 0,
        windowCollected = 0,
        currentPattern = null;
      let safeKills = 0,
        safeCollected = 0,
        checkpointReached = false,
        origin = null,
        heading = 0,
        lastSecond = -1;
      while (run.phase === 'playing' || run.phase === 'upgrade') {
        if (run.phase === 'upgrade') {
          const card = mode.selectCard(run, 'fan-shield');
          if (!card) throw new Error('No legal earned card');
          chooseOverflightUpgrade(run, card.id);
          continue;
        }
        if (run.time >= maxSeconds) break;
        if (!checkpointReached && run.time >= checkpoint) {
          checkpointReached = true;
          origin = { x: run.player.x, y: run.player.y };
          heading = run.player.heading;
          before = { damage: run.stats.damageTaken, shield: run.stats.shieldBlocks };
          safeStart = run.time;
          safeKills = run.stats.kills;
          safeCollected = run.stats.xpCollected;
        }
        if (run.tick % 6 === 0) {
          input = mode.pilot(run, 'fan-shield');
          if (checkpointReached && policy !== 'active') {
            const t = run.time - checkpoint;
            if (policy === 'park') input = { x: 0, y: 0 };
            else if (policy === 'straight-shuttle') {
              const sign = Math.sin((t * Math.PI) / 3) >= 0 ? 1 : -1;
              input = { x: Math.cos(heading) * sign, y: Math.sin(heading) * sign };
            } else if (policy === 'tiny-circle') input = { x: Math.cos(t * 9), y: Math.sin(t * 9) };
            else if (policy === 'wall') input = { x: -1, y: 0 };
            else if (policy === 'orbit') input = { x: Math.cos(t * 0.8), y: Math.sin(t * 0.8) };
            else {
              const angle = (Number(policy.split('-')[1]) * Math.PI) / 4;
              input = { x: Math.cos(angle), y: Math.sin(angle) };
            }
            input.boost = false;
            input.focus = false;
          }
        }
        mode.step(run, input);
        if (checkpointReached) {
          const interval = run.time - safeStart;
          if (interval > longest.seconds)
            longest = {
              seconds: interval,
              kills: run.stats.kills - safeKills,
              collected: run.stats.xpCollected - safeCollected,
            };
          if (run.stats.damageTaken !== before.damage || run.stats.shieldBlocks !== before.shield) {
            safeStart = run.time;
            safeKills = run.stats.kills;
            safeCollected = run.stats.xpCollected;
            before = { damage: run.stats.damageTaken, shield: run.stats.shieldBlocks };
          }
        }
        if (Math.floor(run.time) > lastSecond) {
          lastSecond = Math.floor(run.time);
          let sectors = 0,
            reachable = 0;
          for (const enemy of run.enemies)
            if (enemy.active && Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y) < 300) {
              const a = Math.atan2(enemy.y - run.player.y, enemy.x - run.player.x);
              sectors |= 1 << Math.floor((a + Math.PI) / (Math.PI / 4)) % 8;
            }
          for (const pickup of run.pickups)
            if (
              pickup.active &&
              overflightTerrainClear(
                run.terrain,
                run.player.x,
                run.player.y,
                pickup.x,
                pickup.y,
                run.player.radius,
              )
            )
              reachable += pickup.value;
          trace.push({
            t: run.time,
            x: run.player.x,
            y: run.player.y,
            heading: run.player.heading,
            hull: run.player.hull,
            lives: run.airframesRemaining,
            kills: run.stats.kills,
            damage: run.stats.damageTaken,
            shield: run.stats.shieldBlocks,
            earned: run.stats.xpEarned,
            collected: run.stats.xpCollected,
            reachable,
            sectors,
            pattern: run.encounter,
            warningDeferrals: run.stats.warningDeferrals ?? 0,
            motionDeferrals: run.stats.motionDeferrals ?? 0,
          });
          if (currentPattern !== run.encounter) {
            windows.push({
              pattern: currentPattern,
              kills: run.stats.kills - windowKills,
              collected: run.stats.xpCollected - windowCollected,
            });
            currentPattern = run.encounter;
            windowKills = run.stats.kills;
            windowCollected = run.stats.xpCollected;
          }
        }
      }
      const row = {
        layout,
        mode: modeId,
        policy,
        seed,
        checkpoint,
        maxSeconds,
        checkpointReached,
        phase: run.phase,
        time: run.time,
        compiledIdentity: compiled.projectIdentity,
        build: run.progression.history,
        longestSafeFarming: longest,
        stats: run.stats,
        trace,
        windows,
      };
      cases.push(row);
      console.error(
        JSON.stringify({
          layout,
          mode: modeId,
          policy,
          phase: run.phase,
          time: run.time,
          longestSafeFarming: longest,
        }),
      );
    }
const endHashes = hashes();
const report = {
  schema: 'OverflightFixedLaneProbeV1',
  startedAt,
  endedAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceStable: JSON.stringify(startHashes) === JSON.stringify(endHashes),
  startHashes,
  endHashes,
  limitations: [
    'Bounded240-second diagnostic; not full-sortie qualification.',
    'Standard difficulty,three airframes,one seed,FanShield earned build.',
    'Safe interval counts neither hull damage nor shield consumption; cleared-space relief is allowed.',
    'Reachable salvage means direct unobstructed path; bent-route reachability may be higher.',
    'Existing reviewpilot may not navigate new cover well; report stuckroutes,do not buffgame toforcepass.',
  ],
  cases,
};
const output = process.argv.find((arg) => arg.endsWith('.json') || arg.endsWith('.json.gz'));
if (output) {
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
  writeFileSync(output, output.endsWith('.gz') ? gzipSync(bytes) : bytes);
} else console.log(JSON.stringify(report));
