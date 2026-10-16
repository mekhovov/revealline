import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';

const options = {
  href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
  nativeFocus: true,
  nativeVisibility: true,
  retainInitialDifficulty: true,
};
const enter = (f, element) => {
  element.focus();
  f.tap('Enter');
};
const cards = (f) => [...f.$('journey-cards').querySelectorAll('.journey-card')];
const shown = (f) => cards(f).filter((card) => !card.hidden);
async function open(f) {
  enter(f, f.$('coop-discovery-open'));
  await waitFor(() => f.$('journey-chooser')?.open);
}
function search(f, query) {
  const input = f.$('journey-search');
  input.focus();
  input.value = query;
  input.emit('input');
}
function filter(f, name) {
  const select = f.$('journey-campaign'),
    option = [...select.querySelectorAll('option')].find((item) => item.textContent.includes(name));
  assert(option, name);
  select.focus();
  select.value = option.value;
  select.emit('change');
}

test('flat Team search matches normalized multiword mission text globally and Play remains one action', async (t) => {
  const f = await page(t, options);
  await open(f);
  const first = shown(f)[0];
  search(f, 'ＬＯＯＫＯＵＴ shared');
  assert.equal(shown(f).length, 1);
  assert.equal(shown(f)[0].querySelector('strong').textContent, 'Shared lookout');
  assert.equal(f.doc.activeElement.id, 'journey-search');
  assert.match(f.$('journey-chooser-status').textContent, /^1 mission/);
  f.tap('Enter');
  assert.equal(f.$('journey-chooser').open, true, 'Search confirmation is not Play');
  first.click();
  assert.equal(f.$('journey-chooser').open, true, 'Hidden stale Play cannot start');
  assert.equal(f.$('coop-level').value, 'twin-landings');
  enter(f, shown(f)[0]);
  await waitFor(() => f.$('coop-stage').textContent === 'SHARED LOOKOUT');
  assert.equal(f.$('coop-stage').textContent, 'SHARED LOOKOUT');
  assert.equal(f.$('coop-menu').hidden, true);
});

test('campaign filter intersects search without navigation depth and no results never starts a hidden arena', async (t) => {
  const f = await page(t, options);
  await open(f);
  filter(f, 'Changing common ground');
  assert.equal(shown(f).length, 4);
  assert.equal(f.doc.activeElement.id, 'journey-campaign');
  search(f, 'nonexistent mission');
  assert.equal(shown(f).length, 0);
  assert.match(f.$('journey-chooser-status').textContent, /^0 missions/);
  f.tap('Enter');
  assert.equal(f.$('journey-chooser').open, true);
  assert.equal(f.$('coop-menu').hidden, false);
  search(f, 'depot');
  assert.equal(shown(f).length, 1);
  assert.equal(shown(f)[0].querySelector('strong').textContent, 'Twin depots');
  filter(f, 'All campaigns');
  search(f, '');
  assert.equal(shown(f).length, 14);
  enter(f, f.$('journey-back'));
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  await open(f);
  assert.equal(shown(f).length, 14);
  assert.equal(f.$('journey-search').value, '');
  assert.equal(f.$('journey-campaign').value, '');
});

test('filters stay fixed during staged Play and cancellation retains the filtered mission without an extra Start', async (t) => {
  const gate = deferred();
  let hold = false,
    entered = false;
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    presentation: {
      async decode() {
        if (hold) {
          hold = false;
          entered = true;
          await gate.promise;
        }
      },
    },
  });
  await open(f);
  search(f, 'rendezvous');
  const target = shown(f)[0];
  hold = true;
  enter(f, target);
  await waitFor(() => entered);
  assert.equal(
    f.$('journey-chooser').open,
    false,
    'Staged Play leaves filters outside the active modal',
  );
  assert.equal(f.$('journey-search').value, 'rendezvous');
  assert.equal(shown(f).length, 1);
  enter(f, f.$('coop-discovery-cancel'));
  assert.equal(f.$('journey-chooser').open, true);
  assert.equal(f.doc.activeElement, target);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.equal(f.$('journey-chooser').open, true);
});
