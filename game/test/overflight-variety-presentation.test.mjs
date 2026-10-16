import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERFLIGHT_BATTLEFIELDS } from '../overflight/battlefields.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { overflightCacheHint } from '../overflight/copy.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  overflightMissionSource,
  overflightPlayableMissionDefinitions,
  paintOverflightMission,
} from '../overflight/mission-library.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import { createOverflightRaidVariant } from '../overflight/raid-variants.mjs';
import { createExperimentalOverflightWorldProject } from '../overflight/worlds.mjs';
import {
  createOverflightOperationCards,
  createOverflightRunChangeDialog,
  overflightRememberedOperationURL,
} from '../overflight/operation-view.mjs';
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

test('installed experimental Raid remains discoverable but unavailable in open-arena variants', async () => {
  const terrain = createExperimentalOverflightWorldProject(OVERFLIGHT_HUNT_MODE.createProject);
  const current = OVERFLIGHT_HUNT_MODE.createProject();
  const legacy = createOverflightHuntProject({ rulesVersion: 2 });
  assert.equal(overflightPlayableMissionDefinitions(OVERFLIGHT_HUNT_MODE, [terrain]).length, 1);
  for (const variant of ['time-attack', 'marathon']) {
    const operation = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant });
    const entries = [terrain, current, legacy].map((project, index) => ({
      identity: `community:installed-${index}`,
      project,
    }));
    const progressRead = [],
      launched = [];
    const source = overflightMissionSource({
      id: 'installed',
      entries,
      mode: operation,
      installed: true,
      progress(entry) {
        operation.compileProject(entry.project);
        progressRead.push(entry);
        return { state: 'completed', bestStars: null };
      },
      launch: (entry) => launched.push(entry),
    });
    const library = createMissionLibrary([source]);
    assert.equal(
      library.missions.length,
      3,
      'incompatible packages do not hide any installed rows',
    );
    const [blocked, playable, old] = library.missions;
    assert.equal(
      JSON.parse(blocked.id).at(-1),
      compileOverflightHuntProject(terrain).projectIdentity,
    );
    assert.match(library.presentation(blocked).name, /Experimental/);
    assert.equal(library.availability(blocked, 'solo').state, 'unavailable');
    assert.match(library.availability(blocked, 'solo').reason, /requires open arenas/);
    assert.deepEqual(library.progressState(blocked, 'solo'), { state: 'new', bestStars: null });
    assert.equal(progressRead.length, 0, 'unsupported rows never compile through progress lookup');
    assert.throws(() => library.launch(blocked, { mode: 'solo' }));
    assert.equal(launched.length, 0);
    for (const row of [playable, old]) {
      assert.equal(library.availability(row, 'solo').state, 'ready');
      assert.equal(library.progressState(row, 'solo').state, 'completed');
      await library.launch(row, { mode: 'solo' });
    }
    assert.deepEqual(launched, entries.slice(1));
    assert.deepEqual(
      overflightPlayableMissionDefinitions(operation, [terrain, current, legacy]).map(
        (project) => project.projectIdentity,
      ),
      [current, legacy].map((project) => compileOverflightHuntProject(project).projectIdentity),
      'pre-run record queries include supported current and legacy projects only',
    );
    library.dispose();
  }
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
    paintOverflightMission(context().value, {
      operation: 'overflight-hunt',
      project: hunt,
    }),
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
    left = 0,
    layout = '';
  const view = createOverflightOperationCards({
    document,
    current: 'overflight',
    text: (key) => key,
    destination: (path) => `${path}${path.includes('?') ? '&' : '?'}lang=uk${layout}`,
    onSelect: () => selected++,
    onLeave: () => left++,
  });
  view.refresh();
  assert.equal(view.root.children.length, 2, 'two groups contain all five operation choices');
  const [survivor, riy, raid, timeAttack, marathon] =
    view.root.querySelectorAll('[data-home-choice]');
  assert.equal(survivor.getAttribute('aria-current'), 'true');
  assert.equal(raid.getAttribute('href'), './raid.html?lang=uk');
  assert.equal(riy.getAttribute('href'), './play.html?operation=riy&lang=uk');
  assert.equal(timeAttack.getAttribute('href'), './raid.html?operation=time-attack&lang=uk');
  assert.equal(marathon.getAttribute('href'), './raid.html?operation=marathon&lang=uk');
  survivor.click();
  assert.equal(selected, 0, 'the selected operation is a no-op, not a mission launch');
  for (const card of [riy, raid, timeAttack, marathon]) card.click();
  assert.equal(selected, 4);
  assert.equal(left, 4);
  layout = '&layout=river-port-twin-docks';
  view.refresh();
  assert.equal(raid.getAttribute('href'), './raid.html?lang=uk&layout=river-port-twin-docks');
});

