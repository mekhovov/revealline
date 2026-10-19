import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { activateMissionCard, openMissionLibrary } from './helpers/library-selection.mjs';

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
  if (!p.$('show-result').hidden) p.$('show-result').click();
  await settle(() => !p.$('next-button').disabled);
  holdNext = true;
  p.$('next-button').click();
  await settle(() => decoding);
  assert.equal(p.rendered.run, completed);
  try {
    await openMissionLibrary(p, 'shell-packs');
  } catch (error) {
    error.message += ` ${JSON.stringify({ message: p.$('run-message').textContent, warning: p.$('save-warning').textContent, opening: p.$('mission-library-opening-status')?.textContent, errors: p.errors.map(String) })}`;
    throw error;
  }
  p.$('journey-collection').value = 'Journey';
  p.$('journey-collection').emit('change');
  const identity = JSON.stringify([
    'journey:opening',
    'opening',
    JSON.stringify(['candidate', 'journey-opening', 'prologue']),
    'candidate/journey-opening/prologue/first-return',
    '',
  ]);
  const matches = [...p.$('journey-cards').children].filter(
    (card) => card.dataset.missionId === identity,
  );
  assert.equal(matches.length, 1, 'Only the exact Opening Journey mission is selected.');
  const [first] = matches;
  assert(first, 'Current unified registry exposes the exact Journey mission.');
  await activateMissionCard(first);
  p.frame(0);
  const prepared = p.rendered.run;
  assert.notEqual(prepared, completed);
  assert.equal(prepared.levelId, 'first-return');
  assert.equal(prepared.tick, 0);
  assert.equal(p.doc.body.dataset.flightState, 'briefing');
  assert.equal(p.doc.body.dataset.pictureState, 'ready');
  assert.equal(p.rendered.paused, true);
  assert.equal(p.$('journey-chooser').open, false);
  // Exact Solo selection prepares a briefing. A fresh visible Start, rather
  // than elapsed polling time, owns the transition into play.
  const start = p.$('start-button'),
    onStart = start.onclick;
  assert.equal(start.hidden, false);
  assert.equal(start.disabled, false);
  assert.equal(start.closest('[hidden],[inert]'), null);
  let starting;
  start.onclick = (...args) => (starting = onStart.apply(start, args));
  try {
    start.focus();
    start.click();
  } finally {
    start.onclick = onStart;
  }
  assert(starting instanceof Promise, 'The real Start handler owns resuming the prepared mission.');
  await starting;
  await settle(() => {
    p.frame(0);
    return p.rendered.run !== completed && running();
  });
  assert.equal(p.rendered.paused, false);
  assert.equal(p.rendered.run, prepared, 'Start retains the exact accepted briefing run.');
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
