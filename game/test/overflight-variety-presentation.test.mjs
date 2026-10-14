import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { overflightCacheHint } from '../overflight/copy.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { overflightMissionSource, paintOverflightMission } from '../overflight/mission-library.mjs';
import { createOverflightOperationCards } from '../overflight/operation-view.mjs';
import {
  overflightTacticalEnemyLayers,
  overflightAttackLayers,
  overflightCacheLayers,
} from '../overflight/tactical-view.mjs';

const mode = {
  id: 'overflight',
  compileProject: compileOverflightProject,
  text: () => 'Fly through the swarm.',
};
const context = () => {
  const calls = [];
  return {
    calls,
    value: new Proxy(
      {},
      {
        get: (target, key) =>
          key in target ? target[key] : (...args) => calls.push([key, ...args]),
      },
    ),
  };
};

test('official and installed encounters retain exact compiler identities and owner launches', async () => {
  let locale = 'en',
    launched;
  const project = createOverflightProject({ difficulty: 'veteran' });
  const entry = { project },
    installed = { project, identity: 'community:own-id' };
  const official = overflightMissionSource({
    id: 'official',
    entries: [entry],
    mode,
    locale: () => locale,
    launch: (item) => {
      launched = item;
      return true;
    },
  });
  const custom = overflightMissionSource({
    id: 'installed',
    entries: [installed],
    mode,
    installed: true,
    launch: () => true,
  });
  const library = createMissionLibrary([official, custom]);
  const [a, b] = library.missions;
  assert.notEqual(a.id, b.id);
  assert.equal(a.globalLevelNumber, 1);
  assert.equal(b.globalLevelNumber, null);
  assert.deepEqual(a.modes, ['solo']);
  assert.equal(JSON.parse(a.id).at(-1), compileOverflightProject(project).projectIdentity);
  assert.match(library.presentation(a).name, /Veteran/);
  locale = 'uk';
  assert.match(library.presentation(a).name, /Ветеран/);
  await library.launch(a, { mode: 'solo' });
  assert.equal(launched, entry);
  assert.throws(() => library.launch(a, { mode: 'team' }));
  library.dispose();
});

test('different authored schedules produce different diagrams without mutating projects', () => {
  const projects = ['front', 'crossing', 'mixed'].map((encounterSet) =>
    createOverflightProject({ encounterSet }),
  );
  const snapshots = projects.map((project) => {
    const before = JSON.stringify(project),
      paint = context();
    paintOverflightMission(paint.value, { operation: 'overflight', project });
    assert.equal(JSON.stringify(project), before);
    return JSON.stringify(paint.calls);
  });
  assert.equal(new Set(snapshots).size, 3);
  const hunt = createOverflightHuntProject();
  assert.doesNotThrow(() => compileOverflightHuntProject(hunt));
  assert.doesNotThrow(() =>
    paintOverflightMission(context().value, { operation: 'overflight-hunt', project: hunt }),
  );
});

test('family home exposes all five operations and preserves operation queries with locale', () => {
  const document = new Document();
  const create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'canvas') node.getContext = () => context().value;
    return node;
  };
  let selected = 0,
    left = 0;
  const view = createOverflightOperationCards({
    document,
    current: 'overflight',
    text: (key) => key,
    destination: (path) => `${path}${path.includes('?') ? '&' : '?'}lang=uk`,
    onSelect: () => selected++,
    onLeave: () => left++,
  });
  view.refresh();
  assert.equal(view.root.children.length, 5);
  const [survivor, riy, raid, timeAttack, marathon] = view.root.children;
  assert.equal(survivor.getAttribute('aria-current'), 'true');
  assert.equal(raid.href, './raid.html?lang=uk');
  assert.equal(riy.href, './play.html?operation=riy&lang=uk');
  assert.equal(timeAttack.href, './raid.html?operation=time-attack&lang=uk');
  assert.equal(marathon.href, './raid.html?operation=marathon&lang=uk');
  survivor.click();
  for (const card of [riy, raid, timeAttack, marathon]) card.click();
  assert.equal(selected, 1);
  assert.equal(left, 4);
});

test('committed fan and lane warnings match each damaging ray and full half-width', () => {
  const attack = {
    kind: 'fan',
    originX: 30,
    originY: 50,
    heading: 0.7,
    spread: 0.32,
    length: 620,
    radius: 8,
  };
  const layers = overflightAttackLayers(attack);
  assert.equal(layers.length, 9);
  for (const [index, angle] of [0.38, 0.7, 1.02].entries()) {
    const [left, right, arrow] = layers.slice(index * 3, index * 3 + 3);
    assert.ok(Math.abs(left.rotation - angle) < 1e-10);
    assert.equal(left.width, 620);
    assert.ok(Math.abs(Math.hypot(left.x - right.x, left.y - right.y) - 16) < 1e-10);
    assert.ok(Math.abs(arrow.x - (30 + Math.cos(angle) * 620)) < 1e-10);
    assert.ok(Math.abs(arrow.y - (50 + Math.sin(angle) * 620)) < 1e-10);
  }
  assert.equal(overflightAttackLayers({ ...attack, kind: 'lane' }).length, 3);
  const [ground] = overflightAttackLayers({ kind: 'ground', x: 70, y: 80, radius: 45 });
  assert.equal(ground.frame, 'ring');
  assert.equal(ground.width, 90);
});

