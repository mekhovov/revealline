import test from 'node:test';
import assert from 'node:assert/strict';
import {
  teamPreviewBinding,
  validateTeamPreviewIdentity,
  createStudioVersusMatch,
  crossModeContextPreview,
  playerTreatmentNote,
  stageBoardPreviewEffect,
} from '../../authoring/asset-studio/cross-mode-preview.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { stepDuel } from '../multiplayer.mjs';
import { FIXED_DT } from '../coop/core.mjs';
import { teamRescueProgress } from '../couch/coop-rescue-presentation.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const ids = [
  'player.scout.compact',
  'player.scout.detailed',
  'enemy.bouncer',
  'enemy.border-patrol',
  'enemy.relay-sentinel',
  'terrain.wall',
  ...COOP_PICTURE_BINDINGS.map((row) => row.picture.slot),
];
const resolved = () => ({
  theme: { id: 'fpv', revision: 32 },
  assets: Object.fromEntries(
    ids.map((id) => {
      const picture = COOP_PICTURE_BINDINGS.some((row) => row.picture.slot === id);
      const width = picture ? 1152 : 32,
        height = picture ? 576 : 32;
      return [
        id,
        {
          id: `${id}.test`,
          kind: 'image',
          revision: 2,
          file: { width, height, sha256: id },
          geometry: { frame: { x: 0, y: 0, width, height } },
        },
      ];
    }),
  ),
});
test('Team compatibility requires real bound roles and complete arena artwork', () => {
  const view = resolved();
  assert.equal(
    teamPreviewBinding('player.scout.compact', view, 'first-connection').roles.length,
    4,
  );
  assert.equal(teamPreviewBinding('terrain.wall', view, 'relay-yard').roles.length, 6);
  assert.throws(() => teamPreviewBinding('terrain.wall', view, 'first-connection'), /not bound/);
  assert.throws(
    () => teamPreviewBinding('team.emitter.spark', view, 'first-connection'),
    (error) => /Native size/.test(error.message) && !/Solo\/Versus/.test(error.message),
  );
  assert.throws(() => teamPreviewBinding('pickup.life', view, 'relay-yard'), /not bound/);
  assert.throws(
    () => teamPreviewBinding('trail.active', view, 'relay-yard'),
    /not bound.*Native size/,
  );
  assert.throws(() => teamPreviewBinding('player.scout.compact', view, 'invented'), /registered/);
  view.theme.id = 'retro';
  assert.throws(
    () => teamPreviewBinding('player.scout.compact', view, 'relay-yard'),
    /no reviewed/,
  );
  view.theme.id = 'fpv';
  view.assets['enemy.bouncer'].kind = 'recipe';
  assert.throws(
    () => teamPreviewBinding('player.scout.compact', view, 'relay-yard'),
    /image revision/,
  );
});
test('Team never stretches or crops a draft scene into a valid arena binding', () => {
  const view = resolved(),
    id = COOP_PICTURE_BINDINGS[0].picture.slot;
  view.assets[id].geometry.frame.width = 768;
  assert.throws(() => teamPreviewBinding(id, view, 'first-connection'), /complete 1152/);
  view.assets[id].geometry.frame.width = 1152;
  view.assets[id].geometry.frame.x = 1;
  assert.throws(() => teamPreviewBinding(id, view, 'first-connection'), /complete 1152/);
});
test('Team preview verifies authored identity, revision and canonical content before artwork', async () => {
  for (const binding of COOP_PICTURE_BINDINGS) {
    const { level } = createStudioTeamFixture({ arena: binding.levelId });
    await validateTeamPreviewIdentity(binding, level);
    await assert.rejects(
      validateTeamPreviewIdentity(binding, { ...level, id: 'unrelated-arena' }),
      /identity or revision/,
    );
    await assert.rejects(
      validateTeamPreviewIdentity(binding, { ...level, revision: level.revision + 1 }),
      /identity or revision/,
    );
    await assert.rejects(
      validateTeamPreviewIdentity(binding, { ...level, name: 'Different authored content' }),
      /content does not match/,
    );
  }
});
test('Versus preview owns two real independent deterministic runs', () => {
  const level = CURRENT_ART_SOURCES.find((row) => row.owner.themeId === 'fpv' && row.level)?.level;
  assert.ok(level);
  const before = structuredClone(level),
    match = createStudioVersusMatch(level);
  assert.notEqual(match.runs[0], match.runs[1]);
  assert.notEqual(match.runs[0].cells, match.runs[1].cells);
  assert.deepEqual(match, createStudioVersusMatch(level));
  const right = structuredClone(match.runs[1]);
  stepDuel(match, [{ direction: 'down' }, { direction: null }]);
  assert.equal(match.tick, 13);
  assert.notEqual(match.runs[0].player, match.runs[1].player);
  assert.deepEqual(level, before);
  assert.equal(match.runs[1].player.x, right.player.x);
});
test('responsive player comparisons explicitly identify an inactive selected treatment', () => {
  assert.match(
    playerTreatmentNote('player.scout.detailed', 390),
    /Selected detailed artwork is inactive/,
  );
  assert.match(playerTreatmentNote('player.scout.detailed', 600), /Showing the selected detailed/);
  assert.match(playerTreatmentNote('player.scout.compact', 390), /Showing the selected compact/);
  assert.match(
    playerTreatmentNote('player.scout.compact', 600),
    /Selected compact artwork is inactive/,
  );
  assert.equal(playerTreatmentNote('enemy.bouncer', 390), '');
});
test('cross-mode preview notes switch between English and Ukrainian immediately', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  assert.equal(
    playerTreatmentNote('player.scout.compact', 390),
    'Showing the selected compact body at this width.',
  );
  setLocale('uk', { persist: false });
  assert.equal(
    playerTreatmentNote('player.scout.compact', 390),
    'Показано вибраний корпус компактного оформлення для цієї ширини.',
  );
});
test('each Versus painter receives its selected capture and failure effect', () => {
  const level = CURRENT_ART_SOURCES.find((row) => row.owner.themeId === 'fpv' && row.level).level;
  const match = createStudioVersusMatch(level);
  for (const run of match.runs) {
    const painter = new BoardPainter({});
    stageBoardPreviewEffect(painter, { id: 'effect.capture', group: 'effects' }, run);
    assert.equal(painter.effects.length, 1);
    stageBoardPreviewEffect(painter, { id: 'effect.failure', group: 'effects' }, run);
    assert.equal(painter.effects.length, 2);
    assert.notEqual(painter.effects[0].type, painter.effects[1].type);
    painter.enemyBodies.clear();
  }
});

