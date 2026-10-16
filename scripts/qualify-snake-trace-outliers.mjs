/** Alternate accepted routes test whether a quiet-interval outlier is compulsory. */
import { readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';
const ids = ['classic-expedition-courier-overpass', 'classic-pursuit-supply-circuit'];
const file = new URL(
  '../docs/verification/snake-remaster/outlier-alternative-proofs.json',
  import.meta.url,
);
let proofs = [];
try {
  proofs = JSON.parse(await readFile(file, 'utf8')).proofs;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const levelId of ids)
  for (const mode of ['solo', 'team'])
    for (const pace of ['normal', 'slow', 'fast']) {
      const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === levelId),
        level = prepareClassicSnakeLevel(entry, { pace });
      const prior = proofs.find((p) => p.levelId === levelId && p.mode === mode && p.pace === pace);
      if (prior && restoreClassicSnakeReplay(prior.replay, { level }).status === 'won') continue;
      if (process.argv.includes('--check'))
        throw new Error(`Missing alternate reference ${levelId}/${mode}/${pace}`);
      const replay = proveClassicSnakeV4(level, {
        mode,
        seed: 17,
        maxSteps: 1600,
        maxBacktracks: 32,
      });
      if (restoreClassicSnakeReplay(replay, { level }).status !== 'won')
        throw new Error('Alternate route did not verify.');
      proofs.push({ levelId, mode, pace, replay });
      await writeFile(
        file,
        JSON.stringify({ format: 'classic-snake-outlier-alternatives.v1', proofs }) + '\n',
      );
      console.log(`${levelId}/${mode}/${pace}: ${replay.steps}`);
    }
