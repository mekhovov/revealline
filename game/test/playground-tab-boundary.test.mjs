import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { playgroundTabBoundary } from '../ui/playground-tab-boundary.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { entryScenario } from '../playground/model.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function fixture() {
  const parent = {
    location: { href: 'https://example.test/releases/v1/site/game/playground/?journey=opening' },
  };
  const doc = { defaultView: parent, hidden: false, hasFocus: () => true };
  const child = {
    name: 'revealline-playground-preview',
    parent,
    location: { origin: 'https://example.test' },
    document: { hidden: false, hasFocus: () => true },
  };
  const frame = {
    id: 'preview-frame',
    name: child.name,
    contentWindow: child,
    ownerDocument: doc,
    isConnected: true,
    closest: () => null,
    getClientRects: () => [{}],
  };
  child.frameElement = frame;
  doc.activeElement = frame;
  return { parent, doc, child, frame };
}

test('only the current named same-origin Playground frame may use native sequential exit', () => {
  const f = fixture();
  let suspensions = 0;
  assert.equal(playgroundTabBoundary({ window: f.child, suspend: () => suspensions++ }), 'native');
  assert.equal(suspensions, 1);
  for (const change of [
    (f) => {
      f.child.parent = f.child;
    },
    (f) => {
      f.child.name = 'revealline-controller-practice';
    },
    (f) => {
      f.parent.location.href = 'https://other.test/game/playground/';
    },
    (f) => {
      f.parent.location.href = 'https://example.test/game/controller-lab/';
    },
    (f) => {
      f.frame.id = 'game-frame';
    },
    (f) => {
      f.frame.name = 'other';
    },
    (f) => {
      f.frame.contentWindow = {};
    },
    (f) => {
      f.doc.activeElement = {};
    },
    (f) => {
      f.frame.isConnected = false;
    },
    (f) => {
      f.doc.hidden = true;
    },
    (f) => {
      f.doc.hasFocus = () => false;
    },
    (f) => {
      f.child.document.hidden = true;
    },
    (f) => {
      f.child.document.hasFocus = () => false;
    },
    (f) => {
      f.frame.closest = () => ({});
    },
    (f) => {
      f.frame.getClientRects = () => [];
    },
    (f) => {
      Object.defineProperty(f.child, 'frameElement', {
        get() {
          throw Error('opaque');
        },
      });
    },
  ]) {
    const fresh = fixture();
    change(fresh);
    assert.equal(
      playgroundTabBoundary({ window: fresh.child, suspend: () => suspensions++ }),
      false,
    );
  }
  assert.equal(suspensions, 1);
});

test('retired or failed suspension consumes the key without traversing a replacement owner', () => {
  for (const suspend of [
    (f) => {
      f.frame.isConnected = false;
    },
    (f) => {
      f.doc.activeElement = {};
    },
    (f) => {
      f.child.document.activeElement = {};
    },
    () => {
      throw Error('retired');
    },
  ]) {
    const f = fixture();
    assert.equal(playgroundTabBoundary({ window: f.child, suspend: () => suspend(f) }), true);
  }
});

for (const [tool, frameId, frameName] of [
  ['playground', 'preview-frame', 'revealline-playground-preview'],
  ['studio', 'preview', 'revealline-content-studio-preview'],
])
  test(`actual ${tool} child exit keeps the paused run unchanged across re-entry`, async (t) => {
    const parentDoc = new Document(),
      parent = new Events();
    parent.location = {
      origin: 'http://localhost',
      href: `http://localhost/game/${tool}/?journey=opening`,
    };
    parentDoc.defaultView = parent;
    const campaign = JSON.parse(
        await readFile(new URL('../content/campaign.json', import.meta.url)),
      ),
      { themes } = JSON.parse(await readFile(new URL('../content/themes.json', import.meta.url))),
      scenario = entryScenario({ campaign, themes, visualOverrides: {} });
    const page = await soloPage(t, {
      search: '?practice=1&revision=1',
      parentWindow: parent,
      previewStorage: memoryStorage({ 'revealline.playground.current': JSON.stringify(scenario) }),
    });
    const frame = parentDoc.createElement('iframe');
    frame.id = frameId;
    frame.name = frameName;
    parentDoc.body.append(frame);
    frame.contentWindow = page.win;
    parentDoc.activeElement = frame;
    Object.assign(page.win, { document: page.doc, frameElement: frame, name: frame.name });
    page.$('start-button').click();
    page.frame(16);
    page.key('ArrowDown');
    for (let n = 0; n < 8; n++) page.frame(16);
    assert.equal(page.rendered.run.player.cutting, true);
    page.win.emit('blur', { bubbles: false });
    const run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      saved = [...page.storage.map];
    page.doc.focused = true;
    page.$('shell-menu').focus();
    const exit = page.$('shell-menu').emit('keydown', { key: 'Tab', code: 'Tab', shiftKey: true });
    assert.equal(exit.defaultPrevented, false, 'Browser owns the native frame boundary.');
    assert.equal(page.doc.activeElement.id, 'shell-menu', 'The child must not wrap focus.');
    page.doc.focused = false;
    parentDoc.activeElement = parentDoc.body;
    page.win.emit('blur', { bubbles: false });
    for (let n = 0; n < 8; n++) page.frame(16);
    page.doc.focused = true;
    parentDoc.activeElement = frame;
    page.win.emit('focus', { bubbles: false });
    page.$('shell-menu').focus();
    for (let n = 0; n < 8; n++) page.frame(16);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual([...page.storage.map], saved);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  });

test('Studio is a separate exact owner, not permission for arbitrary embedded frames', () => {
  const studio = () => {
    const f = fixture();
    f.parent.location.href =
      'https://example.test/releases/v1/site/game/studio/index.html?journey=opening';
    f.child.name = f.frame.name = 'revealline-content-studio-preview';
    f.frame.id = 'preview';
    return f;
  };
  let suspensions = 0;
  assert.equal(
    playgroundTabBoundary({ window: studio().child, suspend: () => suspensions++ }),
    'native',
  );
  for (const change of [
    (f) => {
      f.parent.location.href = 'https://example.test/game/playground/';
    },
    (f) => {
      f.parent.location.href = 'https://example.test/game/studio-other/';
    },
    (f) => {
      f.parent.location.href = 'https://other.test/game/studio/';
    },
    (f) => {
      f.frame.id = 'preview-frame';
    },
    (f) => {
      f.frame.name = 'other';
    },
    (f) => {
      f.frame.contentWindow = {};
    },
    (f) => {
      f.doc.activeElement = {};
    },
    (f) => {
      f.doc.hidden = true;
    },
    (f) => {
      f.child.document.hasFocus = () => false;
    },
    (f) => {
      f.frame.isConnected = false;
    },
    (f) => {
      f.frame.getClientRects = () => [];
    },
  ]) {
    const f = studio();
    change(f);
    assert.equal(playgroundTabBoundary({ window: f.child, suspend: () => suspensions++ }), false);
  }
  assert.equal(suspensions, 1);
  const retired = studio();
  assert.equal(
    playgroundTabBoundary({
      window: retired.child,
      suspend: () => {
        retired.frame.isConnected = false;
      },
    }),
    true,
  );
});
