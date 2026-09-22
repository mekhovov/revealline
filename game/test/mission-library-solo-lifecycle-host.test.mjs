import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';

for (const transition of ['newer focus', 'newer key', 'newer pointer'])
  test(`incoming exact Solo handoff retires after ${transition} during held index loading`, async (t) => {
    const indexBytes = await readFile(
      new URL('../content/mission-library-index.json', import.meta.url),
    );
    const library = createMissionLibrary(
      classicLibrarySources(JSON.parse(indexBytes), {
        availability: () => ({ state: 'ready' }),
        launch: () => true,
      }),
    );
    const exact = library.missions[11];
    let release,
      requested = false;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const p = await soloPage(t, {
      titleScreen: true,
      search: `?journey=legacy&library-mission=${encodeURIComponent(exact.id)}`,
      fetchResponse: async (path) => {
        if (path !== 'content/mission-library-index.json') return;
        requested = true;
        await gate;
        return new Response(indexBytes);
      },
    });
    await settle(() => requested);
    const run = p.rendered.run;
    if (transition === 'newer focus') p.$('shell-featured').focus();
    else
      p.$('shell-play').emit(
        transition === 'newer key' ? 'keydown' : 'pointerdown',
        transition === 'newer key' ? { key: 'Tab' } : {},
      );
    const focused = p.doc.activeElement;
    release();
    await settle(() => p.$('journey-collection'));
    await new Promise((resolve) => setImmediate(resolve));
    p.frame(0);
    assert.equal(p.rendered.run, run);
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.activeElement, focused);
    assert.notEqual(p.doc.body.dataset.flightState, 'running');
    assert.deepEqual(p.errors, []);
  });

for (const transition of [
  'blur',
  'persisted pagehide',
  'newer focus',
  'newer key',
  'newer pointer',
])
  test(`a held mission-index request cannot reopen or focus the library after ${transition}; a fresh request works`, async (t) => {
    let release,
      requested = false;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const p = await soloPage(t, {
      titleScreen: true,
      fetchResponse: async (path) => {
        if (path !== 'content/mission-library-index.json') return;
        requested = true;
        await gate;
        return new Response(
          await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
        );
      },
    });
    const run = p.rendered.run,
      checkpoint = authoritativeCheckpoint(run);
    p.$('shell-play').focus();
    p.$('shell-play').click();
    await settle(() => requested);
    assert.equal(p.$('mission-library-opening-status').textContent, 'Preparing missions…');
    if (transition === 'blur') {
      p.doc.focused = false;
      p.win.emit('blur');
      p.doc.focused = true;
      p.win.emit('focus');
    } else if (transition === 'persisted pagehide') {
      p.doc.hidden = true;
      p.win.emit('pagehide', { persisted: true });
      p.doc.hidden = false;
      p.win.emit('pageshow', { persisted: true });
    } else if (transition === 'newer focus') {
      p.$('shell-featured').focus();
      p.$('shell-play').focus(); // Returning focus does not revive the old intent.
    } else {
      p.$('shell-play').emit(
        transition === 'newer key' ? 'keydown' : 'pointerdown',
        transition === 'newer key' ? { key: 'Tab' } : {},
      );
    }
    const focused = p.doc.activeElement;
    assert.equal(
      p.$('mission-library-opening-status'),
      null,
      'Newer intent dismisses preparation feedback.',
    );
    release();
    // Lazy metadata may finish constructing the surface; only a new explicit
    // foreground request may display it or restore its keyboard focus.
    await settle(() => p.$('journey-collection'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.activeElement, focused, 'Late settlement cannot reclaim focus.');
    assert.equal(p.$('shell-home').open, true);
    p.frame(0);
    assert.equal(p.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.notEqual(p.doc.body.dataset.flightState, 'running');

    p.$('shell-play').click();
    await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
    assert.equal(p.$('journey-cards').children.length, 201);
    assert.equal(p.doc.activeElement, p.$('journey-search'));
    p.$('journey-back').click();
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.activeElement, p.$('shell-play'));
    assert.deepEqual(p.errors, []);
  });
