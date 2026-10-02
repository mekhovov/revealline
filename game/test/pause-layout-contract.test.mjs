import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../ui/pixel-theme.css', import.meta.url), 'utf8');
const headerCss = [
  '../ui/device-controls.css',
  '../ui/field-kit-compiled.css',
  '../ui/handheld-play.css',
]
  .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n');
const surfaceCss = readFileSync(new URL('../ui/field-kit-surfaces.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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
  assert.match(card, /\bmax-height:\s*100%\s*;/);
  assert.match(card, /\bflex-shrink:\s*0\s*;/);
  const buttons = declarations(
    ".game-shell .game-overlay[data-kind='pause'] .overlay-actions :is(.button, summary)",
  );
  assert.match(buttons, /\bmin-height:\s*44px\s*;/);
  assert.match(css, /\[data-text-size='large'\][\s\S]*font-size:\s*22px\s*;/);
});

test('pause action groups become compact horizontal rows with narrow and large-text fallbacks', () => {
  const grid = declarations(".game-shell .game-overlay[data-kind='pause'] .pause-action-grid");
  assert.match(grid, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*;/);
  assert.match(
    headerCss,
    /min-width:\s*520px[\s\S]*pause-missions-section[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    headerCss,
    /pause-secondary-groups[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    headerCss,
    /max-width:\s*280px[\s\S]*pause-action-grid[\s\S]*grid-template-columns:\s*1fr/,
  );
  assert.match(css, /\[data-text-size='large'\][\s\S]*grid-template-columns:\s*1fr\s*;/);
});

test('short landscape keeps every command in one compact viewport row set', () => {
  assert.match(
    headerCss,
    /orientation:\s*landscape[\s\S]*max-height:\s*540px[\s\S]*pause-label[\s\S]*display:\s*none/,
  );
  assert.match(
    headerCss,
    /orientation:\s*landscape[\s\S]*max-height:\s*540px[\s\S]*min-height:\s*44px/,
  );
});

test('oversized pause commands have a top-reachable scrollport and focus clearance', () => {
  const overlay = declarations(".game-shell .game-overlay[data-kind='pause']");
  assert.match(overlay, /\balign-items:\s*safe center\s*;/);
  assert.match(overlay, /\boverflow-y:\s*auto\s*;/);
  assert.match(overlay, /\bscroll-padding-block:\s*12px\s*;/);
});

test('gameplay header CSS no longer reserves or hides space for fullscreen', () => {
  assert.doesNotMatch(headerCss, /shell-fullscreen/);
});

test('ready actions use a bounded grid instead of shrinking translated labels into columns', () => {
  assert.match(
    surfaceCss,
    /data-kind='ready'[^}]*\.overlay-card\s*\{[\s\S]*?overflow-y:\s*auto[\s\S]*?scroll-padding-block:\s*12px/,
  );
  assert.match(
    surfaceCss,
    /data-kind='ready'[^}]*\.overlay-actions\s*\{[\s\S]*?display:\s*grid[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    surfaceCss,
    /data-kind='ready'[^}]*\.overlay-actions\s*>\s*\*\s*\{[\s\S]*?min-width:\s*0/,
  );
  assert.match(
    surfaceCss,
    /data-kind='ready'[\s\S]*?>\s*:is\([\s\S]*?#continue-saved[\s\S]*?#start-button[\s\S]*?#overlay-menu[\s\S]*?\)\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/,
  );
  assert.doesNotMatch(
    surfaceCss,
    /data-kind='ready'[^}]*\.overlay-actions\s*>\s*\.pause-missions-section\s*\{[^}]*grid-column/,
  );
  assert.match(
    surfaceCss,
    /data-kind='ready'[\s\S]*?\.overlay-actions \.button\s*\{[\s\S]*?width:\s*100%[\s\S]*?flex:\s*none[\s\S]*?word-break:\s*normal[\s\S]*?overflow-wrap:\s*break-word/,
  );
  assert.match(
    headerCss,
    /not\(\[data-kind='pause'\]\) \.pause-secondary-groups[\s\S]*?display:\s*none/,
  );
  assert.match(
    surfaceCss,
    /data-kind='ready'[\s\S]*?pause-mission-info[\s\S]*?>\s*div\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
});

test('ready primary focus is revealed inside a shallow scrollport', () => {
  assert.match(
    appSource,
    /const target = campaignOverview \? \$\('next-button'\) : \$\('start-button'\);[\s\S]*?target\.focus\(\{ preventScroll: true \}\);[\s\S]*?target\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest', behavior: 'auto' \}\);/,
  );
});

test('pause hierarchy uses compact side labels and a quiet full-width exit', () => {
  assert.match(
    surfaceCss,
    /data-kind='pause'[^}]*\.pause-menu-section\s*\{[\s\S]*?grid-template-columns:\s*72px\s+minmax\(0,\s*1fr\)/,
  );
  assert.match(surfaceCss, /data-kind='pause'[^}]*\.pause-label\s*\{[\s\S]*?font-size:\s*13px/);
  assert.match(
    surfaceCss,
    /data-kind='pause'[^}]*#overlay-menu\s*\{[\s\S]*?background:\s*transparent/,
  );
});

test('pause exposes Random level beside mission continuation and routes through the shared chooser', () => {
  assert.match(
    markup,
    /id="journey-skip"[\s\S]*?id="overlay-random-level"[\s\S]*?id="overlay-missions"/,
  );
  assert.match(
    appSource,
    /\$\('overlay-random-level'\)\.onclick[\s\S]*?openUnifiedMissions\(\$\('overlay-random-level'\), \{ random: true \}\)/,
  );
  assert.match(
    appSource,
    /unifiedChooser\.open\(opener, options\);[\s\S]*?options\?\.random[\s\S]*?playRandom\(\{ resetFilters: true \}\)/,
  );
});

test('briefing and pause share one command-deck surface', () => {
  assert.match(
    surfaceCss,
    /game-overlay:is\(\[data-kind='ready'\], \[data-kind='pause'\]\)[\s\S]*?\.overlay-card\s*\{[\s\S]*?width:\s*min\(680px,\s*100%\)[\s\S]*?background:\s*#050a14fa[\s\S]*?border-color:\s*#30496d/,
  );
  assert.match(
    surfaceCss,
    /data-kind='ready'[^}]*#start-button\s*\{[\s\S]*?min-height:\s*48px[\s\S]*?font-size:\s*17px/,
  );
});

test('mission preparation uses a fixed progress rail and no visible cancel action', () => {
  assert.match(surfaceCss, /\.preparation-cancel-hook\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.match(
    surfaceCss,
    /\.menu-progress-status:not\(\[hidden\]\)\s*\{[\s\S]*?position:\s*fixed[\s\S]*?pointer-events:\s*none/,
  );
  assert.match(
    markup,
    /id="flight-preparation-cancel"[\s\S]*?preparation-cancel-hook[\s\S]*?tabindex="-1"[\s\S]*?aria-hidden="true"/,
  );
  assert.match(
    markup,
    /id="shell-flight-cancel"[\s\S]*?preparation-cancel-hook[\s\S]*?tabindex="-1"[\s\S]*?aria-hidden="true"/,
  );
  assert.match(appSource, /function preparationButtonBusy\([\s\S]*?aria-disabled[\s\S]*?aria-busy/);
});
