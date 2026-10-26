import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { Document, Element } from './helpers/couch-dom.mjs';
import {
  ENCOUNTER_ACTIVITIES,
  mountCombatVitals,
} from '../../optional-practice/civilian-fpv/encounter-controls.mjs';
import { ENCOUNTER_WEAPONS } from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';

const weapon = (id, patch = {}) => ({
  id,
  ammo: ENCOUNTER_WEAPONS[id].magazine,
  reserve: id === 'rocket' ? 2 : -1,
  reloadTicks: 0,
  reloadTotal: ENCOUNTER_WEAPONS[id].reload,
  cooldown: 0,
  ...patch,
});
const state = (patch = {}, status = 'active') => ({
  status,
  ticks: 100,
  encounter: {
    ticks: 100,
    health: 100,
    maxHealth: 100,
    weapons: [weapon('autocannon'), weapon('rocket')],
    weaponIndex: 0,
    fireReleasedTicks: 0,
    payloadAmmo: 3,
    payloadArmed: false,
    ordnance: [],
    ...patch,
  },
});
const definition = {
  format: 'FPVEncounterDefinition.v2',
  ammoPreset: 'balanced',
  playerDamage: 'normal',
  payload: 'bomb',
};
function fixture(t, rules = ENCOUNTER_WEAPONS) {
  const doc = new Document(),
    parent = doc.createElement('div');
  doc.createElementNS = (_ns, tag) => doc.createElement(tag);
  doc.body.append(parent);
  const view = mountCombatVitals({ document: doc, parent, weaponRules: rules });
  t.after(() => view.dispose());
  const card = (name) => {
    const node = view.root.querySelector(`[data-vital="${name}"]`);
    return {
      node,
      label: node.querySelector('.combat-vitals__label'),
      value: node.querySelector('.combat-vitals__value'),
      max: node.querySelector('.combat-vitals__max'),
      meter: node.querySelector('.combat-vitals__meter'),
      fill: node.querySelector('.combat-vitals__fill'),
      status: node.querySelector('.combat-vitals__status'),
    };
  };
  return {
    ...view,
    doc,
    parent,
    hull: card('health'),
    ammo: card('ammo'),
    reserve: view.root.querySelector('.combat-vitals__reserve'),
    payload: view.root.querySelector('.combat-vitals__payload'),
    warning: view.root.querySelector('.combat-vitals__warning'),
    show(patch = {}, options = {}) {
      view.update({
        state: state(patch),
        definition,
        preferences: { vitals: true, playerHealth: 'always' },
        ...options,
      });
    },
  };
}

test('combat vitals hide before combat, during hidden presentation and after disposal', (t) => {
  const h = fixture(t);
  assert.equal(h.root.hidden, true);
  h.update({ state: { status: 'active' } });
  assert.equal(h.root.hidden, true);
  h.show();
  assert.equal(h.root.hidden, false);
  h.show({}, { visible: false });
  assert.equal(h.root.hidden, true);
  h.show({}, { preferences: { vitals: false } });
  assert.equal(h.root.hidden, true);
  h.show();
  assert.equal(h.root.hidden, false);
  h.show({}, { state: null });
  assert.equal(h.root.hidden, true);
  h.show({ weapons: undefined }, { preferences: { playerHealth: 'off' } });
  assert.equal(h.root.hidden, true, 'A HUD with both cards hidden leaves no empty panel');
  h.dispose();
  assert.equal(h.parent.querySelector('[data-combat-vitals]'), null);
  h.show();
  assert.equal(h.parent.querySelector('[data-combat-vitals]'), null);
});

