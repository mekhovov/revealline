import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMenuAppearance } from '../ui/menu-appearance.mjs';
import {
  UKRAINIAN_MENU_STYLE,
  menuStyleVariables,
  resolveMenuStyle,
} from '../presentation/menu-styles.mjs';
import { TOKEN_DEFAULTS } from '../presentation/model.mjs';
import { canvasPresentation } from '../presentation/runtime.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture() {
  const document = new Document();
  for (const [id, tag] of [
    ['shell-home', 'dialog'],
    ['race-main', 'section'],
    ['coop-menu', 'section'],
    ['game-canvas', 'canvas'],
    ['coop-canvas', 'canvas'],
    ['game-hud', 'div'],
  ]) {
    const node = document.createElement(tag);
    node.id = id;
    document.body.append(node);
  }
  const home = document.getElementById('shell-home');
  for (const id of ['shell-start', 'shell-options']) {
    const button = document.createElement('button');
    button.id = id;
    home.append(button);
  }
  return document;
}
function snapshot(id) {
  return Object.freeze({
    resolved: Object.freeze({
      theme: Object.freeze({ id, revision: 19 }),
      tokens: Object.freeze({ ...TOKEN_DEFAULTS }),
      assets: Object.freeze({}),
    }),
  });
}
function contrast(a, b) {
  const luminance = (hex) => {
    const channels = hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('automatic menu choice preserves another authored theme and explicit Ukrainian never alters its canvas inputs', () => {
  const doc = fixture(),
    appearance = createMenuAppearance({ document: doc }),
    authored = snapshot('night-shift');
  const original = JSON.stringify(authored),
    canvas = canvasPresentation(authored.resolved);
  doc.documentElement.style.setProperty('--fk-cyan', '#123456');
  doc.documentElement.style.setProperty('--fk-font-ui', 'Owned UI');
  appearance.setPresentation(authored);
  assert.equal(doc.body.dataset.menuPalette, 'authored');
  appearance.set({ palette: 'ukrainian', ornaments: 'rich' });
  assert.equal(doc.body.dataset.menuPalette, 'ukrainian');
  assert.equal(JSON.stringify(authored), original);
  assert.deepEqual(canvasPresentation(authored.resolved), canvas);
  assert.equal(doc.documentElement.style['--fk-cyan'], '#123456');
  assert.equal(doc.documentElement.style['--fk-font-ui'], 'Owned UI');
  assert.equal(doc.body.style['--fk-cyan'], undefined);
  assert.equal(
    Object.keys(menuStyleVariables()).some((name) => /font|size|motion|asset|image/.test(name)),
    false,
  );
  appearance.dispose();
});

test('automatic FPV and declared unavailable-snapshot fallback select the approved menu palette only', () => {
  const doc = fixture(),
    appearance = createMenuAppearance({ document: doc });
  appearance.setPresentation(snapshot('fpv'));
  assert.equal(doc.body.dataset.menuPalette, 'ukrainian');
  appearance.setPresentation(snapshot('copper'));
  assert.equal(doc.body.dataset.menuPalette, 'authored');
  appearance.setPresentation(null);
  assert.equal(doc.body.dataset.menuPalette, 'ukrainian');
  appearance.dispose();
});

test('invalid menu choices and unaccepted theme identifiers leave the current appearance intact', () => {
  const doc = fixture(),
    appearance = createMenuAppearance({ document: doc });
  appearance.set({ palette: 'auto', ornaments: 'off' });
  const before = { ...doc.body.dataset };
  for (const choice of [
    { palette: 'red-black', ornaments: 'rich' },
    { palette: 'ukrainian', ornaments: 'moving' },
  ])
    assert.throws(() => appearance.set(choice), TypeError);
  for (const invalid of [
    undefined,
    {},
    { resolved: { theme: { id: 'https://example.test/theme' } } },
  ])
    assert.throws(() => appearance.setPresentation(invalid), TypeError);
  assert.deepEqual(doc.body.dataset, before);
  appearance.dispose();
});

test('ornaments add no focus stops, leave existing anchor order intact and never enter arena or HUD', () => {
  const doc = fixture(),
    home = doc.getElementById('shell-home');
  const before = home.querySelectorAll('button').map((node) => node.id);
  const appearance = createMenuAppearance({ document: doc });
  const decorations = doc.querySelectorAll('.menu-ornament');
  assert.equal(decorations.length, 3);
  for (const decoration of decorations) {
    assert.equal(decoration.getAttribute('aria-hidden'), 'true');
    assert.equal(decoration.tabIndex, -1);
    assert.equal(decoration.querySelectorAll('button,a,input,select').length, 0);
  }
  assert.deepEqual(
    home.querySelectorAll('button').map((node) => node.id),
    before,
  );
  for (const id of ['game-canvas', 'coop-canvas', 'game-hud'])
    assert.equal(doc.getElementById(id).children.length, 0);
  appearance.dispose();
  assert.equal(doc.querySelectorAll('.menu-ornament').length, 0);
});

test('replacement ownership removes old decorations and a stale completion cannot overwrite the new choice', () => {
  const doc = fixture(),
    old = createMenuAppearance({ document: doc });
  old.set({ palette: 'auto', ornaments: 'rich' });
  const next = createMenuAppearance({ document: doc });
  next.setPresentation(snapshot('night-shift'));
  next.set({ palette: 'auto', ornaments: 'off' });
  old.setPresentation(snapshot('fpv'));
  old.dispose();
  assert.equal(doc.querySelectorAll('.menu-ornament').length, 3);
  assert.equal(doc.body.dataset.menuPalette, 'authored');
  assert.equal(doc.body.dataset.menuOrnaments, 'off');
  next.dispose();
  assert.equal(doc.querySelectorAll('.menu-ornament').length, 0);
  assert.equal(doc.body.dataset.menuPalette, undefined);
});

test('cleanup restores previous values but preserves a later external writer', () => {
  const doc = fixture();
  doc.body.style.setProperty('--rl-menu-bg', '#030405');
  doc.body.dataset.menuOrnaments = 'off';
  const appearance = createMenuAppearance({ document: doc });
  doc.body.style.setProperty('--rl-menu-cyan', '#334455');
  doc.body.dataset.menuPalette = 'external';
  appearance.dispose();
  appearance.dispose();
  assert.equal(doc.body.style['--rl-menu-bg'], '#030405');
  assert.equal(doc.body.style['--rl-menu-cyan'], '#334455');
  assert.equal(doc.body.dataset.menuOrnaments, 'off');
  assert.equal(doc.body.dataset.menuPalette, 'external');
});

test('approved token pairs preserve functional text and cue contrast on the menu panels', () => {
  const { tokens } = UKRAINIAN_MENU_STYLE;
  for (const background of [tokens.ink, tokens.panel, tokens.panelRaised]) {
    for (const name of ['text', 'muted'])
      assert.ok(contrast(tokens[name], background) >= 4.5, `${name} text on ${background}`);
    for (const name of ['cyan', 'amber', 'hazard', 'controlLine'])
      assert.ok(contrast(tokens[name], background) >= 3, `${name} cue on ${background}`);
  }
  assert.ok(
    contrast(tokens.ink, tokens.amber) >= 4.5,
    'Dark text remains readable on the primary action.',
  );
  for (const name of ['cyan', 'hazard'])
    assert.ok(contrast(tokens.ink, tokens[name]) >= 4.5, `Dark action text on ${name}`);
  assert.equal(Object.isFrozen(UKRAINIAN_MENU_STYLE.tokens), true);
});

test('the static menu stylesheet does not animate decorations or style canvas, HUD, fonts or theme image variables', async () => {
  const css = await readFile(new URL('../ui/menu-appearance.css', import.meta.url), 'utf8');
  assert.doesNotMatch(
    css,
    /@keyframes|url\(|font-family|--fk-font|--fk-.*image|\bcanvas\s*[{,]|#game-hud/,
  );
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /animation:\s*none !important/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.deepEqual(resolveMenuStyle({ palette: 'auto', ornaments: 'off' }, 'fpv'), {
    palette: 'ukrainian',
    ornaments: 'off',
  });
});

function observeDialogs(doc) {
  const instances = [];
  doc.defaultView.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      instances.push(this);
    }
    observe(root, options) {
      assert.equal(root === doc.body, true);
      assert.deepEqual(options, { childList: true, subtree: true });
    }
    disconnect() {
      this.closed = true;
    }
    deliver(records) {
      this.callback(records);
    }
  };
  return instances;
}

test('a late player dialog and a rerendered dialog gain one decoration without adding input stops', () => {
  const doc = fixture(),
    observers = observeDialogs(doc),
    appearance = createMenuAppearance({ document: doc });
  const wrapper = doc.createElement('section'),
    dialog = doc.createElement('dialog'),
    play = doc.createElement('button');
  dialog.id = 'soundtrack-library';
  play.id = 'audition-play';
  dialog.append(play);
  wrapper.append(dialog);
  doc.body.append(wrapper);
  play.focus();
  observers[0].deliver([{ target: doc.body, addedNodes: [wrapper] }]);
  assert.equal(dialog.querySelectorAll('.menu-ornament').length, 1);
  assert.equal(doc.activeElement === play, true);
  const next = doc.createElement('button');
  next.id = 'close-studio';
  dialog.replaceChildren(next);
  observers[0].deliver([{ target: dialog, addedNodes: [next] }]);
  assert.equal(dialog.querySelectorAll('.menu-ornament').length, 1);
  assert.deepEqual(
    dialog.querySelectorAll('button').map((node) => node.id),
    ['close-studio'],
  );
  observers[0].deliver([{ target: dialog, addedNodes: [dialog.querySelector('.menu-ornament')] }]);
  assert.equal(dialog.querySelectorAll('.menu-ornament').length, 1);
  appearance.dispose();
  assert.equal(observers[0].closed, true);
});

test('detached player dialogs release their decoration and reattachment remains owned; generic HUD additions are ignored', () => {
  const doc = fixture(),
    observers = observeDialogs(doc),
    appearance = createMenuAppearance({ document: doc });
  const dialog = doc.createElement('dialog');
  doc.body.append(dialog);
  observers[0].deliver([{ target: doc.body, addedNodes: [dialog] }]);
  const decoration = dialog.querySelector('.menu-ornament');
  dialog.remove();
  observers[0].deliver([{ target: doc.body, addedNodes: [] }]);
  assert.equal(decoration.parentNode, null);
  doc.body.append(dialog);
  observers[0].deliver([{ target: doc.body, addedNodes: [dialog] }]);
  assert.equal(dialog.querySelectorAll('.menu-ornament').length, 1);
  const hud = doc.getElementById('game-hud'),
    score = doc.createElement('strong');
  hud.append(score);
  observers[0].deliver([{ target: hud, addedNodes: [score] }]);
  assert.equal(hud.querySelectorAll('.menu-ornament').length, 0);
  appearance.dispose();
});

test('queued mutation callbacks after disposal or ownership replacement cannot redecorate the page', () => {
  const doc = fixture(),
    observers = observeDialogs(doc),
    old = createMenuAppearance({ document: doc });
  const next = createMenuAppearance({ document: doc }),
    dialog = doc.createElement('dialog');
  doc.body.append(dialog);
  observers[0].deliver([{ target: doc.body, addedNodes: [dialog] }]);
  assert.equal(dialog.children.length, 0);
  observers[1].deliver([{ target: doc.body, addedNodes: [dialog] }]);
  assert.equal(dialog.querySelectorAll('.menu-ornament').length, 1);
  old.dispose();
  next.dispose();
  observers[1].deliver([{ target: doc.body, addedNodes: [dialog] }]);
  assert.equal(dialog.children.length, 0);
});

test('Couch ornament source rules reserve content and focus space without clipping', async () => {
  const css = await readFile(new URL('../ui/menu-appearance.css', import.meta.url), 'utf8');
  const components = await readFile(
    new URL('../ui/field-kit-components.css', import.meta.url),
    'utf8',
  );
  const gutter = Number(css.match(/--menu-ornament-gutter:\s*(\d+)px/)?.[1] ?? 0);
  const inset = Number(css.match(/\binset:\s*(\d+)px/)?.[1]);
  const stripes = [...css.matchAll(/--menu-stripe:\s*(\d+)px/g)].map((m) => Number(m[1]));
  const stripe = Math.max(...stripes);
  const focusRule = components.match(
    /outline:\s*(\d+)px[^;]+!important;\s*outline-offset:\s*(\d+)px/,
  );
  assert.ok(focusRule, 'Use the actual existing focus outline and offset.');
  const focus = Number(focusRule[1]) + Number(focusRule[2]);
  assert.ok(
    gutter >= inset + stripe + focus + 4,
    'Both content and its focus ring must clear the widest band by at least4px.',
  );
  const compact = css.replace(/\s+/g, ' ');
  const rule = compact.match(
    /body:is\(\[data-menu-ornaments='subtle'\], \[data-menu-ornaments='rich'\]\) :is\(\.race-screen, #coop-menu, #coop-overlay\) \{([^}]+)\}/,
  )?.[1];
  assert.ok(
    rule,
    'Actual Versus, Team lobby and Team pause owners need the same enabled-ornament gutter.',
  );
  assert.match(rule, /box-sizing: border-box/);
  assert.match(rule, /padding-inline: var\(--menu-ornament-gutter\)/);
  assert.match(rule, /min-inline-size: 0/);
  assert.doesNotMatch(rule, /overflow:\s*(hidden|clip)/);
  assert.match(
    compact,
    /:is\(\.race-screen, #coop-menu, #coop-overlay\) > \* \{[^}]*min-inline-size: 0;[^}]*max-inline-size: 100%/,
  );
  assert.match(
    compact,
    /:is\(label, select, input, textarea\) \{[^}]*min-inline-size: 0;[^}]*max-inline-size: 100%/,
  );
  // A conservative 44px outer safe gutter budgets the source rule, not browser
  // text layout. Border-box must keep inner padding within each bounded shell.
  for (const viewport of [280, 320, 390, 480, 1309]) {
    const borderBox = Math.min(900, viewport - 44),
      content = borderBox - 2 * gutter;
    assert.ok(content > 0);
    assert.ok(gutter - focus > inset + stripe);
    assert.ok(gutter + content + focus < borderBox - inset - stripe);
  }
});
