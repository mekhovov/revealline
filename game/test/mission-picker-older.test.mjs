import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, SoloElement } from './helpers/solo-dom.mjs';
import { attachMissionPicker } from '../ui/mission-picker.mjs';
import {
  authoritativeCheckpoint,
  verifyReplay,
  createRecorder,
  recordInput,
  exportReplay,
} from '../replay.mjs';
import { PNGImage as ChapterImage } from './helpers/png-image.mjs';
import { loadLibrary } from '../library.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

const oldIds = ['fpv-arcade-r4', 'fpv-arcade-r3', 'fpv-arcade-r2', 'fpv-arcade'];
const ids = (parent) => [...parent.children].map((node) => node.getAttribute('data-pack'));
const card = (page, id) =>
  [...page.$('mission-picker-older-cards').children].find(
    (node) => node.getAttribute('data-pack') === id,
  );
const ticks = (page, count) => {
  for (let n = 0; n < count; n++) page.frame();
};
const sessionKey = 'revealline.suspended.dev.v1';

// This retained native picker is distinct from the current public Missions
// gallery. Pause through the real host before opening its existing component;
// never create an asynchronous gallery owner behind the disclosure under test.
function openRetainedPicker(page) {
  page.$('shell-menu').click();
  page.$('shell-home').close();
  page.$('shell-missions').showModal();
  attachMissionPicker({ document: page.doc }).focusSelectedChapter();
  assert.equal(page.$('shell-missions').open, true);
  assert.equal(page.$('journey-chooser')?.open ?? false, false);
}