test('health off, when damaged and always update independently from ammunition', (t) => {
  const h = fixture(t);
  h.show({ health: 10 }, { preferences: { playerHealth: 'off' } });
  assert.equal(h.hull.node.hidden, true);
  assert.equal(h.ammo.node.hidden, false);
  assert.equal(h.warning.hidden, true, 'Hidden health cannot leak a critical warning');
  assert.equal(h.warning.textContent, '');
  h.show({}, { preferences: { playerHealth: 'damaged' } });
  assert.equal(h.hull.node.hidden, true);
  h.show({ health: 99 }, { preferences: { playerHealth: 'damaged' } });
  assert.equal(h.hull.node.hidden, false);
  assert.equal(h.hull.value.textContent, '99');
  h.show({}, { preferences: { playerHealth: 'damaged' } });
  assert.equal(h.hull.node.hidden, true, 'A fully repaired hull hides again');
  h.show({}, { preferences: { playerHealth: 'always' } });
  assert.equal(h.hull.node.hidden, false);
});

test('health tones, exact meter values and zero hull remain authoritative', (t) => {
  const h = fixture(t);
  for (const [health, tone, text] of [
    [100, 'healthy', 'Healthy'],
    [99, 'damaged', 'Damaged'],
    [35, 'low', 'LOW HULL'],
    [15, 'critical', 'CRITICAL'],
    [0, 'destroyed', 'Destroyed'],
  ]) {
    h.show({ health });
    assert.equal(h.hull.node.getAttribute('data-tone'), tone);
    assert.equal(h.hull.value.textContent, String(health));
    assert.equal(h.hull.status.textContent, text);
    assert.equal(h.hull.meter.getAttribute('aria-valuenow'), String(health));
    assert.equal(h.hull.fill.style.transform, `scaleX(${health / 100})`);
  }
  h.show({ health: 50, maxHealth: 200 });
  assert.equal(h.hull.max.textContent, '/ 200');
  assert.equal(h.hull.node.getAttribute('data-tone'), 'low');
  assert.equal(h.hull.fill.style.transform, 'scaleX(0.25)');
  h.show({ health: 15 }, { definition: { ...definition, playerDamage: 'invulnerable' } });
  assert.equal(h.hull.node.getAttribute('data-tone'), 'invulnerable');
  assert.equal(h.hull.status.textContent, 'Invulnerable');
  assert.equal(h.warning.hidden, true);
  h.show({ health: 0 }, { definition: { ...definition, playerDamage: 'invulnerable' } });
  assert.equal(h.hull.value.textContent, '0', 'Zero is not replaced by the default health');
  assert.equal(h.hull.node.getAttribute('data-tone'), 'destroyed');
});

test('ammunition follows active weapon rules, finite reserves and unlimited conventional reserves', (t) => {
  const h = fixture(t);
  for (const id of Object.keys(ENCOUNTER_WEAPONS)) {
    const rule = ENCOUNTER_WEAPONS[id];
    h.show({ weapons: [weapon(id, { ammo: 1, reserve: 7 })], weaponIndex: 0 });
    assert.equal(h.ammo.value.textContent, '1');
    assert.equal(h.ammo.max.textContent, `/ ${rule.magazine}`);
    assert.equal(h.ammo.meter.getAttribute('aria-valuemax'), String(rule.magazine));
    assert.equal(h.reserve.textContent, 'Reserve 7');
  }
  h.show({ weapons: [weapon('autocannon', { ammo: 7 })] });
  assert.equal(h.ammo.node.getAttribute('data-tone'), 'low');
  assert.equal(h.reserve.textContent, 'Reserve ∞');
  h.show({ weapons: [weapon('autocannon', { ammo: 8 })] });
  assert.equal(h.ammo.node.getAttribute('data-tone'), 'ready');
  h.show({ weapons: [weapon('rocket', { reserve: -1 })] });
  assert.equal(
    h.reserve.textContent,
    'Reserve 0',
    'Heavy ammunition never implies an infinite reserve',
  );
  h.show({ weaponIndex: 1 });
  assert.equal(h.ammo.value.textContent, '2');
  assert.equal(h.ammo.max.textContent, '/ 2');
  assert.match(h.ammo.label.textContent, /Rocket/i);
});

