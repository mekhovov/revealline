import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  mountFlightHud,
  mountStickTrace,
} from '../../optional-practice/civilian-fpv/sim-presentation.mjs';

for (const lang of ['en', 'uk']) {
  test(`Flight guidance can be dismissed, restored and remembered in ${lang}`, () => {
    const doc = new Document(),
      values = new Map();
    doc.createElementNS = (_ns, tag) => doc.createElement(tag);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const container = doc.createElement('div');
    doc.body.append(container);
    const hud = mountFlightHud({ container, storage, locale: () => lang });
    const controls = doc.createElement('div');
    doc.body.append(controls);
    hud.preferenceControls(controls);
    const root = container.querySelector('[data-sim-hud="flight"]');
    const feedback = { id: 'target', action: 'Touch a target' };
    hud.update(feedback, { visible: true, active: true });
    assert.equal(root.hidden, false);
    const dismiss = root.querySelector('[data-hud-part="hide"]');
    assert.ok(dismiss.getAttribute('aria-label'));
    dismiss.click();
    assert.equal(hud.preferences().mode, 'off');
    assert.equal(root.hidden, true);
    hud.update(feedback, { visible: true, active: true });
    hud.setWorldCue({ x: 0.5, y: 0.5 });
    assert.equal(root.hidden, true, 'HUD updates and target cues cannot reopen dismissed guidance');
    const other = mountFlightHud({ container, storage, locale: () => lang });
    assert.equal(other.preferences().mode, 'off');
    const mode = controls.querySelector('[data-hud-preference="mode"]');
    mode.value = 'guided';
    mode.emit('change');
    assert.equal(root.hidden, false);
    hud.update(feedback, { visible: false, active: true });
    assert.equal(root.hidden, true, 'An open menu retains screen ownership');
    hud.destroy();
    other.destroy();
  });
}

test('Shared stick trails retain movement direction and reset for unavailable inputs', () => {
  const doc = new Document();
  doc.createElementNS = (_ns, tag) => doc.createElement(tag);
  const target = doc.createElement('div');
  doc.body.append(target);
  const trace = mountStickTrace(target);
  trace.update({ x: 0, y: 0, now: 0, source: 'radio' });
  trace.update({ x: 0.5, y: 0, now: 50, source: 'radio' });
  const path = target.querySelector('.sim-stick-trace-path');
  assert.ok(path.getAttribute('points').includes('120'));
  trace.update({ x: 0.5, y: 0.5, now: 100, source: 'radio', reducedMotion: true });
  assert.equal(path.getAttribute('points'), '');
  trace.dispose();
  assert.equal(target.querySelector('.sim-stick-trace'), null);
});
