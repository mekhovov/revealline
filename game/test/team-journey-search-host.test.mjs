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
const cards = (f) => [...f.$('coop-discovery-list').querySelectorAll('article')];
const shown = (f) => cards(f).filter((card) => !card.hidden);
function search(f, query) {
  const input = f.$('coop-discovery-search');
  input.focus();
  input.value = query;
  input.emit('input');
}
function filter(f, name) {
  const select = f.$('coop-discovery-campaign'),
    option = [...select.querySelectorAll('option')].find((item) => item.textContent.includes(name));
  assert(option, name);
  select.focus();
  select.value = option.value;
  select.emit('change');
}

test('flat Team search matches normalized multiword mission text globally and Play remains one action', async (t) => {
  const f = await page(t, options);
  enter(f, f.$('coop-discovery-open'));
  const first = shown(f)[0].querySelector('button');
  search(f, 'ＬＯＯＫＯＵＴ shared');
  assert.equal(shown(f).length, 1);
  assert.equal(shown(f)[0].querySelector('button').textContent, 'Play Shared lookout');
  assert.equal(f.doc.activeElement.id, 'coop-discovery-search');
  assert.match(f.$('coop-discovery-status').textContent, /^1 of 14/);
  f.tap('Enter');
  assert.equal(f.$('coop-discovery-dialog').open, true, 'Search confirmation is not Play');
  first.click();
  assert.equal(f.$('coop-discovery-dialog').open, true, 'Hidden stale Play cannot start');
  assert.equal(f.$('coop-level').value, 'twin-landings');
  enter(f, shown(f)[0].querySelector('button'));
  await waitFor(() => !f.$('coop-discovery-dialog').open);
  assert.equal(f.$('coop-stage').textContent, 'SHARED LOOKOUT');
  assert.equal(f.$('coop-menu').hidden, true);
});

test('campaign filter intersects search without navigation depth and no results never starts a hidden arena', async (t) => {
  const f = await page(t, options);
  enter(f, f.$('coop-discovery-open'));
  filter(f, 'Changing common ground');
  assert.equal(shown(f).length, 4);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-campaign');
  search(f, 'nonexistent mission');
  assert.equal(shown(f).length, 0);
  assert.match(f.$('coop-discovery-status').textContent, /No matching.*Clear Search/);
  f.tap('Enter');
  assert.equal(f.$('coop-discovery-dialog').open, true);
  assert.equal(f.$('coop-menu').hidden, false);
  search(f, 'depot');
  assert.equal(shown(f).length, 1);
  assert.equal(shown(f)[0].querySelector('button').textContent, 'Play Twin depots');
  filter(f, 'All campaigns');
  search(f, '');
  assert.equal(shown(f).length, 14);
  enter(f, f.$('coop-discovery-back'));
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  enter(f, f.$('coop-discovery-open'));
  assert.equal(shown(f).length, 14);
  assert.equal(f.$('coop-discovery-search').value, '');
  assert.equal(f.$('coop-discovery-campaign').value, '');
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
  enter(f, f.$('coop-discovery-open'));
  await waitFor(() =>
    [...f.$('coop-discovery-list').querySelectorAll('figcaption')].every(
      (item) => !item.textContent.startsWith('Preparing'),
    ),
  );
  search(f, 'rendezvous');
  const target = shown(f)[0].querySelector('button');
  hold = true;
  enter(f, target);
  await waitFor(() => entered);
  assert.equal(f.$('coop-discovery-search').disabled, true);
  assert.equal(f.$('coop-discovery-campaign').disabled, true);
  f.$('coop-discovery-search').value = 'Twin';
  f.$('coop-discovery-search').emit('input');
  assert.equal(f.$('coop-discovery-search').value, 'rendezvous');
  assert.equal(shown(f).length, 1);
  enter(f, f.$('coop-discovery-cancel'));
  assert.equal(f.$('coop-discovery-search').disabled, false);
  assert.equal(f.doc.activeElement, target);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.equal(f.$('coop-discovery-dialog').open, true);
});
