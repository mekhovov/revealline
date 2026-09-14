import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authoritativeCheckpoint } from '../replay.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';

const scenario = JSON.parse(
  await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url), 'utf8'),
);
function arrow(page, key) {
  const element = page.doc.activeElement;
  element.emit('keydown', { key, code: key });
  element.emit('keyup', { key, code: key });
}
for (const mode of ['ordinary', 'practice', 'course']) {
  test(`${mode}: Settings exposes only usable Creator links and keyboard focus respects the session scope`, async (t) => {
    const isolated = mode !== 'ordinary';
    const page = await soloPage(t, {
      search:
        mode === 'practice'
          ? '?practice=1'
          : mode === 'course'
            ? '?course=first-flight&lesson=close-line'
            : '',
      previewStorage: memoryStorage({ 'revealline.playground.current': JSON.stringify(scenario) }),
    });
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    page.$('settings-button').click();
    assert.equal(page.$('settings-dialog').open, true);
    const creator = page.doc.querySelector('.creator-tools'),
      links = creator.querySelectorAll('a[href]');
    assert.equal(creator.hidden, isolated);
    assert.deepEqual(
      links.map((link) => link.getAttribute('href')),
      ['../authoring/still-media/', '../authoring/video-poster/'],
    );
    // Model the native details-open state; hidden sessions must still exclude
    // its summary and links even if an earlier control state left it expanded.
    creator.open = true;
    assert.equal(page.$('settings-panel-data').hidden, true);
    for (const link of links) assert.equal(link.getClientRects().length, 0);
    page.$('settings-tab-audio').focus();
    arrow(page, 'End');
    assert.equal(page.doc.activeElement, page.$('settings-tab-data'));
    assert.equal(page.$('settings-tab-data').getAttribute('aria-selected'), 'true');
    assert.equal(page.$('settings-panel-data').hidden, false);
    for (const link of links) assert.equal(link.getClientRects().length > 0, !isolated);
    if (isolated) {
      page.$('offline-details').parentElement.querySelector('summary').focus();
      arrow(page, 'ArrowDown');
      assert.equal(creator.contains(page.doc.activeElement), false);
      assert.equal(page.doc.activeElement.closest('[hidden]'), null);
      assert.ok(page.$('settings-dialog').contains(page.doc.activeElement));
      // A forced synthetic activation is still blocked by the unchanged
      // navigation guard. Hiding these links does not grant an escape route.
      assert.equal(links[0].emit('click').defaultPrevented, true);
    } else {
      creator.querySelector('summary').focus();
      arrow(page, 'ArrowDown');
      assert.equal(page.doc.activeElement, links[0]);
      arrow(page, 'ArrowDown');
      assert.equal(page.doc.activeElement, links[1]);
      arrow(page, 'ArrowUp');
      assert.equal(page.doc.activeElement, links[0]);
      assert.equal(links[0].emit('click').defaultPrevented, false);
      // Native navigation itself belongs to the actual browser, not this DOM.
    }
    // Leaving Game data removes even an expanded Creator section from the
    // keyboard scope; navigation must not cross into a hidden category.
    page.$('settings-tab-data').focus();
    arrow(page, 'Home');
    assert.equal(page.$('settings-panel-controls').hidden, false);
    assert.equal(page.$('settings-panel-data').hidden, true);
    for (const link of links) assert.equal(link.getClientRects().length, 0);
    page.$('keyboard-settings').querySelector('summary').focus();
    arrow(page, 'ArrowUp');
    assert.equal(creator.contains(page.doc.activeElement), false);
    assert.equal(page.doc.activeElement.closest('[hidden]'), null);
    page.$('settings-dialog').close();
    page.frame(0);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(page.errors, []);
  });
}