test('magazine capacity is supplied by the host instead of a duplicated HUD rules table', (t) => {
  const h = fixture(t, {
    ...ENCOUNTER_WEAPONS,
    autocannon: { ...ENCOUNTER_WEAPONS.autocannon, magazine: 43 },
  });
  h.show({ weapons: [weapon('autocannon', { ammo: 37 })] });
  assert.equal(h.ammo.max.textContent, '/ 43');
  assert.equal(h.ammo.meter.getAttribute('aria-valuemax'), '43');
  assert.equal(h.ammo.fill.style.transform, 'scaleX(0.8604651162790697)');
});

test('reload countdown uses the selected weapon accepted ticks and never invents loaded rounds', (t) => {
  const h = fixture(t);
  for (const id of Object.keys(ENCOUNTER_WEAPONS)) {
    const total = ENCOUNTER_WEAPONS[id].reload;
    h.show({ weapons: [weapon(id, { ammo: 0, reloadTicks: total })] });
    assert.equal(h.ammo.node.getAttribute('data-tone'), 'reloading');
    assert.match(h.ammo.status.textContent, new RegExp(`${(total / 50).toFixed(1)} s`));
    assert.equal(h.ammo.value.textContent, '0');
    assert.equal(h.ammo.fill.style.transform, 'scaleX(0)');
  }
  const snapshot = state(
    {
      weapons: [
        weapon('autocannon', { ammo: 3, reloadTicks: 45 }),
        weapon('rocket', { ammo: 1, reloadTicks: 100 }),
      ],
    },
    'paused',
  );
  h.show({}, { state: snapshot });
  assert.equal(h.ammo.status.textContent, 'RELOADING 0.9 s · Paused');
  assert.equal(h.ammo.meter.getAttribute('aria-label'), 'Reload progress');
  assert.equal(h.ammo.meter.getAttribute('aria-valuenow'), '45');
  assert.equal(h.ammo.meter.getAttribute('aria-valuemax'), '90');
  assert.equal(h.ammo.fill.style.transform, 'scaleX(0.5)');
  for (let i = 0; i < 20; i++) h.show({}, { state: snapshot });
  assert.equal(h.ammo.status.textContent, 'RELOADING 0.9 s · Paused');
  assert.equal(h.ammo.value.textContent, '3');
  h.show({}, { state: { ...snapshot, encounter: { ...snapshot.encounter, weaponIndex: 1 } } });
  assert.equal(h.ammo.status.textContent, 'RELOADING 2.0 s · Paused');
  h.show({ weapons: [weapon('autocannon', { ammo: 30, reloadTicks: 0 })] });
  assert.equal(h.ammo.status.textContent, 'Ready');
});

test('Arcade conventional and rocket recharge uses the three and five second release thresholds', (t) => {
  const h = fixture(t),
    arcade = { ...definition, ammoPreset: 'arcade' };
  for (const [id, total] of [
    ['autocannon', 150],
    ['rocket', 250],
  ]) {
    h.show({ weapons: [weapon(id, { ammo: 0 })], fireReleasedTicks: 49 }, { definition: arcade });
    assert.match(h.ammo.status.textContent, /Release Fire to recharge/);
    assert.equal(h.ammo.node.getAttribute('data-tone'), 'empty');
    h.show({ weapons: [weapon(id, { ammo: 0 })], fireReleasedTicks: 50 }, { definition: arcade });
    assert.equal(h.ammo.node.getAttribute('data-tone'), 'recharging');
    assert.equal(h.ammo.status.textContent, `RECHARGING ${((total - 50) / 50).toFixed(1)} s`);
    assert.equal(h.ammo.meter.getAttribute('aria-label'), 'Recharge progress');
    assert.equal(h.ammo.meter.getAttribute('aria-valuenow'), '50');
    assert.equal(h.ammo.meter.getAttribute('aria-valuemax'), String(total));
    h.show(
      { weapons: [weapon(id, { ammo: 0 })], fireReleasedTicks: total - 1 },
      { definition: arcade },
    );
    assert.equal(h.ammo.status.textContent, 'RECHARGING 0.1 s');
    assert.equal(
      h.ammo.value.textContent,
      '0',
      'The HUD does not refill before the authority commits',
    );
    h.show({ weapons: [weapon(id)], fireReleasedTicks: total }, { definition: arcade });
    assert.equal(h.ammo.status.textContent, 'Ready');
    h.show({ weapons: [weapon(id, { ammo: 0 })], fireReleasedTicks: 0 }, { definition: arcade });
    assert.match(
      h.ammo.status.textContent,
      /Release Fire to recharge/,
      'Firing restarts the accepted release delay',
    );
  }
});

