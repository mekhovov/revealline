// Real host inputs and persistence; no claim about native download or visual layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { nativeCaptureSession } from '../capture-presentation-session.mjs';
import { authoritativeCheckpoint, verifyReplay, MAX_REPLAY_TICKS } from '../replay.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

async function pausedFlight(t) {
  const page = await soloPage(t, {
    initialReadyTimeoutMs: 30000,
    browserSetup: ({ document }) => {
      // The minimal Solo DOM omits native beforetoggle. Supply that browser
      // boundary so the existing modal owner can remember the real opener.
      for (const id of ['library-dialog', 'replay-dialog']) {
        const dialog = document.getElementById(id),
          show = dialog.showModal;
        dialog.showModal = function () {
          if (!this.open)
            this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
          return show.call(this);
        };
      }
    },
  });
  assert.equal(page.$('capture-flight-limits').hidden, true);
  await activateHostAction(page.$('start-button'));
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  for (let n = 0; n < 12; n++) page.frame();
  page.key('ArrowDown', false);
  page.$('pause-button').click();
  page.frame(0);
  return page;
}

test('paused flight exposes actual recovery and verified replay routes without advancing the run', async (t) => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(previous, { persist: false }));
  const page = await pausedFlight(t),
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  assert.equal(page.$('capture-flight-limits').hidden, false);
  assert.equal(page.$('capture-flight-limits').open, false);
  assert.equal(page.doc.activeElement.id, 'start-button');
  assert.match(page.$('capture-recording-limit').textContent, /30-minute limit/);
  assert.match(page.$('capture-recording-limit').textContent, /not confirmation/);
  assert.match(page.$('capture-collection-limit').textContent, /Classic collection/);
  page.$('capture-flight-limits').open = true; // Modeled native details disclosure only.
  page.$('capture-limit-saves').focus();
  await activateHostAction(page.$('capture-limit-saves'));
  assert.equal(page.$('library-dialog').open, true);
  assert.equal(page.$('library-saves').hidden, false);
  assert.equal(page.$('export-session').textContent, 'Export current attempt');
  assert.equal(page.$('attempt-export-source').textContent, '');
  const session = JSON.parse(page.storage.getItem('revealline.suspended.dev.v1'));
  assert.deepEqual(nativeCaptureSession(session).replay.checkpoint, checkpoint);
  assert.equal(verifyReplay(nativeCaptureSession(session).replay).match, true);
  await activateHostAction(page.$('export-session'));
  const exported = nativeCaptureSession(JSON.parse(page.$('save-json').value));
  assert.deepEqual(exported.replay.checkpoint, checkpoint);
  assert.equal(verifyReplay(exported.replay).match, true);
  page.doc.querySelector('button[data-close="library-dialog"]').click();
  await Promise.resolve();
  assert.equal(page.doc.activeElement.id, 'capture-limit-saves');
  page.$('capture-limit-replay').focus();
  page.$('capture-limit-replay').click();
  await settle(() => page.$('replay-dialog').open);
  const file = JSON.parse(page.$('replay-json').value),
    replay = file.replay ?? file;
  assert.deepEqual(replay.checkpoint, checkpoint);
  assert.equal(verifyReplay(replay).match, true);
  page.$('replay-dialog').close();
  for (let n = 0; n < 12; n++) page.frame();
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  setLocale('uk', { persist: false });
  assert.equal(page.$('capture-flight-limits-summary').textContent, 'Збереження польоту');
  assert.match(page.$('capture-recording-limit').textContent, /Час на паузі не враховується/);
  assert.match(page.$('capture-collection-limit').textContent, /класичної колекції/);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test(
  'legal continuous play warns before recording stops and keeps the earlier checkpoint distinct',
  { timeout: 600000 },
  async (t) => {
    const previous = getLocale();
    setLocale('en', { persist: false });
    t.after(() => setLocale(previous, { persist: false }));
    const page = await soloPage(t, { initialReadyTimeoutMs: 30000 });
    await activateHostAction(page.$('start-button'));
    await settle(() => page.doc.body.dataset.flightState === 'running');
    const beforeCap = MAX_REPLAY_TICKS - 120;
    for (let n = 0; n < 7200 && page.rendered.run.tick < beforeCap; n++) page.frame(250);
    assert.equal(page.rendered.run.status, 'running');
    assert.equal(page.rendered.run.tick, beforeCap);
    const notices = readFlightInformation(page.$('run-message')).recentNotices;
    assert.equal(notices.filter((notice) => notice.role === 'host.flight-limits').length, 1);
    page.$('pause-button').click();
    assert.equal(page.$('capture-flight-limits').open, true);
    assert.match(page.$('capture-recording-limit').textContent, /about 1 min/);
    const saved = page.storage.getItem('revealline.suspended.dev.v1');
    assert.equal(nativeCaptureSession(JSON.parse(saved)).replay.ticks, beforeCap);
    for (let n = 0; n < 20; n++) page.frame(250);
    assert.equal(
      page.rendered.run.tick,
      beforeCap,
      'Time spent paused does not consume the budget.',
    );
    await activateHostAction(page.$('start-button'));
    await settle(() => page.doc.body.dataset.flightState === 'running');
    for (let n = 0; n < 10 && page.rendered.run.tick <= MAX_REPLAY_TICKS; n++) page.frame(250);
    assert.ok(page.rendered.run.tick > MAX_REPLAY_TICKS);
    page.$('pause-button').click();
    assert.match(
      page.$('capture-recording-limit').textContent,
      /no longer has a complete recording/,
    );
    assert.equal(page.$('capture-limit-replay').disabled, true);
    assert.equal(page.$('save-attempt-button').disabled, true);
    assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), saved);
    await activateHostAction(page.$('capture-limit-saves'));
    assert.equal(page.$('export-session').disabled, true);
    assert.match(page.$('attempt-export-source').textContent, /earlier checkpoint/);
    assert.equal(page.rendered.run.status, 'running');
    assert.deepEqual(page.errors, []);
  },
);

test('an authored Journey flight names its independent progress store', async (t) => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(previous, { persist: false }));
  const page = await soloPage(t, {
    search: '?journey=opening',
    initialReadyTimeoutMs: 30000,
    pictures: {
      Image: class {
        width = 1774;
        height = 887;
        naturalWidth = 1774;
        naturalHeight = 887;
        set src(value) {
          this.source = value;
          queueMicrotask(() => this.onload?.());
        }
        async decode() {}
        removeAttribute() {
          this.source = '';
        }
      },
    },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
  await activateHostAction(page.$('start-button'));
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame();
  page.$('pause-button').click();
  assert.match(page.$('capture-collection-limit').textContent, /Journey clears and pictures/);
  assert.match(page.$('capture-collection-limit').textContent, /two-hour limit does not apply/);
  assert.match(page.$('capture-collection-limit').textContent, /still need a complete recording/);
  assert.deepEqual(page.errors, []);
});
