import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  createOverflightTextScalingView,
  overflightCaptionFits,
} from '../overflight/text-scaling-view.mjs';
import { createOverflightRiyMode } from '../overflight/riy-mode.mjs';
import { overflightRiyTarget } from '../overflight/riy-core.mjs';
import { createOverflightRun, startOverflight, stepOverflight } from '../overflight/core.mjs';

function fixture() {
  const doc = new Document();
  const landscape = Object.assign(new Events(), { matches: false });
  doc.defaultView.matchMedia = () => landscape;
  const node = (tag, id, parent) => {
    const value = doc.createElement(tag);
    value.id = id;
    parent.append(value);
    return value;
  };
  const game = node('section', 'overflight-game', doc.body),
    reading = node('section', 'native-pause-reading', doc.body),
    arena = node('div', 'render-host', game),
    credit = node('aside', 'overflight-music-now-playing', game),
    hud = node('div', 'overflight-hud', game),
    top = node('div', 'native-instruments', hud),
    tally = node('div', 'native-tally', top),
    level = node('span', 'hud-level', tally),
    kills = node('span', 'hud-kills', tally),
    controls = node('div', 'overflight-field-controls', hud),
    review = node('div', 'overflight-review-controls', controls),
    details = node('details', 'overflight-diagnostics', review),
    action = node('button', 'native-review-action', details),
    cache = node('p', 'hud-cache', hud),
    reward = node('div', 'hud-reward', hud),
    commentary = node('div', 'overflight-commentator', hud),
    bottom = node('div', 'native-bottomline', hud),
    build = node('span', 'hud-build', bottom),
    boost = node('span', 'hud-boost', bottom),
    context = node('span', 'native-context', hud);
  context.dataset.operationContext = 'true';
  credit.hidden = true;
  details.open = true;
  review.scrollTop = 37;
  let activations = 0;
  action.addEventListener('click', () => activations++);
  return {
    doc,
    landscape,
    reading,
    game,
    arena,
    credit,
    hud,
    top,
    tally,
    level,
    kills,
    controls,
    review,
    details,
    action,
    cache,
    reward,
    commentary,
    bottom,
    build,
    boost,
    context,
    activations: () => activations,
  };
}

test('caption fit uses the complete actual field and excludes visible reward/cache/touch hit areas', () => {
  const f = fixture(),
    panel = f.doc.createElement('div');
  f.commentary.append(panel);
  f.doc.defaultView.innerWidth = 844;
  f.doc.defaultView.innerHeight = 390;
  f.arena._rect = { x: 0, y: 100, width: 376, height: 212 };
  panel._rect = { x: 4, y: 104, width: 368, height: 190 };
  f.cache.hidden = f.reward.hidden = true;
  const fits = () => overflightCaptionFits({ document: f.doc, panel });
  assert.equal(fits(), true);
  panel._rect.height = 300;
  assert.equal(fits(), false, 'Full AX text below the viewport is not a readable fit.');
  panel._rect.height = 190;
  f.reward.hidden = false;
  f.reward._rect = { x: 4, y: 104, width: 368, height: 70 };
  assert.equal(fits(), false, 'Critical reward facts cannot be covered.');
  f.reward.hidden = true;
  const touch = f.doc.createElement('div'),
    action = f.doc.createElement('button');
  touch.className = 'overflight-touch';
  touch.append(action);
  f.game.append(touch);
  action._rect = { x: 20, y: 260, width: 112, height: 44 };
  assert.equal(fits(), false, 'A visible native control retains its whole hit area.');
  touch.hidden = true;
  assert.equal(fits(), true);
  touch.hidden = false;
  action.hidden = true;
  const surface = f.doc.createElement('div');
  surface.className = 'shared-touch-surface';
  surface._rect = { x: 4, y: 180, width: 156, height: 156 };
  touch.append(surface);
  assert.equal(fits(), false, 'The gesture surface is also a critical native input area.');
  touch.hidden = true;
  f.arena._rect = { x: 0, y: 350, width: 376, height: 212 };
  panel._rect = { x: 4, y: 354, width: 368, height: 60 };
  assert.equal(fits(), false, 'A field extending below the viewport cannot qualify a caption.');
});

