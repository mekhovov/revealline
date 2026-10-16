/** Full-sortie ordinary-input policies. This does not emulate human players. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../../../../game/overflight/core.mjs';
import {
  createOverflightRiy,
  stepOverflightRiy,
  overflightRiyTarget,
} from '../../../../game/overflight/riy-core.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../../../../game/overflight/riy-project.mjs';
import { pilot, selectCard } from '../../../../game/overflight/review-pilot.mjs';
const root = new URL('../../../../', import.meta.url);
const paths = [
  'game/overflight/core.mjs',
  'game/overflight/project.mjs',
  'game/overflight/tactics.mjs',
  'game/overflight/combat-profile.mjs',
  'game/overflight/upgrades.mjs',
  'game/overflight/review-pilot.mjs',
  'game/overflight/riy-core.mjs',
  'game/overflight/riy-project.mjs',
];
const bindings = () =>
  paths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(new URL(path, root)))
      .digest('hex'),
  }));
const evidence = {
  format: 'OverflightRiySortieReviewV1',
  capturedAt: new Date().toISOString(),
  source: bindings(),
  policy:
    'Same deterministic tight flight policy and earned upgrades. Follow never commands. Focus commands eligible guarded/armored/elite/final targets, sampled at10Hz when cooldown ready. No runtime power grants.',
  results: [],
  parked: [],
};
function save() {
  writeFileSync(
    new URL('sorties.json.gz', import.meta.url),
    gzipSync(JSON.stringify(evidence, null, 2)),
  );
}
function qualify({ encounterSet, direction, command, parked = false, difficulty = 'standard' }) {
  const project = createOverflightRiyProject({ seed: 17031991, encounterSet, difficulty });
  const run = createOverflightRun(compileOverflightRiyProject(project), { airframes: 3 });
  run.riy = createOverflightRiy(run);
  startOverflight(run);
  let input = {},
    focus = false,
    escortKills = 0,
    escortGoalDamage = 0,
    focusedTicks = 0,
    draftBlocked = false;
  const samples = [];
  while (!['won', 'lost'].includes(run.phase) && run.time < 480) {
    while (run.phase === 'upgrade') {
      const card = selectCard(run, direction);
      if (!card) {
        draftBlocked = true;
        break;
      }
      if (!chooseOverflightUpgrade(run, card.id)) throw Error('Illegal earned card');
    }
    if (draftBlocked) break;
    if (run.tick % 6 === 0) {
      input = parked ? {} : pilot(run, 'tight');
      const t = overflightRiyTarget(run);
      focus =
        command &&
        run.riy.cooldown === 0 &&
        !!t &&
        (t.role !== 'common' || t.maxArmor > 0 || t.guardIntegrity > 0);
    }
    const beforeTick = run.tick;
    stepOverflight(run, input);
    if (run.tick !== beforeTick) {
      const kills = run.stats.kills;
      const goals = run.enemies
        .filter((e) => e.active && ['elite', 'final'].includes(e.role))
        .map((e) => ({ enemy: e, hp: e.hp }));
      stepOverflightRiy(run, { focus });
      focus = false;
      escortKills += run.stats.kills - kills;
      for (const { enemy, hp } of goals)
        escortGoalDamage += Math.max(0, hp - (enemy.active ? enemy.hp : 0));
      if (run.riy.targetId !== null) focusedTicks++;
    }
    if (run.tick % 300 === 0)
      samples.push({
        time: run.time,
        hull: run.player.hull,
        visible: run.stats.enemiesVisible,
        kills: run.stats.kills,
        commands: run.riy.commands,
        focus: run.riy.targetId,
        escorts: run.riy.escorts.map((e) => ({ role: e.role, x: e.x, y: e.y, shots: e.shots })),
      });
  }
  return {
    encounterSet,
    direction,
    policy: command ? 'focus' : 'follow',
    parked,
    difficulty,
    seed: run.seed,
    projectIdentity: run.compiled.projectIdentity,
    summary: overflightSummary(run),
    draftBlocked,
    commands: run.riy.commands,
    escortKills,
    escortGoalDamage,
    focusedSeconds: focusedTicks / 60,
    shots: run.riy.escorts.map((e) => ({ role: e.role, shots: e.shots })),
    samples,
  };
}
for (const encounterSet of ['front', 'crossing', 'mixed'])
  for (const direction of ['fan-shield', 'systems'])
    for (const command of [false, true]) {
      const r = qualify({ encounterSet, direction, command });
      evidence.results.push(r);
      save();
      console.log(
        JSON.stringify({
          encounterSet,
          direction,
          policy: r.policy,
          outcome: r.summary.outcome,
          time: r.summary.time,
          commands: r.commands,
          escortKills: r.escortKills,
          escortGoalDamage: r.escortGoalDamage,
        }),
      );
    }
for (const difficulty of ['standard', 'veteran'])
  for (const command of [false, true]) {
    const r = qualify({
      encounterSet: 'front',
      direction: 'systems',
      command,
      parked: true,
      difficulty,
    });
    evidence.parked.push(r);
    save();
    console.log(
      JSON.stringify({
        parked: true,
        difficulty,
        policy: r.policy,
        outcome: r.summary.outcome,
        time: r.summary.time,
        commands: r.commands,
      }),
    );
  }
evidence.sourceAtFinish = bindings();
save();