// Actual app, shell and controller handlers execute. Only browser summary,
// keyboard default actions, image decoding and physical pad samples are modeled.
function nativeSummary(page) {
  const summary = page.$('mission-picker-older-summary');
  summary.addEventListener('click', (event) => {
    if (!event.defaultPrevented) {
      summary.parentElement.open = !summary.parentElement.open;
      summary.parentElement.emit('toggle');
    }
  });
  return summary;
}
function visibleControls(root) {
  return [...root.querySelectorAll('button,a[href],select,input,textarea,summary')].filter(
    (element) => {
      if (element.disabled || !element.isConnected) return false;
      for (let parent = element; parent; parent = parent.parentElement) {
        if (parent.hidden || parent.hasAttribute('inert')) return false;
        if (
          parent.tagName === 'DETAILS' &&
          !parent.open &&
          !parent.querySelector('summary')?.contains(element)
        )
          return false;
      }
      return true;
    },
  );
}
function key(page, value, shiftKey = false) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', {
    key: value,
    code: value === ' ' ? 'Space' : value,
    shiftKey,
    repeat: false,
  });
  if (
    !event.defaultPrevented &&
    ['Enter', ' '].includes(value) &&
    ['BUTTON', 'SUMMARY'].includes(target.tagName)
  )
    target.click();
  if (!event.defaultPrevented && value === 'Tab') {
    const controls = visibleControls(page.doc.querySelector('dialog[open]'));
    const next =
      (controls.indexOf(target) + (shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }
  if (!event.defaultPrevented && value === 'Escape') {
    const dialog = page.doc.querySelector('dialog[open]');
    if (dialog && !dialog.emit('cancel').defaultPrevented) dialog.close();
  }
  target.emit('keyup', { key: value, code: value });
}
function padInput(page, t) {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const pad = {
    index: 0,
    id: 'Older chapter menu controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = () => {
    time += 20;
    page.frame(20);
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
  };
  frame();
  pulse(0);
  return { next: () => pulse(13), confirm: () => pulse(0), back: () => pulse(1) };
}
test('actual host keeps nine primary cards and four exact archive cards behind a native closed disclosure', async (t) => {
  const page = await soloPage(t);
  const picker = attachMissionPicker({ document: page.doc });
  assert.equal(page.$('mission-picker-cards').children.length, 9);
  assert.equal(page.$('pack-select').options.length, 13);
  assert.deepEqual(ids(page.$('mission-picker-older-cards')), oldIds);
  const older = page.$('mission-picker-older');
  assert.equal(older.tagName, 'DETAILS');
  assert.equal(older.open, false);
  assert.equal(page.$('mission-picker-older-summary').tagName, 'SUMMARY');
  assert.equal(page.$('mission-picker-older-summary').textContent, 'Older chapters (4)');
  assert.ok(oldIds.every((id) => !ids(page.$('mission-picker-cards')).includes(id)));
  const custom = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  custom.id = 'custom-first-light';
  custom.name = 'Custom First Light';
  page.$('library-button').click();
  page.$('pack-json').value = JSON.stringify(custom);
  page.$('install-pack').click();
  await settle(() => !page.$('install-pack').disabled);
  assert.match(page.$('pack-status').textContent, /Validated and installed/);
  picker.sync();
  assert.ok(ids(page.$('mission-picker-cards')).includes('custom-first-light'));
  assert.match(
    [...page.$('pack-select').options].find((o) => o.value === custom.id).label,
    /installed/,
  );
  assert.equal(page.$('pack-select').options.length, 14);
  assert.deepEqual(ids(page.$('mission-picker-older-cards')), oldIds);
});

test('native keyboard defaults, pointer activation and exact disclosure focus leave selection and storage unchanged', async (t) => {
  const page = await soloPage(t),
    summary = nativeSummary(page),
    older = page.$('mission-picker-older');
  openRetainedPicker(page);
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    stored = new Map(page.storage.map),
    writes = page.storage.writes.length;
  let changes = 0,
    requests = 0;
  const actualFetch = globalThis.fetch;
  globalThis.fetch = (...args) => {
    requests++;
    return actualFetch(...args);
  };
  const installedFetch = globalThis.fetch;
  t.after(() => {
    // The outer page fixture may already have restored browser globals.
    if (globalThis.fetch === installedFetch) globalThis.fetch = actualFetch;
  });
  page.$('pack-select').addEventListener('change', () => changes++);
  // Traverse the actual modal from its host-selected card; native Tab is the
  // modeled browser boundary, while all capturing host handlers remain active.
  const closedSeen = new Set();
  for (let n = 0; n < 45; n++) {
    closedSeen.add(page.doc.activeElement);
    key(page, 'Tab');
  }
  assert.ok(closedSeen.has(summary));
  assert.ok(
    [...page.$('mission-picker-older-cards').children].every((node) => !closedSeen.has(node)),
  );
  summary.focus();
  key(page, 'Enter');
  assert.equal(older.open, true);
  key(page, 'Tab');
  assert.equal(page.doc.activeElement, card(page, oldIds[0]));
  key(page, 'Tab', true);
  assert.equal(page.doc.activeElement, summary);
  key(page, ' ');
  assert.equal(older.open, false);
  // A native touch/pointer click shares this unmodified summary default.
  summary.emit('pointerdown', { pointerType: 'touch' });
  summary.click();
  assert.equal(older.open, true);
  card(page, oldIds[2]).focus();
  older.open = false;
  older.emit('toggle');
  assert.equal(page.doc.activeElement, summary);
  const picker = attachMissionPicker({ document: page.doc });
  const options = [...page.$('pack-select').options],
    oldCard = card(page, oldIds[2]);
  page.$('pack-select').value = oldIds[2]; // Source-control synchronization only, no install.
  picker.focusSelectedChapter();
  assert.equal(older.open, true);
  assert.equal(page.doc.activeElement, oldCard);
  older.emit('toggle', { oldState: 'open', newState: 'closed' });
  assert.equal(
    page.doc.activeElement,
    oldCard,
    'A queued old collapse cannot steal focus after reopen',
  );
  page
    .$('pack-select')
    .replaceChildren(...options.map((o) => new globalThis.Option(o.label, o.value)));
  page.$('pack-select').value = oldIds[2];
  picker.sync();
  assert.equal(card(page, oldIds[2]), oldCard);
  assert.equal(page.doc.activeElement, oldCard);
  assert.equal(older.open, true);
  assert.equal(changes, 0);
  assert.equal(requests, 0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.storage.map, stored);
  assert.equal(page.storage.writes.length, writes);
  picker.destroy();
  page.$('start-button').focus();
  older.emit('toggle');
  assert.equal(page.doc.activeElement, page.$('start-button'));
  assert.equal(page.$('mission-picker-older'), null);
  assert.deepEqual(page.errors, []);
});

test('actual host controller navigation excludes closed cards, reaches all four open cards, and Back keeps flight paused', async (t) => {
  const page = await soloPage(t),
    summary = nativeSummary(page),
    input = padInput(page, t);
  openRetainedPicker(page);
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    stored = new Map(page.storage.map);
  const seen = new Set();
  for (let n = 0; n < 60; n++) {
    seen.add(page.doc.activeElement);
    input.next();
  }
  assert.ok(seen.has(summary));
  assert.ok([...page.$('mission-picker-older-cards').children].every((node) => !seen.has(node)));
  for (let n = 0; n < 60 && page.doc.activeElement !== summary; n++) input.next();
  assert.equal(page.doc.activeElement, summary);
  input.confirm();
  assert.equal(page.$('mission-picker-older').open, true);
  const expanded = new Set();
  for (let n = 0; n < 65; n++) {
    expanded.add(page.doc.activeElement);
    input.next();
    assert.ok(page.$('shell-missions').contains(page.doc.activeElement));
  }
  for (const id of oldIds)
    assert.ok(expanded.has(card(page, id)), `${id} is reachable using the actual pad adapter`);
  input.back();
  page.frame(0);
  assert.equal(page.$('shell-missions').open, false);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.storage.map, stored);
  assert.deepEqual(page.errors, []);
});

