// Rebuild only changed recipes; every retained or generated route is reverified.
import { readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_V4_LEVELS } from '../game/snake/classic-catalogue-v4.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { canonicalJSON } from '../game/data-json.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';

const file = new URL('../game/test/fixtures/classic-snake-v4-proofs.json', import.meta.url);
const previous = JSON.parse(await readFile(file, 'utf8'));
const proofs = [];
let generated = 0;
for (const row of CLASSIC_SNAKE_V4_LEVELS) {
  for (const mode of ['solo', 'team'])
    for (const pace of ['slow', 'normal', 'fast']) {
      const level = prepareClassicSnakeLevel(row, { pace });
      const old = previous.proofs.find(
        (proof) => proof.levelId === row.id && proof.mode === mode && proof.pace === pace,
      );
      let reusable = old && canonicalJSON(old.replay.level) === canonicalJSON(level);
      if (reusable) {
        try {
          restoreClassicSnakeReplay(old.replay, { level });
        } catch (error) {
          if (process.argv.includes('--check')) throw error;
          reusable = false;
        }
      }
      if (!reusable && process.argv.includes('--check'))
        throw new Error(`Missing current proof: ${row.id}/${mode}/${pace}`);
      const replay = reusable
        ? old.replay
        : proveClassicSnakeV4(level, { mode, seed: 17, hazardSeed: 17 });
      const verified = restoreClassicSnakeReplay(replay, { level });
      if (verified.status !== 'won' || verified.mode !== mode || verified.seed !== 17)
        throw new Error(`Invalid qualification: ${row.id}/${mode}/${pace}`);
      proofs.push({ levelId: row.id, mode, pace, seed: 17, replay });
      if (!reusable) generated++;
    }
  console.log(`Qualified ${row.id}`);
}
if (!process.argv.includes('--check'))
  await writeFile(
    file,
    `${JSON.stringify({ format: 'classic-snake-v4-proofs.v1', proofs }, null, 2)}\n`,
  );
console.log(`Verified ${proofs.length} v4 setups; generated ${generated} current routes.`);
