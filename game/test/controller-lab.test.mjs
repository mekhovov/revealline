import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseControllerPreviewSnapshot,
  CONTROLLER_PREVIEW_STATUS_FORMAT,
} from '../ui/controller-preview.mjs';

class Element {
  constructor(id = '') {
    this.id = id;
    this.listeners = new Map();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.clientWidth = 900;
    this.classList = { toggle() {} };
  }
  addEventListener(type, fn) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type, fn) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((v) => v !== fn),
    );
  }
  async emit(type, data = {}) {
    for (const fn of this.listeners.get(type) ?? []) await fn(data);
  }
  append(node) {
    this.children.push(node);
    if (!this.value) this.value = node.value;
  }
  replaceChildren() {
    this.children = [];
    this.value = '';
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  getAttribute(key) {
    return key === 'src' ? this.src : this.attributes[key];
  }
  focus() {
    this.focused = true;
  }
}

test('practice page keeps virtual holds, releases and import failures isolated from player storage', async (t) => {
  const originals = new Map(),
    ids = [
      'game-frame',
      'load-status',
      'connect',
      'disconnect',
      'release',
      'focus-game',
      'connection-status',
      'gesture',
      'mission',
      'craft',
      'steering',
      'viewport',
      'frame-space',
      'viewport-readout',
      'load',
      'scope',
      'focused',
      'pad-status',
      'apply-stick',
      'axis-status',
      ...[0, 1, 2, 3].flatMap((index) => [`axis-${index}`, `axis-${index}-value`]),
    ],
    elements = Object.fromEntries(ids.map((id) => [id, new Element(id)])),
    pads = Array.from({ length: 16 }, (_, index) => {
      const button = new Element();
      button.dataset.pad = String(index);
      return button;
    }),
    doc = new Element(),
    host = new Element(),
    posts = [],
    storage = new Map(),
    writes = [],
    timeouts = new Map(),
    intervals = new Map();
  let timer = 0,
    storageFailure = false;
  host.location = { origin: 'http://localhost:8767' };
  const child = {
    focus() {},
    postMessage(data, origin) {
      posts.push({ data, origin });
    },
  };
  elements['game-frame'].contentWindow = child;
  elements.gesture.value = 'pulse';
  for (const index of [0, 1, 2, 3]) elements[`axis-${index}`].value = '0';
  elements.steering.value = 'immediate';
  elements.viewport.value = '1280x720';
  doc.getElementById = (id) => elements[id];
  doc.querySelectorAll = () => pads;
  doc.createElement = () => new Element();
  doc.hidden = false;
  const globals = {
    window: host,
    document: doc,
    sessionStorage: {
      setItem(key, value) {
        if (storageFailure) throw new Error('Storage unavailable');
        writes.push(key);
        storage.set(key, value);
      },
    },
    fetch: async (path) => ({
      ok: true,
      json: async () =>
        JSON.parse(
          await readFile(new URL(path, new URL('../controller-lab/', import.meta.url)), 'utf8'),
        ),
    }),
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    setTimeout: (fn, ms) => {
      const id = ++timer;
      timeouts.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: (fn, ms) => {
      const id = ++timer;
      intervals.set(id, { fn, ms });
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const click = (id) => elements[id].emit('click', { detail: 0 });
  const press = (index) =>
    pads
      .find((button) => button.dataset.pad === String(index))
      .emit('pointerdown', { button: 0, preventDefault() {} });
  const latest = () => posts.at(-1).data;
  try {
    await import(`../controller-lab/lab.mjs?test=${Date.now()}`);
    await t.test(
      'boot prepares actual practice and exposes every authored map without profile writes',
      () => {
        assert.equal(elements.mission.children.length, 21);
        assert.equal(elements.craft.children.length, 7);
        assert.match(elements['game-frame'].src, /practice=1&controller-preview=1/);
        assert.deepEqual(writes, ['revealline.playground.current']);
        const scenario = JSON.parse(storage.get(writes[0]));
        assert.equal(scenario.level.id, 'signal-01');
        assert.equal(scenario.settings.turnPolicy, 'immediate');
      },
    );
    await t.test(
      'canonical staged practice retains its descriptor, selected class and steering without installation',
      async () => {
        const sentinel = elements.mission.children.find(
          (item) => item.textContent === 'Sentinel Relay / Sentinel Relay',
        );
        assert.ok(sentinel);
        elements.mission.value = sentinel.value;
        await elements.mission.emit('change');
        elements.craft.value = 'fiber';
        elements.steering.value = 'grid-center';
        const oldFrame = elements['game-frame'].src;
        await click('load');
        const scenario = JSON.parse(storage.get('revealline.playground.current'));
        const source = JSON.parse(
          await readFile(new URL('../content/packs/sentinel-relay.json', import.meta.url)),
        );
        assert.equal(scenario.format, 'xonix-playground.v3');
        assert.equal(scenario.masteryDefinition, null);
        assert.deepEqual(scenario.level, source.campaigns[0].levels[0]);
        assert.deepEqual(scenario.settings, {
          classId: 'fiber',
          turnPolicy: 'grid-center',
          seed: 1,
        });
        assert.notEqual(elements['game-frame'].src, oldFrame);
        assert.deepEqual(new Set(writes), new Set(['revealline.playground.current']));
      },
    );
    await t.test(
      'long original reading fixture uses the normal validated practice handoff and preserves its final paragraph',
      async () => {
        const reading = elements.mission.children.find(
          (item) => item.textContent === 'Reading practice / The patient route',
        );
        assert.ok(reading);
        elements.mission.value = reading.value;
        await elements.mission.emit('change');
        await click('load');
        const scenario = JSON.parse(storage.get('revealline.playground.current'));
        assert.equal(scenario.format, 'xonix-playground.v1');
        assert.equal(scenario.theme.id, 'ukraine');
        assert.equal(scenario.level.id, 'reading-practice-01');
        assert.ok(scenario.level.metadata.description.length > 2500);
        assert.match(
          scenario.level.metadata.description,
          /End of briefing\n\nYou have reached the last paragraph/,
        );
        assert.equal(scenario.level.goal.coverage, 0.45);
        assert.equal(scenario.classRecipes.length, 7);
        assert.deepEqual(new Set(writes), new Set(['revealline.playground.current']));
        elements.mission.value = '0';
        await elements.mission.emit('change');
        elements.craft.value = 'scout';
        elements.steering.value = 'immediate';
        await click('load');
      },
    );
    await t.test(
      'all three course choices preserve the authored handoff and bind a fresh controller session in both policies',
      async () => {
        const courses = elements.mission.children.filter((item) =>
          item.textContent.startsWith('First Flight / '),
        );
        assert.equal(courses.length, 3);
        const before = storage.get('revealline.playground.current');
        const beforeWrites = writes.length;
        const tokens = new Set();
        // A course must also load when session storage is unavailable: it has no
        // authoring handoff to replace and reads its finite registry at app boot.
        storageFailure = true;
        for (const choice of courses)
          for (const policy of ['immediate', 'grid-center']) {
            elements.mission.value = choice.value;
            await elements.mission.emit('change');
            assert.equal(elements.craft.disabled, true);
            assert.equal(elements.craft.children.length, 1);
            assert.equal(elements.craft.value, 'scout');
            elements.steering.value = policy;
            await click('load');
            const url = new URL(
              elements['game-frame'].src,
              'http://localhost:8767/game/controller-lab/',
            );
            assert.equal(url.searchParams.get('course'), 'first-flight');
            assert.equal(url.searchParams.get('turn-policy'), policy);
            assert.equal(url.searchParams.has('practice'), false);
            assert.equal(url.searchParams.get('controller-preview'), '1');
            const token = url.searchParams.get('controller-session');
            assert.match(token, /^[0-9a-f]{32}$/);
            tokens.add(token);
            assert.equal(writes.length, beforeWrites);
            assert.equal(storage.get('revealline.playground.current'), before);
          }
        assert.equal(tokens.size, 6);
        storageFailure = false;
      },
    );
    await t.test(
      'invalid course steering retains the current child and returning to ordinary practice restores class choice',
      async () => {
        const before = elements['game-frame'].src;
        const beforeWrites = writes.length;
        elements.steering.value = 'diagonal';
        await click('load');
        assert.equal(elements['game-frame'].src, before);
        assert.equal(writes.length, beforeWrites);
        assert.match(elements['load-status'].textContent, /not replaced/);
        elements.mission.value = '0';
        await elements.mission.emit('change');
        assert.equal(elements.craft.disabled, false);
        assert.equal(elements.craft.children.length, 7);
        elements.craft.value = 'scout';
        elements.steering.value = 'immediate';
        await click('load');
        assert.match(elements['game-frame'].src, /practice=1&controller-preview=1/);
        assert.equal(writes.length, beforeWrites + 1);
      },
    );
    await elements['game-frame'].emit('load');
    await t.test(
      'connect focuses the iframe and sends neutral before any deliberate button',
      async () => {
        await click('connect');
        assert.equal(elements['game-frame'].focused, true);
        assert.equal(latest().pad.connected, true);
        assert.ok(latest().pad.buttons.every((v) => !v));
        assert.equal(elements.connect.disabled, true);
        assert.equal(intervals.values().next().value.ms, 150);
      },
    );
    await t.test(
      'pulse uses one press and releases after200ms, ignoring the following pointer click',
      async () => {
        await press(0);
        const count = posts.length;
        await pads.find((p) => p.dataset.pad === '0').emit('click', { detail: 1 });
        assert.equal(posts.length, count);
        assert.equal(latest().pad.buttons[0], true);
        const release = [...timeouts].find(([, item]) => item.ms === 200);
        assert.ok(release);
        timeouts.delete(release[0]);
        release[1].fn();
        assert.equal(latest().pad.buttons[0], false);
      },
    );
    await t.test(
      'hold mode combines movement+boost; release all clears both without disconnecting',
      async () => {
        elements.gesture.value = 'hold';
        await elements.gesture.emit('change');
        await press(15);
        await press(5);
        assert.equal(latest().pad.buttons[15], true);
        assert.equal(latest().pad.buttons[5], true);
        assert.equal(pads.find((p) => p.dataset.pad === '5').getAttribute('aria-pressed'), 'true');
        await click('release');
        assert.equal(latest().pad.connected, true);
        assert.ok(latest().pad.buttons.every((v) => !v));
        assert.equal(timeouts.size, 0);
      },
    );
    await t.test(
      'only exact bounded status from the current same-origin iframe reaches labels',
      async () => {
        const data = {
          format: CONTROLLER_PREVIEW_STATUS_FORMAT,
          session: latest().session,
          sequence: 1,
          readSequence: -1,
          scope: 'settings',
          focusedId: 'theme',
          focusedLabel: '<img onerror=bad>',
          assigned: true,
          message: 'Ready',
        };
        await host.emit('message', { source: {}, origin: host.location.origin, data });
        assert.equal(elements.focused.textContent, '—');
        await host.emit('message', { source: child, origin: 'https://wrong.test', data });
        assert.equal(elements.focused.textContent, '—');
        await host.emit('message', { source: child, origin: host.location.origin, data });
        assert.equal(elements.focused.textContent, '<img onerror=bad>');
        await host.emit('message', {
          source: child,
          origin: host.location.origin,
          data: { ...data, sequence: 0, focusedLabel: 'stale' },
        });
        await host.emit('message', {
          source: child,
          origin: host.location.origin,
          data: { ...data, sequence: 2, gameState: {} },
        });
        assert.equal(elements.focused.textContent, '<img onerror=bad>');
      },
    );
    await t.test('storage failure preserves the old frame and validated handoff', async () => {
      const oldSrc = elements['game-frame'].src,
        oldData = storage.get('revealline.playground.current');
      storageFailure = true;
      await click('load');
      assert.equal(elements['game-frame'].src, oldSrc);
      assert.equal(storage.get('revealline.playground.current'), oldData);
      assert.match(
        elements['load-status'].textContent,
        /Practice was not replaced: Storage unavailable/,
      );
      assert.equal(elements.load.disabled, false);
      storageFailure = false;
    });
    let feedbackSequence = 10;
    const acknowledge = (readSequence, overrides = {}) =>
      host.emit('message', {
        source: child,
        origin: host.location.origin,
        data: {
          format: CONTROLLER_PREVIEW_STATUS_FORMAT,
          session: latest().session,
          sequence: feedbackSequence++,
          readSequence,
          scope: 'paused',
          focusedId: 'resume',
          focusedLabel: 'Resume',
          assigned: true,
          message: 'Controller ready.',
          ...overrides,
        },
      });
    const setAxis = async (index, value) => {
      elements[`axis-${index}`].value = String(value);
      await elements[`axis-${index}`].emit('input');
    };
    await t.test(
      'four draft sliders only send neutral until Apply receives a fresh sampled-neutral acknowledgement',
      async () => {
        for (const [index, value] of [0.2, -0.4, 0.6, -0.8].entries()) await setAxis(index, value);
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        assert.equal(elements['axis-2-value'].textContent, '0.60');
        assert.equal(elements['axis-3-value'].textContent, '-0.80');
        elements['game-frame'].focused = false;
        await click('apply-stick');
        const neutralSequence = latest().sequence;
        assert.equal(elements['game-frame'].focused, true);
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        await acknowledge(neutralSequence - 1);
        await acknowledge(-1);
        await acknowledge(neutralSequence + 100);
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        await acknowledge(neutralSequence);
        assert.deepEqual(latest().pad.axes, [0.2, -0.4, 0.6, -0.8]);
        assert.ok(latest().pad.buttons.every((value) => !value));
        assert.match(elements['axis-status'].textContent, /values applied/);
        const count = posts.length;
        await acknowledge(neutralSequence);
        assert.equal(
          posts.length,
          count,
          'A repeated acknowledgement never reapplies an old draft.',
        );
      },
    );
    await t.test(
      'Release all centers live and draft axes and cancels pending application',
      async () => {
        await setAxis(2, 0.8);
        await click('apply-stick');
        const pendingSequence = latest().sequence;
        await click('release');
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        for (const index of [0, 1, 2, 3]) {
          assert.equal(elements[`axis-${index}`].value, '0');
          assert.equal(elements[`axis-${index}-value`].textContent, '0.00');
        }
        await acknowledge(pendingSequence);
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        assert.equal(timeouts.size, 0);
      },
    );
    await t.test(
      'a pending stick application times out safely and ignores late acknowledgement',
      async () => {
        await setAxis(3, -0.75);
        await click('apply-stick');
        const pendingSequence = latest().sequence,
          timeout = [...timeouts].find(([, item]) => item.ms === 2000);
        assert.ok(timeout);
        timeouts.delete(timeout[0]);
        timeout[1].fn();
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        assert.equal(elements['axis-3'].value, '-0.75');
        assert.match(elements['axis-status'].textContent, /not applied.*retry Apply stick/);
        await acknowledge(pendingSequence);
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
      },
    );
    await t.test(
      'editing again or pressing a physical button cancels a pending stick handoff',
      async () => {
        await click('apply-stick');
        const first = latest().sequence;
        await setAxis(3, -0.5);
        await acknowledge(first);
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        await click('apply-stick');
        const second = latest().sequence;
        await press(11);
        await acknowledge(second);
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        assert.equal(latest().pad.buttons[11], true);
        await click('release');
      },
    );
    for (const transition of ['disconnect', 'reload', 'hidden', 'history-cache'])
      await t.test(
        `${transition} cancels pending stick application and stale feedback cannot restart it`,
        async () => {
          await click('connect');
          await setAxis(2, 0.9);
          await click('apply-stick');
          const pendingSequence = latest().sequence;
          if (transition === 'disconnect') await click('disconnect');
          if (transition === 'reload') {
            await click('load');
            await elements['game-frame'].emit('load');
          }
          if (transition === 'hidden') {
            doc.hidden = true;
            await doc.emit('visibilitychange');
            doc.hidden = false;
          }
          if (transition === 'history-cache') {
            await host.emit('pagehide', { persisted: true });
            await host.emit('pageshow', { persisted: true });
          }
          await acknowledge(pendingSequence);
          assert.equal(latest().pad.connected, false);
          assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
          assert.equal(timeouts.size, 0);
        },
      );
    await t.test(
      'reload rotates the document session so queued high-sequence status cannot starve new feedback',
      async () => {
        const oldSession = latest().session;
        await click('load');
        await elements['game-frame'].emit('load');
        const currentSession = latest().session;
        assert.match(currentSession, /^[a-f0-9]{32}$/);
        assert.notEqual(currentSession, oldSession);
        assert.ok(elements['game-frame'].src.includes(`controller-session=${currentSession}`));
        await acknowledge(-1, {
          session: oldSession,
          sequence: 999999,
          focusedLabel: 'Old document',
        });
        assert.equal(elements.focused.textContent, '—');
        await acknowledge(-1, {
          session: currentSession,
          sequence: 0,
          focusedLabel: 'New document',
        });
        assert.equal(elements.focused.textContent, 'New document');
        await click('connect');
        await setAxis(2, 0.5);
        await click('apply-stick');
        const neutralSequence = latest().sequence;
        await acknowledge(neutralSequence, { session: oldSession, sequence: 1000000 });
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
        await acknowledge(neutralSequence);
        assert.deepEqual(latest().pad.axes, [0, 0, 0.5, 0]);
        await click('release');
      },
    );
    await t.test(
      'every physical button 0 through 15 is operable without fixed-action assumptions',
      async () => {
        await click('connect');
        for (let index = 0; index < 16; index++) {
          await press(index);
          assert.equal(latest().pad.buttons[index], true);
          await press(index);
          assert.ok(latest().pad.buttons.every((value) => !value));
        }
        assert.deepEqual(latest().pad.axes, [0, 0, 0, 0]);
      },
    );
    await t.test(
      'visibility loss disconnects while iframe-focus parent blur does not',
      async () => {
        await press(15);
        await host.emit('blur');
        assert.equal(latest().pad.buttons[15], true);
        doc.hidden = true;
        await doc.emit('visibilitychange');
        assert.equal(latest().pad.connected, false);
        assert.ok(latest().pad.buttons.every((v) => !v));
      },
    );
    await t.test(
      'history-cache return remains usable but never resumes a previous hold',
      async () => {
        doc.hidden = false;
        await click('connect');
        await press(15);
        await host.emit('pagehide', { persisted: true });
        assert.equal(latest().pad.connected, false);
        assert.equal(intervals.size, 1);
        await host.emit('pageshow', { persisted: true });
        await click('connect');
        assert.equal(latest().pad.connected, true);
        assert.ok(latest().pad.buttons.every((v) => !v));
        assert.equal(elements.load.disabled, false);
      },
    );
    await t.test('every emitted snapshot validates and pagehide disposes timers', async () => {
      assert.ok(
        posts.every(
          ({ data, origin }) =>
            parseControllerPreviewSnapshot(data) && origin === host.location.origin,
        ),
      );
      assert.ok(
        posts.every(
          ({ data }, index) => index === 0 || data.sequence > posts[index - 1].data.sequence,
        ),
      );
      await setAxis(0, 0.5);
      await click('apply-stick');
      assert.ok([...timeouts.values()].some((item) => item.ms === 2000));
      await host.emit('pagehide');
      assert.equal(intervals.size, 0);
      assert.equal(timeouts.size, 0);
      assert.deepEqual(new Set(writes), new Set(['revealline.playground.current']));
    });
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('actual lab markup exposes all physical indices and four accessible numeric axis controls', async () => {
  const html = await readFile(new URL('../controller-lab/index.html', import.meta.url), 'utf8');
  const controls = [
    ...html.matchAll(/<button\b([^>]*data-pad="(\d+)"[^>]*)>([\s\S]*?)<\/button>/g),
  ];
  assert.deepEqual(
    controls.map((match) => Number(match[2])).sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => i),
  );
  for (const [, attributes, index, contents] of controls) {
    assert.match(attributes, new RegExp(`aria-label="Button ${index}: [^"]+"`));
    assert.doesNotMatch(contents, /Confirm|ability|Pick up|Boost|Hangar/);
  }
  for (let axis = 0; axis < 4; axis++) {
    assert.match(html, new RegExp(`<label for="axis-${axis}">[^<]+</label\\s*>`));
    assert.match(html, new RegExp(`<output[^>]*id="axis-${axis}-value"[^>]*>0\\.00</output>`));
    assert.match(
      html,
      new RegExp(`<input[^>]*id="axis-${axis}"[^>]*type="range"[^>]*min="-1"[^>]*max="1"`),
    );
  }
  assert.match(html, /Default layout only:/);
  assert.match(html, /configured menu Confirm/);
});