test('only a generic family entry restores a valid saved operation while keeping appearance and locale', () => {
  const base = 'https://example.test/game/overflight/play.html';
  assert.equal(overflightRememberedOperationURL(base, 'marathon'), null);
  assert.equal(overflightRememberedOperationURL(`${base}?family=1`, 'deleted-operation'), null);
  const destination = new URL(
    overflightRememberedOperationURL(`${base}?family=1&lang=uk&appearance=accepted`, 'marathon'),
  );
  assert.equal(destination.pathname, '/game/overflight/raid.html');
  assert.equal(destination.searchParams.get('operation'), 'marathon');
  assert.equal(destination.searchParams.get('lang'), 'uk');
  assert.equal(destination.searchParams.get('appearance'), 'accepted');
  assert.equal(destination.searchParams.has('family'), false);
});

test('changing a live sortie requires explicit end, supports cancel and releases confirmation input', async () => {
  const document = new Document();
  let released = 0;
  const change = createOverflightRunChangeDialog({
    document,
    text: (key) => key,
    releaseInput: () => released++,
  });
  const cancelled = change.ask();
  assert.equal(change.root.open, true);
  assert.equal(document.activeElement.id, 'overflight-change-cancel');
  assert.equal(
    await change.ask(),
    false,
    'a second mutation cannot steal an existing confirmation',
  );
  change.root.querySelector('#overflight-change-cancel').click();
  assert.equal(await cancelled, false);
  const accepted = change.ask();
  change.root.querySelector('#overflight-change-accept').click();
  assert.equal(await accepted, true);
  const back = change.ask();
  change.root.emit('cancel');
  assert.equal(await back, false);
  assert.equal(change.root.open, false);
  assert.ok(released >= 3);
  change.dispose();
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
  const [ground] = overflightAttackLayers({
    kind: 'ground',
    x: 70,
    y: 80,
    radius: 45,
  });
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
  const armor = {
    x: 10,
    y: 20,
    armor: 80,
    maxArmor: 100,
    exposureRemaining: 0,
  };
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
  const enemy = {
    x: 500,
    y: 200,
    maxArmor: 100,
    armor: 50,
    exposureRemaining: 0,
  };
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
      overflightTacticalEnemyLayers({ ...enemy, ...priority }, 32, {
        x: 100,
        y: 200,
      }),
      full,
    );
  for (const state of [{ exposureRemaining: 3 }, { armor: 0 }]) {
    const open = overflightTacticalEnemyLayers({ ...enemy, ...state }, 32, {
      x: 100,
      y: 200,
    });
    assert.equal(
      open.filter((cue) => cue.frame === 'arrow').length,
      2,
      'opening still has geometry in addition to color',
    );
  }
  const guard = {
    ...enemy,
    maxArmor: 0,
    maxGuardIntegrity: 50,
    guardIntegrity: 30,
    heading: 1,
  };
  assert.deepEqual(
    overflightTacticalEnemyLayers(guard, 24, { x: 0, y: 0 }),
    overflightTacticalEnemyLayers(guard, 24),
    'shield facing remains explicit at every distance',
  );
  assert.deepEqual(enemy, before);
});

test('mission discovery labels Relaxed V3 encounters in both native languages', () => {
  const entry = {
    project: createOverflightProject({
      rulesVersion: 3,
      difficulty: 'relaxed',
    }),
  };
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

test('all eighteen battlefields register in six localized campaign groups', () => {
  const entries = OVERFLIGHT_BATTLEFIELDS.map(({ id }) => ({
    project: createOverflightProject({ rulesVersion: 4, layout: id }),
  }));
  for (const locale of ['en', 'uk']) {
    const source = overflightMissionSource({
      id: 'official',
      entries,
      mode,
      locale: () => locale,
      launch() {},
    });
    const library = createMissionLibrary([source]);
    assert.equal(library.missions.length, 18);
    const campaigns = new Set(library.missions.map((row) => row.campaignKey));
    assert.equal(campaigns.size, 6);
    for (const row of library.missions) {
      assert.equal(row.campaignLevelCount, 3);
      assert.ok(row.levelIndex >= 0 && row.levelIndex < 3);
      assert.equal(library.availability(row, 'solo').state, 'ready');
      assert.deepEqual(row.tags, ['Classic', 'FPV', 'Arcade']);
    }
    library.dispose();
  }
});
