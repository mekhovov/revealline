// Actual panel/controller handlers; details default activation, geometry and Tab
// are finite browser boundaries. No rendered layout or physical-pad claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { SOURCE_EXTERNAL_EDITIONS } from '../external-chapter-source.mjs';
import { readFile } from 'node:fs/promises';
import { preparePack } from '../packs.mjs';
import { decodePilotImage } from '../../authoring/library/external-chapter-pilot/build.mjs';

function fixture(t, overrides = {}, legacy = {}) {
  const doc = new Document();
  doc.createElement = (tag) => {
    const element = new SoloElement(doc, tag);
    let disabled = element.disabled;
    Object.defineProperty(element, 'disabled', {
      get: () => disabled,
      set(value) {
        disabled = !!value;
        // Native8957 displaced focus to BODY when a focused action was disabled.
        if (disabled && doc.activeElement === element) doc.activeElement = doc.body;
      },
    });
    const rectangles = element.getClientRects.bind(element);
    element.getClientRects = () => {
      for (let p = element.parentElement; p; p = p.parentElement)
        if (p.tagName === 'DETAILS' && !p.open && p.querySelector('summary') !== element) return [];
      return rectangles();
    };
    if (tag === 'summary')
      element.click = () => {
        const event = element.emit('click');
        if (!event.defaultPrevented) {
          element.parentElement.open = !element.parentElement.open;
          element.parentElement.emit('toggle');
        }
      };
    return element;
  };
  const panel = attachOptionalChaptersPanel({
    document: doc,
    getLibrary: () => ({ packs: [] }),
    loadCatalog: async () => ({ format: 'revealline-optional-chapters.v1', packs: [] }),
    sourceChapters: ['a', 'b'].map((id) => ({
      id,
      name: id,
      mode: 'Tactical',
      levels: 3,
      description: 'Choose an exit and time your return.',
      bytes: 1024,
      sourceOnly: false,
      backupSupported: true,
      inspect: async () => ({ status: 'absent' }),
      download: async () => {},
      install: async () => {},
      choose: async () => {},
      ...overrides[id],
    })),
    ...legacy,
  });
  const $ = (id) => doc.getElementById(`optional-worlds-${id}`);
  const nav = attachControllerNavigation({
    document: doc,
    getScope: () => 'menu',
    getRoot: () => $('dialog'),
    getDefaultFocus: () => $('top-back'),
    keyboard: true,
    onBack: () => panel.close(),
  });
  t.after(() => {
    nav.destroy();
    panel.dispose();
  });
  function key(key, extra = {}) {
    const target = doc.activeElement;
    const event = target.emit('keydown', { key, repeat: false, ...extra });
    if (!event.defaultPrevented && ['Enter', ' '].includes(key)) target.click();
    target.emit('keyup', { key });
    return event;
  }
  return { doc, panel, $, nav, key };
}

test('public cards lead with playable context and actions; native recovery controls stay inside one closed disclosure', async (t) => {
  const f = fixture(t);
  await f.panel.open();
  const card = f.$('source-a-card'),
    details = f.$('source-a-recovery');
  assert.deepEqual(
    card.children.map((n) => n.tagName),
    ['H3', 'P', 'P', 'BUTTON', 'BUTTON', 'P', 'DETAILS'],
  );
  assert.equal(card.children[1].textContent, 'Tactical · 3 original pictures');
  assert.equal(card.children[3], f.$('source-a-download'));
  assert.equal(card.children[4], f.$('source-a-choose'));
  assert.equal(details.open, false);
  assert.equal(details.querySelector('summary').textContent, 'Restore from files');
  for (const name of ['pack', 'media', 'install', 'recovery-note'])
    assert(details.contains(f.$(`source-a-${name}`)));
  assert.match(
    f.$('source-a-recovery-note').textContent,
    /backup.*descriptor.*\.rlmedia.*Removal/is,
  );
  assert(
    !card.children
      .filter((n) => n !== details)
      .some((n) => /backup|migration|source candidate/i.test(n.textContent)),
  );
  assert.equal(SOURCE_EXTERNAL_EDITIONS[0].name, 'FPV Front · Pressure Pictures');
  assert.deepEqual(
    SOURCE_EXTERNAL_EDITIONS.map((e) => e.mode),
    ['Arcade', 'Tactical', 'Tactical', 'Tactical', 'Tactical', 'Tactical', 'Tactical', 'Tactical'],
  );
});

