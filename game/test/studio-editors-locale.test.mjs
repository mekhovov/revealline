import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { editTimedBonus } from '../content-design/timed-bonuses.mjs';
import { editContentObjective } from '../content-design/objectives.mjs';
import { editContentDirectional } from '../content-design/directional.mjs';
import { editContentRelay } from '../content-design/relays.mjs';
import { editContentGeometry } from '../content-design/geometry-edit.mjs';
import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';
import { createTimedBonusEditor } from '../studio/timed-bonus-editor.mjs';
import { createCombatEditor } from '../studio/combat-editor.mjs';
import { createObjectiveEditor } from '../studio/objective-editor.mjs';
import { createDirectionalEditor } from '../studio/directional-editor.mjs';
import { createRelayEditor } from '../studio/relay-editor.mjs';
import { createGeometryEditor } from '../studio/geometry-editor.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { createEncounterEditor } from '../studio/encounter-editor.mjs';
import { sentinelProjectFixture } from './helpers/sentinel-project.mjs';

const mapFor = (p) =>
  p.maps.find((m) => m.id === p.missions[0].map.id && m.revision === p.missions[0].map.revision);
const command = (p, action, rest = {}) => ({
  action,
  expectedMap: dataIdentity(mapFor(p)),
  expectedMission: dataIdentity(p.missions[0]),
  ...rest,
});
function populatedSource() {
  let p = createStarterProject();
  p.missions[0].objectives = [
    { id: 'trigger', x: 20.5, y: 10.5, required: true, hidden: false },
    { id: 'optional', x: 22.5, y: 12.5, required: false, hidden: false },
  ];
  p = editContentRelay(p, 'nearby-shore', command(p, 'enable'));
  p = editContentRelay(
    p,
    'nearby-shore',
    command(p, 'add', {
      id: 'shortcut',
      gate: { x: 40, y: 10, w: 2, h: 3, objectiveId: 'trigger' },
    }),
  );
  p = editContentDirectional(p, 'nearby-shore', command(p, 'enable'));
  p = editContentDirectional(
    p,
    'nearby-shore',
    command(p, 'add', { id: 'lane', zone: { x: 10, y: 2, w: 5, h: 8, direction: 'down' } }),
  );
  p = editTimedBonus(p, 'nearby-shore', {
    action: 'add',
    id: 'window',
    schedule: {
      id: 'window',
      kind: 'enemy-slow',
      anchors: [
        { x: 8.5, y: 8.5 },
        { x: 24.5, y: 8.5 },
      ],
      initialDelayTicks: 0,
      announcementTicks: 120,
      availableTicks: 1200,
      cooldownTicks: 1440,
      maxAppearances: 3,
      maxCollections: 2,
    },
  });
  return prepareCombatAuthoring(p, 'nearby-shore');
}
const initial = populatedSource();
const cases = [
  {
    prefix: 'timed-bonus',
    create: createTimedBonusEditor,
    fields:
      'kind select tools id anchors delay announce available cooldown appearances collections remove submit result form',
    selected: 'window',
    field: 'anchors',
    emptyError: 'errors:studio.timed.anchors',
    confirm: 'tools:studio.timed.confirmRemove',
    count: (p) => p.missions[0].timedBonuses?.schedules.length ?? 0,
  },
  {
    prefix: 'objective',
    create: createObjectiveEditor,
    fields: 'select tools id x y required hidden remove submit result qualification form',
    selected: 'optional',
    field: 'x',
    emptyError: 'errors:studio.cellCentreCoordinates',
    confirm: 'tools:studio.objective.confirmRemove',
    count: (p) => p.missions[0].objectives.length,
  },
  {
    prefix: 'directional',
    create: createDirectionalEditor,
    fields: 'enable tools qualification select id x y w h direction remove submit result form',
    selected: 'lane',
    field: 'x',
    emptyError: 'errors:studio.wholeRectangleCoordinates',
    confirm: 'tools:studio.directional.confirmRemove',
    count: (p) => mapFor(p).speedZones.length,
  },
  {
    prefix: 'relay',
    create: createRelayEditor,
    fields: 'enable tools qualification select id x y w h objective remove submit result form',
    selected: 'shortcut',
    field: 'x',
    emptyError: 'errors:studio.wholeRectangleCoordinates',
    confirm: 'tools:studio.relay.confirmRemove',
    count: (p) => mapFor(p).gates.length,
  },
  {
    prefix: 'geometry-edit',
    create: createGeometryEditor,
    fields: 'tools select x y w h kind kind-row remove submit result form',
    selected: 'foundations:0',
    field: 'x',
    emptyError: 'errors:studio.rectangleCoordinates',
    confirm: 'tools:studio.rectangle.confirmRemove',
    count: (p) => mapFor(p).foundations.length,
  },
];
function fixture(config, initialSource = initial) {
  const document = new Document();
  for (const id of config.fields.split(' ')) {
    const node = document.createElement(
      [
        'select',
        'kind',
        'direction',
        'objective',
        'core',
        'shield-0',
        'shield-1',
        'shield-2',
        'shield-3',
      ].includes(id)
        ? 'select'
        : ['form'].includes(id)
          ? 'form'
          : 'input',
    );
    node.id = `${config.prefix}-${id}`;
    document.body.append(node);
  }
  let source = structuredClone(initialSource),
    reads = 0,
    writes = 0;
  const editor = config.create({
    document,
    getSource() {
      reads++;
      return source;
    },
    getMission() {
      reads++;
      return source.missions[0];
    },
    apply(next) {
      source = next;
      writes++;
      editor.sync();
      return true;
    },
  });
  const node = (id) => document.getElementById(`${config.prefix}-${id}`);
  editor.sync();
  if (config.selected) {
    node('select').value = config.selected;
    node('select').onchange();
  }
  return {
    document,
    node,
    editor,
    source: () => source,
    reads: () => reads,
    writes: () => writes,
    submit: () => node('form').onsubmit({ preventDefault() {} }),
  };
}
for (const config of cases)
  test(`${config.prefix} switches existing options, validation and armed removal without touching pending fields or draft`, () => {
    const previous = getLocale(),
      f = fixture(config),
      before = JSON.stringify(f.source());
    try {
      f.node(config.field).value = 'draft input';
      f.node(config.field).selectionStart = 2;
      f.node(config.field).selectionEnd = 5;
      f.node(config.field).focus();
      f.node('form').scrollTop = 37;
      const options = [...f.node('select').options],
        reads = f.reads();
      for (const locale of ['uk', 'en', 'uk']) {
        setLocale(locale, { persist: false });
        assert.equal(f.node(config.field).value, 'draft input');
        assert.equal(f.node(config.field).selectionStart, 2);
        assert.equal(f.node(config.field).selectionEnd, 5);
        assert.equal(f.document.activeElement, f.node(config.field));
        assert.equal(f.node('form').scrollTop, 37);
        assert.equal(f.node('select').value, config.selected);
        assert.deepEqual([...f.node('select').options], options);
        assert.equal(f.reads(), reads);
        assert.equal(f.writes(), 0);
        assert.equal(JSON.stringify(f.source()), before);
        assert.match(
          f.node('result').textContent,
          locale === 'uk' ? /[А-ЯІЇЄҐа-яіїєґ]/ : /[A-Za-z]/,
        );
      }
      f.node(config.field).value = '';
      f.submit();
      const errorReads = f.reads();
      for (const locale of ['en', 'uk']) {
        setLocale(locale, { persist: false });
        assert.equal(
          f.node('result').textContent,
          t('tools:studio.editor.notApplied', { message: t(config.emptyError) }),
        );
        assert.equal(f.reads(), errorReads);
      }
      assert.equal(f.writes(), 0);
      assert.equal(JSON.stringify(f.source()), before);
      f.node('select').onchange();
      f.node('remove').onclick();
      const armedReads = f.reads(),
        count = config.count(f.source());
      for (const locale of ['en', 'uk']) {
        setLocale(locale, { persist: false });
        assert.equal(f.node('remove').textContent, t(config.confirm));
        assert.equal(f.reads(), armedReads);
        assert.equal(f.writes(), 0);
      }
      f.node('remove').onclick();
      assert.equal(f.writes(), 1, f.node('result').textContent);
      assert.equal(config.count(f.source()), count - 1);
    } finally {
      f.editor.destroy?.();
      setLocale(previous, { persist: false });
    }
  });

