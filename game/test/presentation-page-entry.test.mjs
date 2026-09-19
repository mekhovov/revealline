import test from 'node:test';
import assert from 'node:assert/strict';
import { mountAuxiliaryPresentationPage } from '../presentation/page-entry.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

function fixture() {
  const document = new Document(),
    window = new Events();
  document.defaultView = window;
  document.baseURI = new URL('../../authoring/still-media/index.html', import.meta.url).href;
  document.head = document.createElement('head');
  document.documentElement.append(document.head);
  const heading = document.createElement('h1'),
    localStatus = document.createElement('p'),
    back = document.createElement('a');
  heading.textContent = 'Picture workshop';
  localStatus.textContent = 'Reading the local original…';
  back.textContent = 'Back to game';
  document.body.append(heading, localStatus, back);
  // The shared minimal selector fixture recognizes alphabetic tags only.
  const query = document.querySelector.bind(document);
  document.querySelector = (selector) => (selector === 'h1' ? heading : query(selector));
  back.focus();
  let resolve, reject, report;
  const pending = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const calls = { loads: 0, applies: 0, closes: 0 };
  const createHost = () => ({
    load({ onStatus }) {
      calls.loads++;
      report = onStatus;
      return pending;
    },
    apply() {
      calls.applies++;
    },
    close() {
      calls.closes++;
    },
  });
  return {
    document,
    window,
    createHost,
    calls,
    heading,
    localStatus,
    back,
    resolve,
    reject,
    report: (value) => report(value),
    target: () => document.querySelector('[data-presentation-status]'),
  };
}
const label = (target) => target.querySelector('.operation-status-label').textContent;

test('auxiliary loading is immediate beside its heading, leaves local work and focus alone, and clears after applying artwork', async () => {
  const f = fixture();
  const entry = mountAuxiliaryPresentationPage(f),
    target = f.target();
  assert.equal(f.document.body.children[1], target);
  assert.equal(target.dataset.state, 'busy');
  assert.match(label(target), /Loading release artwork/);
  assert.equal(f.calls.loads, 0, 'Notice precedes the actual shared load.');
  assert.equal(f.localStatus.textContent, 'Reading the local original…');
  assert.equal(f.document.activeElement, f.back);
  assert.equal(f.back.disabled, false);
  assert.equal(f.document.body.inert, false);
  assert.equal(f.document.body.getAttribute('aria-busy'), null);
  await Promise.resolve();
  f.report({
    status: 'preparing',
    stage: 'decoding',
    message: 'Opening release artwork…',
    progress: null,
  });
  assert.match(label(target), /Opening release artwork/);
  f.resolve({ release: true });
  await entry.ready;
  assert.equal(target.hidden, true);
  assert.equal(f.calls.applies, 1);
  assert.equal(f.document.activeElement, f.back);
  entry.close();
});

test('repeated auxiliary mounts and ordinary page peers share one load and one stylesheet without taking over peer cleanup', async () => {
  const f = fixture(),
    stylesheet = f.document.createElement('link');
  stylesheet.setAttribute('rel', 'stylesheet');
  stylesheet.setAttribute('href', '../../game/ui/operation-status.css');
  f.document.head.append(stylesheet);
  const peer = mountPresentationPage(f),
    first = mountAuxiliaryPresentationPage(f),
    second = mountAuxiliaryPresentationPage(f);
  assert.equal(first, second);
  assert.equal(f.document.querySelectorAll('[data-presentation-status]').length, 1);
  assert.equal(f.document.querySelectorAll('link[rel="stylesheet"]').length, 1);
  f.resolve({ release: true });
  await first.ready;
  first.close();
  assert.equal(f.calls.closes, 0, 'The ordinary page still holds its own lease.');
  const cached = mountAuxiliaryPresentationPage(f);
  assert.equal(f.target().hidden, true, 'Cached cosmetic readiness has no artificial delay.');
  assert.equal(f.calls.loads, 1);
  cached.close();
  peer.close();
  assert.equal(f.calls.closes, 1);
});

test('an existing presentation owner keeps its own notice and still shares the cosmetic host', async () => {
  const f = fixture(),
    own = f.document.createElement('p');
  own.id = 'presentation-preparation-status';
  own.textContent = 'Host-owned presentation notice';
  f.document.body.append(own);
  const entry = mountAuxiliaryPresentationPage(f);
  assert.equal(f.target(), null);
  f.resolve({ release: true });
  await entry.ready;
  assert.equal(f.calls.loads, 1);
  assert.equal(own.textContent, 'Host-owned presentation notice');
  entry.close();
  assert.equal(own.isConnected, true);
});

test('failed cosmetic loading keeps the existing warning and local controls without replacing authored content', async () => {
  const f = fixture(),
    entry = mountAuxiliaryPresentationPage(f);
  f.reject(new Error('Collection response is unavailable.'));
  assert.equal(await entry.ready, null);
  assert.equal(f.target().dataset.state, 'error');
  assert.equal(
    label(f.target()),
    'Release artwork unavailable: Collection response is unavailable.',
  );
  assert.equal(f.calls.applies, 0);
  assert.equal(f.localStatus.textContent, 'Reading the local original…');
  assert.equal(f.document.activeElement, f.back);
  entry.close();
});

test('BFCache keeps cosmetic observation, while real page disposal fences late status and application', async () => {
  const f = fixture(),
    entry = mountAuxiliaryPresentationPage(f),
    oldTarget = f.target();
  await Promise.resolve();
  f.window.emit('pagehide', { persisted: true });
  assert.equal(f.target(), oldTarget);
  assert.equal(f.calls.closes, 0);
  f.window.emit('pagehide', { persisted: false });
  assert.equal(f.target(), null);
  assert.equal(oldTarget.hidden, true);
  f.report({ status: 'preparing', stage: 'decoding', message: 'Stale decode…' });
  f.resolve({ release: true });
  assert.equal(await entry.ready, null);
  assert.equal(label(oldTarget), '');
  assert.equal(f.calls.applies, 0);
  assert.equal(f.calls.closes, 1);
  assert.equal(f.window.listeners.get('pagehide').size, 0);
});

test('auxiliary retry exposes current readiness and changes error notice back to busy without taking focus', async () => {
  const f = fixture();
  let loads = 0,
    finish;
  const second = new Promise((resolve) => {
    finish = resolve;
  });
  const entry = mountAuxiliaryPresentationPage({
    ...f,
    createHost: () => ({
      load() {
        if (++loads === 1) throw new Error('Temporary presentation outage');
        return second;
      },
      apply() {},
      close() {},
    }),
  });
  assert.equal(await entry.ready, null);
  assert.equal(f.target().dataset.state, 'error');
  const previous = entry.ready,
    retry = entry.retry();
  assert.notEqual(retry, previous);
  assert.equal(entry.ready, retry);
  assert.equal(f.target().dataset.state, 'busy');
  assert.equal(f.target().hidden, false);
  assert.match(label(f.target()), /Loading release artwork/);
  assert.equal(f.document.activeElement, f.back);
  assert.equal(f.localStatus.textContent, 'Reading the local original…');
  await Promise.resolve();
  const snapshot = { recovered: true };
  finish(snapshot);
  assert.equal(await retry, snapshot);
  assert.equal(loads, 2);
  assert.equal(f.target().hidden, true);
  assert.equal(f.document.activeElement, f.back);
  entry.close();
});