test('an overlapping Arcade refill and manual reload shows the earliest accepted completion', (t) => {
  const h = fixture(t),
    options = { definition: { ...definition, ammoPreset: 'arcade' } };
  h.show(
    { weapons: [weapon('autocannon', { ammo: 0, reloadTicks: 90 })], fireReleasedTicks: 70 },
    options,
  );
  assert.equal(h.ammo.status.textContent, 'RECHARGING 1.6 s');
  assert.equal(h.ammo.meter.getAttribute('aria-valuenow'), '70');
  assert.equal(h.ammo.meter.getAttribute('aria-valuemax'), '150');
  h.show(
    { weapons: [weapon('autocannon', { ammo: 0, reloadTicks: 45 })], fireReleasedTicks: 70 },
    options,
  );
  assert.equal(h.ammo.status.textContent, 'RELOADING 0.9 s');
  assert.equal(h.ammo.meter.getAttribute('aria-valuenow'), '45');
  assert.equal(h.ammo.meter.getAttribute('aria-valuemax'), '90');
  assert.equal(h.ammo.value.textContent, '0');
});

test('payload refill, armed charges and deployed ordnance reflect accepted combat state', (t) => {
  const h = fixture(t),
    arcade = { ...definition, ammoPreset: 'arcade' };
  h.show({ payloadAmmo: 0, fireReleasedTicks: 49 }, { definition: arcade });
  assert.equal(h.payload.textContent, 'Bomb 0 · Release Fire to refill');
  h.show({ payloadAmmo: 0, fireReleasedTicks: 50 }, { definition: arcade });
  assert.equal(h.payload.textContent, 'Bomb 0 · Refill 10.0 s');
  h.show({ payloadAmmo: 0, fireReleasedTicks: 549 }, { definition: arcade });
  assert.equal(h.payload.textContent, 'Bomb 0 · Refill 0.1 s');
  h.show({ payloadAmmo: 3, fireReleasedTicks: 550 }, { definition: arcade });
  assert.equal(h.payload.textContent, 'Bomb 3');
  h.show(
    { payloadAmmo: 1, payloadArmed: true },
    { definition: { ...definition, payload: 'drone' } },
  );
  assert.equal(h.payload.textContent, 'Drone charge 1 · ARMED');
  assert.equal(h.payload.getAttribute('data-state'), 'armed');
  h.show(
    { payloadAmmo: 1, ordnance: [{ kind: 'remote', settled: true }] },
    { definition: { ...definition, payload: 'remote' } },
  );
  assert.equal(h.payload.textContent, 'Remote charge 1 · Ready to detonate');
  assert.equal(h.payload.getAttribute('data-state'), 'deployed');
  h.show({ payloadAmmo: 2, ordnance: [{ kind: 'bomb', settled: false }] });
  assert.equal(h.payload.textContent, 'Bomb 2 · In flight');
});

