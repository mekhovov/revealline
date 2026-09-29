#!/usr/bin/env node
/** Import a manually reviewed browser-authoring bundle. Never changes old evidence. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { snapshotReplay } from '../game/replay.mjs';
import { demoInputTraceIdentity } from '../game/demo-catalog.mjs';
const file = process.argv[2];
assert.ok(file && process.argv.length === 3, 'Pass one reviewed browser-authoring bundle path.');
const bundle = JSON.parse(await readFile(file, 'utf8'));
assert.equal(bundle.format, 'revealline-demo-browser-authoring.v1');
const root = new URL('../game/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('demo-data/catalog.json', root), 'utf8'));
assert.equal(bundle.clips.length, catalog.clips.length);
const variants = [];
for (const clip of catalog.clips) {
  const authored = bundle.clips.find((candidate) => candidate.id === clip.id);
  assert.ok(authored, `Missing browser variant ${clip.id}.`);
  const source = snapshotReplay(await readFile(new URL(clip.replayURL, root), 'utf8'));
  const replay = snapshotReplay(authored.replay);
  assert.deepEqual(authored.sourceCheckpoint, source.checkpoint);
  assert.equal(authored.sourceURL, clip.replayURL);
  for (const key of [
    'version',
    'ruleset',
    'level',
    'options',
    'segments',
    'ticks',
    'releaseAfter',
    'summary',
  ])
    assert.deepEqual(replay[key], source[key], `${clip.id} changed ${key}.`);
  for (const [section, hash] of Object.entries(source.checkpoint.sections))
    if (section !== 'enemies') assert.equal(replay.checkpoint.sections[section], hash);
  assert.ok(
    authored.originalDiagnostics.every(
      (item) => item.code === 'state-mismatch' && item.section === 'enemies',
    ),
  );
  assert.equal(replay.summary.status, 'won');
  assert.equal(replay.summary.lives, 3);
  const replayURL = `./demo-data/${clip.id}.chromium-macos.replay.json`;
  variants.push({
    id: clip.id,
    replayURL,
    inputTraceIdentity: demoInputTraceIdentity(replay),
    sourceCheckpoint: source.checkpoint.hash,
    checkpoint: replay.checkpoint.hash,
  });
  await writeFile(new URL(replayURL, root), `${JSON.stringify(replay, null, 2)}\n`, { flag: 'wx' });
}
const manifest = {
  format: 'revealline-demo-runtime-variants.v1',
  provenance:
    'Fixed committed input traces recorded and independently strictly verified twice in the named browser. Only the exact enemy checkpoint section differs from the original runtime; all other sections, summaries, levels, options, input segments and ticks are identical.',
  createdAt: bundle.createdAt,
  userAgent: bundle.userAgent,
  platform: bundle.platform,
  mathWitness: bundle.mathWitness,
  variants,
};
await writeFile(
  new URL('demo-data/variant-provenance.json', root),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { flag: 'wx' },
);
console.log(
  `Imported ${variants.length} frozen browser recording variants; original recordings untouched.`,
);
