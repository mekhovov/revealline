/** Exact Solo/Team/pace witnesses for editorial pacing and geometry revisions. */
import { readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { CLASSIC_EDITORIAL_REVISIONS } from '../game/snake/classic-catalogue-remaster.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';
const file = new URL('../docs/verification/snake-remaster/editorial-proofs.json', import.meta.url);
let proofs = [];
try {
  proofs = JSON.parse(await readFile(file, 'utf8')).proofs;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const levelId of Object.keys(CLASSIC_EDITORIAL_REVISIONS))
  for (const mode of ['solo', 'team'])
    for (const pace of ['normal', 'slow', 'fast']) {
      const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === levelId),
        level = prepareClassicSnakeLevel(entry, { pace });
      const prior = proofs.find((p) => p.levelId === levelId && p.mode === mode && p.pace === pace);
      if (prior && restoreClassicSnakeReplay(prior.replay, { level }).status === 'won') continue;
      if (process.argv.includes('--check'))
        throw new Error(`Missing editorial reference ${levelId}/${mode}/${pace}`);
      const replay = proveClassicSnakeV4(level, {
        mode,
        seed: 17,
        maxSteps: 640,
        maxBacktracks: 32,
      });
      if (restoreClassicSnakeReplay(replay, { level }).status !== 'won')
        throw new Error('Editorial route did not verify.');
      proofs.push({ levelId, mode, pace, replay });
      await writeFile(
        file,
        JSON.stringify({ format: 'classic-snake-editorial-proofs.v1', proofs }) + '\n',
      );
      console.log(`${levelId}/${mode}/${pace}: ${replay.steps}`);
    }