test('existing presentation frame coalesces caption geometry refresh and retires stale work', () => {
  const f = fixture(),
    frames = new Map();
  let id = 0,
    refreshed = 0;
  f.doc.defaultView.requestAnimationFrame = (callback) => {
    frames.set(++id, callback);
    return id;
  };
  f.doc.defaultView.cancelAnimationFrame = (key) => frames.delete(key);
  const view = createOverflightTextScalingView({
    document: f.doc,
    readingRoot: f.reading,
    label: () => 'Details',
    onLayoutChange: () => refreshed++,
  });
  view.refresh(true);
  view.refreshCaptionLayout();
  f.doc.defaultView.emit('resize');
  assert.equal(frames.size, 1);
  const stale = [...frames.values()][0];
  view.refresh(false);
  stale();
  assert.equal(refreshed, 0);
  view.refresh(true);
  const disposed = [...frames.values()][0];
  view.dispose();
  disposed();
  assert.equal(refreshed, 0);
});

test('secondary-copy reflow preserves exact native nodes, disclosure, scroll, handlers and focused descendants', () => {
  const f = fixture(),
    originals = new Map();
  for (const parent of [f.game, f.hud, f.controls, f.review, f.bottom])
    originals.set(parent, [...parent.children]);
  let locale = 'en';
  const view = createOverflightTextScalingView({
    document: f.doc,
    readingRoot: f.reading,
    label: () => (locale === 'en' ? 'Flight details' : 'Подробиці польоту'),
  });
  view.refresh(false);
  assert.equal(f.doc.getElementById('overflight-flight-details'), null);
  f.action.focus();
  for (const language of ['en', 'uk', 'en']) {
    locale = language;
    view.refresh(true);
    const secondary = f.doc.getElementById('overflight-flight-details');
    assert.equal(
      f.doc.getElementById(secondary.getAttribute('aria-labelledby')).textContent,
      language === 'en' ? 'Flight details' : 'Подробиці польоту',
    );
    assert.ok(secondary.parentNode === f.reading);
    assert.ok(f.build.parentNode === secondary);
    assert.ok(f.context.parentNode === secondary);
    assert.ok(f.credit.parentNode === secondary);
    assert.ok(f.review.parentNode === f.controls);
    for (const live of [f.cache, f.reward, f.commentary])
      assert.ok(
        live.closest('#overflight-field-notices')?.parentNode === f.game,
        'Full timed guidance remains in the live field layer.',
      );
    assert.ok(f.arena.parentNode === f.game);
    assert.ok(f.top.parentNode === f.hud);
    assert.ok(f.boost.parentNode === f.bottom);
    assert.ok(f.doc.activeElement === f.action);
    assert.equal(f.details.open, true);
    assert.equal(f.review.scrollTop, 37);
    assert.equal(f.credit.hidden, true);
  }
  f.action.click();
  assert.equal(f.activations(), 1);
  view.refresh(false);
  assert.equal(f.doc.getElementById('overflight-flight-details'), null);
  for (const [parent, children] of originals)
    assert.ok(
      children.length === parent.children.length &&
        children.every((node, index) => parent.children[index] === node),
      `Restore ${parent.id}'s exact child order.`,
    );
  assert.ok(f.doc.activeElement === f.action);
  view.refresh(true);
  view.dispose();
  view.refresh(true);
  assert.equal(f.doc.getElementById('overflight-flight-details'), null);
  f.action.click();
  assert.equal(f.activations(), 2, 'Disposal cannot retire the native action handler.');
});