test('guard facing, damage and armor opening remain geometrically distinct', () => {
  const enemy = {
    x: 100,
    y: 100,
    heading: 0,
    guardHeading: Math.PI / 2,
    maxGuardIntegrity: 50,
    guardIntegrity: 50,
  };
  const guarded = overflightTacticalEnemyLayers(enemy);
  assert.ok(guarded.slice(0, 7).every((layer) => layer.y >= 100 - 1e-9));
  const broken = overflightTacticalEnemyLayers({ ...enemy, guardIntegrity: 0 });
  assert.ok(broken.length < guarded.length);
  assert.ok(broken.some((layer) => layer.frame === 'arrow'));
  const armor = { x: 10, y: 20, armor: 80, maxArmor: 100, exposureRemaining: 0 };
  assert.equal(
    overflightTacticalEnemyLayers(armor).filter((layer) => layer.frame === 'arrow').length,
    0,
  );
  assert.equal(
    overflightTacticalEnemyLayers({ ...armor, exposureRemaining: 3 }).filter(
      (layer) => layer.frame === 'arrow',
    ).length,
    2,
  );
});

test('open cache shows two physical choices with distinct glyphs and disabled state', () => {
  const cache = {
    state: 'open',
    rewards: [
      { id: 'repair', x: 40, y: 50, enabled: false },
      { id: 'recalibrate', x: 90, y: 50, enabled: true },
    ],
  };
  const layers = overflightCacheLayers(cache);
  assert.deepEqual(overflightCacheLayers({ ...cache, state: 'claimed' }), []);
  assert.deepEqual(overflightCacheLayers({ ...cache, state: 'locked' }), []);
  assert.equal(layers.filter((layer) => layer.frame === 'ring').length, 2);
  assert.equal(layers.filter((layer) => layer.frame === 'arrow').length, 2);
  assert.notEqual(layers[0].tint, layers[3].tint);
});

test('distant armor stays compact without losing state, while approaches and priority targets stay detailed', () => {
  const enemy = { x: 500, y: 200, maxArmor: 100, armor: 50, exposureRemaining: 0 };
  const before = structuredClone(enemy);
  const full = overflightTacticalEnemyLayers(enemy, 32);
  const near = overflightTacticalEnemyLayers(enemy, 32, { x: 400, y: 200 });
  const far = overflightTacticalEnemyLayers(enemy, 32, { x: 100, y: 200 });
  assert.deepEqual(near, full);
  assert.equal(far.length, full.length, 'every closed-armor state cue stays present');
  assert.ok(far[0].width < full[0].width);
  assert.ok(far.slice(2).every((cue) => cue.width < full[2].width));
  assert.equal(
    far[1].width / (far[0].width - 2),
    0.5,
    'compact bar retains the actual armor fraction',
  );
  const halfway = overflightTacticalEnemyLayers(enemy, 32, { x: 310, y: 200 });
  assert.ok(
    halfway[0].width > far[0].width && halfway[0].width < full[0].width,
    'detail changes continuously during approach',
  );
  for (const priority of [
    { heavy: true },
    { role: 'elite' },
    { role: 'final' },
    { objectiveId: 'required' },
  ])
    assert.deepEqual(
      overflightTacticalEnemyLayers({ ...enemy, ...priority }, 32, { x: 100, y: 200 }),
      full,
    );
  for (const state of [{ exposureRemaining: 3 }, { armor: 0 }]) {
    const open = overflightTacticalEnemyLayers({ ...enemy, ...state }, 32, { x: 100, y: 200 });
    assert.equal(
      open.filter((cue) => cue.frame === 'arrow').length,
      2,
      'opening still has geometry in addition to color',
    );
  }
  const guard = { ...enemy, maxArmor: 0, maxGuardIntegrity: 50, guardIntegrity: 30, heading: 1 };
  assert.deepEqual(
    overflightTacticalEnemyLayers(guard, 24, { x: 0, y: 0 }),
    overflightTacticalEnemyLayers(guard, 24),
    'shield facing remains explicit at every distance',
  );
  assert.deepEqual(enemy, before);
});

test('mission discovery labels Relaxed V3 encounters in both native languages', () => {
  const entry = { project: createOverflightProject({ rulesVersion: 3, difficulty: 'relaxed' }) };
  for (const [locale, label] of [
    ['en', 'Relaxed'],
    ['uk', 'Спокійна'],
  ]) {
    const source = overflightMissionSource({
      id: 'official',
      entries: [entry],
      mode,
      locale: () => locale,
      launch() {},
    });
    assert.ok(source.describe(entry).name.includes(label));
    assert.ok(source.details(entry).challenge.includes(label));
    assert.equal(source.availability(entry).state, 'ready');
  }
});

test('cache instructions explain stored V3 Overdrive without changing legacy or Raid rewards', () => {
  const v3 = compileOverflightProject(createOverflightProject({ rulesVersion: 3 }));
  const legacy = compileOverflightProject(createOverflightProject());
  const raid = compileOverflightHuntProject(createOverflightHuntProject({ rulesVersion: 3 }));
  assert.match(overflightCacheHint(v3), /stored Overdrive.*next fresh boost.*6 seconds.*25%/);
  assert.match(overflightCacheHint(v3, 'uk'), /запас форсажу.*6 секунд.*25%/);
  assert.match(overflightCacheHint(v3), new RegExp(`\\+${v3.combat.supplies.repairHull} hull`));
  assert.doesNotMatch(overflightCacheHint(legacy), /Overdrive/);
  assert.doesNotMatch(overflightCacheHint(raid), /Overdrive/);
  assert.doesNotMatch(
    overflightCacheHint({
      ...v3,
      combat: { supplies: { ...v3.combat.supplies, overdrive: false } },
    }),
    /Overdrive/,
  );
});
