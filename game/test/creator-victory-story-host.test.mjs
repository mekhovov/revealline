import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreatorVictoryStoryHost } from '../creator/victory-story-host.mjs';
import { Document } from './helpers/couch-dom.mjs';

function harness(createPresentation) {
  const document = new Document();
  const make = (tag, id) => {
    const element = document.createElement(tag);
    element.id = id;
    document.body.append(element);
    return element;
  };
  const nodes = {
    surface: make('section', 'story'),
    stage: make('div', 'story-stage'),
    status: make('p', 'story-status'),
    retry: make('button', 'story-retry'),
    next: make('button', 'next'),
  };
  nodes.retry.hidden = true;
  nodes.next.disabled = false;
  nodes.next.hidden = false;
  const host = createCreatorVictoryStoryHost({
    document,
    nodes,
    createPresentation,
  });
  return { document, nodes, host };
}

test('story state and playback failure never take ownership of Next or the earned poster', () => {
  let change,
    disposed = 0;
  const h = harness(({ container, posterElement, onChange }) => {
    change = onChange;
    const element = h.document.createElement('section');
    for (const label of ['Play', 'Skip', 'Replay']) {
      const button = h.document.createElement('button');
      button.textContent = label;
      element.append(button);
    }
    container.append(element);
    return {
      snapshot: () => ({ state: 'poster', reason: null }),
      dispose: () => disposed++,
      element,
      posterElement,
    };
  });
  const poster = h.document.createElement('img');
  h.host.show({ posterElement: poster, picturePin: {}, prepared: {} });
  assert.equal(h.nodes.next.disabled, false);
  assert.equal(h.nodes.next.hidden, false);
  assert.equal(h.nodes.stage.children[0], poster);
  assert.deepEqual(
    h.nodes.stage.querySelectorAll('button').map((button) => button.textContent),
    ['Play', 'Skip', 'Replay'],
  );
  change({ state: 'blocked', reason: 'Browser blocked playback.' });
  assert.equal(poster.hidden, false);
  assert.equal(h.nodes.next.disabled, false);
  assert.equal(h.nodes.next.hidden, false);
  assert.match(h.nodes.status.textContent, /blocked playback/);
  assert.equal(h.nodes.retry.hidden, true, 'the presentation’s Play control owns blocked retry');
  h.host.close();
  assert.equal(disposed, 1);
});

test('presentation setup failure falls back to the poster and leaves continuation available', () => {
  const h = harness(() => {
    throw new Error('Decoder unavailable.');
  });
  const poster = h.document.createElement('img');
  poster.hidden = true;
  h.host.show({ posterElement: poster, picturePin: {}, prepared: {} });
  assert.equal(poster.hidden, false);
  assert.equal(h.nodes.next.disabled, false);
  assert.equal(h.nodes.next.hidden, false);
  assert.equal(h.nodes.retry.hidden, false);
  assert.match(h.nodes.status.textContent, /earned picture and Next remain available/);
  assert.deepEqual(h.host.snapshot(), {
    state: 'error',
    reason: 'Decoder unavailable.',
    available: false,
  });
});
