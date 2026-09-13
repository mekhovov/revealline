import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { prepareScenario } from '../imports.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const source = JSON.parse(
  await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
);
const lesson =
  'Recommended: Scout. Scan at home to reveal the hidden relay, then cut Down. The full authored lesson must remain readable without starting the flight.';
function nativeDialogs(t) {
  const show = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close;
  const origins = new WeakMap();
  SoloElement.prototype.showModal = function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    show.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled)')?.focus();
  };
  SoloElement.prototype.close = function () {
    if (!this.open) return;
    close.call(this);
    const origin = origins.get(this);
    if (origin?.isConnected && !origin.closest('[hidden]')) origin.focus();
  };
  t.after(() => {
    SoloElement.prototype.showModal = show;
    SoloElement.prototype.close = close;
  });
}
function key(page, value, { release = true, repeat = false } = {}) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat });
  if (!event.defaultPrevented && value === 'Enter' && target.tagName === 'BUTTON') target.click();
  // Escape's cancellable modal close is a browser default, not game behavior.
  const dialog = target.closest('dialog[open]');
  if (
    !event.defaultPrevented &&
    value === 'Escape' &&
    dialog &&
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
  )
    dialog.close();

  if (release) target.emit('keyup', { key: value, code: value });
  return event;
}
function reach(page, id) {
  for (let i = 0; i < 35 && page.doc.activeElement.id !== id; i++) key(page, 'ArrowDown');
  assert.equal(page.doc.activeElement.id, id, `${id} remains keyboard reachable`);
}
function frames(page, n) {
  for (let i = 0; i < n; i++) page.frame();
}
async function practice(t, turnPolicy, { arcade = false } = {}) {
  nativeDialogs(t);
  const raw = structuredClone(source);
  raw.level.metadata.description = lesson;
  raw.settings.turnPolicy = turnPolicy;
  if (arcade) raw.level.classic.arcadeActions = { version: 'arcade-actions.v1' };
  const scenario = (await prepareScenario(raw)).scenario;
  const storage = memoryStorage({ control: 'retained' });
  const previewStorage = memoryStorage({
    'revealline.playground.current': JSON.stringify(scenario),
  });
  const page = await soloPage(t, { storage, previewStorage, search: '?practice=1&revision=2' });
  const region = page.$('mission-brief-reading');
  region.clientHeight = 100;
  region.scrollHeight = 500;
  return Object.assign(page, { previewStorage });
}
function pad(page, t) {
  let now = 1000;
  const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    descriptor ? Object.defineProperty(performance, 'now', descriptor) : delete performance.now,
  );
  const controller = {
    index: 0,
    id: 'Brief controls',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [controller];
  const frame = () => {
    now += 16;
    page.frame(16);
  };
  const set = (index, pressed) => {
    controller.buttons[index] = { pressed, value: pressed ? 1 : 0 };
  };
  const pulse = (index) => {
    set(index, true);
    frame();
    set(index, false);
    frame();
  };
  const find = (id) => {
    for (let i = 0; i < 35 && page.doc.activeElement.id !== id; i++) pulse(13);
    assert.equal(page.doc.activeElement.id, id);
  };
  frame();
  pulse(0);
  frame();
  return { frame, set, pulse, find };
}
for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: native keyboard opens exact practice lesson from ready and a live-cut pause without starting or changing the run`, async (t) => {
    const page = await practice(t, policy);
    const ready = authoritativeCheckpoint(page.rendered.run),
      writes = page.storage.writes.length;
    const raw = page.previewStorage.getItem('revealline.playground.current');
    assert.equal(page.$('shell-edition').textContent, 'PRACTICE');
    reach(page, 'overlay-brief');
    key(page, 'Enter');
    assert.equal(page.$('shell-missions').open, true);
    assert.equal(page.$('mission-brief').open, true);
    assert.equal(page.$('shell-missions').dataset.view, 'brief');
    assert.equal(page.$('shell-mission-content').hidden, true);
    assert.equal(page.$('shell-briefing').hidden, true);
    assert.equal(page.$('mission-brief-unit').parentElement, page.$('shell-brief-content'));
    assert.ok(page.$('mission-picker-stage').closest('[hidden]'));
    assert.ok(page.$('mission-picker-setup').closest('[hidden]'));
    assert.equal(page.doc.activeElement.id, 'mission-brief-read');
    assert.equal(page.$('mission-brief-copy').textContent, lesson);
    key(page, 'Enter');
    key(page, 'ArrowDown');
    assert.ok(page.$('mission-brief-reading').scrollTop > 0);
    key(page, 'Escape');
    assert.equal(page.$('shell-missions').open, true);
    key(page, 'Escape');
    assert.equal(page.$('shell-missions').open, false);
    assert.equal(page.$('shell-mission-content').hidden, false);
    assert.equal(page.$('shell-brief-content').hidden, true);
    assert.equal(page.$('mission-brief-unit').parentElement, page.$('mission-brief'));
    frames(page, 12);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ready);
    assert.equal(page.$('game-overlay').dataset.kind, 'ready');
    reach(page, 'start-button');
    key(page, 'Enter');
    page.key('ArrowDown');
    frames(page, 25);
    page.key('ArrowDown', false);
    page.key('Escape');
    page.key('Escape', false);
    page.frame(0);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    const checkpoint = authoritativeCheckpoint(page.rendered.run),
      pausedTick = page.rendered.run.tick;
    assert.ok(page.rendered.run.trail.length > 0);
    reach(page, 'overlay-brief');
    key(page, 'Enter');
    key(page, 'Enter');
    key(page, 'ArrowDown');
    key(page, 'Escape');
    key(page, 'ArrowRight');
    key(page, 'Escape');
    frames(page, 20);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    reach(page, 'start-button');
    key(page, 'Enter');
    page.frame();
    assert.equal(page.rendered.run.player.direction, 'down');
    assert.ok(page.rendered.run.tick > pausedTick);
    assert.equal(page.storage.writes.length, writes);
    assert.equal(page.previewStorage.getItem('revealline.playground.current'), raw);
    assert.deepEqual(page.errors, []);
  });
  test(`${policy}: controller brief/read/Back and held direction retain the paused flight`, async (t) => {
    const page = await practice(t, policy),
      controls = pad(page, t);
    controls.find('start-button');
    controls.pulse(0);
    controls.pulse(13);
    frames(page, 20);
    controls.pulse(9);
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    controls.find('overlay-brief');
    controls.pulse(0);
    assert.equal(page.doc.activeElement.id, 'mission-brief-read');
    assert.equal(page.$('shell-mission-content').hidden, true);
    controls.pulse(0);
    controls.set(13, true);
    controls.frame();
    controls.pulse(1);
    assert.equal(page.$('shell-missions').open, true);
    controls.pulse(1);
    assert.equal(
      page.$('shell-missions').open,
      true,
      'Held direction keeps the neutral gate after leaving reading.',
    );
    controls.set(13, false);
    controls.frame();
    controls.set(13, true);
    controls.pulse(1);
    assert.equal(page.$('shell-missions').open, false);
    const focus = page.doc.activeElement;
    for (let i = 0; i < 35; i++) controls.frame();
    assert.equal(page.doc.activeElement, focus);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    controls.set(13, false);
    controls.frame();
    controls.find('start-button');
    controls.pulse(0);
    assert.equal(page.rendered.run.player.direction, 'down');
    assert.equal(page.$('game-overlay').hidden, true);
    assert.deepEqual(page.errors, []);
  });
}
test('focused brief restores exact picker placement, native Back and normal missions across repeated openings', async (t) => {
  const page = await practice(t, 'immediate'),
    unit = page.$('mission-brief-unit'),
    detail = page.$('mission-brief'),
    originalChildren = [...detail.children],
    checkpoint = authoritativeCheckpoint(page.rendered.run),
    title = page.$('shell-missions-title').textContent,
    context = page.$('shell-missions-context').textContent;
  for (let attempt = 0; attempt < 2; attempt++) {
    page.$('mission-brief-reading').scrollTop = 250;
    reach(page, 'overlay-brief');
    key(page, 'Enter');
    assert.equal(
      page.$('shell-missions-title').textContent,
      page.$('mission-brief-title').textContent,
    );
    assert.equal(page.$('shell-missions-context').textContent, 'PRACTICE · MISSION BRIEF');
    assert.equal(page.$('mission-brief-reading').scrollTop, 0);
    assert.equal(unit.parentElement, page.$('shell-brief-content'));
    // Native close events can be queued after a rapid re-open. The active
    // focused view must survive a preceding dialog's delayed event.
    page.$('shell-missions').emit('close');
    assert.equal(page.$('shell-missions').dataset.view, 'brief');
    const visited = new Set();
    for (let i = 0; i < 8; i++) {
      visited.add(page.doc.activeElement.id);
      key(page, 'ArrowDown');
    }
    assert.deepEqual([...visited].sort(), ['mission-brief-read', 'shell-missions-back']);
    reach(page, 'shell-missions-back');
    key(page, 'Enter');
    assert.equal(page.$('shell-missions').open, false);
    assert.equal(page.$('shell-missions').dataset.view, undefined);
    assert.equal(page.$('shell-missions-title').textContent, title);
    assert.equal(page.$('shell-missions-context').textContent, context);
    assert.deepEqual(detail.children, originalChildren);
    assert.equal(detail.open, false);
    assert.equal(page.$('shell-brief-content').children.length, 0);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  }
  reach(page, 'overlay-menu');
  key(page, 'Enter');
  reach(page, 'shell-play');
  key(page, 'Enter');
  assert.equal(page.$('shell-missions').open, true);
  assert.equal(page.$('shell-missions-title').textContent, title);
  assert.equal(page.$('shell-mission-content').hidden, false);
  assert.equal(page.$('shell-briefing').hidden, false);
  assert.equal(page.$('mission-picker-stage').closest('[hidden]'), null);
  assert.equal(page.$('mission-picker-setup').closest('[hidden]'), null);
  assert.ok(page.doc.activeElement.closest('#mission-picker-cards'));
  assert.deepEqual(detail.children, originalChildren);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
});

test('long brief has scoped fluid reading layout, explicit body sizes and Large preference without simulation changes', async (t) => {
  const css = await readFile(new URL('../ui/mission-brief.css', import.meta.url), 'utf8'),
    html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="ui\/mission-brief.css"/);
  // These are source layout contracts, not a browser/computed geometry oracle.
  assert.match(
    css,
    /#shell-brief-content #mission-brief-reading\s*\{[^}]*min-height: 120px;[^}]*max-height: none;[^}]*overflow-y: auto;/,
  );
  assert.match(
    css,
    /#shell-brief-content #mission-brief-reading > p\s*\{[^}]*font-size: 20px;[^}]*line-height: 1.55;/,
  );
  assert.match(
    css,
    /\[data-text-size='large'\][^{]*#mission-brief-reading > p\s*\{[^}]*font-size: 22px;/,
  );
  assert.match(
    css,
    /@media \(max-width: 480px\)[\s\S]*#mission-brief-reading > p\s*\{[^}]*font-size: 18px;/,
  );
  const page = await practice(t, 'grid-center'),
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('settings-button').click();
  page.$('text-size').value = 'large';
  page.$('text-size').emit('change');
  page.$('settings-dialog').close();
  assert.equal(page.doc.body.dataset.textSize, 'large');
  reach(page, 'overlay-brief');
  key(page, 'Enter');
  const region = page.$('mission-brief-reading');
  // Modeled responsive geometry proves reader ownership across reflow only.
  region.clientHeight = 240;
  region.scrollHeight = 1200;
  key(page, 'Enter');
  key(page, 'ArrowDown');
  assert.ok(region.scrollTop > 0);
  region.clientHeight = 120;
  key(page, 'End');
  assert.equal(region.scrollTop, 1080);
  key(page, 'Escape');
  key(page, 'Escape');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
test('an imported authored arcade scenario is still labeled practice', async (t) => {
  const page = await practice(t, 'immediate', { arcade: true });
  assert.equal(page.$('shell-edition').textContent, 'PRACTICE');
});
test('First Flight keeps its own lesson reader and contextual label', async (t) => {
  const page = await soloPage(t, { search: '?course=first-flight&lesson=close-line' });
  assert.equal(page.$('shell-edition').textContent, 'FIRST FLIGHT');
  assert.equal(page.$('overlay-brief').hidden, true);
});
test('ordinary manual missions have a neutral label without inventing a Tactical edition', async (t) => {
  const page = await soloPage(t);
  assert.equal(page.$('shell-edition').textContent, 'REVEAL / LINE');
  assert.equal(page.$('overlay-brief').hidden, false);
});

test('only an ordinary validated Arcade action policy receives the Arcade label', async (t) => {
  // Real chapter installation still validates exact image headers; native
  // decode is the only modeled boundary needed for this context-label case.
  class ChapterImage {
    set src(value) {
      const header = inspectImageDataUrl(value);
      assert.equal(header.valid, true);
      this.width = this.naturalWidth = header.width;
      this.height = this.naturalHeight = header.height;
      queueMicrotask(() => this.onload?.());
    }
    decode() {
      return Promise.resolve();
    }
  }
  const page = await soloPage(t, { titleScreen: true, pictures: { Image: ChapterImage } });
  await page.$('shell-featured').onclick();
  page.frame(0);
  assert.equal(
    page.$('shell-edition').textContent,
    'ARCADE EDITION',
    JSON.stringify({
      levelId: page.rendered.run.levelId,
      error: page.$('content-select-status').textContent,
      message: page.$('run-message').textContent,
      logs: page.errors,
    }),
  );
  assert.equal(page.rendered.run.level.classic.arcadeActions.version, 'arcade-actions.v1');
});
