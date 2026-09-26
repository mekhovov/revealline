import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  WORKSHOP_TOOLS,
  workshopToolHref,
  workshopReturnLinks,
  readWorkshopReturn,
  clearWorkshopReturn,
  mountToolReturnLinks,
} from '../ui/workshop-return.mjs';
import { soloPage, SoloElement } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { mountEditionNavigation } from '../ui/edition-navigation.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('edition navigation retains the exact tool-return owner inside its installed root', () => {
  const doc = new Document(),
    link = doc.createElement('a');
  link.setAttribute('href', '../?edition=foreign&workshop=controller-lab#details');
  doc.body.append(link);
  const root = 'https://example.test/releases/v2/site/';
  mountEditionNavigation({
    document: doc,
    href: `${root}game/controller-lab/`,
    provider: {
      editionId: 'sample-public',
      rootURL: root,
      selection: { brand: { name: 'Sample' } },
      href: () => `${root}game/index.html?edition=sample-public`,
    },
  });
  const target = new URL(link.href);
  assert.equal(target.pathname, '/releases/v2/site/game/index.html');
  assert.equal(target.searchParams.get('edition'), 'sample-public');
  assert.equal(target.searchParams.get('workshop'), 'controller-lab');
  assert.equal(target.hash, '#details');
});

test('retained presentation stays scoped across game and replay/controller tool returns', () => {
  const doc = new Document(),
    root = 'https://example.test/editions/sample/releases/v2/site/',
    receipt = 'a'.repeat(64);
  const links = [
    '../index.html?presentation=foreign',
    '../replay-theater/',
    '../controller-lab/',
  ].map((href) => {
    const link = doc.createElement('a');
    link.setAttribute('href', href);
    doc.body.append(link);
    return link;
  });
  mountEditionNavigation({
    document: doc,
    href: `${root}game/replay-theater/`,
    provider: {
      editionId: 'sample-public',
      retainedPresentationId: receipt,
      rootURL: root,
      selection: { brand: { name: 'Sample' } },
      href: () => `${root}game/index.html?edition=sample-public&presentation=${receipt}`,
    },
  });
  for (const link of links) {
    const url = new URL(link.href);
    assert.equal(url.searchParams.get('presentation'), receipt);
    assert.equal(url.searchParams.get('edition'), 'sample-public');
    assert.ok(url.pathname.startsWith(new URL(root).pathname));
  }
});

for (const prefix of [
  'http://localhost/',
  'https://example.test/releases/v0.69.3/site/',
  'https://example.test/archive/releases/v0.68.2/site/',
]) {
  test(`all nine tools retain exact edition routes under ${prefix}`, () => {
    assert.equal(WORKSHOP_TOOLS.length, 9);
    for (const { id, path, opener } of WORKSHOP_TOOLS) {
      assert.ok(opener.startsWith('shell-'));
      for (const index of ['', 'index.html']) {
        const target = workshopToolHref(
          `${prefix}game/${index}?journey=opening&pack=other#old`,
          id,
        );
        assert.equal(target, `${prefix}${path}?journey=opening`);
        const returns = workshopReturnLinks(
          `${prefix}${path}${index}?journey=opening&other=discard`,
          id,
        );
        assert.deepEqual(returns, {
          game: `${prefix}game/?journey=opening`,
          workshop: `${prefix}game/?journey=opening&workshop=${id}`,
        });
        assert.equal(readWorkshopReturn(new URL(returns.workshop).search).opener, opener);
      }
    }
  });
}

test('finite tools and competing launch owners cannot be overridden by a return hint', () => {
  for (const id of [
    'unknown',
    '../../game/',
    'https://elsewhere.test',
    '__proto__',
    'constructor',
  ]) {
    assert.throws(() => workshopToolHref('https://example.test/game/', id), /Unknown/);
    assert.throws(
      () => workshopReturnLinks('https://example.test/game/playground/', id),
      /Unknown/,
    );
    assert.equal(readWorkshopReturn(`?workshop=${encodeURIComponent(id)}`), null);
  }
  for (const { id } of WORKSHOP_TOOLS) {
    assert.equal(readWorkshopReturn(`?workshop=${id}&workshop=${id}`), null);
    for (const conflict of [
      'course',
      'practice',
      'pack',
      'mode-return',
      'mode-return-v2',
      'enemy-workshop-session',
      'practice-return',
      'controller-preview',
      'controller-session',
    ])
      assert.equal(readWorkshopReturn(`?workshop=${id}&${conflict}=`), null, `${id}/${conflict}`);
    assert.equal(
      new URL(workshopToolHref('https://example.test/game/?journey=opening&journey=other', id))
        .search,
      '',
    );
  }
});

test('history consumption preserves unrelated route and state and tolerates unavailable history', () => {
  for (const { id } of WORKSHOP_TOOLS) {
    const state = { same: 'history' },
      calls = [];
    const host = {
      location: { href: `https://example.test/game/?journey=opening&workshop=${id}#same` },
      history: { state, replaceState: (...args) => calls.push(args) },
    };
    clearWorkshopReturn(host);
    assert.deepEqual(calls, [[state, '', 'https://example.test/game/?journey=opening#same']]);
    host.history.replaceState = () => {
      throw Error('Unavailable');
    };
    assert.doesNotThrow(() => clearWorkshopReturn(host));
  }
});

