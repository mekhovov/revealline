import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoReward } from '../ui/demo-reward.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
const flush = () => new Promise((resolve) => setImmediate(resolve));
function setup({ acquire = async () => ({ prepared: true }) } = {}) {
  const document = new Document(),
    board = document.createElement('div'),
    canvas = document.createElement('canvas');
  const make = document.createElement.bind(document);
  document.createElement = (tag) => {
    const node = make(tag);
    if (tag === 'canvas')
      node.getContext = () => ({
        drawImage(source) {
          assert.equal(source, canvas);
        },
      });
    return node;
  };
  document.body.append(board);
  board.append(canvas);
  const seen = [];
  let options,
    disposed = 0;
  const reward = createDemoReward({
    document,
    canvas,
    readMedia: async () => {
      seen.push('read');
      return {};
    },
    acquire,
    createPresentation(value) {
      options = value;
      value.onChange({ state: 'playing' });
      return {
        dispose: () => disposed++,
        pause: () => value.onChange({ state: 'paused' }),
        setPreferences() {},
      };
    },
  });
  const config = {
    won: true,
    age: 4,
    allowed: true,
    pin: { picturePin: { id: 'exact-poster' } },
    paused: false,
    reduced: false,
  };
  return {
    reward,
    config,
    seen,
    board,
    get options() {
      return options;
    },
    get disposed() {
      return disposed;
    },
  };
}
test('demo video waits for the image hold and never acquires hidden/unearned or reduced media', async () => {
  const f = setup();
  for (const change of [
    { age: 2 },
    { won: false },
    { allowed: false },
    { pin: null },
    { reduced: true },
    { paused: true },
  ])
    assert.equal(f.reward.update({ ...f.config, ...change }), false);
  assert.deepEqual(f.seen, []);
  assert.equal(f.reward.update(f.config), true);
  await flush();
  assert.equal(f.options.autoplay, true);
  assert.equal(f.options.cinematicTransition, true);
  assert.equal(f.options.muted, true);
  assert.equal(f.reward.update(f.config), true, 'Playing media owns the recap.');
  f.options.onChange({ state: 'poster' });
  assert.equal(f.reward.update(f.config), false, 'Finished media releases the recap.');
  assert.deepEqual(f.seen, ['read']);
  f.reward.update({ ...f.config, allowed: false });
  assert.equal(f.disposed, 1);
  assert.equal(f.board.children.length, 1);
});
test('Next, hide media and Pause cancel pending preparation without late autoplay', async () => {
  for (const action of ['reset', 'hide', 'pause']) {
    const held = deferred();
    let signal;
    const f = setup({
      acquire: async (_, options) => {
        signal = options.signal;
        return held.promise;
      },
    });
    f.reward.update(f.config);
    await flush();
    if (action === 'reset') f.reward.reset();
    if (action === 'hide') f.reward.update({ ...f.config, allowed: false });
    if (action === 'pause') f.reward.pause();
    assert.equal(signal.aborted, true);
    held.resolve({});
    await flush();
    assert.equal(f.options, undefined);
    assert.equal(f.board.children.length, 1);
    f.reward.reset();
  }
});
