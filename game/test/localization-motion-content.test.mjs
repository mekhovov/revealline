import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  freezeMotionPresets,
  motionText,
  motionTargetText,
} from '../../authoring/motion-lab/copy.mjs';
import { describeAbilityLabels } from '../../authoring/motion-lab/ability-labels.mjs';
import { createAbilityState } from '../../authoring/motion-lab/ability.mjs';
import { setLocale, getLocale } from '../i18n/index.mjs';

const load = async (name) =>
  JSON.parse(
    await readFile(new URL(`../../authoring/motion-lab/${name}.json`, import.meta.url), 'utf8'),
  );

test('Motion first-party fields translate through immutable identities without changing definitions or state', async () => {
  const previous = getLocale();
  const visuals = await load('presets');
  const collection = await load('collection-presets');
  const ability = await load('ability-presets');
  const sourceBytes = JSON.stringify([visuals, collection, ability]);
  [visuals, collection, ability].forEach((value) => freezeMotionPresets(value));
  const state = createAbilityState(ability);
  const stateBytes = JSON.stringify(state);
  try {
    setLocale('uk', { persist: false });
    assert.equal(
      motionText(collection, collection.contexts[0], 'label'),
      'Фронт FPV · перший політ',
    );
    assert.equal(
      motionText(ability, ability.vocabulary['fpv-front'], 'classLabels.scout'),
      'Розвідник',
    );
    assert.match(
      motionText(visuals, visuals.characters['fpv-body'], 'sourceStatus'),
      /^Концептуальний корпус/,
    );
    const labels = describeAbilityLabels(state, ability, 'fpv-front');
    assert.equal(labels.find((row) => row.key === 'haze:0').text, 'Штучна радіозавада');
    assert.equal(labels.find((row) => row.key === 'target:tile-a').text, 'Плитка A');
    const note = state.targets.find((target) => target.kind === 'note');
    assert.equal(labels.find((row) => row.key === `target:${note.id}`).canvasText, '?');
    assert.doesNotMatch(JSON.stringify(labels), /Нотатка маршруту|Route note/);
    assert.equal(JSON.stringify(state), stateBytes);
    assert.equal(JSON.stringify([visuals, collection, ability]), sourceBytes);
    assert.equal(motionTargetText(ability, { ...note, revealedUntil: 3 }), 'Нотатка маршруту');
    assert.equal(
      motionTargetText(ability, { ...note, label: 'My authored note' }),
      'My authored note',
    );
    setLocale('en', { persist: false });
    assert.equal(
      motionText(collection, collection.contexts[0], 'label'),
      'FPV Front · first flight',
    );
    assert.equal(motionTargetText(ability, note), note.label);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('a changed Motion definition keeps all authored child copy, including same-named presets', async () => {
  const previous = getLocale();
  const custom = await load('ability-presets');
  custom.description = 'My custom ability study';
  freezeMotionPresets(custom);
  try {
    setLocale('uk', { persist: false });
    assert.equal(motionText(custom, custom.vocabulary['fpv-front'], 'classLabels.scout'), 'Scout');
    assert.equal(motionTargetText(custom, custom.stage.targets[0]), 'Route note');
    assert.equal(
      motionText(custom, custom.classes[0], 'description'),
      custom.classes[0].description,
    );
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('Motion counters use Ukrainian plural forms and decimal formatting', async () => {
  const { t: translate } = await import('../i18n/index.mjs');
  const previous = getLocale();
  try {
    setLocale('uk', { persist: false });
    for (const [count, number, marker, note, charge] of [
      [0, '0', 'маркерів', 'нотаток', 'зарядів'],
      [1, '1', 'маркер', 'нотатку', 'заряд'],
      [2, '2', 'маркери', 'нотатки', 'заряди'],
      [5, '5', 'маркерів', 'нотаток', 'зарядів'],
      [11, '11', 'маркерів', 'нотаток', 'зарядів'],
      [21, '21', 'маркер', 'нотатку', 'заряд'],
      [22, '22', 'маркери', 'нотатки', 'заряди'],
      [1.5, '1,5', 'маркера', 'нотатки', 'заряду'],
    ]) {
      assert.equal(
        translate('tools:motionLab.markersUpdated', { count }),
        `Оновлено ${number} ${marker}`,
      );
      assert.equal(translate('tools:motionLab.notesVisible', { count }), `Видно ${number} ${note}`);
      assert.equal(
        translate('tools:motionLab.charges', { count, ammo: 0 }),
        `0/${number} ${charge}`,
      );
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});
