import { CLASSIC_SNAKE_OPERATION_LEVELS_B } from '../game/snake/classic-catalogue-operations-b.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { CLASSIC_SNAKE_OPERATION_LEVELS_A } from '../game/snake/classic-catalogue-operations-a.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';

const suite = process.argv.find((a) => a.startsWith('--suite='))?.slice(8) ?? 'operations-a';
if (!['operations-a', 'operations-b', 'variety'].includes(suite))
  throw new Error('Unknown qualification suite');
const entries =
  suite === 'variety'
    ? CLASSIC_SNAKE_LEVELS.filter((e) => /\.v[23]$/.test(e.level.version))
    : suite === 'operations-b'
      ? CLASSIC_SNAKE_OPERATION_LEVELS_B
      : CLASSIC_SNAKE_OPERATION_LEVELS_A;
const hazardSeed = Number(
  process.argv.find((a) => a.startsWith('--hazard-seed='))?.slice(14) ?? 17,
);
if (!Number.isSafeInteger(hazardSeed) || hazardSeed < 0 || hazardSeed > 0xffffffff)
  throw new Error('Invalid hazard seed');
const suffix = hazardSeed === 17 ? '' : `-hazards-${hazardSeed}`;
const output = new URL(
  `../game/test/fixtures/classic-snake-${suite}${suffix}-proofs.json`,
  import.meta.url,
);
const only = process.argv.find((a) => a.startsWith('--mission='))?.slice(10);
let previous;
try {
  previous = JSON.parse(await readFile(output, 'utf8'));
} catch {
  previous = { format: 'classic-snake-qualification.v1', proofs: [] };
}
const proofs = previous.proofs;
const failures = [];
for (const entry of entries.filter(
  (e) =>
    (!only || e.id.endsWith(only)) &&
    (hazardSeed === 17 || e.level.targets.required.some((p) => p.signalProfile)),
)) {
  for (const mode of ['solo', 'team'])
    for (const pace of ['normal', 'slow', 'fast']) {
      const level = prepareClassicSnakeLevel(entry, { pace });
      const prior = proofs.find(
        (p) => p.levelId === entry.id && p.mode === mode && p.pace === pace,
      );
      if (prior) {
        try {
          if (restoreClassicSnakeReplay(prior.replay, { level }).status === 'won') continue;
        } catch {
          /* A revised draft needs a new proof. */
        }
        proofs.splice(proofs.indexOf(prior), 1);
      }
      const started = performance.now();
      try {
        const replay = proveClassicSnakeV4(level, {
          mode,
          hazardSeed,
          maxSteps: suite === 'variety' ? 1600 : 480,
          maxBacktracks: 32,
        });
        if (restoreClassicSnakeReplay(replay, { level }).status !== 'won')
          throw new Error('Proof did not finish');
        proofs.push({ levelId: entry.id, mode, pace, replay });
        await writeFile(output, JSON.stringify({ format: previous.format, proofs }) + '\n');
        console.log(
          JSON.stringify({
            level: entry.id,
            mode,
            pace,
            steps: replay.steps,
            ms: Math.round(performance.now() - started),
          }),
        );
      } catch (error) {
        failures.push({ level: entry.id, mode, pace, error: error.message.slice(0, 280) });
        console.log(JSON.stringify(failures.at(-1)));
        // A normal-pace failure is a content/pilot review item, not six repeated searches.
        break;
      }
    }
}
console.log(JSON.stringify({ qualified: proofs.length, failures }));
if (failures.length) process.exitCode = 1;