test('a failed older-card request preserves a paused cut and its disclosure; a newer action owns any late failure', async (t) => {
  const page = await soloPage(t),
    summary = nativeSummary(page);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 13);
  openRetainedPicker(page);
  page.frame(0);
  summary.click();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    stored = new Map(page.storage.map);
  const actualFetch = globalThis.fetch;
  let rejectRequest,
    requests = 0,
    changes = 0;
  globalThis.fetch = (url, ...args) =>
    url === 'content/packs/fpv-arcade-r4.json'
      ? new Promise((resolve, reject) => {
          requests++;
          rejectRequest = reject;
        })
      : actualFetch(url, ...args);
  const installedFetch = globalThis.fetch;
  t.after(() => {
    // The outer page fixture may already have restored browser globals.
    if (globalThis.fetch === installedFetch) globalThis.fetch = actualFetch;
  });
  page.$('pack-select').addEventListener('change', () => changes++);
  const target = card(page, oldIds[0]);
  target.focus();
  target.click();
  await settle(
    () => page.$('mission-replace-dialog').open && !page.$('mission-replace-confirm').disabled,
  );
  assert.equal(requests, 0, 'A chapter request waits for the explicit replacement decision');
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  // Checked replacement refreshes savedAt before any download. Every other
  // saved-session field and storage entry must remain exactly the same.
  const beforeSave = JSON.parse(stored.get(sessionKey)),
    checkedRaw = page.storage.getItem(sessionKey),
    checkedSave = JSON.parse(checkedRaw);
  assert.equal(typeof checkedSave.savedAt, 'string');
  assert.ok(Date.parse(checkedSave.savedAt) >= Date.parse(beforeSave.savedAt));
  assert.deepEqual({ ...checkedSave, savedAt: beforeSave.savedAt }, beforeSave);
  const requestStored = new Map(stored).set(sessionKey, checkedRaw),
    requestWrites = page.storage.writes.length;
  assert.deepEqual(page.storage.map, requestStored);
  page.$('mission-replace-confirm').click();
  await settle(() => requests === 1);
  assert.equal(page.$('pack-select').disabled, true);
  target.click();
  card(page, oldIds[1]).click();
  assert.equal(changes, 1);
  assert.equal(requests, 1);
  rejectRequest(new TypeError('Failed to fetch'));
  await settle(() => !page.$('mission-replace-dialog').open && !page.$('pack-select').disabled);
  assert.equal(page.doc.activeElement, target, 'Failed replacement returns to its chapter card');
  summary.focus();
  attachMissionPicker({ document: page.doc }).sync();
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.storage.map, requestStored);
  assert.equal(page.storage.writes.length, requestWrites);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('mission-picker-older').open, true);
  assert.equal(page.doc.activeElement, summary);
  assert.match(page.$('content-select-status').textContent, /Connect to the internet/);
  target.focus();
  target.click();
  await settle(
    () => page.$('mission-replace-dialog').open && !page.$('mission-replace-confirm').disabled,
  );
  page.$('mission-replace-confirm').click();
  await settle(() => requests === 2);
  // Stay cancels the pending download before a new, visible Restart decision.
  // Background controls cannot replace a flight behind the active dialog.
  page.$('mission-replace-stay').click();
  assert.equal(page.$('mission-replace-dialog').open, false);
  assert.equal(page.$('pack-select').disabled, false);
  page.$('shell-missions-back').click();
  assert.equal(page.$('shell-missions').open, false);
  page.$('overlay-restart').click();
  assert.equal(page.$('restart-dialog').open, true);
  assert.equal(page.rendered.run, run, 'Opening Restart does not replace the paused flight');
  page.$('restart-confirm').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.$('pause-button').click();
  page.frame(0);
  const newer = page.rendered.run;
  assert.notEqual(newer, run, 'Only the confirmed restart creates the newer attempt');
  openRetainedPicker(page);
  page.frame(0);
  const newerCheckpoint = authoritativeCheckpoint(newer),
    status = page.$('content-select-status').textContent,
    newerStored = new Map(page.storage.map);
  summary.focus();
  rejectRequest(new TypeError('Failed to fetch'));
  await new Promise((resolve) => setImmediate(resolve));
  page.frame(0);
  assert.equal(page.rendered.run, newer);
  assert.deepEqual(authoritativeCheckpoint(newer), newerCheckpoint);
  assert.deepEqual(page.storage.map, newerStored);
  assert.equal(page.$('content-select-status').textContent, status);
  assert.equal(page.doc.activeElement, summary);
  assert.deepEqual(page.errors, []);
});