test('a delayed completed legacy install cannot move focus in a reopened dialog', async (t) => {
  const catalog = JSON.parse(
    await readFile(new URL('../content/optional-worlds.json', import.meta.url)),
  );
  const item = catalog.packs[0];
  const { pack } = await preparePack(
    await readFile(new URL(`../../${item.path}`, import.meta.url), 'utf8'),
    { decodeImage: decodePilotImage },
  );
  let library = { packs: [] },
    finish;
  const f = fixture(
    t,
    {},
    {
      loadCatalog: async () => ({ ...catalog, packs: [item] }),
      getLibrary: () => library,
      install: async () => {
        library = { packs: [pack] };
        await new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  );
  await f.panel.open();
  f.$(`install-${item.id}`).focus();
  const old = f.$(`install-${item.id}`).onclick();
  f.panel.close();
  await f.panel.open();
  assert.equal(f.$(`choose-${item.id}`).disabled, false);
  f.$('source-b-recovery-summary').focus();
  finish();
  await old;
  assert.equal(f.doc.activeElement.id, f.$('source-b-recovery-summary').id);
});

for (const kind of ['download', 'install'])
  for (const succeeds of [true, false])
    test(`native disabled ${kind} focus returns to ${succeeds ? 'Choose after success' : 'the action after refusal'}`, async (t) => {
      let finish,
        fail,
        installed = false,
        chosen = 0;
      const f = fixture(t, {
        a: {
          inspect: async () => ({ status: installed ? 'installed' : 'absent' }),
          [kind]: async () => {
            await new Promise((resolve, reject) => {
              finish = resolve;
              fail = reject;
            });
            installed = true;
          },
          choose: () => chosen++,
        },
      });
      await f.panel.open();
      if (kind === 'install') {
        f.$('source-a-recovery-summary').focus();
        f.key('Enter');
        f.$('source-a-pack').files = [new Blob(['pack'])];
        f.$('source-a-media').files = [new Blob(['media'])];
      }
      const origin = f.$(`source-a-${kind}`);
      origin.focus();
      const pending = origin.onclick();
      assert.equal(
        f.doc.activeElement,
        f.doc.body,
        'Native disabling is modeled, not silently retained focus',
      );
      if (succeeds) finish();
      else fail(new Error('Exact pair refused'));
      await pending;
      assert.equal(f.doc.activeElement.id, succeeds ? f.$('source-a-choose').id : origin.id);
      assert(f.doc.activeElement.getClientRects().length);
      assert.equal(f.doc.activeElement.disabled, false);
      assert.equal(chosen, 0, 'Focus is not automatic mission selection');
    });

test('Cancel returns to its card action and a late completed download cannot steal later navigation', async (t) => {
  let finish, signal;
  const f = fixture(t, {
    a: {
      download: async (options) => {
        signal = options.signal;
        await new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  await f.panel.open();
  const origin = f.$('source-a-download');
  origin.focus();
  const pending = origin.onclick();
  f.$('cancel').focus();
  f.$('cancel').click();
  assert(signal.aborted);
  assert.equal(f.doc.activeElement.id, origin.id);
  f.$('source-b-recovery-summary').focus();
  finish();
  await pending;
  assert.equal(f.doc.activeElement, f.$('source-b-recovery-summary'));
});

test('successful completion respects deliberate navigation after the initiating action lost native focus', async (t) => {
  let finish,
    installed = false;
  const f = fixture(t, {
    a: {
      inspect: async () => ({ status: installed ? 'installed' : 'absent' }),
      download: async () => {
        await new Promise((resolve) => {
          finish = resolve;
        });
        installed = true;
      },
    },
  });
  await f.panel.open();
  f.$('source-a-download').focus();
  const pending = f.$('source-a-download').onclick();
  f.$('source-b-recovery-summary').focus();
  finish();
  await pending;
  assert.equal(f.doc.activeElement, f.$('source-b-recovery-summary'));
  assert.equal(f.$('source-a-choose').disabled, false);
});

test('keyboard arrows skip closed file controls; native expansion enables them and collapse restores logical focus', async (t) => {
  const f = fixture(t);
  await f.panel.open();
  f.$('source-a-download').focus();
  f.key('ArrowDown');
  assert.equal(f.doc.activeElement, f.$('source-a-recovery-summary'));
  f.key('ArrowDown');
  assert.equal(f.doc.activeElement, f.$('source-b-download'));
  f.$('source-a-recovery-summary').focus();
  assert.equal(f.key('Enter', { repeat: true }).defaultPrevented, true);
  assert.equal(f.$('source-a-recovery').open, false);
  f.key('Enter');
  assert.equal(f.$('source-a-recovery').open, true);
  assert.equal(f.doc.activeElement, f.$('source-a-recovery-summary'));
  f.key('ArrowDown');
  assert.equal(f.doc.activeElement, f.$('source-a-pack'));
  assert.equal(f.key('ArrowDown').defaultPrevented, false, 'Native file input owns its keys');
  const pack = new Blob(['selected']),
    media = new Blob(['selected media']);
  f.$('source-a-pack').files = [pack];
  f.$('source-a-media').files = [media];
  const details = f.$('source-a-recovery');
  details.open = false;
  details.emit('toggle');
  assert.equal(f.doc.activeElement, f.$('source-a-recovery-summary'));
  f.panel.refresh();
  assert.equal(details.open, false);
  f.key('Enter');
  assert.equal(details.open, true);
  assert.equal(f.$('source-a-pack').files[0], pack);
  assert.equal(f.$('source-a-media').files[0], media);
});

test('controller navigation excludes closed bodies and Confirm operates the native summary without installing or choosing', async (t) => {
  let calls = 0;
  const f = fixture(t, { a: { install: () => calls++, choose: () => calls++ } });
  await f.panel.open();
  f.nav.engage();
  f.$('source-a-download').focus();
  f.nav.handle({ direction: 'down' });
  assert.equal(f.doc.activeElement, f.$('source-a-recovery-summary'));
  f.nav.handle({ direction: 'down' });
  assert.equal(f.doc.activeElement, f.$('source-b-download'));
  f.$('source-a-recovery-summary').focus();
  f.nav.handle({ confirm: true });
  assert(f.$('source-a-recovery').open);
  f.nav.handle({ direction: 'down' });
  assert.equal(f.doc.activeElement, f.$('source-a-pack'));
  assert.equal(calls, 0);
  f.nav.handle({ back: true });
  assert.equal(f.$('dialog').open, false);
  assert.equal(calls, 0);
});

test('refresh retains expanded recovery selection and focus; Back still cancels a late download without publishing readiness', async (t) => {
  let release, signal;
  const f = fixture(t, {
    a: {
      download: async (o) => {
        signal = o.signal;
        await new Promise((r) => {
          release = r;
        });
      },
    },
  });
  await f.panel.open();
  f.$('source-b-recovery-summary').focus();
  f.key('Enter');
  const details = f.$('source-b-recovery'),
    file = new Blob(['b']);
  f.$('source-b-pack').files = [file];
  const pending = f.$('source-a-download').onclick();
  assert.equal(f.$('source-b-pack').disabled, true);
  assert.equal(details.open, true);
  f.panel.refresh();
  assert.equal(f.doc.activeElement, f.$('source-b-recovery-summary'));
  assert.equal(f.$('source-b-pack').files[0], file);
  assert.equal(details.open, true);
  f.$('top-back').click();
  assert(signal.aborted);
  await f.panel.open();
  f.$('source-b-recovery-summary').focus();
  const message = f.$('status').textContent;
  release();
  await pending;
  assert.equal(f.doc.activeElement, f.$('source-b-recovery-summary'));
  assert.equal(f.$('status').textContent, message);
  assert.equal(f.$('source-a-choose').disabled, true);
});