test('every standalone tool keeps a same-edition game exit before any module loads', async () => {
  for (const entry of WORKSHOP_TOOLS) {
    const html = await readFile(new URL(`../../${entry.path}index.html`, import.meta.url), 'utf8');
    const anchor = [...html.matchAll(/<a\b[^>]*>/g)].find((match) =>
      match[0].includes('data-workshop-return="game"'),
    )?.[0];
    assert.ok(anchor, `${entry.id} has a static game exit`);
    assert.doesNotMatch(anchor, /\binert\b|aria-disabled="true"|\bhidden\b/);
    const href = anchor.match(/href="([^"]+)"/)[1];
    for (const prefix of ['https://example.test/', 'https://example.test/releases/v0.70.0/site/'])
      assert.equal(new URL(href, `${prefix}${entry.path}`).href, `${prefix}game/`);
  }
});

test('all standalone pages prepare both returns before enabling and retain cross-tool hints', async () => {
  for (const entry of WORKSHOP_TOOLS) {
    const html = await readFile(new URL(`../../${entry.path}index.html`, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`data-workshop-tool="${entry.id}"`));
    assert.match(html, /workshop-return-entry\.mjs/);
    assert.match(html, /workshop-return\.css/);
    if (entry.id === 'video-poster') assert.match(html, /cancels work or returns to Workshop\./);
    for (const role of ['workshop', 'game'])
      assert.match(html, new RegExp(`data-workshop-return="${role}"`));
    for (const anchor of html.matchAll(/<a\b[^>]*>/g)) {
      const href = anchor[0].match(/href="([^"]+)"/)?.[1];
      if (!href || href.startsWith('#')) continue;
      const resolved = new URL(href, `https://example.test/${entry.path}`);
      const destination = WORKSHOP_TOOLS.find((tool) => resolved.pathname === `/${tool.path}`);
      if (destination)
        assert.match(anchor[0], new RegExp(`data-workshop-tool="${destination.id}"`));
    }
    const writes = [];
    const returns = ['workshop', 'game'].map((role) => ({
      getAttribute: () => role,
      set href(value) {
        writes.push([role, 'href', value]);
      },
      set inert(value) {
        writes.push([role, 'inert', value]);
      },
      removeAttribute(name) {
        writes.push([role, 'remove', name]);
      },
    }));
    const cross = { getAttribute: () => 'playground' };
    mountToolReturnLinks({
      document: {
        querySelectorAll: (selector) => (selector === '[data-workshop-return]' ? returns : [cross]),
      },
      href: `https://example.test/${entry.path}?journey=opening`,
      id: entry.id,
    });
    for (const role of ['workshop', 'game']) {
      const own = writes.filter((row) => row[0] === role);
      assert.deepEqual(own[0], [
        role,
        'href',
        `https://example.test/game/?journey=opening${role === 'workshop' ? `&workshop=${entry.id}` : ''}`,
      ]);
      assert.deepEqual(own.slice(1), [
        [role, 'remove', 'inert'],
        [role, 'inert', false],
        [role, 'remove', 'aria-disabled'],
      ]);
    }
    assert.equal(cross.href, 'https://example.test/game/playground/?journey=opening');
  }
});

function nativeDialogs(t) {
  const open = SoloElement.prototype.showModal,
    origins = new WeakMap();
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    open.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute('open');
    origins.get(this)?.focus();
    queueMicrotask(() => this.emit('close', { bubbles: false }));
  });
}

for (const { id, opener } of WORKSHOP_TOOLS) {
  test(`actual Solo boot returns ${id} to its own Workshop opener without advancing or saving`, async (t) => {
    nativeDialogs(t);
    const h = await soloPage(t, { titleScreen: true, search: `?workshop=${id}` });
    assert.equal(h.$('shell-home').open, true);
    assert.equal(h.$('shell-workshop-dialog').open, true);
    assert.equal(h.doc.activeElement.id, opener);
    const checkpoint = authoritativeCheckpoint(h.rendered.run),
      stored = [...h.storage.map];
    const event = h.$(opener).emit('keydown', { key: 'Escape', code: 'Escape' });
    assert.equal(event.defaultPrevented, true);
    await Promise.resolve();
    assert.equal(h.$('shell-home').open, true);
    assert.equal(h.$('shell-workshop-dialog').open, false);
    assert.equal(h.doc.activeElement.id, 'shell-workshop');
    h.frame();
    assert.equal(h.rendered.paused, true);
    assert.equal(h.rendered.run.tick, 0);
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
    assert.deepEqual([...h.storage.map], stored);
    assert.deepEqual(h.errors, []);
  });
}

test('company tool routes retain only a valid single edition through exact-release return', () => {
  const game =
    'https://example.test/editions/coupa-all/releases/v1.0.0/site/game/index.html?edition=coupa-all&journey=coupa-all&practice=1';
  const href = workshopToolHref(game, 'controller-lab');
  assert.equal(new URL(href).searchParams.get('edition'), 'coupa-all');
  assert.equal(new URL(href).searchParams.has('practice'), false);
  assert.equal(
    new URL(workshopReturnLinks(href, 'controller-lab').game).searchParams.get('edition'),
    'coupa-all',
  );
  for (const query of [
    'edition=one&edition=two',
    'edition=https://other.test',
    'edition=../escape',
  ]) {
    assert.equal(
      new URL(
        workshopToolHref(`https://example.test/game/?${query}`, 'controller-lab'),
      ).searchParams.has('edition'),
      false,
    );
  }
});
