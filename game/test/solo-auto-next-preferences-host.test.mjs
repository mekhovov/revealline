import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { continuousPlayPreferences, CONTINUOUS_PLAY_KEY } from '../ui/continuous-play.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'auto-next-preference-host',
  revision: '1',
  title: 'Automatic Next preference',
  levels: Array.from({ length: 5 }, (_, i) => ({
    ...retryFixture('self-contact').level,
    id: `next-${i}`,
    goal: { coverage: 0.1 },
  })),
};

test(
  'Solo honors the shared automatic Next preference and retires only its own subscription',
  { timeout: 60000 },
  async (t) => {
    const h = await soloPage(t, {
      campaign,
      pictures: {
        Image: class {
          width = 64;
          height = 64;
          set src(value) {
            this.source = value;
            queueMicrotask(() => this.onload?.());
          }
        },
      },
    });
    const preferences = continuousPlayPreferences();
    const advance = (ms) => {
      for (let i = 0; i < Math.ceil(ms / 100); i++) h.frame(Math.min(100, ms - i * 100));
    };
    async function running() {
      await settle(() => h.doc.body.dataset.flightState === 'running', 'public running', {
        timeoutMs: 15000,
      });
    }
    function win() {
      h.key('ArrowDown');
      for (let i = 0; i < 100 && h.rendered.run.status === 'running'; i++) h.frame(100);
      h.key('ArrowDown', false);
      assert.equal(h.rendered.run.status, 'won');
      const run = h.rendered.run;
      for (let i = 0; i < 100 && h.$('game-overlay').hidden; i++) h.frame(100);
      assert.equal(h.$('game-overlay').dataset.kind, 'won');
      assert.equal(h.$('game-overlay').hidden, false);
      return run;
    }
    async function next(run) {
      h.$('next-button').click();
      await running();
      assert.notEqual(h.rendered.run, run);
    }
    function publicPreference(value) {
      h.$('overlay-settings').click();
      h.$('settings-tab-gameplay').click();
      const control = h.$('settings-autoNext');
      assert(control);
      control.checked = value;
      control.emit('change');
      h.doc.querySelector('[data-close="settings-dialog"]').click();
      assert.equal(preferences.snapshot().autoNext, value);
      assert.equal(JSON.parse(h.storage.getItem(CONTINUOUS_PLAY_KEY)).autoNext, value);
    }
    h.$('start-button').click();
    await running();
    assert.equal(preferences.snapshot().autoNext, true);
    const defaultRun = win();
    advance(5000);
    await running();
    assert.notEqual(
      h.rendered.run,
      defaultRun,
      'Default true keeps the existing automatic advance',
    );
    h.$('pause-button').click();
    h.frame(0);
    publicPreference(false);
    h.$('start-button').click();
    await running();
    const disabledRun = win(),
      disabledCheckpoint = authoritativeCheckpoint(disabledRun);
    assert.equal(h.$('result-auto-next').hidden, true);
    advance(7000);
    assert.equal(h.rendered.run, disabledRun);
    assert.deepEqual(authoritativeCheckpoint(disabledRun), disabledCheckpoint);
    await next(disabledRun);
    h.$('pause-button').click();
    h.frame(0);
    publicPreference(true);
    h.$('start-button').click();
    await running();
    const countdownRun = win(),
      countdownCheckpoint = authoritativeCheckpoint(countdownRun);
    assert.equal(h.$('result-auto-next').hidden, false);
    h.storage.setItem(
      CONTINUOUS_PLAY_KEY,
      JSON.stringify({ autoNext: false, autoRetry: true, autoReplay: true }),
    );
    h.win.emit('storage', { key: CONTINUOUS_PLAY_KEY });
    assert.equal(preferences.snapshot().autoNext, false);
    assert.equal(h.$('result-auto-next').hidden, true);
    advance(7000);
    assert.equal(h.rendered.run, countdownRun);
    assert.deepEqual(authoritativeCheckpoint(countdownRun), countdownCheckpoint);
    preferences.set('autoNext', true);
    advance(7000);
    assert.equal(
      h.rendered.run,
      countdownRun,
      'Re-enabling does not resurrect the cancelled result',
    );
    await next(countdownRun);
    h.$('pause-button').click();
    h.frame(0);

    let reads = 0,
      writes = 0;
    const notice = h.$('result-auto-next');
    let hidden = notice.hidden;
    Object.defineProperty(notice, 'hidden', {
      configurable: true,
      get: () => {
        reads++;
        return hidden;
      },
      set: (value) => {
        hidden = value;
        writes++;
      },
    });
    h.win.emit('pagehide', { persisted: true });
    reads = writes = 0;
    preferences.set('autoNext', false);
    assert.equal(reads, 1, 'A cached page retains its subscription');
    assert.equal(writes, 0, 'An already hidden notice requires no redundant DOM write');
    h.win.emit('pagehide', { persisted: false });
    reads = writes = 0;
    let notifications = 0;
    const stop = preferences.subscribe(() => notifications++);
    preferences.set('autoNext', true);
    preferences.set('autoNext', false);
    stop();
    assert.equal(notifications, 2, 'Other consumers retain the shared owner');
    assert.equal(reads, 0, 'Retired Solo no longer observes its countdown');
    assert.equal(writes, 0, 'Retired Solo no longer updates its countdown');
    assert.deepEqual(h.errors, []);
  },
);
