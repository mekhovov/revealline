#!/usr/bin/env node
/** Offline authoring only. Runtime never invents missing catalog coverage. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { authorSnakeDemoReplay } from '../game/demo-modes/snake-authoring.mjs';
import { recordSnakeDemo, verifySnakeDemo } from '../game/demo-modes/snake-recording.mjs';
const directory = new URL('../game/demo-data/snake/', import.meta.url);
const check = process.argv.includes('--check');
const filter = process.argv.find((arg) => arg.startsWith('--level='))?.slice(8);
const entries = CLASSIC_SNAKE_LEVELS.filter((entry) => !filter || entry.id.includes(filter));
const manifest = [],
  missing = [];
await mkdir(directory, { recursive: true });
for (const [index, entry] of entries.entries()) {
  const level = prepareClassicSnakeLevel(entry);
  const file = new URL(`${entry.id}.replay.json`, directory);
  let demo;
  try {
    demo = verifySnakeDemo(JSON.parse(await readFile(file, 'utf8')), { level }).demo;
  } catch (error) {
    if (check) {
      missing.push({ id: entry.id, error: error.message });
      continue;
    }
    for (const seed of [17, 37, 73]) {
      try {
        const replay = authorSnakeDemoReplay(level, { seed, hazardSeed: seed, maxBacktracks: 128 });
        demo = recordSnakeDemo(replay, { level });
        await writeFile(file, `${JSON.stringify(demo)}\n`);
        break;
      } catch (error) {
        if (seed === 73) missing.push({ id: entry.id, error: error.message.slice(0, 200) });
      }
    }
  }
  if (demo)
    manifest.push({
      levelId: entry.id,
      levelIdentity: demo.levelIdentity,
      simulationIdentity: demo.simulationIdentity,
      outcome: demo.outcome,
      durationSeconds: demo.recording.elapsedMs / 1000,
      ticks: demo.recording.replays[0].steps,
      progress: demo.progress,
    });
  console.log(`${index + 1}/${entries.length} ${entry.id} ${demo ? demo.outcome : 'MISSING'}`);
}
const report = {
  format: 'snake-demo-coverage.v1',
  required: entries.length,
  verified: manifest.length,
  missing,
  entries: manifest,
};
if (!filter && !check) {
  await writeFile(new URL('catalog.json', directory), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ required: report.required, verified: report.verified, missing }));
if (missing.length) process.exitCode = 1;
