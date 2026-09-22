import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

for (const transition of ['blur', 'persisted pagehide'])
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
    if (transition === 'blur') {
      p.doc.focused = false;
      p.win.emit('blur');
      p.doc.focused = true;
      p.win.emit('focus');
    } else {
      p.doc.hidden = true;
      p.win.emit('pagehide', { persisted: true });
      p.doc.hidden = false;
      p.win.emit('pageshow', { persisted: true });
    }
    const focused = p.doc.activeElement;
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
