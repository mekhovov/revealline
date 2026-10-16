/** Fill current retained foundation evidence gaps without revising recipes. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { canonicalJSON } from '../game/data-json.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';
const evidence = new URL('../docs/verification/classic-snake/', import.meta.url);
const output = new URL(
  '../docs/verification/snake-remaster/retained-foundation-proofs.json',
  import.meta.url,
);
const existing = [];
for (const name of (await readdir(evidence, { recursive: true })).filter((f) =>
  f.endsWith('.json'),
)) {
  const replay = JSON.parse(await readFile(new URL(name, evidence), 'utf8'));
  if (replay.version === 'classic-snake-replay.v1') existing.push(replay);
}
let proofs = [];
try {
  proofs = JSON.parse(await readFile(output, 'utf8')).proofs;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const entry of CLASSIC_SNAKE_LEVELS.filter(
  (e) => e.level.version === 'classic-snake-level.v1',
))
  for (const mode of ['solo', 'team'])
    for (const pace of ['normal', 'slow', 'fast']) {
      const level = prepareClassicSnakeLevel(entry, { pace });
      const prior = [...existing, ...proofs.map((p) => p.replay)].find(
        (p) =>
          p.level.id === entry.id &&
          p.mode === mode &&
          p.seed === 17 &&
          canonicalJSON(p.level) === canonicalJSON(level),
      );
      if (prior && restoreClassicSnakeReplay(prior, { level }).status === 'won') continue;
      if (process.argv.includes('--check'))
        throw new Error(`Missing current foundation proof ${entry.id}/${mode}/${pace}`);
      const replay = proveClassicSnakeV4(level, {
        mode,
        seed: 17,
        maxSteps: 1800,
        maxBacktracks: 32,
      });
      if (restoreClassicSnakeReplay(replay, { level }).status !== 'won')
        throw new Error(`Invalid proof ${entry.id}/${mode}/${pace}`);
      proofs.push({ levelId: entry.id, mode, pace, replay });
      await writeFile(
        output,
        JSON.stringify({ format: 'classic-snake-retained-foundation-proofs.v1', proofs }) + '\n',
      );
      console.log(`${entry.id}/${mode}/${pace}: ${replay.steps}`);
    }
console.log(
  `All 48 retained foundation missions have normal/slow/fast Solo/Team evidence; ${proofs.length} gap journals retained.`,
);