test('actual Riy controls retain their queued-focus owner and accepted core state through reflow and locale refresh', () => {
  const f = fixture(),
    mode = createOverflightRiyMode({ createRun: createOverflightRun, step: stepOverflight }),
    run = mode.createRun(mode.compileProject(mode.createProject()));
  startOverflight(run);
  for (let n = 0; n < 500 && !overflightRiyTarget(run) && run.phase === 'playing'; n++)
    mode.step(run, { x: 0, y: 0, boost: false, focus: false }, 1 / 60);
  assert.ok(overflightRiyTarget(run), 'A legal running core supplies the actual focus target.');
  const dispose = mode.installActions({
    document: f.doc,
    getRun: () => run,
    canAct: () => run.phase === 'playing',
    compactTouchActions: () => f.game.classList.contains('has-touch-controls'),
  });
  const squad = f.game.querySelector('.overflight-riy-controls');
  f.controls.prepend(squad);
  const title = squad.querySelector('strong'),
    roles = squad.querySelector('small'),
    button = squad.querySelector('button');
  f.landscape.matches = true;
  const status = squad.querySelector('span');
  const originalChildren = [...squad.children],
    before = JSON.stringify(run);
  const view = createOverflightTextScalingView({
    document: f.doc,
    readingRoot: f.reading,
    label: () => 'Flight details',
  });
  try {
    mode.refreshOverlay(run, 'en');
    button.focus();
    view.refresh(true);
    mode.refreshOverlay(run, 'uk');
    assert.equal(JSON.stringify(run), before);
    assert.ok(f.doc.activeElement === button);
    assert.ok(button.parentNode === squad);
    assert.ok(status.parentNode === f.doc.getElementById('overflight-field-status'));
    assert.ok(f.boost.parentNode === status.parentNode);
    assert.ok(f.arena.parentNode === f.game);
    f.landscape.matches = false;
    f.landscape.emit('change');
    assert.ok(status.parentNode === squad);
    assert.ok(f.boost.parentNode === f.bottom);
    assert.ok(f.doc.activeElement === button);
    f.landscape.matches = true;
    f.landscape.emit('change');
    assert.ok(status.parentNode === f.doc.getElementById('overflight-field-status'));
    assert.equal(JSON.stringify(run), before);
    assert.ok(title.closest('#overflight-flight-details'));
    assert.ok(roles.closest('#overflight-flight-details'));
    assert.match(button.textContent, /Зосередити/);
    f.level.textContent = 'Level 2';
    f.kills.textContent = 'Cleared 166';
    f.game.classList.add('has-touch-controls', 'has-touch-layout');
    view.refreshCaptionLayout();
    mode.refreshOverlay(run, 'uk');
    assert.ok(squad.parentNode === f.doc.getElementById('overflight-field-status'));
    assert.ok(status.parentNode === squad);
    assert.ok(button.parentNode === squad);
    assert.ok(f.level.closest('#overflight-flight-details'));
    assert.ok(f.kills.closest('#overflight-flight-details'));
    assert.equal(f.level.textContent, 'Level 2');
    assert.equal(f.kills.textContent, 'Cleared 166');
    assert.equal(button.textContent, 'F · Зосередити');
    assert.equal(
      button.getAttribute('aria-label'),
      `F · Зосередити вогонь · ${status.textContent}`,
    );
    assert.ok(f.doc.activeElement === button);
    assert.equal(JSON.stringify(run), before);
    f.game.classList.remove('has-touch-controls', 'has-touch-layout');
    view.refreshCaptionLayout();
    mode.refreshOverlay(run, 'uk');
    assert.ok(squad.parentNode === f.controls);
    assert.ok(status.parentNode === f.doc.getElementById('overflight-field-status'));
    assert.ok(f.level.parentNode === f.tally);
    assert.ok(f.kills.parentNode === f.tally);
    assert.equal(button.getAttribute('aria-label'), null);
    assert.equal(button.textContent, 'F · Зосередити вогонь');
    const commands = run.riy.commands;
    button.click();
    assert.equal(run.riy.commands, commands, 'The real owner queues until the next game step.');
    assert.ok(f.doc.activeElement === f.arena);
    mode.step(run, { x: 0, y: 0, boost: false, focus: false }, 1 / 60);
    assert.equal(run.riy.commands, commands + 1);
    view.refresh(false);
    assert.ok(originalChildren.every((node, index) => squad.children[index] === node));
    assert.ok(f.doc.activeElement === f.arena);
  } finally {
    view.dispose();
    dispose();
  }
});

