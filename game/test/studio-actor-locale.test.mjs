import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, render, setLocale } from '../i18n/index.mjs';
import * as catalogs from '../content-design/catalogs.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createActorEditor } from '../studio/actor-editor.mjs';
import { actorCounterplay, actorEditorCopy, actorRoleName } from '../studio/actor-copy.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('actor presentation covers every pinned role and timing without altering catalog facts', () => {
  const previous = getLocale();
  try {
    for (const catalog of Object.values(catalogs).filter(
      (item) => item?.format === 'ActorCatalogV1',
    )) {
      const original = JSON.stringify(catalog);
      for (const [roleId, role] of Object.entries(catalog.roles)) {
        setLocale('en', { persist: false });
        assert.equal(
          actorCounterplay(roleId),
          role.counterplay,
          `${catalog.id}/${roleId} needs an updated translation`,
        );
        for (const difficultyCatalogId of ['journey-difficulty-v1', 'journey-difficulty-v2'])
          for (const difficulty of ['gentle', 'standard', 'expert'])
            for (const combatEnabled of role.combatRole ? [false, true] : [false]) {
              const copy = actorEditorCopy({
                roleId,
                actorCatalogId: catalog.id,
                difficultyCatalogId,
                difficulty,
                combatEnabled,
              });
              const values = copy.options.map(([id]) => id);
              for (const locale of ['en', 'uk']) {
                setLocale(locale, { persist: false });
                const text = [
                  actorRoleName(roleId),
                  copy.description(),
                  render(copy.positionHelp),
                  render(copy.tierLabel),
                  ...copy.options.map(([, label]) => render(label)),
                ].join('\n');
                assert.doesNotMatch(
                  text,
                  /tools:|content:|interface:|undefined|NaN/,
                  `${catalog.id}/${roleId}/${locale}`,
                );
                if (locale === 'uk') {
                  assert(!text.includes(role.counterplay));
                  assert.doesNotMatch(
                    text,
                    /warning|cells\/s|retains field|Start in|Inactive authored/,
                  );
                }
              }
              assert.deepEqual(
                copy.options.map(([id]) => id),
                values,
              );
            }
      }
      assert.equal(JSON.stringify(catalog), original);
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});

function fixture() {
  const document = new Document();
  for (const id of [
    'tools',
    'select',
    'id',
    'role',
    'tier',
    'tier-label',
    'x',
    'y',
    'position-help',
    'description',
    'heading',
    'edge',
    'clockwise',
    'axis',
    'heading-row',
    'edge-row',
    'clockwise-row',
    'axis-row',
    'submit',
    'remove',
    'result',
    'form',
  ]) {
    const node = document.createElement(
      ['select', 'role', 'tier'].includes(id)
        ? 'select'
        : ['id', 'x', 'y'].includes(id)
          ? 'input'
          : 'div',
    );
    node.id = `actor-${id}`;
    document.body.append(node);
  }
  let source = createStarterProject(),
    reads = 0,
    writes = 0;
  const editor = createActorEditor({
    document,
    getSource: () => {
      reads++;
      return source;
    },
    getMission: () => {
      reads++;
      return source.missions[0];
    },
    getDifficulty: () => 'expert',
    apply(next) {
      source = next;
      writes++;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  const node = (id) => document.getElementById(`actor-${id}`);
  // The minimal DOM fixture selects the first nonempty option; explicitly
  // choose the browser's initial blank-valued "New actor" option here.
  node('select').value = '';
  node('select').onchange();
  return {
    document,
    node,
    source: () => source,
    reads: () => reads,
    writes: () => writes,
    submit: () => node('form').onsubmit({ preventDefault() {} }),
  };
}

test('live actor labels preserve unsaved role, tier, coordinates, focus and canonical source', () => {
  const previous = getLocale();
  const f = fixture();
  f.node('id').value = 'my-new-actor';
  f.node('role').value = 'frontier-patrol';
  f.node('role').onchange();
  f.node('tier').value = 'brisk';
  f.node('x').value = '30';
  f.node('y').value = '14';
  f.node('id').selectionStart = 3;
  f.node('id').selectionEnd = 7;
  f.node('id').focus();
  const options = [...f.node('tier').options];
  const reads = f.reads();
  const before = JSON.stringify(f.source());
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(f.reads(), reads);
      assert.equal(f.writes(), 0);
      assert.equal(f.node('id').value, 'my-new-actor');
      assert.equal(f.node('role').value, 'frontier-patrol');
      assert.equal(f.node('tier').value, 'brisk');
      assert.equal(f.node('x').value, '30');
      assert.equal(f.node('y').value, '14');
      assert.equal(f.document.activeElement, f.node('id'));
      assert.equal(f.node('id').selectionStart, 3);
      assert.equal(f.node('id').selectionEnd, 7);
      assert.deepEqual([...f.node('tier').options], options);
      assert.match(
        f.node('position-help').textContent,
        locale === 'uk' ? /Ціла клітина поля/ : /Integer field cell/,
      );
    }
    f.node('id').value = 'INVALID ID';
    f.submit();
    assert.match(f.node('result').textContent, /Укажи сталий ID персонажа/);
    setLocale('en', { persist: false });
    assert.equal(f.node('result').textContent, 'Not applied: Give the actor a stable ID.');
    assert.equal(JSON.stringify(f.source()), before);
    assert.equal(f.writes(), 0);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('actor removal remains a two-action operation across locale changes', () => {
  const previous = getLocale();
  const f = fixture();
  try {
    f.node('id').value = 'extra';
    f.node('x').value = '10.5';
    f.node('y').value = '10.5';
    f.submit();
    assert.equal(f.source().missions[0].actors.length, 2, f.node('result').textContent);
    f.node('remove').onclick();
    const before = JSON.stringify(f.source());
    const reads = f.reads();
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(f.reads(), reads);
      assert.equal(f.writes(), 1);
      assert.match(
        f.node('remove').textContent,
        locale === 'uk' ? /Підтвердити видалення extra/ : /Confirm remove extra/,
      );
      assert.equal(JSON.stringify(f.source()), before);
    }
    f.node('remove').onclick();
    assert.equal(f.source().missions[0].actors.length, 1);
    assert.equal(f.writes(), 2);
  } finally {
    setLocale(previous, { persist: false });
  }
});