function fakeDocument() {
  const draws = [],
    texts = [],
    nodes = [];
  class Node {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.clientWidth = 600;
      this.attributes = {};
      nodes.push(this);
    }
    append(...items) {
      this.children.push(...items);
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    getContext() {
      if (this.context) return this.context;
      this.context = new Proxy(
        { canvas: this, globalAlpha: 1 },
        {
          get: (target, name) => {
            if (name in target) return target[name];
            if (name === 'drawImage') return (image) => draws.push({ canvas: this, image });
            if (name === 'fillText') return (text) => texts.push(String(text));
            if (name === 'measureText')
              return (text) => ({
                width:
                  String(text).length *
                  Number(String(target.font).match(/([\d.]+)px/)?.[1] ?? 12) *
                  0.6,
              });
            if (name === 'createLinearGradient' || name === 'createRadialGradient')
              return () => ({ addColorStop() {} });
            return () => {};
          },
        },
      );
      return this.context;
    }
  }
  return { document: { createElement: (tag) => new Node(tag) }, Node, draws, texts, nodes };
}
const palette = Object.fromEntries(
  ['ink', 'paper', 'muted', 'accent', 'safe', 'danger', 'field', 'grid', 'sky', 'land'].map(
    (key) => [key, '#123456'],
  ),
);
function snapshot(view, decoded) {
  return {
    resolved: view,
    canvas: { palette, motionScale: 1 },
    fonts: { ui: 'sans-serif', numeric: 'monospace' },
    image: (id) => {
      const item = decoded.get(id);
      return item
        ? {
            ...item,
            geometry: {
              frame: item.asset.geometry.frame,
              pivot: { x: 0.5, y: 0.5 },
              occupiedBounds: { x: 0, y: 0, width: 1, height: 1 },
              rotors: [],
            },
          }
        : null;
    },
  };
}
const decodedImage = (asset) => ({
  id: asset.file.sha256,
  src: 'owned-image',
  width: asset.file.width,
  height: asset.file.height,
});
test('secured scene shows role bodies on a neutral backdrop and refuses canonical picture inspection', async (t) => {
  const dom = fakeDocument(),
    previous = globalThis.document;
  globalThis.document = dom.document;
  t.after(() => {
    globalThis.document = previous;
  });
  const view = resolved();
  for (const id of ['team.core.secured', 'team.core.shielded'])
    view.assets[id] = {
      id,
      kind: 'image',
      revision: 1,
      file: { width: 64, height: 64, sha256: id },
      geometry: { frame: { x: 0, y: 0, width: 64, height: 64 } },
    };
  const options = {
    fieldMode: 'team',
    teamArena: 'relay-yard',
    teamScenario: 'secured',
    motion: 'paused',
    isCurrent: () => true,
  };
  const decoded = [],
    cleanups = [],
    surface = new dom.Node('section');
  const services = {
    decode: async (asset) => {
      const image = decodedImage(asset);
      decoded.push(image);
      return image;
    },
    presentation: snapshot,
    loop: (own, draw) => draw(0, true),
  };
  const slot = { id: 'team.core.secured', group: 'actors' };
  await crossModeContextPreview(
    surface,
    slot,
    view.assets[slot.id],
    view,
    new Map(),
    options,
    (cleanup) => cleanups.push(cleanup),
    services,
  );
  for (const id of ['team.core.secured', 'team.core.shielded'])
    assert.ok(dom.draws.some(({ image }) => image.id === id));
  assert.ok(
    decoded.every((image) => !COOP_PICTURE_BINDINGS.some((row) => row.picture.slot === image.id)),
  );
  assert.ok(
    dom.nodes.some((node) =>
      /Authored two-relay specimen · neutral backdrop/.test(node.textContent || ''),
    ),
  );
  assert.ok(dom.nodes.some((node) => /^Showing 1 secured core/.test(node.textContent || '')));
  assert.ok(
    dom.nodes.some((node) => /Studio Two Relays/.test(node.attributes?.['aria-label'] || '')),
  );
  const { level } = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'secured' });
  await assert.rejects(
    validateTeamPreviewIdentity(COOP_PICTURE_BINDINGS[1], level),
    /identity or revision/,
  );
  const count = decoded.length,
    pictureSlot = { id: COOP_PICTURE_BINDINGS[1].picture.slot, group: 'pictures' };
  await assert.rejects(
    crossModeContextPreview(
      new dom.Node('section'),
      pictureSlot,
      view.assets[pictureSlot.id],
      view,
      new Map(),
      options,
      (cleanup) => cleanups.push(cleanup),
      services,
    ),
    /neutral backdrop/,
  );
  assert.equal(decoded.length, count, 'picture inspection fails before any resource decode');
  cleanups.forEach((cleanup) => cleanup());
  assert.ok(decoded.every((image) => image.src === ''));
});
test('real Team painter consumes distinct compact/detailed sprites, picture and held rescue', async (t) => {
  const dom = fakeDocument(),
    previous = globalThis.document;
  const previousObserver = globalThis.ResizeObserver;
  let resized,
    disconnected = false;
  globalThis.ResizeObserver = class {
    constructor(callback) {
      resized = callback;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  };
  globalThis.document = dom.document;
  t.after(() => {
    globalThis.document = previous;
    globalThis.ResizeObserver = previousObserver;
  });
  const cleanups = [],
    images = [],
    surface = new dom.Node('section');
  let render;
  const view = resolved(),
    slot = { id: 'player.scout.detailed', group: 'players' };
  await crossModeContextPreview(
    surface,
    slot,
    view.assets[slot.id],
    view,
    new Map(),
    {
      fieldMode: 'team',
      teamArena: 'relay-yard',
      teamScenario: 'rescue-p1',
      motion: 'paused',
      isCurrent: () => true,
    },
    (cleanup) => cleanups.push(cleanup),
    {
      decode: async (asset) => {
        const image = decodedImage(asset);
        images.push(image);
        return image;
      },
      presentation: snapshot,
      loop: (own, draw) => {
        render = draw;
        own(() => {
          render = null;
        });
        draw(0, false);
      },
    },
  );
  const canvas = dom.nodes.find((node) => node.tagName === 'canvas');
  assert.equal(canvas.width / canvas.height, 2);
  assert.ok(dom.draws.some(({ image }) => image.id === 'player.scout.detailed'));
  assert.ok(dom.draws.some(({ image }) => image.id === COOP_PICTURE_BINDINGS[1].picture.slot));
  const hud = dom.nodes.find((node) => node.className === 'context-hud');
  assert.match(hud.textContent, /P1 downed.*P2 rescuing 50%/);
  const held = hud.textContent;
  canvas.clientWidth = 390;
  dom.draws.length = 0;
  resized();
  assert.equal(
    hud.textContent,
    held,
    'Paused preview must preserve an actual half-completed rescue.',
  );
  assert.ok(dom.draws.some(({ image }) => image.id === 'player.scout.compact'));
  assert.ok(
    dom.nodes.some((node) => /Selected detailed artwork is inactive/.test(node.textContent || '')),
  );
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(render, null);
  assert.equal(disconnected, true);
  assert.ok(images.every((image) => image.src === ''));
});
for (const target of [1, 2]) {
  test(`Team rescue ${target} HUD, board and note agree through fractional ticks and completion`, async (t) => {
    const dom = fakeDocument(),
      previous = globalThis.document;
    globalThis.document = dom.document;
    t.after(() => {
      globalThis.document = previous;
    });
    const view = resolved(),
      slot = { id: 'team.rescue.progress', group: 'effects' },
      scenario = `rescue-p${target}`,
      expected = createStudioTeamFixture({ arena: 'relay-yard', scenario }),
      cleanups = [];
    view.assets[slot.id] = {
      id: `${slot.id}.default`,
      revision: 1,
      kind: 'recipe',
      recipe: { id: 'team.rescue.v1' },
    };
    let render;
    await crossModeContextPreview(
      new dom.Node('section'),
      slot,
      view.assets[slot.id],
      view,
      new Map(),
      {
        fieldMode: 'team',
        teamArena: 'relay-yard',
        teamScenario: scenario,
        motion: 'playing',
        isCurrent: () => true,
      },
      (cleanup) => cleanups.push(cleanup),
      {
        decode: async (asset) => decodedImage(asset),
        presentation: snapshot,
        loop: (_own, draw) => {
          render = draw;
        },
      },
    );
    t.after(() => cleanups.forEach((cleanup) => cleanup()));
    const hud = dom.nodes.find((node) => node.className === 'context-hud'),
      rescuer = 3 - target,
      shown = [];
    let completed = false;
    for (let tick = 0; tick <= 61; tick++) {
      const dt = tick === 0 ? 0 : FIXED_DT;
      expected.advance(dt);
      dom.texts.length = 0;
      render(dt, false);
      const progress = teamRescueProgress(expected.run, expected.run.players[rescuer - 1]);
      if (progress) {
        const percent = Math.floor(progress.progress * 100);
        shown.push(percent);
        assert.match(hud.textContent, new RegExp(`P${rescuer} rescuing ${percent}%`));
        assert.deepEqual(
          dom.texts.filter((text) => text.startsWith('RESCUE ')),
          [`RESCUE ${target} · ${percent}%`],
          `same simulation tick ${expected.run.tick} must have one matching board cue`,
        );
        assert.ok(
          dom.nodes.some((node) =>
            (node.textContent || '').includes(
              `Player ${rescuer} rescuing player ${target}: ${percent}%`,
            ),
          ),
        );
        assert.ok(percent < 100, 'Active rescue must not announce completion early.');
      } else {
        completed = true;
        assert.equal(expected.run.players[target - 1].status, 'active');
        assert.doesNotMatch(hud.textContent, /rescuing/);
        assert.equal(
          dom.texts.some((text) => text.startsWith('RESCUE ')),
          false,
        );
        assert.ok(
          dom.nodes.some((node) => /^No active contact rescue/.test(node.textContent || '')),
        );
      }
    }
    assert.ok(shown.includes(50) && shown.includes(71) && shown.includes(99));
    assert.equal(completed, true, 'Public-command rescue completes on the ordinary core timer.');
  });
}

test('replacement during decode cannot attach a stale Team scene or leak its image', async (t) => {
  const dom = fakeDocument(),
    previous = globalThis.document;
  globalThis.document = dom.document;
  t.after(() => {
    globalThis.document = previous;
  });
  let resolveImage,
    startedDecode,
    current = true,
    dispose;
  const decoding = new Promise((resolve) => {
    startedDecode = resolve;
  });
  const surface = new dom.Node('section'),
    view = resolved(),
    slot = { id: 'player.scout.compact', group: 'players' };
  const task = crossModeContextPreview(
    surface,
    slot,
    view.assets[slot.id],
    view,
    new Map(),
    {
      fieldMode: 'team',
      teamArena: 'first-connection',
      teamScenario: 'initial',
      isCurrent: () => current,
    },
    (cleanup) => {
      dispose = cleanup;
    },
    {
      decode: () =>
        new Promise((resolve) => {
          resolveImage = resolve;
          startedDecode();
        }),
      presentation: snapshot,
      loop: () => {
        throw new Error('Stale scene must never start its clock.');
      },
    },
  );
  await decoding;
  current = false;
  dispose();
  const image = decodedImage(view.assets[slot.id]);
  resolveImage(image);
  await task;
  assert.equal(image.src, '');
  assert.equal(surface.children.length, 0);
});
test('replacement during arena verification cannot begin image preparation', async () => {
  const view = resolved(),
    slot = { id: 'player.scout.compact', group: 'players' };
  let dispose,
    current = true,
    decodes = 0;
  const task = crossModeContextPreview(
    { append: () => assert.fail('A cancelled scene must not attach.') },
    slot,
    view.assets[slot.id],
    view,
    new Map(),
    { fieldMode: 'team', isCurrent: () => current },
    (cleanup) => {
      dispose = cleanup;
    },
    {
      decode: async () => {
        decodes++;
        assert.fail('A cancelled identity check must not decode artwork.');
      },
    },
  );
  current = false;
  dispose();
  await task;
  assert.equal(decodes, 0);
});
test('a failed required Team image releases earlier decodes before showing recovery', async (t) => {
  const dom = fakeDocument(),
    previous = globalThis.document;
  globalThis.document = dom.document;
  t.after(() => {
    globalThis.document = previous;
  });
  const surface = new dom.Node('section'),
    view = resolved(),
    slot = { id: 'player.scout.compact', group: 'players' };
  const first = decodedImage(view.assets[slot.id]);
  let calls = 0;
  await assert.rejects(
    crossModeContextPreview(
      surface,
      slot,
      view.assets[slot.id],
      view,
      new Map(),
      {
        fieldMode: 'team',
        teamArena: 'first-connection',
        teamScenario: 'initial',
        isCurrent: () => true,
      },
      () => {},
      {
        decode: async () => {
          if (++calls === 1) return first;
          throw new Error('Required image unavailable');
        },
        presentation: snapshot,
        loop: () => {
          throw new Error('Incomplete scene must not play.');
        },
      },
    ),
    /Required image unavailable/,
  );
  assert.equal(first.src, '');
  assert.equal(surface.children.length, 0);
});
