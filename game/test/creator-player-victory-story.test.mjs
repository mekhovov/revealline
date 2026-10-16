import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreatorPlayerVictoryStory } from '../creator/player-victory-story.mjs';
import { Document } from './helpers/couch-dom.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

function harness(prepareVictoryStory) {
  const document = new Document(),
    make = (tag, id) => {
      const element = document.createElement(tag);
      element.id = id;
      document.body.append(element);
      return element;
    },
    nodes = {
      surface: make('section', 'earned'),
      stage: make('div', 'creator-story-stage'),
      status: make('p', 'creator-story-status'),
      retry: make('button', 'creator-story-retry'),
      next: make('button', 'next'),
    },
    calls = [],
    host = {
      close() {
        calls.push({ type: 'close' });
        nodes.surface.hidden = true;
        nodes.stage.replaceChildren();
      },
      show(value) {
        calls.push({ type: 'show', value });
        nodes.surface.hidden = false;
        nodes.stage.append(value.posterElement);
        return { kind: 'presentation' };
      },
    },
    player = createCreatorPlayerVictoryStory({
      runtime: { prepareVictoryStory },
      host,
      nodes,
    });
  nodes.surface.hidden = false;
  nodes.retry.hidden = true;
  nodes.next.hidden = false;
  nodes.next.disabled = false;
  return { document, nodes, calls, player };
}

const request = (document) => ({
  receipt: Object.freeze({ missionId: 'mission-two', runId: 'verified-run' }),
  posterElement: document.createElement('img'),
  posterAsset: Object.freeze({ id: 'poster-two', sha256: 'a'.repeat(64) }),
});

const preparedStory = (entry) => ({
  prepared: Object.freeze({ kind: 'authenticated-story' }),
  picturePin: Object.freeze({ sha256: entry.posterAsset.sha256 }),
  poster: entry.posterAsset,
});

test('player opens a story only from the exact runtime receipt while poster and Next stay available', async () => {
  const held = deferred(),
    seen = [];
  const h = harness((receipt, options) => {
      seen.push({ receipt, options });
      return held.promise;
    }),
    entry = request(h.document);
  h.nodes.stage.append(entry.posterElement);
  const pending = h.player.show(entry);
  assert.equal(seen[0].receipt, entry.receipt);
  assert.equal(seen[0].options.signal.aborted, false);
  assert.equal(entry.posterElement.hidden, false);
  assert.equal(h.nodes.next.hidden, false);
  assert.equal(h.nodes.next.disabled, false);
  assert.equal(h.player.snapshot().preparing, true);
  held.resolve(preparedStory(entry));
  assert.deepEqual(await pending, { kind: 'presentation' });
  const shown = h.calls.find(({ type }) => type === 'show').value;
  assert.equal(shown.posterElement, entry.posterElement);
  assert.equal(shown.prepared.kind, 'authenticated-story');
  assert.equal(h.nodes.next.hidden, false);
  assert.equal(h.nodes.next.disabled, false);
});

test('image-only completion keeps its earned poster without adding story controls', async () => {
  const h = harness(async () => null),
    entry = request(h.document);
  h.nodes.stage.append(entry.posterElement);
  assert.equal(await h.player.show(entry), null);
  assert.equal(
    h.calls.some(({ type }) => type === 'show'),
    false,
  );
  assert.equal(h.nodes.surface.hidden, false);
  assert.equal(h.nodes.stage.children[0], entry.posterElement);
  assert.equal(h.nodes.retry.hidden, true);
  assert.equal(h.nodes.next.disabled, false);
});

test('story preparation failure preserves the poster and offers an exact-receipt retry', async () => {
  let attempts = 0;
  const receipts = [],
    h = harness(async (receipt) => {
      receipts.push(receipt);
      if (attempts++ === 0) throw new Error('Temporary decoder failure.');
      return preparedStory(entry);
    }),
    entry = request(h.document);
  h.nodes.stage.append(entry.posterElement);
  assert.equal(await h.player.show(entry), null);
  assert.equal(entry.posterElement.hidden, false);
  assert.equal(h.nodes.retry.hidden, false);
  assert.match(h.nodes.status.textContent, /earned picture and Next remain available/);
  assert.equal(h.nodes.next.disabled, false);
  h.nodes.retry.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(receipts.length, 2);
  assert.equal(receipts[0], entry.receipt);
  assert.equal(receipts[1], entry.receipt);
  assert.equal(
    h.calls.some(({ type }) => type === 'show'),
    true,
  );
  assert.equal(h.nodes.next.disabled, false);
});

test('new mission cancels late story preparation before it can replace the next poster', async () => {
  const held = deferred(),
    h = harness((_receipt, { signal }) => {
      signal.addEventListener('abort', () =>
        held.reject(new DOMException('Cancelled', 'AbortError')),
      );
      return held.promise;
    }),
    entry = request(h.document),
    pending = h.player.show(entry);
  h.player.reset();
  assert.equal(await pending, null);
  assert.equal(
    h.calls.some(({ type }) => type === 'show'),
    false,
  );
  assert.deepEqual(h.player.snapshot(), { preparing: false, retryAvailable: false });
});

test('a story cannot bind to a different poster even after valid runtime preparation', async () => {
  const h = harness(async () => ({
      ...preparedStory(entry),
      poster: { ...entry.posterAsset, sha256: 'b'.repeat(64) },
    })),
    entry = request(h.document);
  h.nodes.stage.append(entry.posterElement);
  assert.equal(await h.player.show(entry), null);
  assert.equal(
    h.calls.some(({ type }) => type === 'show'),
    false,
  );
  assert.equal(h.nodes.retry.hidden, false);
  assert.match(h.nodes.status.textContent, /differs from the exact earned poster/);
  assert.equal(h.nodes.next.disabled, false);
});