test('paused and unavailable encounters freeze countdowns and suppress urgent announcements', (t) => {
  const h = fixture(t),
    frozen = state(
      {
        health: 10,
        weapons: [weapon('rocket', { ammo: 0 })],
        payloadAmmo: 0,
        fireReleasedTicks: 100,
      },
      'paused',
    ),
    options = { state: frozen, definition: { ...definition, ammoPreset: 'arcade' } };
  h.show({}, options);
  const texts = [h.ammo.status.textContent, h.payload.textContent];
  assert.equal(texts[0], 'RECHARGING 3.0 s · Paused');
  assert.equal(texts[1], 'Bomb 0 · Refill 9.0 s · Paused');
  for (let i = 0; i < 30; i++) h.show({}, options);
  assert.deepEqual([h.ammo.status.textContent, h.payload.textContent], texts);
  assert.equal(h.warning.hidden, true);
  for (const [flag, label] of [
    ['outsideArea', 'Return to resume combat'],
    ['geometryWaiting', 'Loading combat terrain'],
  ]) {
    h.show({ health: 10, [flag]: true });
    assert.equal(h.ammo.node.getAttribute('data-tone'), 'waiting');
    assert.equal(h.ammo.status.textContent, label);
    assert.equal(h.warning.hidden, true);
  }
});

test('destroyed aircraft show offline weapons without active reload or recharge prompts', (t) => {
  const h = fixture(t),
    arcade = { ...definition, ammoPreset: 'arcade' };
  for (const phase of ['aftermath', 'defeat']) {
    for (const fireReleasedTicks of [0, 100]) {
      h.show(
        {
          phase,
          health: 0,
          weapons: [weapon('autocannon', { ammo: 3, reloadTicks: 45 })],
          fireReleasedTicks,
          payloadAmmo: 0,
          ordnance: phase === 'aftermath' ? [{ kind: 'bomb', settled: false }] : [],
        },
        { definition: arcade },
      );
      assert.equal(h.hull.value.textContent, '0');
      assert.equal(h.ammo.node.getAttribute('data-tone'), 'destroyed');
      assert.equal(
        h.ammo.status.textContent,
        phase === 'aftermath' ? 'Ordnance resolving' : 'Weapons offline',
      );
      assert.equal(h.ammo.value.textContent, '3', 'Remaining rounds are preserved');
      assert.equal(h.ammo.meter.getAttribute('aria-valuenow'), '3');
      assert.equal(h.ammo.meter.getAttribute('aria-valuemax'), '30');
      assert.equal(h.ammo.fill.style.transform, 'scaleX(0.1)');
      assert.doesNotMatch(h.ammo.meter.getAttribute('aria-label'), /progress/);
      assert.doesNotMatch(h.payload.textContent, /Refill|Release Fire|supplies|service pad/);
      assert.equal(h.payload.textContent, phase === 'aftermath' ? 'Bomb 0 · In flight' : 'Bomb 0');
    }
  }
});

test('empty finite reserves give a service-pad cue and missing weapons hide only their card', (t) => {
  const h = fixture(t);
  h.show(
    { weapons: [weapon('autocannon', { ammo: 0, reserve: 0 })] },
    { definition: { ...definition, ammoPreset: 'tactical' } },
  );
  assert.equal(h.ammo.status.textContent, 'EMPTY · Find a service pad');
  assert.equal(h.warning.textContent, 'EMPTY · Find a service pad');
  h.show({ weapons: [weapon('autocannon', { ammo: 0 })] });
  assert.equal(h.warning.textContent, 'EMPTY · Reload');
  h.show({ weapons: [weapon('rocket', { ammo: 0, reserve: 0 })], payloadAmmo: 0 });
  assert.match(h.ammo.status.textContent, /Collect supplies/);
  assert.equal(h.payload.textContent, 'Bomb 0 · Empty · Collect supplies');
  h.show({
    weapons: [weapon('rocket', { ammo: 0, reserve: 0 })],
    servicePad: { x: 0, y: 0, z: 0 },
  });
  assert.match(h.ammo.status.textContent, /Find a service pad/);
  h.show({ weapons: undefined });
  assert.equal(h.ammo.node.hidden, true);
  assert.equal(h.hull.node.hidden, false);
  assert.equal(h.warning.hidden, true);
});

