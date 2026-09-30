import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { validateCoopLevel } from '../coop/core.mjs';
import { page } from './helpers/coop-host.mjs';

function densePack() {
  const pack = structuredClone(COOP_STARTER_PACK),
    level = structuredClone(pack.levels[0]);
  pack.id = 'dense-cue-review';
  pack.name = 'Dense cue review';
  level.id = 'dense-cue-arena';
  level.name = 'Dense cue arena';
  level.enemies = Array.from({ length: 16 }, (_, index) => ({
    id: `hunter-${String(index + 1).padStart(2, '0')}`,
    type: 'hunter',
    x: 5.5 + (index % 8) * 8,
    y: 9.5 + Math.floor(index / 8) * 16,
    vx: 0.1,
    vy: 0.1,
    radius: 0.3,
  }));
  level.strongholds = Array.from({ length: 8 }, (_, index) => ({
    id: `relay-${index + 1}`,
    core: { x: 4.5 + index * 8, y: 17.5 },
    anchors: [
      { x: 3.5 + index * 8, y: 15.5 },
      { x: 5.5 + index * 8, y: 15.5 },
    ],
  }));
  level.goal = { coverage: 0.65 };
  assert.deepEqual(validateCoopLevel(level), { valid: true, errors: [] });
  pack.levels = [level];
  return pack;
}

test('actual imported maximum-density arena exposes all entries and one press enters paused reading', async (t) => {
  const f = await page(t, {
    nativeFocus: true,
    beforeImport({ $ }) {
      $('coop-canvas').clientWidth = 212;
    },
  });
  await f.selectFile(JSON.stringify(densePack()));
  assert.equal(f.$('coop-level').value, 'dense-cue-arena');
  f.$('coop-start').click();
  f.tick(3);
  assert.equal(f.$('coop-cue-overflow').hidden, false);
  assert.equal(f.$('coop-field-details').hidden, false);
  assert.equal(f.$('coop-field-details-list').children.length, 26);
  assert.equal(
    new Set(f.$('coop-field-details-list').children.map((item) => item.dataset.entity)).size,
    26,
  );
  assert.match(f.$('coop-cue-announcement').textContent, /Some field labels need more room/);
  assert.equal(f.$('coop-field-details-section').getAttribute('aria-live'), 'off');
  const action = f.$('coop-field-details');
  const criticalMessage = f.$('coop-message').textContent;
  let noticeWrites = 0;
  const notice = f.$('coop-cue-announcement'),
    textDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(notice), 'textContent');
  Object.defineProperty(notice, 'textContent', {
    configurable: true,
    get() {
      return textDescriptor.get.call(this);
    },
    set(value) {
      noticeWrites++;
      textDescriptor.set.call(this, value);
    },
  });
  f.tick(20);
  assert.equal(noticeWrites, 0, 'Continued overflow has no live-region chatter');
  assert.equal(
    f.$('coop-message').textContent,
    criticalMessage,
    'Overflow does not replace the existing instruction',
  );
  action.focus();
  f.tap('Enter');
  assert.equal(f.$('coop-help').open, true);
  assert.equal(
    f.doc.activeElement.id,
    'coop-help-reading',
    'one action enters the existing reader',
  );
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  const clock = f.$('coop-clock').textContent;
  f.tick(120);
  assert.equal(f.$('coop-clock').textContent, clock);
  assert.equal(f.$('coop-field-details-list').children.length, 26);
  const details = f.$('coop-field-details-list').textContent;
  f.$('coop-canvas').clientWidth = 600;
  f.tick(3);
  assert.equal(f.doc.activeElement.id, 'coop-help-reading', 'reflow retains reader ownership');
  assert.equal(f.$('coop-field-details-list').textContent, details);
  assert.equal(f.$('coop-clock').textContent, clock);
  f.press('Escape');
  assert.equal(f.doc.activeElement, action);
  f.tick(20);
  assert.equal(f.$('coop-clock').textContent, clock, 'Back never resumes');
  assert.equal(action.hidden, false, 'the paused reader survives desktop reflow');
  assert.equal(f.$('coop-cue-overflow').hidden, true);
  f.$('coop-resume').click();
  f.tick(120);
  assert.notEqual(f.$('coop-clock').textContent, clock);
  assert.equal(f.$('coop-cue-overflow').hidden, false, 'admission survives a later clear layout');
  assert.equal(action.parentNode, f.$('coop-cue-overflow'));
  action.focus();
  f.tick(3);
  assert.equal(f.doc.activeElement, action, 'a transient fit cannot retire the focused action');
  assert.equal(action.hidden, false);
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-field-details-section').hidden, true);
  assert.equal(f.$('coop-field-details-list').children.length, 0);
  assert.equal(f.$('coop-cue-announcement').textContent, '');
  const oldAction = action.onclick;
  oldAction();
  assert.notEqual(
    f.doc.activeElement.id,
    'coop-help-reading',
    'A retired attempt cannot reopen its reader',
  );
});

test('fresh controller Confirm enters overflow details once and Back preserves the paused attempt', async (t) => {
  const f = await page(t, {
    beforeImport({ $ }) {
      $('coop-canvas').clientWidth = 212;
    },
  });
  await f.selectFile(JSON.stringify(densePack()));
  f.$('coop-start').click();
  f.tick(3);
  f.$('coop-pause').click();
  const clock = f.$('coop-clock').textContent,
    pad = {
      index: 0,
      id: 'Overflow controller',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
  f.pads.push(pad);
  const press = (index, ticks = 1) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick(ticks);
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick(2);
  };
  f.tick(2);
  press(0);
  for (let i = 0; i < 35 && f.doc.activeElement.id !== 'coop-field-details'; i++) press(13);
  assert.equal(f.doc.activeElement.id, 'coop-field-details');
  press(0, 45);
  assert.equal(f.doc.activeElement.id, 'coop-help-reading');
  assert.equal(f.$('coop-clock').textContent, clock);
  press(1);
  assert.equal(f.doc.activeElement.id, 'coop-field-details');
  assert.equal(f.$('coop-clock').textContent, clock);
  const retiredAction = f.$('coop-field-details').onclick;
  f.win.emit('pagehide');
  assert.equal(f.$('coop-field-details').onclick, null);
  retiredAction();
  assert.notEqual(f.doc.activeElement.id, 'coop-help-reading');
});

test('clear ordinary Team canvas adds no overflow action or announcement', async (t) => {
  const f = await page(t);
  f.$('coop-start').click();
  f.tick(3);
  assert.equal(f.$('coop-field-details').hidden, true);
  assert.equal(f.$('coop-cue-overflow').hidden, true);
  assert.equal(f.$('coop-field-details-section').hidden, true);
  assert.equal(f.$('coop-cue-announcement').textContent, '');
});
