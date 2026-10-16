// Keep revised foundation evidence as ordinary replay documents so the rating
// calibrator can verify it alongside the other retained qualification routes.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { canonicalJSON } from '../game/data-json.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';

const directory = new URL('../docs/verification/classic-snake/foundation-v2/', import.meta.url);
const check = process.argv.includes('--check');
const entries = CLASSIC_SNAKE_LEVELS.filter(
  ({ level }) => level.version === 'classic-snake-level.v1' && level.revision === '2',
);
if (!entries.length) throw new Error('No revised foundation recipes to qualify.');
if (!check) await mkdir(directory, { recursive: true });
let generated = 0;
let verifiedCount = 0;
for (const entry of entries) {
  const level = prepareClassicSnakeLevel(entry, { pace: 'normal' });
  for (const mode of ['solo', 'team']) {
    const file = new URL(`${entry.id}.${mode}.replay.json`, directory);
    let replay;
    try {
      replay = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    let reusable =
      replay?.mode === mode &&
      replay.seed === 17 &&
      canonicalJSON(replay.level) === canonicalJSON(level);
    if (reusable) {
      try {
        reusable = restoreClassicSnakeReplay(replay, { level }).status === 'won';
      } catch (error) {
        if (check) throw error;
        reusable = false;
      }
    }
    if (!reusable) {
      if (check) throw new Error(`Missing current foundation proof: ${entry.id}/${mode}`);
      replay = proveClassicSnakeV4(level, { mode, seed: 17 });
    }
    const verified = restoreClassicSnakeReplay(replay, { level });
    if (verified.status !== 'won' || verified.mode !== mode || verified.seed !== 17)
      throw new Error(`Invalid foundation qualification: ${entry.id}/${mode}`);
    if (!reusable) {
      await writeFile(file, `${JSON.stringify(replay, null, 2)}\n`);
      generated++;
    }
    verifiedCount++;
    console.log(`Qualified ${entry.id}/${mode}: ${verified.tick} moves`);
  }
}
console.log(`Verified ${verifiedCount} revised foundation setups; generated ${generated} routes.`);
