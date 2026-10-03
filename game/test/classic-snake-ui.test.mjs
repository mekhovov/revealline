import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { parse as parseModule } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import * as core from '../snake/classic-core.mjs';
import {
  CLASSIC_SNAKE_CHAPTERS,
  CLASSIC_SNAKE_LEVELS,
  CLASSIC_SNAKE_CAMPAIGNS,
  CLASSIC_SNAKE_FEATURED,
} from '../snake/classic-catalogue.mjs';
import * as matches from '../snake/classic-match.mjs';
import { prepareClassicSnakeLevel, CLASSIC_PACES } from '../snake/classic-setup.mjs';
import { CLASSIC_COPY } from '../snake/classic-copy.mjs';

const appURL = new URL('../snake/classic-app.mjs', import.meta.url);
const source = await readFile(appURL, 'utf8');
const html = await readFile(new URL('./play.html', appURL), 'utf8');
const imports = parseModule(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.filter(
  (node) => node.type === 'ImportDeclaration',
);
const hostSource = imports.reduceRight(
  (text, node) => text.slice(0, node.start) + text.slice(node.end),
  source,
);
const flush = () => new Promise((resolve) => setImmediate(resolve));

// Execute actual host handlers, setup preparation and match/session admission.
// Canvas, persistent records and preferences are boundaries; no layout claim.
function harness({ entry = CLASSIC_SNAKE_LEVELS[0], mode = 'solo' } = {}) {
  const document = new Document();
  document.createElement = (tag) => {
    const node = new Element(document, tag);
    if (tag === 'canvas') node.getContext = () => ({ clearRect() {} });
    return node;
  };
  const mount = (node, parent) => {
    if (!node.tagName || ['html', 'body', 'head'].includes(node.tagName)) {
      for (const child of node.childNodes ?? []) mount(child, parent);
      return;
    }
    const element = document.createElement(node.tagName);
    for (const { name, value } of node.attrs) {
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'open'].includes(name)) element[name] = true;
    }
    parent.append(element);
    for (const child of node.childNodes ?? []) mount(child, element);
  };
  mount(parseHTML(html), document.body);
  const window = new Events();
  const storage = new Map();
  const created = [],
    scheduledFrames = [];
  const location = {
    href: `https://example.test/game/snake/play.html?mode=${mode}&level=${entry.id}`,
  };
  const preferences = (snapshot) => ({
    snapshot: () => snapshot,
    subscribe(listener) {
      listener(snapshot);
      return () => {};
    },
    set() {},
  });
  const context = createContext({
    document,
    URL,
    Blob,
    structuredClone,
    location,
    history: {
      replaceState(_state, _unused, url) {
        location.href = String(url);
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    matchMedia: () => Object.assign(new Events(), { matches: false }),
    addEventListener: window.addEventListener.bind(window),
    requestAnimationFrame(callback) {
      scheduledFrames.push(callback);
    },
    screen: { orientation: new Events() },
    navigator: { getGamepads: () => [] },
    setTimeout,
    getLocale: () => 'en',
    setLocale() {},
    onLocaleChange() {},
    createDestructionPreferences: () => preferences({ brutal: false, blood: true }),
    createEncounterDisplayPreferences: () => preferences({ showRemains: true }),
    createDisplayPreferences: () =>
      preferences({ reducedEffects: false, effectiveReducedEffects: false }),
    createTouchPreferences: () => preferences({ size: 'normal', opacity: 1, side: 'right' }),
    createClassicPresentation: () => ({ snapshot: () => null }),
    createBoardFootprints: () => ({ refresh() {}, dispose() {} }),
    createAudioMaster: () => preferences({ muted: false, volume: 1 }),
    createAudioPreferences: () => ({ setMuted() {}, setVolume() {} }),
    Soundscape: class {
      settings = { sfx: 0.7 };
      feedbackDirector = { play() {} };
      configure(value) {
        Object.assign(this.settings, value);
      }
      async enable() {}
    },
    createClassicSnakeRecords: () => ({
      async read() {},
      async visit() {},
      async remember() {},
      chapter: () => 0,
      cleared: () => false,
      get: () => null,
      recent: () => null,
    }),
    createHuntDestruction: () => ({ reset() {}, advance() {}, draw() {} }),
    classicCatchMarks: () => [],
    drawClassicBoard() {},
    drawClassicTarget() {},
    boundedJSON,
    exactKeys,
    required,
    CLASSIC_PACES,
    prepareClassicSnakeLevel,
    CLASSIC_SNAKE_CAMPAIGNS,
    CLASSIC_SNAKE_FEATURED,
    CLASSIC_SNAKE_CHAPTERS,
    CLASSIC_SNAKE_LEVELS,
    CLASSIC_COPY,
    ...core,
    ...matches,
    createClassicSnakeMatch(...args) {
      // The VM models a browser realm; normalize only this harness crossing so
      // strict plain-data admission sees the same realm it would in production.
      const match = matches.createClassicSnakeMatch(
        ...args.map((argument) => structuredClone(argument)),
      );
      created.push(...match.runs);
      return match;
    },
  });
  new Script(hostSource, { filename: appURL.pathname }).runInContext(context);
  return {
    document,
    created,
    window,
    storage,
    location,
    frame(now) {
      scheduledFrames.shift()(now);
    },
    $: (id) => document.getElementById(id),
  };
}

test('Classic Snake accepts the physical WASD key with a Ukrainian keyboard layout', () => {
  const { document, created } = harness();
  const event = document.emit('keydown', {
    target: document.querySelector('canvas'),
    key: 'ц',
    code: 'KeyW',
    repeat: false,
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(created[0].history.length, 1);
  assert.equal(created[0].history[0].direction, 'up');
});

test('Escape pauses Classic Snake even when a settings checkbox has focus', () => {
  const { document, $ } = harness();
  $('toggle').emit('click');
  assert.equal($('toggle').textContent, CLASSIC_COPY.en.pause);
  const event = document.emit('keydown', {
    target: $('brutal'),
    key: 'Escape',
    code: 'Escape',
    repeat: false,
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal($('toggle').textContent, CLASSIC_COPY.en.resume);
  assert.equal(document.body.dataset.playing, 'false');
});

test('a delayed Classic Snake import cannot replace a subsequently selected Team round', async () => {
  const { document, created, $ } = harness();
  const saved = JSON.stringify({
    format: 'revealline-classic-snake-session.v1',
    levelId: CLASSIC_SNAKE_LEVELS[0].id,
    mode: 'solo',
    pace: 'normal',
    elapsedMs: 0,
    replays: [core.exportClassicSnakeReplay(created[0])],
  });
  let finishRead;
  const read = new Promise((resolve) => {
    finishRead = resolve;
  });
  $('import').files = [{ size: saved.length, text: () => read }];
  $('import').emit('change');
  document.querySelector('[data-mode="team"]').emit('click');
  finishRead(saved);
  await flush();
  assert.equal(document.body.dataset.mode, 'team');
  assert.equal($('toggle').textContent, CLASSIC_COPY.en.start);
  assert.notEqual($('save-status').textContent, CLASSIC_COPY.en.loaded);
});

const savedSession = (run, elapsedMs = run.elapsedMs) => ({
  format: 'revealline-classic-snake-session.v1',
  levelId: CLASSIC_SNAKE_LEVELS[0].id,
  mode: 'solo',
  pace: 'normal',
  elapsedMs,
  replays: [core.exportClassicSnakeReplay(run)],
});
async function importSession($, value) {
  const raw = JSON.stringify(value);
  $('import').files = [{ size: Buffer.byteLength(raw), text: async () => raw }];
  $('import').emit('change');
  await flush();
}

test('legacy Continue and Retry preserve the verified replay seed', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 71 });
  const state = harness();
  await importSession(state.$, savedSession(run));
  assert.equal(new URL(state.location.href).searchParams.get('seed'), '71');
  state.$('restart').emit('click');
  assert.equal(state.created.at(-1).seed, 71);
});

test('a scheduled terminal result cannot be restored with a later host clock', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 17 });
  while (run.status === 'running') core.stepClassicSnake(run);
  const { $ } = harness();
  await importSession($, savedSession(run, run.elapsedMs + 0.5));
  assert.equal($('save-status').textContent, CLASSIC_COPY.en.invalid);
  assert.equal($('toggle').textContent, CLASSIC_COPY.en.start);
});

