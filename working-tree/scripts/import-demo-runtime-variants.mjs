#!/usr/bin/env node
/** Import a manually reviewed browser-authoring bundle. Never changes old evidence. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { snapshotReplay } from '../game/replay.mjs';
import { demoInputTraceIdentity } from '../game/demo-catalog.mjs';
const file = process.argv[2];
const append = process.argv[3] === '--append';
assert.ok(
  file && (process.argv.length === 3 || (append && process.argv.length === 4)),
  'Pass one reviewed browser-authoring bundle path, optionally --append.',
);
const bundle = JSON.parse(await readFile(file, 'utf8'));
assert.equal(bundle.format, 'revealline-demo-browser-authoring.v1');
const root = new URL('../game/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('demo-data/catalog.json', root), 'utf8'));
const manifestURL = new URL('demo-data/variant-provenance.json', root);
const previous = append ? JSON.parse(await readFile(manifestURL, 'utf8')) : null;
if (previous) assert.equal(previous.format, 'revealline-demo-runtime-variants.v1');
assert.equal(bundle.clips.length, catalog.clips.length);
const variants = [...(previous?.variants ?? [])];
const additions = [];
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
  const identity = {
    id: clip.id,
    replayURL,
    inputTraceIdentity: demoInputTraceIdentity(replay),
    sourceCheckpoint: source.checkpoint.hash,
    checkpoint: replay.checkpoint.hash,
  };
  const existing = variants.find((variant) => variant.replayURL === replayURL);
  if (existing) {
    for (const key of Object.keys(identity)) assert.equal(existing[key], identity[key]);
    assert.deepEqual(
      snapshotReplay(await readFile(new URL(replayURL, root), 'utf8')),
      replay,
      'Appending cannot replace a previously frozen browser recording.',
    );
  } else {
    variants.push({
      ...identity,
      ...(append
        ? {
            recordedIn: {
              createdAt: bundle.createdAt,
              userAgent: bundle.userAgent,
              platform: bundle.platform,
              mathWitness: bundle.mathWitness,
            },
          }
        : {}),
    });
    additions.push([new URL(replayURL, root), replay]);
  }
}
const manifest = {
  format: 'revealline-demo-runtime-variants.v1',
  provenance:
    'Fixed committed input traces recorded and independently strictly verified twice in the named browser. Only the exact enemy checkpoint section differs from the original runtime; all other sections, summaries, levels, options, input segments and ticks are identical.',
  createdAt: previous?.createdAt ?? bundle.createdAt,
  userAgent: previous?.userAgent ?? bundle.userAgent,
  platform: previous?.platform ?? bundle.platform,
  mathWitness: previous?.mathWitness ?? bundle.mathWitness,
  variants,
};
for (const [url, replay] of additions)
  await writeFile(url, `${JSON.stringify(replay, null, 2)}\n`, { flag: 'wx' });
await writeFile(manifestURL, `${JSON.stringify(manifest, null, 2)}\n`, {
  flag: append ? 'w' : 'wx',
});
console.log(
  `Imported ${additions.length} frozen browser recording variants; original recordings untouched.`,
);
