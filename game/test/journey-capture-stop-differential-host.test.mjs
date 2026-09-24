import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { emptyLibrary, updatePreferences, saveLibrary } from '../library.mjs';
import { recoverGameplayTuning } from '../gameplay-tuning.mjs';
import { verifyReplay } from '../replay.mjs';

// Actual host, shipped mission data, preparation, input adapters and recorder.
// Only browser DOM/PNG decoding/device samples are modeled. This is not native
// browser or physical-device evidence, and no run state or geometry is injected.
const keys = { down: 'ArrowDown', right: 'ArrowRight', up: 'ArrowUp', left: 'ArrowLeft' };
const frames = (page, count, ms = 1000 / 120) => {
  for (let index = 0; index < count; index++) page.frame(ms);
};
const position = (page) => [page.rendered.run.player.x, page.rendered.run.player.y];
const controller = () => ({
  index: 0,
  id: 'Capture differential modeled controller',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

async function setup(
  t,
  owner,
  turnPolicy,
  pad,
  missionId = owner === 'Journey' ? 'first-return' : 'orchard-crossing',
) {
  const storage = memoryStorage();
  assert.equal(
    saveLibrary(
      storage,
      'revealline.library.dev.v1',
      updatePreferences(emptyLibrary(), { turnPolicy, screenControls: 'always' }),
    ).ok,
    true,
  );
  const page = await soloPage(t, {
    search: owner === 'Journey' ? '?journey=whole-spatial-v5' : '?journey=legacy',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    readPads: () => (pad ? [pad] : []),
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
  });
  if (owner === 'Journey' && missionId === 'first-return') page.$('shell-featured').click();
  else if (owner === 'Journey') {
    page.$('shell-play').click();
    await settle(() => page.$('journey-chooser')?.open && page.$('journey-collection'));
    const card = [...page.$('journey-cards').children].find((entry) =>
      JSON.parse(entry.dataset.missionId)[3].endsWith(`/${missionId}`),
    );
    assert.ok(card, 'Choose the exact current Journey mission through the shared library.');
    card.click();
  } else {
    page.$('shell-play').click();
    await settle(() => page.$('journey-chooser')?.open && page.$('journey-collection'));
    page.$('journey-collection').value = 'Classic';
    page.$('journey-collection').emit('change');
    const card = [...page.$('journey-cards').children].find(
      (entry) =>
        entry.dataset.missionId.includes('fpv-arcade-r5') &&
        entry.dataset.missionId.includes('orchard-crossing'),
    );
    assert.ok(card, 'Select the exact retained Pressure Lines edition.');
    assert.match(card.textContent, /Download/);
    card.click();
    await waitFor(() => card.textContent.endsWith('Play'), {
      timeoutMs: 30000,
      message: 'Pressure Lines original pack and picture become ready.',
    });
    card.click();
  }
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.$('journey-chooser').open, false);
  frames(page, 3);
  const run = page.rendered.run;
  assert.equal(run.levelId, missionId);
  assert.equal(run.turnPolicy, turnPolicy);
  assert.equal(run.seed, 1);
  assert.equal(run.rules.stopOnCapture, true);
  assert.equal(recoverGameplayTuning(run.level).version, 'gameplay-pressure.v4');
  assert.equal(recoverGameplayTuning(run.level).difficulty, 'standard');
  assert.equal(run.rules.moveSpeed, 8.84);
  assert.equal(run.classic.livesLost, 0);
  return page;
}

function driver(page, kind, pad) {
  if (kind === 'keyboard')
    return {
      steer: (direction) => page.key(keys[direction]),
      stale() {
        // Both native repeat and a duplicate non-repeat event from the same
        // physical hold must remain consumed after capture.
        for (const code of ['ArrowUp', 'ArrowDown']) {
          page.$('game-canvas').emit('keydown', { code, key: code, repeat: true });
          page.$('game-canvas').emit('keydown', { code, key: code, repeat: false });
        }
      },
      fresh() {
        for (const code of Object.values(keys)) page.key(code, false);
        frames(page, 2);
        page.key('ArrowLeft');
        page.key('ArrowLeft', false);
      },
    };
  if (kind === 'controller')
    return {
      steer(direction) {
        const vector = { down: [0, 1], right: [1, 0], up: [0, -1], left: [-1, 0] }[direction];
        [pad.axes[0], pad.axes[1]] = vector;
      },
      stale() {
        // Repeated sampling of the final held stick is not a fresh gesture.
        pad.axes[1] = -1;
      },
      fresh() {
        pad.axes.fill(0);
        frames(page, 3);
        pad.axes[0] = -1;
      },
    };
  const surface = page.$('touch-surface');
  surface._rect = { x: 0, y: 0, width: 156, height: 156 };
  const emit = (type, x, y, pointerId = 7) =>
    surface.emit(type, { pointerId, pointerType: 'touch', button: 0, clientX: x, clientY: y });
  emit('pointerdown', 78, 78);
  return {
    steer(direction) {
      const [x, y] = { down: [78, 110], right: [110, 78], up: [78, 46] }[direction];
      emit('pointermove', x, y);
    },
    stale() {
      emit('pointermove', 110, 78);
      emit('pointermove', 78, 46);
      emit('lostpointercapture', 78, 46);
    },
    fresh() {
      emit('pointerup', 78, 46);
      emit('pointerdown', 78, 78, 8);
      emit('pointermove', 46, 78, 8);
      // A late loss from the old capture must not retire the new finger.
      emit('lostpointercapture', 78, 46, 7);
      emit('pointerup', 46, 78, 8);
    },
  };
}

for (const owner of ['Journey', 'Pressure Lines'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    for (const kind of ['keyboard', 'touch', 'controller'])
      test(`${owner}/${turnPolicy}/${kind}: accepted closure consumes held input across batched frames and pause`, async (t) => {
        const pad = kind === 'controller' ? controller() : null;
        const page = await setup(t, owner, turnPolicy, pad);
        const input = driver(page, kind, pad);
        input.steer('down');
        frames(page, 60);
        input.steer('right');
        frames(page, 60);
        input.steer('up');
        // Include the closure and its remaining fixed substeps in one frame.
        for (let index = 0; index < 20 && page.rendered.run.claimedCount === 0; index++)
          page.frame(100);
        const run = page.rendered.run;
        assert.equal(run.status, 'running', 'The check needs a nonterminal capture.');
        assert.equal(run.classic.livesLost, 0, 'A respawn is not a capture stop.');
        assert.ok(
          run.claimedCount > 0,
          `The real route must secure territory: ${JSON.stringify({
            tick: run.tick,
            player: run.player,
            paused: page.rendered.paused,
            state: page.doc.body.dataset.flightState,
            dialogs: page.doc.querySelectorAll('dialog[open]').map((dialog) => dialog.id),
            message: page.$('run-message').textContent,
          })}`,
        );
        assert.equal(run.player.cutting, false);
        assert.equal(run.player.y, 1, 'Stop at the return boundary, not later at the outer wall.');
        assert.equal(run.player.speed, 0);
        assert.equal(run.player.queuedDirection, null);
        const stopped = position(page);
        input.stale();
        frames(page, 10, 100);
        assert.deepEqual(position(page), stopped, 'No old source may restart the craft.');
        assert.equal(run.player.speed, 0);
        page.$('pause-button').click();
        const saveKey =
          owner === 'Journey'
            ? 'revealline.suspended.journey-whole-spatial.v5'
            : 'revealline.suspended.dev.v1';
        const saved = JSON.parse(page.storage.getItem(saveKey));
        assert.ok(saved, 'The owning edition must persist the stopped attempt.');
        assert.equal(saved.continuation.direction, null);
        assert.equal(verifyReplay(saved.replay).match, true);
        page.$('start-button').click();
        await settle(() => page.doc.body.dataset.flightState === 'running');
        frames(page, 2, 100);
        assert.deepEqual(position(page), stopped, 'Pause/resume must retain stopped intent.');
        input.fresh();
        frames(page, 16);
        assert.ok(page.rendered.run.player.x < stopped[0], 'One fresh direction resumes flight.');
        assert.equal(page.rendered.run.classic.livesLost, 0);
        assert.deepEqual(page.errors, []);
      });

for (const missionId of ['two-bays', 'nearby-shore'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`Journey internal/${missionId}/${turnPolicy}: foundation return stops before crossing the opened picture`, async (t) => {
      const page = await setup(t, 'Journey', turnPolicy, null, missionId);
      if (missionId === 'two-bays') {
        page.key('ArrowLeft');
        frames(page, 40);
        page.key('ArrowUp');
        frames(page, 40);
      }
      const held = missionId === 'two-bays' ? 'ArrowRight' : 'ArrowDown';
      page.key(held);
      for (let index = 0; index < 25 && page.rendered.run.claimedCount === 0; index++)
        page.frame(100);
      const run = page.rendered.run;
      assert.equal(run.status, 'running');
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.player.cutting, false);
      assert.equal(run.player.speed, 0);
      assert.equal(run.player.queuedDirection, null);
      if (missionId === 'two-bays') {
        assert.equal(run.player.x, 34, 'The cut stops at the interior return lane boundary.');
        assert.ok(run.player.y >= 14.5 && run.player.y < 14.6);
        assert.equal(run.claimedCount, 8);
      } else {
        assert.deepEqual(position(page), [32.5, 15], 'Stop at the near edge of the island.');
        assert.equal(
          run.claimedCount,
          14,
          'Only the 14-cell bridge is earned, not a field region.',
        );
        for (let y = 1; y < 15; y++) assert.equal(run.cells[y * run.width + 32], 1);
        assert.match(page.$('run-message').textContent, /occupied|line|reclaimed|ground|secured/i);
      }
      const stopped = position(page);
      page.$('game-canvas').emit('keydown', { code: held, key: held, repeat: true });
      frames(page, 10, 100);
      assert.deepEqual(position(page), stopped, 'Held input cannot travel onto the foundation.');
      assert.equal(run.player.speed, 0);
      for (const code of Object.values(keys)) page.key(code, false);
      frames(page, 2);
      assert.deepEqual(position(page), stopped, 'Release alone is not a new direction.');
      page.key('ArrowUp');
      page.key('ArrowUp', false);
      frames(page, 16);
      assert.ok(run.player.y < stopped[1], 'A fresh direction traverses reclaimed ground.');
      assert.equal(run.classic.livesLost, 0);
      assert.deepEqual(page.errors, []);
    });
