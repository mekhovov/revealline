/** Constructed correctness fixtures, not earned builds or balance evidence. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as core from '../../../../game/overflight/core.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../../../../game/overflight/riy-project.mjs';
import * as current from '../../../../game/overflight/riy-core.mjs';
const root = new URL('../../../../', import.meta.url);
const base = '859d5cfc9';
const source = execFileSync('git', ['show', `${base}:game/overflight/riy-core.mjs`], {
  cwd: root,
  encoding: 'utf8',
}).replace(/from '([^']+)'/g, (text, path) =>
  path.startsWith('.')
    ? `from '${new URL(path, new URL('game/overflight/riy-core.mjs', root)).href}'`
    : text,
);
const previous = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const digest = (run) =>
  createHash('sha256')
    .update(
      JSON.stringify(run, (key, value) =>
        ['shotSegments', 'shotSegmentCount'].includes(key) ? undefined : value,
      ),
    )
    .digest('hex');
const results = [];
for (const [rulesVersion, branch, escortBranch] of [
  [2, 'wide', null],
  [4, 'wide', 'burst'],
  [4, 'wide', 'chain'],
  [4, 'double', 'burst'],
  [4, 'double', 'chain'],
]) {
  const compiled = structuredClone(
    compileOverflightRiyProject(createOverflightRiyProject({ rulesVersion, seed: 202604 })),
  );
  compiled.encounters = [];
  compiled.terrain = null;
  compiled.goals = { ...compiled.goals, eliteAt: 10000, finalAt: 20000 };
  const pair = [previous, current].map((api) => {
    const run = core.createOverflightRun(compiled, { seed: 202604 });
    run.riy = api.createOverflightRiy(run);
    run.build.primary = { rank: 4, branch, evolved: true };
    if (escortBranch)
      for (const item of run.build.escorts)
        Object.assign(item, { rank: 3, branch: item.role === 'breaker' ? escortBranch : 'broad' });
    core.startOverflight(run);
    for (let i = 0; i < 12; i++)
      core.spawnOverflightEnemy(run, {
        family: 'patroller',
        x: run.player.x + ((i % 4) - 1.5) * 55,
        y: run.player.y + (Math.floor(i / 4) - 1) * 65,
        hp: 100000,
        speed: 0,
        warning: 0,
      });
    return run;
  });
  let compared = 0,
    maxLinks = 0;
  for (let tick = 0; tick < 900; tick++) {
    const input = {
      x: Math.cos(tick / 120),
      y: Math.sin(tick / 120),
      boost: tick % 180 === 0,
      focus: tick % 360 === 0,
    };
    for (const [index, api] of [previous, current].entries()) {
      const before = pair[index].tick;
      core.stepOverflight(pair[index], input);
      if (before !== pair[index].tick) api.stepOverflightRiy(pair[index], input);
    }
    maxLinks = Math.max(maxLinks, ...pair[1].riy.escorts.map((escort) => escort.shotSegmentCount));
    if (tick % 60 === 0 || tick === 899) {
      assert.equal(
        digest(pair[1]),
        digest(pair[0]),
        `simulation differs: ${rulesVersion}/${branch}/${escortBranch} at ${tick}`,
      );
      compared++;
    }
  }
  results.push({
    rulesVersion,
    branch,
    escortBranch,
    compared,
    maxLinks,
    time: pair[1].time,
    damageDealt: pair[1].stats.damageDealt,
    damageTaken: pair[1].stats.damageTaken,
    phase: pair[1].phase,
  });
}
const report = {
  base,
  candidate: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  kind: 'constructed simulation parity, not balance qualification',
  cases: results,
  passed: true,
};
writeFileSync(new URL('./parity.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