test('Extra large reveals only the accepted current Home focus, preserving native order and retiring stale frames', () => {
  const f = fixture(),
    win = f.doc.defaultView,
    frames = new Map(),
    scrolled = [];
  let next = 0;
  win.requestAnimationFrame = (callback) => {
    const id = ++next;
    frames.set(id, callback);
    return id;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  const home = f.doc.createElement('dialog'),
    first = f.doc.createElement('button'),
    second = f.doc.createElement('button');
  f.doc.body.append(home);
  home.append(first, second);
  home.open = true;
  for (const button of [first, second])
    button.scrollIntoView = (options) => scrolled.push({ button, options });
  const order = [...home.children];
  const view = createOverflightTextScalingView({
    document: f.doc,
    readingRoot: f.reading,
    home,
    label: () => 'Flight details',
  });
  const flush = () => {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback();
    }
  };
  const pending = () => [...frames.values()][0];
  try {
    first.focus();
    let focusCalls = 0;
    const focus = first.focus.bind(first);
    first.focus = () => {
      focusCalls++;
      focus();
    };
    view.refresh(false);
    win.emit('resize');
    flush();
    assert.equal(scrolled.length, 0, 'Standard/Large do not reveal or reorder Home.');
    view.refresh(true);
    flush();
    assert.equal(scrolled.length, 1);
    assert.ok(scrolled[0].button === first);
    assert.deepEqual(scrolled[0].options, { block: 'nearest', inline: 'nearest' });
    assert.equal(focusCalls, 0, 'The presentation cannot call the accepted target’s focus owner.');
    assert.ok(f.doc.activeElement === first);
    win.emit('resize');
    const stale = pending();
    second.focus();
    stale();
    assert.equal(scrolled.length, 1, 'A cancelled old frame cannot reveal the previous focus.');
    flush();
    assert.equal(scrolled.length, 2);
    assert.ok(scrolled[1].button === second);
    assert.ok(f.doc.activeElement === second);
    win.emit('resize');
    home.open = false;
    flush();
    assert.equal(scrolled.length, 2, 'Hidden Home does not scroll.');
    home.open = true;
    win.emit('resize');
    const beforeDisable = pending();
    view.refresh(false);
    beforeDisable();
    flush();
    assert.equal(scrolled.length, 2, 'A stale Extra large frame cannot scroll Standard/Large.');
    view.refresh(true);
    const beforeDispose = pending();
    view.dispose();
    beforeDispose();
    flush();
    win.emit('resize');
    first.focus();
    flush();
    assert.equal(scrolled.length, 2, 'Retired view has no focus/resize work.');
    assert.ok(
      order.every((node, index) => home.children[index] === node),
      'Native Home DOM/Tab order is unchanged.',
    );
    assert.ok(f.doc.activeElement === first);
  } finally {
    view.dispose();
  }
});

test('Results reveals its existing accepted action without reordering or stealing newer focus', () => {
  const f = fixture(),
    win = f.doc.defaultView,
    frames = new Map();
  let next = 0,
    reveals = 0,
    focuses = 0;
  win.requestAnimationFrame = (callback) => {
    frames.set(++next, callback);
    return next;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  const results = f.doc.createElement('dialog'),
    retry = f.doc.createElement('button'),
    back = f.doc.createElement('button');
  f.doc.body.append(results);
  results.append(retry, back);
  results.open = true;
  const order = [...results.children];
  retry.scrollIntoView = () => reveals++;
  retry.focus();
  const focus = retry.focus.bind(retry);
  retry.focus = () => {
    focuses++;
    focus();
  };
  const view = createOverflightTextScalingView({
    document: f.doc,
    readingRoot: f.reading,
    results,
    label: () => 'Flight details',
  });
  const flush = () => {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback();
    }
  };
  try {
    view.refresh(true);
    flush();
    assert.equal(reveals, 1);
    assert.equal(focuses, 0);
    assert.ok(f.doc.activeElement === retry);
    win.emit('resize');
    const stale = [...frames.values()][0];
    back.focus();
    stale();
    flush();
    assert.equal(reveals, 1);
    assert.ok(f.doc.activeElement === back);
    retry.focus();
    results.open = false;
    flush();
    assert.equal(reveals, 1, 'A closed results dialog cannot scroll.');
    assert.ok(order.every((node, index) => results.children[index] === node));
    view.dispose();
    results.open = true;
    retry.focus();
    flush();
    assert.equal(reveals, 1, 'Disposal retires results listeners/frames.');
  } finally {
    view.dispose();
  }
});

