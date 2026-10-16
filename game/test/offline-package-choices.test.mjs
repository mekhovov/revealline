import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  attachOfflinePackageChoice,
  syncOfflinePackageChoices,
} from '../ui/offline-package-choices.mjs';
import { gameplaySelection } from '../offline-download-session.mjs';
import { addOfflineExperiences } from '../../scripts/offline-experiences.mjs';
import { downloadFiles } from '../download-catalogue.mjs';

function fixture() {
  const document = new Document(),
    selected = new Set(),
    inputs = [];
  const allInput = document.createElement('input');
  allInput.type = 'checkbox';
  document.body.append(allInput);
  const file = {
    path: 'game/audio/effects/rotor.wav',
    sha256: 'a'.repeat(64),
    bytes: 4,
    kind: 'gameplay',
  };
  const group = (id, extra = {}) => ({
    id,
    title: id,
    kind: 'gameplay',
    modes: [],
    requires: [],
    files: [],
    ...extra,
  });
  const catalogue = {
    format: 'revealline-offline-content.v2',
    groups: [
      group('base'),
      group('shared'),
      group('runtime:team', { category: 'mode' }),
      group('extras:spatial-audio', { current: false, category: 'extra', files: [file.path] }),
      group('extras:sim-fpv', { current: false, category: 'experience' }),
      group('company:one'),
      group('community:one', { current: false, category: 'community', requires: ['company:one'] }),
    ],
    files: [file],
  };
  addOfflineExperiences(
    catalogue.groups,
    catalogue.files,
    [],
    new Set([
      'game/overflight/play.html',
      'game/overflight/raid.html',
      'game/snake/play.html',
      'game/snake/index.html',
    ]),
  );
  let changes = 0,
    enabled = true;
  const sync = () => syncOfflinePackageChoices({ catalogue, selected, allInput, inputs });
  allInput.onchange = sync;
  for (const group of catalogue.groups.filter((item) => !['base', 'shared'].includes(item.id))) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.group = group.id;
    document.body.append(input);
    inputs.push(input);
    attachOfflinePackageChoice(input, {
      group,
      catalogue,
      selected,
      allInput,
      enabled: () => enabled,
      onChange: () => {
        changes++;
        sync();
      },
    });
  }
  sync();
  return {
    allInput,
    selected,
    catalogue,
    input: (id) => inputs.find((input) => input.dataset.group === id),
    ids: () => gameplaySelection(catalogue, { all: allInput.checked, selected: [...selected] }),
    get changes() {
      return changes;
    },
    set enabled(value) {
      enabled = value;
    },
  };
}

test('All games visibly selects native experiences; removing one keeps other choices and does not opt into SIM', () => {
  const h = fixture();
  h.allInput.click();
  assert.equal(h.input('extras:overflight').checked, true);
  assert.equal(h.input('extras:snake').checked, true);
  assert.equal(h.input('extras:sim-fpv').checked, false);
  assert.equal(downloadFiles(h.catalogue, h.ids()).length, 1, 'shared effects are included once');
  h.input('extras:overflight').click();
  assert.equal(h.allInput.checked, false);
  assert.equal(h.input('extras:overflight').checked, false);
  assert.equal(h.input('extras:snake').checked, true);
  assert.equal(h.input('runtime:team').checked, true);
  assert.ok(!h.ids().includes('extras:overflight'));
  assert.ok(h.ids().includes('extras:snake'));
  assert.ok(!h.ids().includes('extras:sim-fpv'));
  h.input('extras:snake').click();
  assert.equal(
    downloadFiles(h.catalogue, h.ids()).length,
    0,
    'removing both releases their optional effects dependency',
  );
  assert.equal(h.changes, 2);
});

test('optional SIM remains an independent opt-in and explicitly selected choices survive All toggling', () => {
  const h = fixture();
  h.input('extras:sim-fpv').click();
  h.allInput.click();
  h.allInput.click();
  assert.equal(h.input('extras:sim-fpv').checked, true);
  assert.equal(h.input('extras:overflight').checked, false);
  assert.equal(h.input('extras:snake').checked, false);
  assert.deepEqual(h.ids(), ['base', 'extras:sim-fpv']);
  h.allInput.click();
  h.input('extras:sim-fpv').click();
  assert.equal(h.allInput.checked, true, 'removing an optional extra preserves All-current intent');
  assert.equal(h.input('extras:overflight').checked, true);
  assert.equal(h.input('extras:snake').checked, true);
  assert.ok(!h.ids().includes('extras:sim-fpv'));
});

test('community removal preserves other inferred games and disabled operations cannot change consent', () => {
  const h = fixture();
  h.allInput.click();
  h.input('community:one').click();
  assert.equal(h.allInput.checked, false);
  assert.ok(!h.ids().includes('company:one'));
  assert.ok(h.ids().includes('extras:overflight'));
  assert.ok(h.ids().includes('extras:snake'));
  const before = h.ids();
  h.enabled = false;
  h.input('extras:snake').click();
  assert.deepEqual(h.ids(), before);
  assert.equal(h.changes, 1);
});
