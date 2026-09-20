import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../ui/pixel-theme.css', import.meta.url), 'utf8');
const declarations = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing pause-specific rule: ${selector}`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
};

// Structural regression protection, not a layout engine. Native viewport/focus
// measurements are recorded separately in the P03 verification ledger.
test('pause commands own their intrinsic height instead of inheriting the short-screen reader height', () => {
  const card = declarations(".game-shell .game-overlay[data-kind='pause'] .overlay-card");
  assert.match(card, /\bheight:\s*auto\s*;/);
  assert.match(card, /\bmax-height:\s*none\s*;/);
  assert.match(card, /\bflex-shrink:\s*0\s*;/);
  const buttons = declarations(
    ".game-shell .game-overlay[data-kind='pause'] .overlay-actions .button",
  );
  assert.match(buttons, /\bmin-height:\s*50px\s*;/);
  assert.match(css, /\[data-text-size='large'\][\s\S]*font-size:\s*22px\s*;/);
});

test('oversized pause commands have a top-reachable scrollport and focus clearance', () => {
  const overlay = declarations(".game-shell .game-overlay[data-kind='pause']");
  assert.match(overlay, /\balign-items:\s*safe center\s*;/);
  assert.match(overlay, /\boverflow-y:\s*auto\s*;/);
  assert.match(overlay, /\bscroll-padding-block:\s*12px\s*;/);
});
