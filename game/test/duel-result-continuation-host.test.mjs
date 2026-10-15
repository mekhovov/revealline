import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { expectedRouteEvidence } from './helpers/route-evidence.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const css = await readFile(new URL('../couch/couch.css', import.meta.url), 'utf8');
const boardOnlyNav = css.match(
  /\n\s*(body:not\(\.race-focus\) #race-journey-controls)\s*\{\s*display:\s*none !important;/,
)?.[1];
assert.ok(boardOnlyNav, 'The live-board nav remains intentionally hidden on menu surfaces.');
const route = JSON.parse(
  await readFile(new URL('./fixtures/candidate-solo-tuned-host-routes.json', import.meta.url)),
);

test('earned Duel results expose keyboard Next in their owned action stack while other screens keep it hidden', async (t) => {
  const databases = new Map();
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=opening',
    initialLevel: null,
    nativeKeyboard: true,
    storage: memoryStorage(),
    assetDatabase: {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    },
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) return new Response(await readFile(url));
    },
    beforeImport({ document }) {
      // This finite DOM has no CSS engine. Apply the shipped nav-hiding rule at
      // the computed-style boundary used by real controller/keyboard navigation.
      // Browser geometry and AX output remain a separate native check.
      const computed = document.defaultView.getComputedStyle;
      document.defaultView.getComputedStyle = (element) => ({
        ...computed(element),
        ...(element.matches(boardOnlyNav) ? { display: 'none' } : {}),
      });
    },
  });
  const next = p.$('race-journey-next');
  const visible = (element) => {
    if (element.closest('[hidden],[inert]') || !element.getClientRects().length) return false;
    for (let parent = element; parent; parent = parent.parentElement)
      if (p.doc.defaultView.getComputedStyle(parent).display === 'none') return false;
    return true;
  };
  assert.equal(visible(next), false, 'Ready does not advertise an unearned continuation.');
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(visible(next), false, 'Play keeps continuation out of the live arena.');
  p.$('race-pause').click();
  p.frame(0);
  assert.equal(p.state(), 'paused');
  assert.equal(visible(next), false, 'Pause cannot expose result-only Next.');
  p.$('race-start').click();
  p.frame(0);

  const [mission, , , , segments] = route.rows[0];
  playKeyboardRoute(
    p,
    () => p.renders,
    [
      { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
      { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    ],
    {
      seed: 1,
      turnPolicy: 'immediate',
      evidence: expectedRouteEvidence(route.evidence, mission),
      segments: segments.map(([direction, ticks]) => ({ direction, ticks })),
    },
  );
  assert.equal(p.state(), 'finished');
  assert.equal(p.renders[0].status, 'won');
  assert.equal(p.renders[1].status, 'won');
  assert.match(p.$('race-message').textContent, /First clear/);
  assert.equal(p.doc.body.classList.contains('race-focus'), false);
  assert.equal(visible(next), true, 'The earned result must expose Next through all ancestors.');
  assert.match(next.textContent, /Next: Choose your share/);
  const result = p.checkpoint();
  p.$('race-options').click();
  assert.equal(p.$('race-options-panel').hidden, false);
  assert.equal(visible(next), false, 'Settings owns its screen without a stray continuation.');
  p.$('race-options-back').click();
  assert.equal(visible(next), true);
  assert.deepEqual(p.checkpoint(), result, 'Visiting Settings retains the earned result.');

  p.$('race-start').focus();
  p.doc.activeElement.emit('keydown', { key: 'ArrowRight', code: 'ArrowRight', repeat: false });
  p.doc.activeElement.emit('keyup', { key: 'ArrowRight', code: 'ArrowRight', repeat: false });
  assert.equal(p.doc.activeElement, next, 'The real Rematch→Next keyboard link reaches Next.');
  p.key('Enter', true, next);
  p.key('Enter', false, next);
  await waitFor(() => {
    p.frame(0);
    return p.state() === 'running' && p.renders[0].levelId === route.rows[1][0];
  });
  assert.equal(p.renders[1].levelId, route.rows[1][0]);
  assert.equal(visible(next), false);
  t.diagnostic(
    'Real host/core keyboard clear and continuation; finite DOM, image and CSS boundaries.',
  );
});