import { updateOverflightHuntHUD } from '../overflight/raid-mode.mjs';
import { overflightHuntText } from '../overflight/raid-copy.mjs';

test('Raid reflow retains live Rush/score owners and exact anchors across scale, layout, locale and disposal', () => {
  const f = fixture(),
    make = (tag, id, parent) => {
      const element = f.doc.createElement(tag);
      element.id = id;
      parent.append(element);
      return element;
    };
  const objective = make('span', 'hud-objective', f.tally),
    chain = make('span', 'hud-chain', f.tally),
    score = make('span', 'hud-score', f.tally),
    boost = f.doc.createElement('div');
  boost.className = 'raid-boost';
  f.bottom.insertBefore(boost, f.boost);
  boost.append(f.boost);
  const rush = make('span', 'hud-rush', boost),
    meter = make('div', 'raid-rush-meter', boost);
  meter.setAttribute('role', 'progressbar');
  make('span', 'raid-rush-fill', meter);
  make('span', 'xp-fill', f.hud);
  make('p', 'raid-event-status', f.game);
  const originals = new Map(
    [f.game, f.hud, f.tally, f.bottom, boost].map((node) => [node, [...node.children]]),
  );
  const run = {
    phase: 'playing',
    hunt: {
      sector: 0,
      chain: 3,
      multiplier: 2,
      chainRemaining: 4.2,
      score: 1234567,
      rushRemaining: 0,
      rushCharge: 20,
      objectivesCompleted: 1,
      objectives: [{}, {}],
    },
  };
  const compiled = { encounters: [{ title: { en: 'Targets', uk: 'Цілі' } }] };
  let locale = 'en';
  const update = () => {
    f.doc.documentElement.lang = locale;
    updateOverflightHuntHUD({
      run,
      compiled,
      document: f.doc,
      text: (key) => overflightHuntText(locale, key),
      local: (value) => value?.[locale] ?? '',
    });
  };
  const view = createOverflightTextScalingView({
    document: f.doc,
    readingRoot: f.reading,
    label: () => 'Details',
  });
  const checkpoint = structuredClone(run);
  try {
    for (const enabled of [false, true])
      for (const landscape of [false, true])
        for (const touch of [false, true]) {
          f.landscape.matches = landscape;
          f.game.classList.toggle('has-touch-controls', touch);
          f.game.classList.toggle('has-touch-layout', touch);
          view.refresh(enabled);
          view.refreshCaptionLayout();
          for (const language of ['en', 'uk']) {
            locale = language;
            update();
            const parent =
              enabled && landscape ? f.doc.getElementById('overflight-field-status') : null;
            for (const node of [boost, chain, score])
              assert.ok(node.parentNode === (parent ?? (node === boost ? f.bottom : f.tally)));
            for (const node of [objective, f.level, f.kills])
              assert.ok(node.parentNode === f.tally);
            assert.ok(f.doc.getElementById('hud-rush') === rush);
            assert.ok(f.doc.getElementById('raid-rush-meter') === meter);
            assert.equal(meter.getAttribute('aria-valuetext'), rush.textContent);
            assert.equal(meter.getAttribute('aria-valuenow'), '20');
            assert.equal(meter.getAttribute('aria-label'), overflightHuntText(locale, 'rush'));
            assert.ok(score.textContent.includes((1234567).toLocaleString(locale)));
            assert.deepEqual(run, checkpoint);
          }
        }
    run.hunt.rushRemaining = 3.25;
    update();
    assert.equal(meter.getAttribute('aria-valuemax'), '5');
    assert.equal(meter.getAttribute('aria-valuenow'), '3.25');
    assert.equal(meter.getAttribute('aria-valuetext'), rush.textContent);
    view.refresh(false);
    for (const [parent, children] of originals) assert.deepEqual([...parent.children], children);
    view.refresh(true);
    view.dispose();
    for (const [parent, children] of originals) assert.deepEqual([...parent.children], children);
    f.landscape.matches = !f.landscape.matches;
    f.landscape.emit('change');
    f.doc.defaultView.emit('resize');
    assert.equal(f.doc.getElementById('overflight-field-status'), null);
  } finally {
    view.dispose();
  }
});
