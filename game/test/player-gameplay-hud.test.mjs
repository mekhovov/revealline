import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Solo gameplay HUD names mission time and keeps equipment status outside the board', async () => {
  const [html, css, host] = await Promise.all([
    read('../index.html'),
    read('../style.css'),
    read('../app.mjs'),
  ]);
  assert.match(html, /class="telemetry" role="group" aria-label="Mission status"/);
  assert.match(html, /id="time-label">ELAPSED/);
  assert.match(html, /class="telemetry-stat telemetry-equipment"[\s\S]*id="ability-state"/);
  assert.doesNotMatch(html, /id="ability-state" role="status"/);
  assert.match(
    host,
    /time-label'\)\.textContent = run\.rules\.timeLimitSeconds \? 'TIME LEFT' : 'ELAPSED'/,
  );
  assert.match(
    css,
    /grid-template-columns: minmax\(150px, 1\.75fr\) repeat\(4, minmax\(72px, 1fr\)\)/,
  );
  assert.match(
    css,
    /@media \(min-width: 681px\) and \(max-height: 500px\)[\s\S]*\.arena-panel > \.telemetry/,
  );
});

test('Versus gameplay HUD exposes targets and player-facing states without an irrelevant match score', async () => {
  const [html, css, host] = await Promise.all([
    read('../couch/index.html'),
    read('../couch/couch.css'),
    read('../couch/couch.mjs'),
  ]);
  assert.match(html, /id="race-match-score" class="race-score" aria-label="Match score"/);
  assert.match(html, /id="race-clock-label">TIME LEFT/);
  assert.match(host, /race-match-score'\)\.hidden = roundRecipe\.format !== 'first-to-two'/);
  assert.match(host, /% target · \$\{run\.lives\}/);
  assert.match(host, /'Recovering'[\s\S]*'Line exposed'[\s\S]*'In flight'/);
  assert.doesNotMatch(host, /racer-state-\$\{i\}`\)\.textContent = match\.status/);
  assert.match(css, /\.race-cross \{[\s\S]*repeat\(3, 44px\)/);
});

test('Team gameplay HUD keeps objective and both recovery states explicit at touch sizes', async () => {
  const [html, css, host] = await Promise.all([
    read('../couch/relay-rescue.html'),
    read('../couch/relay-rescue.css'),
    read('../couch/relay-rescue.mjs'),
  ]);
  assert.match(html, /id="coop-identity-0" class="identity sunflower"/);
  assert.match(html, /OBJECTIVE<\/span[\s\S]*id="coop-objective"/);
  assert.match(host, /coop-progress'\)\.setAttribute\([\s\S]*aria-valuetext/);
  assert.match(host, /identity\.setAttribute\([\s\S]*aria-label/);
  assert.match(css, /\.board-footer button \{[\s\S]*min-height: var\(--fk-target-size, 44px\)/);
  assert.match(
    css,
    /orientation: landscape[\s\S]*max-height: 500px[\s\S]*grid-template-columns: 140px minmax\(0, 1fr\) 140px/,
  );
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
