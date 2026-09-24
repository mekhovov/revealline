// Actual app, game shell, gallery/save handlers and navigation. The DOM's native
// button/summary/Tab/Escape defaults and physical gamepad samples are modeled boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';

function key(page, value) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat: false });
  if (
    !event.defaultPrevented &&
    value === 'Enter' &&
    ['BUTTON', 'SUMMARY'].includes(target.tagName)
  )
    target.click();
  if (!event.defaultPrevented && value === 'Tab') {
    // Native dialogs own Tab. Text inputs retain native arrows, so Tab must
    // leave search without borrowing the controller's direction behavior.
    const dialog = target.closest('dialog[open]');
    if (dialog) {
      const controls = dialog
        .querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')
        .filter((element) => {
          if (element.disabled || element.tabIndex < 0 || !element.getClientRects().length)
            return false;
          if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
          for (
            let parent = element.parentElement;
            parent && parent !== dialog;
            parent = parent.parentElement
          )
            if (
              parent.tagName === 'DETAILS' &&
              !parent.open &&
              parent.querySelector('summary') !== element
            )
              return false;
          return true;
        });
      controls[(controls.indexOf(target) + 1) % controls.length]?.focus();
    }
  }
  if (!event.defaultPrevented && value === 'Escape') {
    const dialog = page.doc.activeElement?.closest('dialog[open]');
    if (dialog && !dialog.emit('cancel').defaultPrevented) dialog.close();
  }
  target.emit('keyup', { key: value, code: value });
}
function controls(page, t, mode) {
  if (mode === 'keyboard')
    return {
      next: () => key(page, 'Tab'),
      confirm: () => key(page, 'Enter'),
      back: () => key(page, 'Escape'),
    };
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const pad = {
    index: 0,
    id: 'Main menu collection controller',
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
  // A neutral sample connects automatically; Confirm is now a real menu action.
  return { next: () => pulse(13), confirm: () => pulse(0), back: () => pulse(1) };
}
function activate(page, input, target, scope) {
  const surfaces = Array.isArray(scope) ? scope : [scope];
  for (let step = 0; step < 80 && page.doc.activeElement !== target; step++) {
    input.next();
    assert.ok(
      surfaces.some((surface) => surface.contains(page.doc.activeElement)),
      'focus stays in the requested visible menu surfaces',
    );
  }
  assert.ok(
    page.doc.activeElement === target,
    `${target.tagName}#${target.id} must be reachable without pointer focus; actual ${page.doc.activeElement?.tagName}#${page.doc.activeElement?.id}`,
  );
  input.confirm();
  page.frame(0);
}
function nonmodalOverlay(page) {
  // Only the four visible header actions join a nonmodal overlay. Dialog
  // callers still supply their single native modal and keep strict containment.
  return ['game-overlay', 'shell-menu', 'shell-packs', 'shell-collection', 'shell-settings'].map(
    (id) => page.$(id),
  );
}

for (const mode of ['keyboard', 'controller']) {
  test(`${mode}: native Main menu reaches Collection and Workshop records without winning or leaving a paused cut`, async (t) => {
    const nativeClick = SoloElement.prototype.click;
    t.mock.method(SoloElement.prototype, 'click', function () {
      nativeClick.call(this);
      if (this.tagName === 'SUMMARY') {
        const details = this.parentElement;
        details.open = !details.open;
        details.emit('toggle');
      }
    });
    const showModal = SoloElement.prototype.showModal,
      close = SoloElement.prototype.close,
      origins = new WeakMap();
    t.mock.method(SoloElement.prototype, 'showModal', function () {
      if (this.open) return;
      origins.set(this, this.ownerDocument.activeElement);
      this.emit('beforetoggle', { oldState: 'closed', newState: 'open' });
      showModal.call(this);
      // Native showModal focuses the first eligible control. Actual app/menu
      // listeners remain responsible for any deliberate replacement focus.
      this.querySelector(
        'button:not(:disabled),select:not(:disabled),input:not(:disabled)',
      )?.focus();
    });
    t.mock.method(SoloElement.prototype, 'close', function () {
      if (!this.open) return;
      close.call(this);
      const origin = origins.get(this),
        dialog = origin?.closest('dialog');
      if (origin?.isConnected && !origin.closest('[hidden]') && (!dialog || dialog.open))
        origin.focus();
      else this.ownerDocument.activeElement = this.ownerDocument.body;
    });
    const page = await soloPage(t, { titleScreen: true }),
      input = controls(page, t, mode),
      home = page.$('shell-home');
    const ready = authoritativeCheckpoint(page.rendered.run),
      initialStorage = [...page.storage.map],
      initialWrites = page.storage.writes.length;
    assert.equal(home.open, true);
    assert.match(
      page.$('shell-library').textContent.trim().replaceAll('&amp;', '&'),
      /^Scores & saves/,
    );
    assert.equal(page.$('shell-gallery').textContent.trim(), 'Collection');
    assert.ok(
      page.$('shell-workshop-dialog').contains(page.$('shell-guide')),
      'Field guide stays available through Workshop',
    );
    activate(page, input, page.$('shell-gallery'), home);
    assert.equal(home.open, true);
    assert.equal(page.$('collection-dialog').open, true);
    const progress = page.$('collection-progress'),
      summary = progress.querySelector('summary');
    assert.equal(progress.open, false);
    assert.equal(page.$('gallery-pages').hidden, true);
    assert.equal(page.$('gallery-pages').children.length, 0);
    for (let step = 0; step < 12; step++) {
      input.next();
      assert.ok(
        !progress.contains(page.doc.activeElement) || page.doc.activeElement === summary,
        'Closed progress controls stay out of keyboard/controller navigation',
      );
    }
    activate(page, input, summary, page.$('collection-dialog'));
    assert.equal(progress.open, true);
    activate(page, input, summary, page.$('collection-dialog'));
    assert.equal(progress.open, false);

    assert.equal(page.$('library-dialog').open, false);
    assert.ok(page.$('collection-dialog').contains(page.doc.activeElement));
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ready);
    assert.deepEqual([...page.storage.map], initialStorage);
    assert.equal(page.storage.writes.length, initialWrites);
    input.back();
    page.frame(0);
    assert.equal(page.$('collection-dialog').open, false);
    assert.equal(page.$('collection-dialog').contains(page.doc.activeElement), false);
    assert.equal(page.rendered.paused, true);
    assert.equal(home.open, true);
    assert.ok(page.doc.activeElement === page.$('shell-gallery'), page.doc.activeElement?.id);
    activate(page, input, page.$('shell-workshop'), home);
    const workshop = page.$('shell-workshop-dialog');
    assert.equal(workshop.open, true);
    activate(page, input, page.$('shell-library'), workshop);
    assert.equal(workshop.open, true);
    assert.equal(home.open, true);
    assert.equal(page.$('library-dialog').open, true);
    assert.equal(page.$('collection-dialog').open, false);
    input.back();
    page.frame(0);
    assert.equal(page.$('library-dialog').open, false);
    assert.equal(page.$('library-dialog').contains(page.doc.activeElement), false);
    assert.equal(workshop.open, true);
    assert.ok(page.doc.activeElement === page.$('shell-library'));
    input.back();
    page.frame(0);
    assert.equal(workshop.open, false);
    assert.equal(home.open, true);
    assert.ok(page.doc.activeElement === page.$('shell-workshop'));
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ready);
    activate(page, input, page.$('shell-featured'), home);
    await settle(() => {
      page.frame(0);
      return !home.open && !page.rendered.paused;
    }, 'The explicit named Title Start must complete before sending flight input.');
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let i = 0; i < 20; i++) page.frame();
    assert.equal(page.rendered.run.player.cutting, true);
    page.key('Escape');
    page.key('Escape', false);
    page.frame(0);
    const paused = authoritativeCheckpoint(page.rendered.run);
    activate(page, input, page.$('overlay-menu'), nonmodalOverlay(page));
    activate(page, input, page.$('shell-gallery'), home);
    assert.equal(page.$('collection-dialog').open, true);
    input.back();
    for (let i = 0; i < 10; i++) page.frame();
    assert.equal(page.$('collection-dialog').open, false);
    assert.equal(home.open, true);
    assert.ok(page.doc.activeElement === page.$('shell-gallery'), page.doc.activeElement?.id);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), paused);
    assert.equal(page.$('collection-dialog').contains(page.doc.activeElement), false);

    activate(page, input, page.$('shell-workshop'), home);
    const exportButton = page.$('export-replay'),
      replayDialog = page.$('replay-dialog'),
      replayStatus = page.$('replay-operation-status'),
      replayRail = page.$('replay-operation-rail');
    assert.ok(replayRail, 'Replay feedback and escape controls share one operation rail');
    assert.ok(replayRail.contains(replayStatus), 'The original presenter target stays in the rail');
    const replayControls = replayRail.querySelector('.dialog-operation-controls'),
      replayClose = replayControls.querySelector('[data-close="replay-dialog"]');
    assert.ok(replayControls.contains(page.$('download-replay')));
    assert.ok(replayClose, 'The operation rail includes its own genuine Close action');
    assert.ok(
      replayDialog.children.indexOf(replayRail) <
        replayDialog.children.indexOf(page.$('replay-json')),
      'Operation feedback and controls precede the long readonly replay payload',
    );
    assert.ok(workshop.contains(exportButton), 'The original replay export belongs to Workshop');
    assert.equal(page.doc.querySelectorAll('#export-replay').length, 1);
    assert.equal(exportButton.closest('.page-footer'), null);
    assert.equal(exportButton.disabled, false);
    const originalExport = exportButton.onclick;
    let exportRequest;
    t.mock.method(exportButton, 'onclick', (...args) => {
      exportRequest = originalExport(...args);
      return exportRequest;
    });
    // Retain the browser's real Blob/request boundary and cleanup duration;
    // only keep its delayed URL release from holding the Node process open.
    const schedule = globalThis.setTimeout;
    t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
      const timer = schedule(callback, delay, ...args);
      if (delay === 60000) timer.unref();
      return timer;
    });
    const layoutFrames = [];
    page.doc.defaultView.requestAnimationFrame = (callback) => {
      layoutFrames.push(callback);
      return layoutFrames.length;
    };
    const workshopTools = workshop.querySelector('.workshop-tools');
    workshopTools.open = true;
    assert.equal(workshopTools.open, true, 'Authoring actions expand only when requested.');
    activate(page, input, exportButton, workshop);
    assert.ok(exportRequest instanceof Promise, 'Normal scoped activation invokes the real export');
    assert.equal(replayDialog.open, true);
    assert.equal(workshop.open, true);
    assert.equal(home.open, true);
    assert.ok(replayDialog.contains(page.doc.activeElement));
    assert.equal(exportButton.disabled, true);
    assert.equal(page.$('download-replay').disabled, true);
    assert.equal(replayStatus.hidden, false);
    assert.match(replayStatus.textContent, /Preparing replay download/);
    const replayText = page.$('replay-json').value,
      replay = JSON.parse(replayText),
      verified = verifyReplay(replay);
    assert.equal(verified.match, true);
    assert.deepEqual(replay.checkpoint, paused);
    assert.deepEqual(verified.actual.checkpoint, paused);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), paused);
    assert.equal(page.rendered.paused, true);
    // Pause/export may persist the existing flight. Completion and modal return
    // must not introduce more writes or alter those exact saved bytes.
    const exportedStorage = [...page.storage.map],
      exportedWrites = page.storage.writes.length;
    await exportRequest;
    assert.equal(exportButton.disabled, false);
    assert.equal(page.$('download-replay').disabled, false);
    assert.match(replayStatus.textContent, /Download requested/);
    assert.equal(page.$('replay-json').value, replayText);
    assert.ok(replayRail.contains(replayStatus), 'Settlement retains the exact presenter target');
    // Native r5: Tab scrolls this 180px textarea to y120.34375, under a rail
    // ending at y134.046875. Model only geometry; the actual app wires clearance.
    const replayJSON = page.$('replay-json');
    replayDialog.scrollTop = 194;
    t.mock.method(replayDialog, 'getBoundingClientRect', () => ({ top: 0, bottom: 390 }));
    t.mock.method(replayRail, 'getBoundingClientRect', () => ({
      top: 33.75,
      bottom: 134.046875,
    }));
    t.mock.method(replayJSON, 'getBoundingClientRect', () => ({
      top: 314.34375 - replayDialog.scrollTop,
      bottom: 494.34375 - replayDialog.scrollTop,
    }));
    replayJSON.focus();
    for (const callback of layoutFrames.splice(0)) callback();
    assert.ok(
      replayJSON.getBoundingClientRect().top >= replayRail.getBoundingClientRect().bottom + 8,
      'Focused replay JSON begins below the actual sticky rail',
    );
    assert.equal(replayDialog.style.scrollPaddingBlockStart, '142.046875px');
    assert.equal(page.doc.activeElement, replayJSON);
    assert.equal(replayJSON.value, replayText);
    const manualScroll = (replayDialog.scrollTop += 40);
    replayDialog.emit('scroll');
    for (const callback of layoutFrames.splice(0)) callback();
    assert.equal(replayDialog.scrollTop, manualScroll, 'Manual reading scroll is not undone');
    activate(page, input, replayClose, replayDialog);
    page.frame(0);
    assert.equal(replayDialog.open, false);
    assert.equal(workshop.open, true);
    assert.equal(home.open, true);
    assert.equal(replayStatus.hidden, true);
    assert.equal(
      page.doc.activeElement,
      exportButton,
      'Settled export returns to its visible opener',
    );
    input.back();
    page.frame(0);
    assert.equal(workshop.open, false);
    assert.equal(home.open, true);
    assert.equal(page.doc.activeElement, page.$('shell-workshop'));
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), paused);
    assert.deepEqual([...page.storage.map], exportedStorage);
    assert.equal(page.storage.writes.length, exportedWrites);
    assert.deepEqual(page.errors, []);
  });
}
