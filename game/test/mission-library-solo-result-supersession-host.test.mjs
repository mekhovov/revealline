import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

// Real authored level, registered image bytes, public input and current async
// selector. The finite decoder/DOM boundary is not native rendering evidence.
test('actual unified Journey chooser supersedes held Next artwork without a stale adoption', async (t) => {
  const held = deferred();
  t.after(() => held.resolve());
  let holdNext = false,
    decoding = false,
    decodeSettled = false,
    heldPicture = null;
  class Picture {
    width = 1774;
    height = 887;
    naturalWidth = 1774;
    naturalHeight = 887;
    releases = 0;
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    async decode() {
      if (!holdNext) return;
      holdNext = false;
      decoding = true;
      heldPicture = this;
      await held.promise;
      decodeSettled = true;
    }
    removeAttribute() {
      this.source = '';
      this.releases++;
    }
  }
  const p = await soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
  const running = () => {
    p.frame(0);
    return (
      p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === 'first-return'
    );
  };
  p.$('shell-featured').click();
  await settle(running);
  p.key('ArrowDown');
  for (let i = 0; i < 1800 && p.rendered.run.status === 'running'; i++) p.frame();
  p.key('ArrowDown', false);
  p.frame(0);
  assert.equal(p.rendered.run.status, 'won');
  const completed = p.rendered.run;
  if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  await settle(() => !p.$('next-button').disabled);
  holdNext = true;
  p.$('next-button').click();
  await settle(() => decoding);
  assert.equal(p.rendered.run, completed);
  p.$('shell-packs').click();
  try {
    await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  } catch (error) {
    error.message += ` ${JSON.stringify({ message: p.$('run-message').textContent, warning: p.$('save-warning').textContent, opening: p.$('mission-library-opening-status')?.textContent, errors: p.errors.map(String) })}`;
    throw error;
  }
  p.$('journey-collection').value = 'Journey';
  p.$('journey-collection').emit('change');
  const first = [...p.$('journey-cards').children].find((card) =>
    JSON.parse(card.dataset.missionId)[3].endsWith('/first-return'),
  );
  assert(first, 'Current unified registry exposes the exact Journey mission.');
  first.click();
  await settle(running);
  assert.notEqual(p.rendered.run, completed);
  const accepted = p.rendered.run,
    checkpoint = authoritativeCheckpoint(accepted),
    picture = p.rendered.backdrop;
  assert.equal(p.$('journey-chooser').open, false);
  held.resolve();
  await settle(
    () => decodeSettled && heldPicture.releases > 0,
    'The superseded decoder settles and releases its stale image.',
  );
  p.frame(0);
  assert.equal(p.rendered.run, accepted);
  assert.deepEqual(authoritativeCheckpoint(accepted), checkpoint);
  assert.equal(p.rendered.backdrop, picture);
  assert.equal(p.doc.body.dataset.flightState, 'running');
  assert.equal(p.doc.activeElement.id, 'game-canvas');
  assert.deepEqual(p.errors, []);
});
