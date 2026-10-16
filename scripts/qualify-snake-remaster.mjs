import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';
const directory = new URL('../docs/verification/snake-remaster/', import.meta.url);
const hazardSeed = Number(
  process.argv.find((a) => a.startsWith('--hazard-seed='))?.slice(14) ?? 17,
);
if (!Number.isSafeInteger(hazardSeed) || hazardSeed < 0 || hazardSeed > 0xffffffff)
  throw new Error('Invalid hazard seed');
const output = new URL(
  hazardSeed === 17 ? 'tactical-proofs.json' : `tactical-proofs-hazards-${hazardSeed}.json`,
  directory,
);
const check = process.argv.includes('--check');
const only = process.argv.find((a) => a.startsWith('--mission='))?.slice(10);
const entries = CLASSIC_SNAKE_LEVELS.filter(
  (e) =>
    e.level.version === 'classic-snake-level.v6' &&
    (!only || e.id.endsWith(only)) &&
    (hazardSeed === 17 || e.level.targets.required.some((p) => p.signalProfile)),
);
let proofs = [];
try {
  proofs = JSON.parse(await readFile(output, 'utf8')).proofs;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(directory, { recursive: true });
const failures = [];
for (const entry of entries)
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
          /* Requalify changed content. */
        }
      }
      if (check) throw new Error(`Missing current tactical proof ${entry.id}/${mode}/${pace}`);
      try {
        const replay = proveClassicSnakeV4(level, {
          mode,
          seed: 17,
          hazardSeed,
          maxSteps: 640,
          maxBacktracks: 32,
        });
        if (restoreClassicSnakeReplay(replay, { level }).status !== 'won')
          throw new Error('Unverified proof');
        proofs = proofs.filter(
          (p) => !(p.levelId === entry.id && p.mode === mode && p.pace === pace),
        );
        proofs.push({ levelId: entry.id, mode, pace, replay });
        await writeFile(
          output,
          JSON.stringify({ format: 'classic-snake-remaster-proofs.v1', proofs }) + '\n',
        );
        console.log(`${entry.id}/${mode}/${pace}: ${replay.steps} moves`);
      } catch (error) {
        failures.push({ id: entry.id, mode, pace, error: error.message });
        console.log(JSON.stringify(failures.at(-1)));
        break;
      }
    }
console.log(JSON.stringify({ verified: proofs.length, failures }));
if (failures.length) process.exitCode = 1;
