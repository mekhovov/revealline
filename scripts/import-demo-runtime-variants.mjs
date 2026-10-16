#!/usr/bin/env node
/** Import a manually reviewed browser-authoring bundle. Never changes old evidence. */
import assert from 'node:assert/strict';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { commitDemoMetadata } from './build-demo-recordings.mjs';
import { snapshotReplay } from '../game/replay.mjs';
import { demoInputTraceIdentity } from '../game/demo-catalog.mjs';
const fileOperations = { readFile, writeFile, rename, unlink };
const jsonText = (document) => `${JSON.stringify(document, null, 2)}\n`;

export async function importDemoRuntimeVariants(
  bundle,
  { root = new URL('../game/', import.meta.url), append = false, io = fileOperations } = {},
) {
  assert.equal(bundle.format, 'revealline-demo-browser-authoring.v1');
  const catalog = JSON.parse(await io.readFile(new URL('demo-data/catalog.json', root), 'utf8'));
  const manifestURL = new URL('demo-data/variant-provenance.json', root);
  const previous = append ? JSON.parse(await io.readFile(manifestURL, 'utf8')) : null;
  if (previous) assert.equal(previous.format, 'revealline-demo-runtime-variants.v1');
  assert.equal(bundle.clips.length, catalog.clips.length);
  const variants = [...(previous?.variants ?? [])];
  const additions = [];
  for (const clip of catalog.clips) {
    const authored = bundle.clips.find((candidate) => candidate.id === clip.id);
    assert.ok(authored, `Missing browser variant ${clip.id}.`);
    const source = snapshotReplay(await io.readFile(new URL(clip.replayURL, root), 'utf8'));
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
        snapshotReplay(await io.readFile(new URL(replayURL, root), 'utf8')),
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
      const url = new URL(replayURL, root);
      let missing = false;
      try {
        const existingText = await io.readFile(url, 'utf8');
        assert.ok(append, 'Creating variants cannot reuse an existing file.');
        assert.equal(
          existingText,
          jsonText(replay),
          'An unregistered browser recording must exactly match the pending addition.',
        );
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        missing = true;
      }
      additions.push({ url, replay, missing });
    }
  }
  const manifest = previous
    ? { ...previous, variants }
    : {
        format: 'revealline-demo-runtime-variants.v1',
        provenance:
          'Fixed committed input traces recorded and independently strictly verified twice in the named browser. Only the exact enemy checkpoint section differs from the original runtime; all other sections, summaries, levels, options, input segments and ticks are identical.',
        createdAt: bundle.createdAt,
        userAgent: bundle.userAgent,
        platform: bundle.platform,
        mathWitness: bundle.mathWitness,
        variants,
      };
  for (const { url, replay, missing } of additions)
    if (missing) await io.writeFile(url, jsonText(replay), { flag: 'wx' });
  if (append) await commitDemoMetadata(manifestURL, manifest, io);
  else await io.writeFile(manifestURL, jsonText(manifest), { flag: 'wx' });
  return additions.length;
}

async function main() {
  const file = process.argv[2];
  const append = process.argv[3] === '--append';
  assert.ok(
    file && (process.argv.length === 3 || (append && process.argv.length === 4)),
    'Pass one reviewed browser-authoring bundle path, optionally --append.',
  );
  const bundle = JSON.parse(await readFile(file, 'utf8'));
  const count = await importDemoRuntimeVariants(bundle, { append });
  console.log(
    `Imported ${count} frozen browser recording variants; original recordings untouched.`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