test('an input-limit result may restore between its final two scheduled grid times', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 17 });
  const head = run.snakes[0].body[0];
  // The empty opening board admits a four-cell loop that never catches its
  // stationary target. Every turn and move still goes through production APIs.
  const below = [
    { x: head.x, y: head.y + 1 },
    { x: head.x - 1, y: head.y + 1 },
  ];
  const directions = below.some((cell) => cell.x === run.target.x && cell.y === run.target.y)
    ? ['up', 'left', 'down', 'right']
    : ['down', 'left', 'up', 'right'];
  for (let index = 0; index < core.CLASSIC_SNAKE_MAX_TURNS; index++) {
    assert.equal(core.queueClassicSnakeTurn(run, 0, directions[index % 4]), true);
    if (run.status === 'running') core.stepClassicSnake(run);
  }
  assert.equal(run.failure.cause, 'input-limit');
  const { $ } = harness();
  await importSession($, savedSession(run, run.elapsedMs + 0.5));
  assert.equal($('save-status').textContent, CLASSIC_COPY.en.loadedComplete);
  assert.equal($('toggle').hidden, true);
  assert.equal($('announcement').textContent, CLASSIC_COPY.en.limit);
});

test('a V2 round saves its accepted timeline and continues paused without advancing it', async () => {
  const entry = CLASSIC_SNAKE_LEVELS.find(
    (item) => item.level.version === 'classic-snake-level.v2',
  );
  const state = harness({ entry });
  state.document.emit('keydown', {
    target: state.document.querySelector('canvas'),
    key: 'w',
    code: 'KeyW',
    repeat: false,
  });
  state.frame(0);
  state.frame(core.classicSnakeSummary(state.created[0]).stepMs);
  state.window.emit('blur');
  const saved = JSON.parse(state.storage.get('revealline.classic-snake.round.v2'));
  assert.equal(saved.format, 'revealline-classic-snake-session.v2');
  assert.equal(saved.match.turns.length, 1);
  assert.equal(saved.match.replays[0].steps, 1);
  assert.equal(saved.match.turns[0].direction, 'up');
  const accepted = matches.restoreClassicSnakeMatch(saved.match, {
    level: prepareClassicSnakeLevel(entry),
  });
  assert.deepEqual(matches.exportClassicSnakeMatch(accepted), saved.match);
  const resumed = harness({ entry });
  await importSession(resumed.$, saved);
  assert.equal(resumed.$('save-status').textContent, CLASSIC_COPY.en.loaded);
  assert.equal(resumed.$('toggle').textContent, CLASSIC_COPY.en.resume);
  assert.equal(resumed.document.body.dataset.playing, 'false');
  assert.equal(new URL(resumed.location.href).searchParams.get('level'), entry.id);
  resumed.frame(0);
  resumed.frame(500);
  assert.equal(resumed.document.body.dataset.playing, 'false');
});

test('a valid match cannot be imported under a different host seat arrangement', async () => {
  const entry = CLASSIC_SNAKE_LEVELS.find(
    (item) => item.level.version === 'classic-snake-level.v2',
  );
  const state = harness({ entry });
  state.$('toggle').emit('click');
  state.window.emit('blur');
  const saved = JSON.parse(state.storage.get('revealline.classic-snake.round.v2'));
  saved.mode = 'team';
  const imported = harness({ entry });
  await importSession(imported.$, saved);
  assert.equal(imported.$('save-status').textContent, CLASSIC_COPY.en.invalid);
  assert.equal(imported.document.body.dataset.mode, 'solo');
  assert.equal(imported.$('toggle').textContent, CLASSIC_COPY.en.start);
});
