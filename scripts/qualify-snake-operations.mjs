import { readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_OPERATION_LEVELS_A } from '../game/snake/classic-catalogue-operations-a.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';

const output = new URL(
  '../game/test/fixtures/classic-snake-operations-a-proofs.json',
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
for (const entry of CLASSIC_SNAKE_OPERATION_LEVELS_A.filter((e) => !only || e.id.endsWith(only))) {
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
        const replay = proveClassicSnakeV4(level, { mode, maxSteps: 480, maxBacktracks: 32 });
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