test('HUD is localized, accessible without color, and limits live announcements to categories', (t) => {
  const h = fixture(t);
  h.show({ health: 10 });
  assert.equal(h.root.getAttribute('aria-label'), 'Vitals');
  assert.equal(h.warning.getAttribute('role'), 'status');
  assert.equal(h.warning.getAttribute('aria-live'), 'polite');
  assert.equal(h.warning.getAttribute('aria-atomic'), 'true');
  assert.equal(h.warning.textContent, 'CRITICAL');
  assert.equal(h.hull.meter.getAttribute('role'), 'meter');
  assert.equal(h.hull.meter.getAttribute('aria-valuemin'), '0');
  assert.equal(h.hull.meter.getAttribute('aria-valuemax'), '100');
  assert.equal(h.hull.meter.getAttribute('aria-label'), 'Health');
  assert.equal(h.hull.meter.getAttribute('aria-valuetext'), '10 / 100 · CRITICAL');
  assert.ok(
    h.root
      .querySelectorAll('.combat-vitals__icon')
      .every((node) => node.getAttribute('aria-hidden') === 'true'),
  );
  h.show({ health: 9 });
  assert.equal(h.warning.textContent, 'CRITICAL', 'Every health point is not a new announcement');
  h.show(
    { health: 10, weapons: [weapon('autocannon', { ammo: 0, reloadTicks: 45 })] },
    { locale: 'uk' },
  );
  assert.equal(h.root.getAttribute('aria-label'), 'Стан');
  assert.equal(h.hull.label.textContent, 'Здоров’я');
  assert.equal(h.warning.textContent, 'КРИТИЧНО');
  assert.match(h.ammo.status.textContent, /ПЕРЕЗАРЯДЖЕННЯ/);
  assert.equal(h.reserve.textContent, 'Запас ∞');
  assert.equal(h.payload.textContent, 'Бомба 3');
});

test('repeated accepted snapshots do not churn text nodes or mutate gameplay data', (t) => {
  const h = fixture(t),
    snapshot = state({ health: 75, weapons: [weapon('autocannon', { ammo: 12 })] }, 'paused'),
    before = structuredClone(snapshot),
    options = {
      state: snapshot,
      definition: structuredClone(definition),
      preferences: { vitals: true, playerHealth: 'always' },
    };
  h.update(options);
  const nodes = [h.root, ...h.root.querySelectorAll('*')],
    text = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
  let writes = 0;
  for (const node of nodes)
    Object.defineProperty(node, 'textContent', {
      configurable: true,
      get() {
        return text.get.call(this);
      },
      set(value) {
        writes++;
        text.set.call(this, value);
      },
    });
  for (let i = 0; i < 50; i++) h.update(options);
  assert.equal(writes, 0);
  assert.deepEqual([h.root, ...h.root.querySelectorAll('*')], nodes);
  assert.deepEqual(snapshot, before);
  assert.deepEqual(options.definition, definition);
  assert.deepEqual(options.preferences, { vitals: true, playerHealth: 'always' });
});