test('combat localization describes the accepted edition while preserving an unapplied checkbox', () => {
  const previous = getLocale(),
    f = fixture({
      prefix: 'combat',
      create: createCombatEditor,
      fields: 'tools prepare enabled apply state result',
    }),
    before = JSON.stringify(f.source());
  try {
    f.node('enabled').checked = true;
    f.node('enabled').onchange();
    f.node('enabled').focus();
    const reads = f.reads();
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(f.node('state').textContent, t('tools:studio.combat.disabled'));
      assert.equal(f.node('result').textContent, t('tools:studio.combat.unapplied'));
      assert.equal(f.node('enabled').checked, true);
      assert.equal(f.document.activeElement, f.node('enabled'));
      assert.equal(f.reads(), reads);
      assert.equal(f.writes(), 0);
      assert.equal(JSON.stringify(f.source()), before);
    }
    f.node('apply').onclick();
    assert.equal(f.writes(), 1);
    assert.equal(f.source().missions[0].combat.enabled, true);
    assert.equal(f.node('state').textContent, t('tools:studio.combat.enabled'));
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('all six models keep canonical error text and carry hidden immutable localized diagnostics', () => {
  const previous = getLocale(),
    before = JSON.stringify(initial);
  const checks = [
    [
      () => editTimedBonus(initial, 'nearby-shore', { action: 'remove', id: 'BAD ID' }),
      'Give the schedule a stable ID.',
      'errors:studio.timed.stableId',
    ],
    [
      () => editContentObjective(initial, 'nearby-shore', { action: 'remove', id: 'absent' }),
      'Choose an existing objective.',
      'errors:studio.objective.existing',
    ],
    [
      () =>
        editContentDirectional(
          initial,
          'nearby-shore',
          command(initial, 'remove', { id: 'absent' }),
        ),
      'Choose an existing field.',
      'errors:studio.directional.existing',
    ],
    [
      () => editContentRelay(initial, 'nearby-shore', command(initial, 'remove', { id: 'absent' })),
      'Choose an existing gate.',
      'errors:studio.relay.existing',
    ],
    [
      () =>
        editContentGeometry(initial, 'nearby-shore', {
          action: 'remove',
          surface: 'foundations',
          index: 99,
          expectedMap: dataIdentity(mapFor(initial)),
        }),
      'Choose an existing rectangle.',
      'errors:studio.rectangle.existing',
    ],
    [
      () => setMissionCombatEnabled(initial, 'nearby-shore', 'true'),
      'Combat enabled must be an explicit boolean.',
      'errors:studio.combat.enabledBoolean',
    ],
    [
      () => editContentObjective(initial, 'nearby-shore', { action: 'remove', id: 'trigger' }),
      'Objective controls relay gates: shortcut. Relink or remove those gates first.',
      'errors:studio.objective.linkedGates',
    ],
  ];
  try {
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      for (const [run, message, key] of checks)
        assert.throws(run, (error) => {
          assert(error instanceof TypeError);
          assert.equal(error.message, message);
          assert.equal(error.localization.key, key);
          assert(Object.isFrozen(error.localization));
          assert(Object.isFrozen(error.localization.values));
          assert(!Object.keys(error).includes('localization'));
          const translated = t(key, error.localization.values);
          if (locale === 'uk') {
            assert.notEqual(translated, message);
            assert.match(translated, /[А-ЯІЇЄҐа-яіїєґ]/);
          } else assert.equal(translated, message);
          return true;
        });
    }
    assert.equal(JSON.stringify(initial), before);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('Sentinel selectors, model failures and armed removal switch without altering the encounter', () => {
  const previous = getLocale();
  const f = fixture(
    {
      prefix: 'sentinel',
      create: createEncounterEditor,
      fields:
        'tools qualification core shield-0 shield-1 shield-2 shield-3 enemy submit remove result form',
    },
    sentinelProjectFixture(),
  );
  const before = JSON.stringify(f.source());
  try {
    f.node('shield-1').value = '';
    f.node('core').focus();
    const options = [...f.node('core').options],
      reads = f.reads();
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(f.node('core').value, 'core');
      assert.equal(f.node('shield-1').value, '');
      assert.equal(f.document.activeElement, f.node('core'));
      assert.deepEqual([...f.node('core').options], options);
      assert.equal(options[0].textContent, t('tools:studio.encounter.core'));
      assert.equal(f.node('qualification').textContent, t('tools:studio.encounter.qualification'));
      assert.equal(f.reads(), reads);
      assert.equal(f.writes(), 0);
      assert.equal(JSON.stringify(f.source()), before);
    }
    f.node('core').value = '';
    f.submit();
    const errorReads = f.reads();
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(
        f.node('result').textContent,
        t('tools:studio.editor.notApplied', { message: t('errors:studio.encounter.core') }),
      );
      assert.equal(f.reads(), errorReads);
      assert.equal(f.writes(), 0);
    }
    f.node('remove').onclick();
    const armedReads = f.reads();
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(f.node('remove').textContent, t('tools:studio.encounter.confirmRemove'));
      assert.equal(f.reads(), armedReads);
      assert.equal(f.writes(), 0);
      assert.equal(JSON.stringify(f.source()), before);
    }
    const geometry = structuredClone(f.source().maps),
      objectives = structuredClone(f.source().missions[0].objectives);
    f.node('remove').onclick();
    assert.equal(f.writes(), 1, f.node('result').textContent);
    assert.equal(f.source().missions[0].encounter, null);
    assert.deepEqual(f.source().maps, geometry);
    assert.deepEqual(f.source().missions[0].objectives, objectives);
  } finally {
    setLocale(previous, { persist: false });
  }
});
