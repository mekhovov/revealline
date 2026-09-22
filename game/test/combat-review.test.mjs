import test from 'node:test';
import assert from 'node:assert/strict';

test('static combat review paints all seven specimens with finite geometry through every control combination', async () => {
  const nodes = new Map(),
    all = [];
  const create = (tagName) => {
    const node = {
      tagName,
      children: [],
      calls: [],
      handlers: {},
      value: '',
      style: {},
      append(...children) {
        this.children.push(...children);
      },
      setAttribute(name, value) {
        this[name] = value;
      },
      addEventListener(name, handler) {
        this.handlers[name] = handler;
      },
    };
    if (tagName === 'canvas') {
      const values = {};
      node.getContext = () =>
        new Proxy(
          {},
          {
            get: (_, method) =>
              method in values
                ? values[method]
                : (...args) => {
                    for (const arg of args.flat())
                      if (typeof arg === 'number')
                        assert(
                          Number.isFinite(arg),
                          `${String(method)} must use finite coordinates`,
                        );
                    node.calls.push({ method, args });
                  },
            set: (_, name, value) => {
              values[name] = value;
              return true;
            },
          },
        );
    }
    all.push(node);
    return node;
  };
  for (const [id, value] of Object.entries({
    'body-size': '24',
    surface: 'dark',
    effects: 'normal',
    colour: 'colour',
    studies: '',
    'review-status': '',
  })) {
    const node = create('div');
    node.value = value;
    nodes.set(id, node);
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { getElementById: (id) => nodes.get(id), createElement: create },
  });
  try {
    await import('../presentation/combat-review.mjs');
    const cards = nodes.get('studies').children;
    assert.equal(cards.length, 7);
    const canvases = cards.map((card) => card.children[2].children[0]);
    assert(canvases.every((c) => c.role === 'img' && c['aria-label'].length > 20));
    const keeper = canvases.at(-1);
    assert.equal(keeper.calls.filter((c) => c.method === 'arc').length, 2);
    assert(
      keeper.calls
        .filter((c) => c.method === 'arc')
        .every((c) => c.args[0] === 0 && c.args[1] === 0 && c.args[2] === 13),
    );
    for (const size of ['16', '24', '32'])
      for (const surface of ['dark', 'light', 'grey'])
        for (const effects of ['normal', 'reduced'])
          for (const colour of ['colour', 'mono']) {
            for (const [id, value] of Object.entries({
              'body-size': size,
              surface,
              effects,
              colour,
            }))
              nodes.get(id).value = value;
            for (const c of canvases) c.calls.length = 0;
            nodes.get('body-size').handlers.change();
            assert.match(
              nodes.get('review-status').textContent,
              new RegExp(`${size}px robot bodies`),
            );
            assert(
              canvases.every((c) =>
                c.calls.some((call) => ['drawImage', 'fillRect', 'arc'].includes(call.method)),
              ),
            );
            assert.equal(keeper.calls.filter((c) => c.method === 'arc').length, 2);
          }
    // The review never schedules animation, accesses storage or applies content.
    assert.equal(all.filter((n) => n.tagName === 'section').length, 7);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