test('host feedback caches actual immutable definition values once per flight', async () => {
  const source = await readFile(
      new URL('../../optional-practice/civilian-fpv/world-app.mjs', import.meta.url),
      'utf8',
    ),
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
    queue = [ast];
  let declaration;
  while (queue.length) {
    const node = queue.pop();
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'combatFeedbackDefinition') {
      declaration = node;
      break;
    }
    for (const value of Object.values(node))
      for (const child of Array.isArray(value) ? value : [value])
        if (child?.type) queue.push(child);
  }
  assert.ok(declaration, 'The host must resolve actual session definitions');
  const selected = { payload: 'bomb', ammoPreset: 'balanced', playerDamage: 'normal' },
    context = {
      flight: null,
      encounterSelection: selected,
      combatFeedbackDefinitions: new WeakMap(),
    },
    feedback = new Function(
      'state',
      `with (state) { return (${source.slice(declaration.start, declaration.end)}); }`,
    )(context),
    firstDefinition = {
      payload: 'remote',
      ammoPreset: 'tactical',
      playerDamage: 'invulnerable',
      actors: [{ id: 'irrelevant-large-definition-data' }],
    };
  let firstReads = 0,
    secondReads = 0;
  const first = {
    combatDefinition() {
      firstReads++;
      return structuredClone(firstDefinition);
    },
  };
  assert.equal(feedback(), selected, 'Without an active flight the selected loadout is used');
  context.flight = first;
  const cached = feedback();
  assert.deepEqual(cached, {
    payload: 'remote',
    ammoPreset: 'tactical',
    playerDamage: 'invulnerable',
  });
  for (let i = 0; i < 50; i++) assert.equal(feedback(), cached);
  assert.equal(firstReads, 1, 'HUD frames must not clone the full session definition repeatedly');
  assert.equal('actors' in cached, false);
  context.flight = {
    combatDefinition() {
      secondReads++;
      return { payload: 'drone', ammoPreset: 'arcade', playerDamage: 'normal' };
    },
  };
  assert.deepEqual(feedback(), { payload: 'drone', ammoPreset: 'arcade', playerDamage: 'normal' });
  feedback();
  assert.equal(secondReads, 1, 'A changed flight must read its own immutable loadout');
  context.flight = first;
  assert.equal(feedback(), cached);
  assert.equal(firstReads, 1);
  context.flight = {};
  assert.equal(
    feedback(),
    selected,
    'Original-course sessions retain selected preference fallback',
  );
});

test('all combat activities keep vitals independent of summary visibility and health preferences', (t) => {
  const h = fixture(t);
  for (const activity of ENCOUNTER_ACTIVITIES.filter((value) => value !== 'original')) {
    const snapshot = state({ activity, health: 82, weapons: [weapon('autocannon', { ammo: 13 })] }),
      options = {
        state: snapshot,
        definition: { ...definition, activity },
        preferences: { hud: false, vitals: true, playerHealth: 'always' },
      };
    h.show({}, options);
    assert.equal(h.root.hidden, false, activity);
    assert.equal(h.hull.value.textContent, '82', activity);
    assert.equal(h.ammo.value.textContent, '13', activity);
    h.show({}, { ...options, visible: false });
    assert.equal(h.root.hidden, true, `${activity}: menus/results suppress the panel`);
    h.show({}, { ...options, state: { ...snapshot, status: 'paused' } });
    assert.equal(
      h.root.hidden,
      false,
      `${activity}: unobstructed pause/replay keeps frozen values`,
    );
    assert.equal(h.ammo.value.textContent, '13', activity);
    h.show({}, { ...options, preferences: { vitals: true, playerHealth: 'off' } });
    assert.equal(h.hull.node.hidden, true, activity);
    assert.equal(h.ammo.node.hidden, false, `${activity}: health Off cannot hide ammunition`);
  }
  h.show({}, { state: { status: 'active' } });
  assert.equal(h.root.hidden, true, 'Original courses have no combat overlay');
});

