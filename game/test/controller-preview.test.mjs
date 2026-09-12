import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  attachControllerPreview,
  parseControllerPreviewSnapshot,
  parseControllerPreviewStatus,
  CONTROLLER_PREVIEW_FORMAT,
  CONTROLLER_PREVIEW_STATUS_FORMAT,
  CONTROLLER_PREVIEW_LEASE_MS,
} from '../ui/controller-preview.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { entryScenario } from '../playground/model.mjs';
import { prepareScenario } from '../imports.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';

const packet = (sequence = 0, pressed = [], connected = true) => ({
  format: CONTROLLER_PREVIEW_FORMAT,
  sequence,
  pad: {
    index: 0,
    connected,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, (_, i) => pressed.includes(i)),
  },
});
const feedback = () => ({
  scope: 'settings-dialog',
  focusedId: 'music-select',
  focusedLabel: 'Music style',
  assigned: true,
  message: 'Controller ready.',
});
function fixture() {
  const listeners = new Map(),
    posts = [],
    origin = 'http://localhost:8767';
  let time = 0;
  const parent = {
    location: { origin },
    postMessage: (data, target) => posts.push({ data, target }),
  };
  const host = {
    parent,
    location: { origin },
    performance: { now: () => time },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const bridge = attachControllerPreview({ enabled: true, window: host });
  return {
    host,
    parent,
    bridge,
    listeners,
    posts,
    advance: (delta) => {
      time += delta;
    },
    send: (data, extra = {}) =>
      listeners.get('message')?.({ source: parent, origin, data, ...extra }),
    get time() {
      return time;
    },
  };
}

test('preview is inert unless enabled in a nonopaque same-origin iframe', () => {
  const f = fixture();
  assert.equal(attachControllerPreview({ window: f.host }), null);
  assert.equal(attachControllerPreview({ enabled: true, window: null }), null);
  const top = { location: f.host.location };
  top.parent = top;
  assert.equal(attachControllerPreview({ enabled: true, window: top }), null);
  assert.equal(
    attachControllerPreview({ enabled: true, window: { ...f.host, location: { origin: 'null' } } }),
    null,
  );
  assert.equal(
    attachControllerPreview({
      enabled: true,
      window: { ...f.host, parent: { location: { origin: 'https://other.test' } } },
    }),
    null,
  );
  const parent = {};
  Object.defineProperty(parent, 'location', {
    get() {
      throw new Error('Cross origin');
    },
  });
  assert.equal(attachControllerPreview({ enabled: true, window: { ...f.host, parent } }), null);
});

test('snapshots reject non-finite, oversized, sparse, unknown and disconnected-held data', () => {
  for (const mutate of [
    (v) => {
      v.pad.axes[0] = NaN;
    },
    (v) => {
      v.pad.axes[1] = Infinity;
    },
    (v) => {
      v.pad.axes[0] = 1.01;
    },
    (v) => {
      v.pad.axes.push(0);
    },
    (v) => {
      delete v.pad.axes[0];
    },
    (v) => {
      v.pad.buttons.push(false);
    },
    (v) => {
      v.pad.buttons[2] = 1;
    },
    (v) => {
      delete v.pad.buttons[2];
    },
    (v) => {
      v.pad.buttons.extra = false;
    },
    (v) => {
      v.pad.index = 1;
    },
    (v) => {
      v.pad.connected = 'true';
    },
    (v) => {
      v.command = 'win';
    },
    (v) => {
      v.pad.id = 'arbitrary';
    },
    (v) => {
      v.sequence = -1;
    },
    (v) => {
      v.sequence = Number.MAX_SAFE_INTEGER + 1;
    },
    (v) => {
      v.pad.connected = false;
      v.pad.buttons[0] = true;
    },
    (v) => {
      v.pad.connected = false;
      v.pad.axes[0] = 0.01;
    },
    (v) => {
      v.format = 'revealline.game-command.v1';
    },
    (v) => {
      v[Symbol('hidden')] = 1;
    },
  ]) {
    const value = packet();
    mutate(value);
    assert.equal(parseControllerPreviewSnapshot(value), null);
  }
  const valid = packet();
  valid.pad.buttons = [];
  valid.pad.axes = [-1, 1];
  assert.deepEqual(parseControllerPreviewSnapshot(valid), valid);
});

test('local parser callers cannot execute getters or inject custom prototypes', () => {
  let executed = 0;
  for (const target of ['sequence', 'axes', 'array']) {
    const value = packet();
    const object =
      target === 'sequence' ? value : target === 'axes' ? value.pad : value.pad.buttons;
    const key = target === 'array' ? '0' : target;
    Object.defineProperty(object, key, {
      enumerable: true,
      get() {
        executed++;
        return 0;
      },
    });
    assert.equal(parseControllerPreviewSnapshot(value), null);
  }
  assert.equal(executed, 0);
  const value = packet();
  Object.setPrototypeOf(value.pad, { dangerous: true });
  assert.equal(parseControllerPreviewSnapshot(value), null);
  const safe = packet();
  Object.setPrototypeOf(safe.pad, null);
  assert.ok(parseControllerPreviewSnapshot(safe));
});

test('wrong windows, origin, duplicate sequences and older packets cannot steer', () => {
  const f = fixture();
  f.send(packet(0), { source: {} });
  f.send(packet(0), { origin: 'https://other.test' });
  assert.deepEqual(f.bridge.readPads(), []);
  f.send(packet(1));
  f.send(packet(2, [15]));
  f.send(packet(2, [14]));
  f.send(packet(0, [14]));
  assert.equal(f.bridge.readPads()[0].buttons[15].pressed, true);
  assert.equal(f.bridge.readPads()[0].buttons[14].pressed, false);
});

test('first input needs neutral and readPads yields independent fixed descriptors', () => {
  const f = fixture();
  f.send(packet(0, [0]));
  assert.deepEqual(f.bridge.readPads(), []);
  const neutral = packet(1);
  neutral.pad.buttons = [];
  f.send(neutral);
  const first = f.bridge.readPads()[0];
  assert.equal(first.mapping, 'standard');
  assert.match(first.id, /simulated/);
  assert.equal(first.buttons.length, 16);
  first.axes[0] = 1;
  first.buttons[0].pressed = true;
  assert.equal(f.bridge.readPads()[0].axes[0], 0);
  assert.equal(f.bridge.readPads()[0].buttons[0].pressed, false);
  f.send(packet(2, [0]));
  assert.equal(f.bridge.readPads()[0].buttons[0].value, 1);
});

test('lifecycle clear cannot resurrect stale held heartbeats before a real release', () => {
  const f = fixture();
  f.send(packet(0));
  f.send(packet(1, [15, 5]));
  f.bridge.clear();
  f.send(packet(2, [15, 5]));
  assert.ok(f.bridge.readPads()[0].buttons.every((button) => !button.pressed));
  f.send(packet(3));
  f.send(packet(4, [12]));
  assert.equal(f.bridge.readPads()[0].buttons[12].pressed, true);
});

test('expired or explicit disconnect drops the device and stale held input cannot reconnect', () => {
  const f = fixture();
  f.send(packet(0));
  f.send(packet(1, [15]));
  f.advance(CONTROLLER_PREVIEW_LEASE_MS + 1);
  assert.deepEqual(f.bridge.readPads(), []);
  f.send(packet(2, [15]));
  assert.deepEqual(f.bridge.readPads(), []);
  f.send(packet(3));
  assert.equal(f.bridge.readPads().length, 1);
  f.send(packet(4, [], false));
  assert.deepEqual(f.bridge.readPads(), []);
  f.send(packet(5, [0]));
  assert.deepEqual(f.bridge.readPads(), []);
  f.send(packet(6));
  assert.equal(f.bridge.readPads().length, 1);
});

test('untrusted traffic never extends the input lease', () => {
  const f = fixture();
  f.send(packet(0));
  f.advance(1000);
  f.send(packet(1), { source: {} });
  f.send({ ...packet(1), unexpected: true });
  f.send(packet(0));
  f.advance(201);
  assert.deepEqual(f.bridge.readPads(), []);
});

test('a late held heartbeat cannot hide an expired lease between app samples', () => {
  const f = fixture();
  f.send(packet(0));
  f.send(packet(1, [15]));
  f.advance(1201);
  f.send(packet(2, [15]));
  assert.deepEqual(f.bridge.readPads(), []);
  f.send(packet(3));
  assert.equal(f.bridge.readPads().length, 1);
});

test('bounded feedback is changed-only, throttled and sent to the exact parent origin', () => {
  const f = fixture();
  assert.equal(f.bridge.report(feedback()), true);
  assert.equal(f.bridge.report(feedback()), false);
  const next = { ...feedback(), focusedLabel: 'Master volume' };
  assert.equal(f.bridge.report(next), false);
  f.advance(100);
  assert.equal(f.bridge.report(next), true);
  assert.equal(f.posts.length, 2);
  assert.equal(f.posts[1].target, f.host.location.origin);
  assert.equal(f.posts[1].data.sequence, 1);
  assert.deepEqual(parseControllerPreviewStatus(f.posts[1].data), f.posts[1].data);
  assert.equal(f.bridge.report({ ...next, run: {} }), false);
  assert.equal(f.bridge.report({ ...next, focusedLabel: 'a'.repeat(161) }), false);
  assert.equal(f.bridge.report({ ...next, assigned: { index: 0 } }), false);
});

test('feedback parser rejects hidden commands, oversized fields and invalid sequences', () => {
  const valid = { format: CONTROLLER_PREVIEW_STATUS_FORMAT, sequence: 0, ...feedback() };
  assert.deepEqual(parseControllerPreviewStatus(valid), valid);
  assert.equal(parseControllerPreviewStatus({ ...valid, sequence: -1 }), null);
  assert.equal(parseControllerPreviewStatus({ ...valid, message: 'a'.repeat(241) }), null);
  assert.equal(parseControllerPreviewStatus({ ...valid, scene: 'won' }), null);
  assert.equal(parseControllerPreviewStatus({ ...valid, assigned: 1 }), null);
});

test('destroy detaches bridge and suppresses subsequent input and feedback', () => {
  const f = fixture();
  f.send(packet());
  f.bridge.destroy();
  f.bridge.destroy();
  assert.equal(f.listeners.size, 0);
  assert.deepEqual(f.bridge.readPads(), []);
  assert.equal(f.bridge.report(feedback()), false);
});

test('virtual transport drives the real router through join, ready, flight, pause and disconnect', () => {
  const f = fixture(),
    router = createControllerRouter({ readPads: f.bridge.readPads, eventTarget: null });
  let seq = 0;
  const sample = (pressed = [], scope = 'ready', connected = true) => {
    f.send(packet(seq++, pressed, connected));
    return router.sample({ scope, timeMs: f.time });
  };
  assert.equal(sample().status.code, 'ready-to-join');
  assert.equal(sample([0]).status.code, 'joined');
  sample();
  assert.equal(sample([0]).ui.confirm, true);
  assert.equal(sample([0], 'flight').flight.action, false);
  sample([], 'flight');
  const flying = sample([15, 5, 0], 'flight');
  assert.equal(flying.flight.direction, 'right');
  assert.equal(flying.flight.boost, true);
  assert.equal(flying.flight.action, true);
  assert.equal(sample([9], 'flight').flight.pause, true);
  assert.equal(sample([9], 'paused').ui.menu, false);
  sample([], 'paused');
  assert.equal(sample([0], 'paused').ui.confirm, true);
  assert.equal(sample([], 'paused', false).disconnected, true);
  router.destroy();
});

test('heartbeat loss reaches the real router as device loss requiring deliberate rejoin', () => {
  const f = fixture(),
    router = createControllerRouter({ readPads: f.bridge.readPads, eventTarget: null });
  const sample = () => router.sample({ scope: 'flight', timeMs: f.time });
  f.send(packet(0));
  sample();
  f.send(packet(1, [0]));
  sample();
  f.send(packet(2));
  sample();
  f.send(packet(3, [15]));
  assert.equal(sample().flight.direction, 'right');
  f.advance(1201);
  assert.equal(sample().disconnected, true);
  f.send(packet(4));
  assert.equal(sample().assigned, null);
  f.send(packet(5, [0]));
  assert.equal(sample().status.code, 'joined');
  router.destroy();
});

test('all offered base and Fieldcraft missions prepare through the real practice pipeline in both policies', async () => {
  const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const [campaign, themes, classRecipes, fieldcraft] = await Promise.all([
    json('../content/campaign.json'),
    json('../content/themes.json'),
    json('../content/classes.json'),
    json('../content/packs/fieldcraft.json'),
  ]);
  const { pack } = await preparePack(fieldcraft);
  const entries = [
    { campaign, themes: themes.themes, classRecipes },
    ...pack.campaigns.map((c) => resolvePackCampaign(pack, c.id)),
  ];
  let count = 0;
  for (const entry of entries)
    for (const level of entry.campaign.levels)
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const original = JSON.stringify(entry);
        const { scenario } = await prepareScenario(
          entryScenario(entry, level.id, { classId: 'scout', turnPolicy, seed: 1 }),
        );
        assert.equal(scenario.level.id, level.id);
        assert.equal(scenario.settings.turnPolicy, turnPolicy);
        assert.equal(JSON.stringify(entry), original);
        count++;
      }
  assert.equal(count, 32);
});
