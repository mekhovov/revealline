import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { inspectPublishedCue } from '../published-cue-inspection.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';

test('production effect originals remain admissible at native and resampled output rates', async () => {
  for (const [name, asset] of Object.entries(EFFECT_BANK)) {
    const bytes = await readFile(new URL(`../audio/effects/${asset.file}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, name);
    const maxDuration = name.startsWith('human-reaction-')
      ? 0.7
      : name.startsWith('destroy-')
        ? 1
        : 15;
    for (const sampleRate of [44100, 48000, 96000]) {
      const result = await inspectPublishedCue(new Blob([bytes], { type: 'audio/wav' }), {
        sampleRate,
        maxDuration,
        scheduleScan: (work) => work(),
      });
      assert(result.reservedBytes > 0 && result.reservedBytes <= 16 * 1024 * 1024, name);
    }
  }
});

test('the actual build collector and offline selector retain the cue inspector module chain', async () => {
  const shipped = new Set(await collectBuildFiles());
  const names = [
    'game/index.html',
    'game/boot.mjs',
    'game/app.mjs',
    'game/ui/audio.mjs',
    'game/ui/published-audio.mjs',
    'game/published-cue-inspection.mjs',
    'game/mp3-inspection.mjs',
    'game/ui/media-preparation.mjs',
  ];
  for (const name of names) assert(shipped.has(name), `Shipped source: ${name}`);
  const entries = await Promise.all(
    names.map(async (name) => ({
      name,
      bytes: await readFile(new URL(`../../${name}`, import.meta.url)),
    })),
  );
  const core = selectOfflineCore(entries, new Set());
  for (const name of names) assert(core.retained.has(name), `Offline source: ${name}`);
  assert.equal(
    core.references.get('game/published-cue-inspection.mjs'),
    'game/ui/published-audio.mjs',
  );
  assert.equal(core.references.get('game/mp3-inspection.mjs'), 'game/published-cue-inspection.mjs');
});
