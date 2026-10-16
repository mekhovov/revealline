import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { editContentBonus } from '../content-design/bonuses.mjs';
import { createBonusEditor } from '../studio/bonus-editor.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture() {
  const document = new Document();
  for (const id of [
    'kind',
    'select',
    'tools',
    'id',
    'x',
    'y',
    'remove',
    'submit',
    'result',
    'qualification',
    'form',
  ]) {
    const node = document.createElement(
      ['kind', 'select'].includes(id) ? 'select' : ['id', 'x', 'y'].includes(id) ? 'input' : 'div',
    );
    node.id = `bonus-${id}`;
    document.body.append(node);
  }
  let source = createStarterProject(),
    reads = 0,
    writes = 0;
  const editor = createBonusEditor({
    document,
    getSource: () => {
      reads++;
      return source;
    },
    getMission: () => {
      reads++;
      return source.missions[0];
    },
    apply: (next) => {
      source = next;
      writes++;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  const node = (id) => document.getElementById(`bonus-${id}`);
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

test('bonus labels change without re-reading the draft, resetting input or writing checkpoints', () => {
  const previous = getLocale();
  const f = fixture();
  const before = JSON.stringify(f.source());
  f.node('id').value = 'my-bonus';
  f.node('kind').value = 'enemy-freeze';
  f.node('x').value = '20.5';
  f.node('x').selectionStart = 2;
  f.node('x').selectionEnd = 4;
  f.node('x').focus();
  const nodes = [...f.node('kind').options];
  const reads = f.reads();
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(f.node('id').value, 'my-bonus');
      assert.equal(f.node('kind').value, 'enemy-freeze');
      assert.equal(f.node('x').value, '20.5');
      assert.equal(f.node('x').selectionStart, 2);
      assert.equal(f.node('x').selectionEnd, 4);
      assert.equal(f.document.activeElement, f.node('x'));
      assert.deepEqual([...f.node('kind').options], nodes);
      assert.match(f.node('submit').textContent, locale === 'uk' ? /додати бонус/ : /add bonus/);
      assert.equal(f.reads(), reads);
      assert.equal(f.writes(), 0);
    }
    f.submit();
    assert.match(f.node('result').textContent, /Введи обидві координати/);
    setLocale('en', { persist: false });
    assert.equal(f.node('result').textContent, 'Not applied: Enter both cell-centre coordinates.');
    assert.equal(JSON.stringify(f.source()), before);
    assert.equal(f.writes(), 0);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('bonus validation feedback and pending two-action removal survive locale switches', () => {
  const previous = getLocale();
  const f = fixture();
  try {
    setLocale('uk', { persist: false });
    f.node('id').value = 'detour';
    f.node('x').value = '20.5';
    f.node('y').value = '0.5';
    f.submit();
    assert.equal(f.source().missions[0].bonuses.length, 1);
    assert.match(f.node('result').textContent, /Застосовано до локальної чернетки/);
    const before = JSON.stringify(f.source());
    f.node('select').value = '';
    f.node('select').onchange();
    f.node('id').value = 'detour';
    f.node('x').value = '20.5';
    f.node('y').value = '0.5';
    f.submit();
    assert.match(f.node('result').textContent, /Такий ID бонусу вже існує/);
    setLocale('en', { persist: false });
    assert.equal(f.node('result').textContent, 'Not applied: That bonus ID already exists.');
    assert.equal(JSON.stringify(f.source()), before);
    assert.equal(f.writes(), 1);
    f.node('select').value = 'detour';
    f.node('select').onchange();
    f.node('remove').onclick();
    const reads = f.reads();
    setLocale('uk', { persist: false });
    assert.equal(f.reads(), reads);
    assert.equal(f.writes(), 1);
    assert.equal(f.node('remove').textContent, 'Підтвердити видалення бонусу');
    assert.equal(JSON.stringify(f.source()), before);
    f.node('remove').onclick();
    assert.equal(f.source().missions[0].bonuses.length, 0);
    assert.equal(f.writes(), 2);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('authoring validation retains canonical English errors and supplies explicit UI message descriptors', () => {
  const previous = getLocale();
  const source = createStarterProject();
  const before = JSON.stringify(source);
  try {
    setLocale('uk', { persist: false });
    for (const [command, message, key] of [
      [{ action: 'unknown' }, 'Choose a bonus operation.', 'errors:studio.bonus.operation'],
      [
        { action: 'remove', id: 'INVALID ID' },
        'Give the bonus a stable ID.',
        'errors:studio.bonus.stableId',
      ],
      [
        { action: 'remove', id: 'absent' },
        'Choose an existing bonus.',
        'errors:studio.bonus.existing',
      ],
      [
        { action: 'add', id: 'one', bonus: { id: 'two' } },
        'Bonus identity must match the command.',
        'errors:studio.bonus.identity',
      ],
    ]) {
      assert.throws(
        () => editContentBonus(source, 'nearby-shore', command),
        (error) => {
          assert(error instanceof TypeError);
          assert.equal(error.message, message);
          assert.equal(error.localization.key, key);
          assert(Object.isFrozen(error.localization));
          assert(Object.isFrozen(error.localization.values));
          return true;
        },
      );
    }
    assert.equal(JSON.stringify(source), before);
  } finally {
    setLocale(previous, { persist: false });
  }
});