test('canonical vitals styling positions the panel above the canvas and belongs to the projection source', async () => {
  const [css, generator] = await Promise.all([
      readFile(
        new URL('../../optional-practice/civilian-fpv/flight-fullscreen.css', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../../scripts/refresh-fpv-presentation-assets.mjs', import.meta.url),
        'utf8',
      ),
    ]),
    block = (selector) => {
      const start = css.indexOf(`${selector} {`);
      assert.ok(start >= 0, `Missing canonical style: ${selector}`);
      return css.slice(start, css.indexOf('}', start) + 1);
    },
    root = block('html body #world-viewport > .combat-vitals'),
    icon = block('html body #world-viewport .combat-vitals__icon'),
    fill = block('html body #world-viewport .combat-vitals__fill');
  assert.match(root, /position:\s*absolute/);
  assert.match(root, /inset:\s*auto auto max\(9%, env\(safe-area-inset-bottom, 0px\)\) 50%/);
  assert.match(root, /z-index:\s*6/);
  assert.match(root, /pointer-events:\s*none/);
  assert.match(root, /width:\s*min\(400px, calc\(100% - 24px\)\)/);
  assert.match(icon, /width:\s*20px/);
  assert.match(icon, /height:\s*20px/);
  assert.match(fill, /display:\s*block/);
  assert.match(fill, /transform-origin:\s*left center/);
  assert.match(css, /\.combat-vitals \[hidden\],[\s\S]*?display:\s*none !important/);
  assert.match(css, /:has\(\.world-touch:not\(\[hidden\]\)\)[^{]*\{\s*--combat-vitals-floor:/);
  assert.match(
    css,
    /@media \(min-width: 600px\) and \(max-width: 1100px\) and \(max-height: 480px\)/,
  );
  assert.match(css, /\.combat-vitals\[data-health-hidden='true'\]/);
  assert.doesNotMatch(root, /props|survival|activity/);
  assert.match(
    generator,
    /\['FULLSCREEN', 'optional-practice\/civilian-fpv\/flight-fullscreen\.css', 'end'\]/,
    'Packaging takes the vitals rules from this canonical sheet',
  );
});

test('vitals SVG icons retain a bounded intrinsic size before styles load', (t) => {
  const h = fixture(t);
  h.show();
  assert.ok(
    h.root
      .querySelectorAll('.combat-vitals__icon')
      .every((node) => node.getAttribute('width') === '20' && node.getAttribute('height') === '20'),
  );
});

test('ready and paused combat keep Resume in its own row above variable-height vitals', async () => {
  const css = await readFile(
    new URL('../../optional-practice/civilian-fpv/flight-fullscreen.css', import.meta.url),
    'utf8',
  );
  const start = css.indexOf('/* Only ready/paused combat uses two content-sized rows.');
  const end = css.indexOf('html body .fpv-menu-editor__actions', start);
  assert.ok(start >= 0 && end > start);
  const rules = css.slice(start, end).replace(/\s+/g, ' ');
  const guardedHost =
    "#flight-dialog:not([data-flight-state='active'], [data-flight-state='complete'], [data-flight-state='failed']) #world-viewport:has(> .combat-vitals:not([hidden]))";
  const selectors = [...rules.matchAll(/html body #flight-dialog[^{}]+\{/g)].map((match) =>
    match[0].replace(':not( ', ':not(').replace("'] )", "'])"),
  );
  assert.equal(selectors.length, 9);
  assert.ok(
    selectors.every((selector) => selector.includes(guardedHost)),
    'Layout changes require visible combat vitals and a non-active, non-terminal flight',
  );
  assert.match(
    rules,
    /grid-template-rows: minmax\(0, 1fr\) auto auto var\(--combat-vitals-floor\)/,
  );
  assert.match(rules, /> \.handheld-flight-actions \{ display: contents;/);
  assert.match(
    rules,
    /> \.handheld-flight-actions > \.handheld-flight-resume \{[^}]*grid-area: 2 \/ 1;[^}]*margin: 0 0 12px/,
  );
  assert.match(rules, /> \.combat-vitals \{[^}]*grid-area: 3 \/ 1;/);
  assert.match(rules, /> canvas \{ position: absolute; inset: 0;/);
  assert.match(
    rules,
    /> \.enemy-stats\[data-variant='hud'\] \{ display: none;/,
    'The old flow counter cannot create an extra row; collection/results stay untouched',
  );
  assert.match(
    rules,
    /grid-template-rows: max\(60px, env\(safe-area-inset-top, 0px\)\) auto auto minmax\(0, 1fr\)/,
  );
  assert.match(
    rules,
    /> \.handheld-flight-actions > \.handheld-flight-resume \{ grid-area: 2 \/ 2;/,
  );
  assert.match(rules, /> \.combat-vitals \{ grid-area: 3 \/ 2; width: 100%;/);
  assert.doesNotMatch(
    rules,
    /(?:^|[;{])\s*(?:max-)?height:|overflow:|display: (?:block|inline-flex)/,
    'No fixed panel height, clipping, or override of resume visibility',
  );
});