test('an installed original R4 keeps its saved v4 flight, ordinary win, Collection and replay across the disclosure', async (t) => {
  const pictures = [];
  // Canvas pixels are a modeled boundary; actual gallery resolution, image
  // ownership, readiness and Replay handlers execute unchanged.
  t.mock.method(SoloElement.prototype, 'getContext', () => ({ drawImage() {} }));
  t.mock.method(BoardPainter.prototype, 'drawGallery', (context, args) => {
    pictures.push(args);
  });
  const page = await soloPage(t, { pictures: { Image: ChapterImage } }),
    summary = nativeSummary(page);
  openRetainedPicker(page);
  summary.click();
  const target = card(page, oldIds[0]);
  target.click();
  await settle(() => !page.$('pack-select').disabled);
  page.frame(0);
  assert.equal(page.$('pack-select').value, oldIds[0]);
  const source = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r4.json', import.meta.url)),
  );
  assert.equal(source.campaigns[0].levels[0].revision, '4');
  const reference = createRun(
    applyGameplayTuning(source.campaigns[0].levels[0], resolveGameplayTuning('standard')),
    { seed: 1, classId: 'scout', classRecipes: source.classRecipes, turnPolicy: 'immediate' },
  );
  const recorder = createRecorder(reference.level, {
    seed: 1,
    classId: 'scout',
    classRecipes: source.classRecipes,
    turnPolicy: 'immediate',
  });
  assert.deepEqual(page.rendered.run.level, reference.level);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(reference));
  const advance = (direction, count, fresh = true) => {
    if (fresh && direction) {
      const code = `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`;
      page.key(code);
      page.key(code, false);
    }
    for (let tick = 0; tick < count; tick++) {
      recordInput(recorder, { direction });
      stepRun(reference, { direction }, FIXED_DT);
      page.frame();
    }
    assert.equal(page.rendered.run.lives, 3);
    assert.deepEqual(
      authoritativeCheckpoint(page.rendered.run),
      authoritativeCheckpoint(reference),
    );
  };
  const campaign = page.$('campaign-select').value;
  assert.equal(campaign, 'fpv-first-light-r4/4/0295a1eae3e180ec');
  assert.equal(card(page, oldIds[0]), target);
  page.$('shell-briefing').click();
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  advance(null, 120);
  advance('right', 326);
  advance('down', 13);
  openRetainedPicker(page);
  releaseInputs(reference);
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    oldY = page.rendered.run.player.y,
    savedRaw = page.storage.getItem(sessionKey),
    saved = JSON.parse(savedRaw);
  assert.equal(saved.format, 'xonix-session.v4');
  assert.equal(saved.campaignKey, campaign);
  assert.equal(saved.continuation.direction, 'down');
  assert.equal(verifyReplay(saved.replay).match, true);
  assert.equal(page.$('mission-picker-older').open, true);
  assert.equal(page.doc.activeElement, target);
  summary.focus();
  key(page, 'Enter');
  assert.equal(page.$('mission-picker-older').open, false);
  page.$('shell-briefing').click();
  page.$('continue-saved').click();
  await settle(() => !page.$('continue-saved').disabled);
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.storage.getItem(sessionKey), savedRaw);
  openRetainedPicker(page);
  page.frame(0);
  assert.equal(page.$('mission-picker-older').open, true);
  assert.equal(page.doc.activeElement, target);
  assert.equal(page.$('pack-select').value, oldIds[0]);
  assert.equal(page.$('campaign-select').value, campaign);
  page.$('shell-briefing').click();
  ticks(page, 4);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  advance('down', 8, false);
  assert.equal(page.rendered.run.tick, saved.replay.ticks + 8);
  assert.ok(page.rendered.run.player.y > oldY);
  page.$('pause-button').click();
  releaseInputs(reference);
  const resumed = JSON.parse(page.storage.getItem(sessionKey));
  assert.equal(resumed.campaignKey, campaign);
  assert.deepEqual(resumed.presentationPins, saved.presentationPins);
  assert.equal(verifyReplay(resumed.replay).match, true);
  // The authored R4 original is retained; fresh attempts use the approved
  // pressure.v4/immediate recipe. Complete a legal lossless route from the
  // exact saved cut, with an independently stepped reference throughout.
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  advance('down', 448, false);
  advance(null, 240);
  advance('down', 7);
  advance('left', 299);
  advance('up', 537);
  advance('down', 7);
  advance('up', 14);
  advance('left', 271);
  advance('down', 395);
  assert.equal(page.rendered.run.status, 'won');
  assert.equal(page.rendered.run.tick, 2685);
  assert.equal(page.rendered.run.score, 18020);
  assert.equal(verifyReplay(exportReplay(recorder, reference)).match, true);
  const library = () => loadLibrary(page.storage, 'revealline.library.dev.v1').library;
  await settle(() => library().gallery.length === 1);
  const earned = structuredClone(library().gallery[0]);
  assert.equal(earned.campaignKey, campaign);
  assert.equal(earned.levelId, 'orchard-window');
  assert.equal(earned.levelRevision, '4');
  assert.equal(earned.score, 18020);
  page.$('shell-collection').click();
  await settle(
    () =>
      page.$('gallery-grid').children.length === 1 && !page.$('gallery-grid').children[0].disabled,
  );
  page.$('gallery-grid').children[0].click();
  await settle(() => !page.$('gallery-replay').disabled);
  assert.ok(
    pictures.some(
      ({ level, theme, image }) =>
        level.id === earned.levelId &&
        level.revision === '4' &&
        theme.id === 'fpv' &&
        image instanceof ChapterImage,
    ),
  );
  page.$('gallery-replay').click();
  page.frame(0);
  assert.equal(page.$('pack-select').value, oldIds[0]);
  assert.equal(page.$('campaign-select').value, campaign);
  assert.deepEqual(page.rendered.run.level, reference.level);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(library().gallery[0], earned);
  openRetainedPicker(page);
  page.frame(0);
  assert.equal(page.$('mission-picker-older').open, true);
  assert.equal(page.doc.activeElement, target);
  assert.deepEqual(page.errors, []);
});

test('focused mission brief and embedded course retain their existing hidden chapter surfaces', async (t) => {
  await t.test('focused brief', async (sub) => {
    const page = await soloPage(sub);
    page.$('overlay-brief').click();
    assert.equal(page.$('shell-missions').open, true);
    assert.ok(page.$('mission-picker-older').closest('[hidden]'));
    assert.ok(
      !visibleControls(page.$('shell-missions')).includes(page.$('mission-picker-older-summary')),
    );
    assert.equal(page.rendered.run.tick, 0);
  });
  await t.test('embedded course', async (sub) => {
    const page = await soloPage(sub, { search: '?course=first-flight&lesson=close-line' });
    assert.ok(page.doc.body.classList.contains('first-flight-session'));
    assert.ok(page.$('mission-picker-stage').hasAttribute('data-course-hide'));
    page.$('start-button').focus();
    for (let n = 0; n < 25; n++) {
      key(page, 'ArrowDown');
      assert.ok(
        !page.$('mission-picker-stage').contains(page.doc.activeElement),
        'The actual course navigation root excludes chapter controls',
      );
    }
    assert.equal(page.$('overlay-brief').hidden, true);
    assert.equal(page.rendered.run.tick, 0);
  });
});
