import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFlightLayout, attachFlightLayout } from '../ui/flight-layout.mjs';

const viewports = [
  [956, 440],
  [956, 330],
  [874, 402],
  [874, 300],
  [852, 393],
  [844, 390],
  [915, 412],
  [800, 360],
  [740, 360],
  [667, 375],
  [667, 280],
  [568, 256],
  [1133, 744],
  [1180, 820],
  [1280, 800],
  [1024, 600],
];
for (const [width, height] of viewports) {
  for (const largeText of [false, true]) {
    test(`${width}×${height}, ${largeText ? 'large' : 'standard'} text: whole board outside HUD`, () => {
      for (const aspect of [1, 4 / 3, 16 / 9, 2, 2.5]) {
        // Also cover a landscape notch and a visible home indicator.
        for (const [left, right, bottom] of [
          [4, 4, 4],
          [62, 62, 21],
        ]) {
          const w = width - left - right;
          const h = height - 4 - bottom;
          const { board, mode, railWidth, stripHeight } = fitFlightLayout({
            width: w,
            height: h,
            aspect,
            largeText,
          });
          assert.ok(board.width > 0 && board.height > 0);
          assert.ok(board.x >= 0 && board.y >= 0);
          assert.ok(board.x + board.width <= w + 1e-8);
          assert.ok(board.y + board.height <= h + 1e-8);
          assert.ok(Math.abs(board.width / board.height - aspect) < 1e-8);
          if (mode === 'rail') assert.ok(board.x >= railWidth + 8 - 1e-8);
          else assert.ok(board.y >= stripHeight - 1e-8);
          // Always at least as large as a safe horizontal HUD fit.
          assert.ok(board.width + 1e-8 >= Math.min(w, (h - stripHeight) * aspect));
        }
      }
    });
  }
}
test('wide Safari viewport keeps the board at full available height beside the HUD', () => {
  const { mode, board } = fitFlightLayout({ width: 832, height: 305, aspect: 2 });
  assert.equal(mode, 'rail');
  assert.equal(board.height, 305);
  assert.equal(board.width, 610);
});
test('short landscape uses the larger rail fit until its controls no longer fit vertically', () => {
  assert.equal(fitFlightLayout({ width: 560, height: 248, aspect: 2 }).mode, 'rail');
  assert.equal(fitFlightLayout({ width: 560, height: 220, aspect: 2 }).mode, 'strip');
});
test('empty/invalid measurements cannot produce a broken layout', () => {
  for (const args of [
    { width: 0, height: 300 },
    { width: 600, height: 0 },
    { width: 600, height: 300, aspect: NaN },
  ])
    assert.equal(fitFlightLayout(args), null);
});

test('left-handed steering puts the HUD on the right without shrinking the board', () => {
  const args = { width: 948, height: 322, aspect: 2 };
  const left = fitFlightLayout(args);
  const right = fitFlightLayout({ ...args, railSide: 'right' });
  assert.equal(right.mode, 'rail');
  assert.equal(right.board.width, left.board.width);
  assert.equal(right.board.height, left.board.height);
  assert.ok(right.board.x + right.board.width < right.chromeX);
  assert.equal(right.chromeX + right.railWidth, args.width);
});

test('rotating fullscreen to portrait keeps the HUD and thumb controls off the board', () => {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [440, 956],
    [744, 1133],
  ]) {
    for (const largeText of [false, true]) {
      const layout = fitFlightLayout({
        width,
        height,
        aspect: 4 / 3,
        largeText,
        portraitControlHeight: 228,
      });
      assert.equal(layout.mode, 'portrait');
      assert.ok(layout.board.y >= layout.stripHeight);
      assert.ok(layout.board.y + layout.board.height <= height - 228 + 1e-8);
    }
  }
});

test('lessons reserve instruction space instead of covering the board with the task', () => {
  for (const [width, height] of [
    [956, 330],
    [568, 256],
    [440, 956],
  ]) {
    const lesson = fitFlightLayout({ width, height, aspect: 4 / 3, taskHeight: 48 });
    assert.notEqual(lesson.mode, 'rail');
    assert.ok(lesson.board.y >= lesson.stripHeight);
    assert.ok(lesson.stripHeight >= 104);
  }
});

// Exercise the browser adapter's event boundaries without a browser or game
// simulation: viewport changes, settings, fullscreen, and course navigation.
function layoutHost() {
  class Node {
    dataset = {};
    children = [];
    values = {};
    style = { setProperty: (name, value) => (this.values[name] = value) };
    setAttribute() {}
    append(node) {
      node.remove();
      this.children.push(node);
      node.parentElement = this;
    }
    insertBefore(node, sibling) {
      node.remove();
      const index = this.children.indexOf(sibling);
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
      node.parentElement = this;
    }
    remove() {
      if (this.parentElement) {
        const siblings = this.parentElement.children;
        siblings.splice(siblings.indexOf(this), 1);
        this.parentElement = null;
      }
    }
    get nextSibling() {
      const siblings = this.parentElement?.children || [];
      return siblings[siblings.indexOf(this) + 1] || null;
    }
  }
  const root = new Node(),
    body = new Node(),
    panel = new Node(),
    task = new Node(),
    after = new Node(),
    card = new Node();
  const classes = new Set();
  body.classList = { contains: (value) => classes.has(value) };
  body.append(panel);
  body.append(after);
  const dimensions = { width: 956, height: 330 };
  const media = {
    matches: true,
    addEventListener(_event, callback) {
      this.change = callback;
    },
    removeEventListener() {
      this.change = null;
    },
  };
  const menuMedia = { ...media };
  const displayMode = { ...media, matches: false };
  const observers = [],
    frames = new Map();
  let serial = 0;
  class Observer {
    targets = [];
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(...args) {
      this.targets.push(args);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  const doc = {
    documentElement: root,
    body,
    getElementById: (id) => (id === 'first-flight-task' ? task : panel),
    querySelector: () => card,
    addEventListener(_event, callback) {
      this.fullscreenChange = callback;
    },
    removeEventListener() {
      this.fullscreenChange = null;
    },
    createElement() {
      const node = new Node();
      node.getBoundingClientRect = () => dimensions;
      return node;
    },
  };
  const win = {
    ResizeObserver: Observer,
    MutationObserver: Observer,
    matchMedia: (query) =>
      query.includes('display-mode')
        ? displayMode
        : query.includes('any-pointer')
          ? media
          : menuMedia,
    requestAnimationFrame(callback) {
      const id = ++serial;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    getComputedStyle: () => ({
      paddingLeft: '4px',
      paddingRight: '4px',
      paddingTop: '4px',
      paddingBottom: '4px',
      getPropertyValue: () => '2',
    }),
  };
  const flush = () => {
    for (const [id, callback] of frames) {
      frames.delete(id);
      callback();
    }
  };
  return {
    doc,
    win,
    root,
    body,
    panel,
    task,
    after,
    card,
    classes,
    dimensions,
    media,
    menuMedia,
    displayMode,
    observers,
    frames,
    flush,
  };
}

test('browser viewport/settings events update geometry once per frame and dispose cleanly', () => {
  const host = layoutHost();
  const detach = attachFlightLayout({ document: host.doc, window: host.win });
  assert.equal(host.body.dataset.flightLayout, 'rail');
  assert.equal(host.body.values['--flight-height'], '322px');
  host.body.dataset.touchSide = 'left';
  host.observers[1].callback();
  host.observers[0].callback();
  assert.equal(host.frames.size, 1);
  host.flush();
  assert.equal(host.body.values['--flight-left'], '840px');
  host.root.dataset.gameFullscreen = 'true';
  host.dimensions.width = 440;
  host.dimensions.height = 956;
  host.media.matches = false;
  host.media.change();
  host.flush();
  assert.equal(host.body.dataset.flightLayout, 'portrait');
  delete host.root.dataset.gameFullscreen;
  host.observers[1].callback();
  host.flush();
  assert.equal(host.body.dataset.flightLayout, undefined);
  host.observers[0].callback();
  detach();
  assert.equal(host.frames.size, 0);
  assert.ok(host.observers.every((observer) => observer.disconnected));
  assert.equal(host.media.change, null);
  assert.equal(host.displayMode.change, null);
  assert.equal(host.doc.fullscreenChange, null);
  assert.equal(host.body.children.length, 2);
});

test('native fullscreen and installed display modes reserve portrait HUD space', () => {
  for (const kind of ['fullscreen', 'standalone', 'ios']) {
    const host = layoutHost();
    host.media.matches = false;
    host.dimensions.width = 440;
    host.dimensions.height = 956;
    const detach = attachFlightLayout({ document: host.doc, window: host.win });
    assert.equal(host.body.dataset.flightLayout, undefined);
    if (kind === 'fullscreen') host.doc.fullscreenElement = host.root;
    if (kind === 'standalone') host.displayMode.matches = true;
    if (kind === 'ios') host.win.navigator = { standalone: true };
    host.doc.fullscreenChange();
    host.flush();
    assert.equal(host.body.dataset.flightLayout, 'portrait', kind);
    assert.ok(parseFloat(host.body.values['--flight-y']) >= 104);
    detach();
  }
});

test('compact course controls join the scrollable menu and return to their original position', () => {
  const host = layoutHost();
  const detach = attachFlightLayout({ document: host.doc, window: host.win });
  host.classes.add('first-flight-session');
  const bodyObservation = host.observers[1].targets.find(([target]) => target === host.body);
  assert.ok(bodyObservation[1].attributeFilter.includes('class'));
  host.observers[1].callback();
  host.flush();
  assert.equal(host.panel.parentElement, host.card);
  assert.equal(host.body.dataset.flightLayout, 'strip');
  assert.equal(host.body.values['--flight-strip-height'], '104px');
  host.media.matches = false;
  host.media.change();
  host.flush();
  assert.equal(host.body.dataset.flightLayout, undefined);
  assert.equal(
    host.panel.parentElement,
    host.card,
    'portrait mobile menus retain course navigation',
  );
  host.menuMedia.matches = false;
  host.menuMedia.change();
  host.flush();
  assert.equal(host.panel.parentElement, host.body);
  assert.equal(host.panel.nextSibling, host.after);
  host.media.matches = true;
  host.media.change();
  host.flush();
  detach();
  assert.equal(host.panel.parentElement, host.body);
  assert.equal(host.panel.nextSibling, host.after);
});

test('long lesson instructions resize their reserved space and leave a visible board', () => {
  const host = layoutHost();
  host.classes.add('first-flight-session');
  const detach = attachFlightLayout({ document: host.doc, window: host.win });
  host.task.scrollHeight = 160;
  host.observers[1].callback();
  host.flush();
  assert.equal(host.body.values['--flight-strip-height'], '128px');
  assert.equal(host.body.values['--flight-y'], '132px');
  host.body.dataset.textSize = 'large';
  host.dimensions.width = 568;
  host.dimensions.height = 256;
  host.task.scrollHeight = 240;
  host.observers[0].callback();
  host.flush();
  const top = parseFloat(host.body.values['--flight-y']);
  const height = parseFloat(host.body.values['--flight-height']);
  assert.ok(height >= 48);
  assert.ok(top + height <= 252);
  host.dimensions.width = 320;
  host.dimensions.height = 568;
  host.body.dataset.screenControls = 'shown';
  host.body.dataset.touchSize = 'large';
  host.task.scrollHeight = 600;
  host.observers[0].callback();
  host.flush();
  assert.equal(host.body.dataset.flightLayout, 'portrait');
  assert.ok(parseFloat(host.body.values['--flight-height']) >= 48);
  assert.ok(
    parseFloat(host.body.values['--flight-y']) + parseFloat(host.body.values['--flight-height']) <=
      568 - 4 - 228,
    'long instructions also leave room for the large portrait thumb control',
  );
  assert.ok(
    host.observers[1].targets.some(
      ([target, options]) => target === host.task && options.characterData,
    ),
  );
  detach();
});

test('ordinary portrait browsers get a compact header without requesting fullscreen', () => {
  const host = layoutHost();
  host.dimensions.width = 440;
  host.dimensions.height = 760;
  const detach = attachFlightLayout({ document: host.doc, window: host.win });
  assert.equal(host.body.dataset.flightLayout, 'portrait');
  assert.equal(host.body.values['--flight-y'], '104px');
  assert.equal(host.body.values['--flight-width'], '432px');
  assert.equal(host.body.values['--flight-height'], '216px');
  detach();
});

test('warning-capable missions reserve space and D-pads stay outside either side of the board', () => {
  for (const [width, height] of viewports) {
    for (const largeText of [false, true]) {
      for (const railSide of ['left', 'right']) {
        const args = {
          width,
          height,
          largeText,
          railSide,
          aspect: 2,
          steeringWidth: 180,
          warnings: true,
        };
        const layout = fitFlightLayout(args);
        const { board } = layout;
        assert.ok(board.width > 0 && board.height > 0);
        assert.ok(board.y + board.height <= height + 1e-8);
        if (railSide === 'right') assert.ok(board.x >= 180);
        else assert.ok(board.x + board.width <= width - 180 + 1e-8);
        if (layout.mode === 'rail') assert.ok(height >= (largeText ? 424 : 360));
        else assert.ok(board.y >= layout.stripHeight);
      }
    }
  }
});

test('portrait warning rows and large controls fit inside browser chrome constraints', () => {
  for (const width of [320, 360, 393, 440]) {
    const { board, stripHeight } = fitFlightLayout({
      width,
      height: 568,
      aspect: 2,
      warnings: true,
      largeText: true,
      portraitControlHeight: 228,
    });
    assert.ok(board.y >= stripHeight);
    assert.ok(board.y + board.height <= 340 + 1e-8);
    assert.ok(board.width > 0);
  }
});

test('warning phase changes do not resize the board; authored layout changes do', () => {
  const host = layoutHost();
  host.body.dataset.flightWarnings = 'true';
  const detach = attachFlightLayout({ document: host.doc, window: host.win });
  const before = { ...host.body.values };
  host.observers[1].callback();
  host.flush();
  assert.deepEqual(host.body.values, before);
  host.body.dataset.flightWarnings = 'false';
  host.observers[1].callback();
  host.flush();
  assert.equal(host.body.dataset.flightLayout, 'rail');
  assert.ok(
    parseFloat(host.body.values['--flight-height']) > parseFloat(before['--flight-height']),
  );
  detach();
});

test('manual actions and a large D-pad each own space outside the board', () => {
  for (const railSide of ['left', 'right']) {
    for (const height of [248, 322, 432]) {
      const args = {
        width: 948,
        height,
        aspect: 4 / 3,
        largeText: true,
        steeringWidth: 216,
        actionWidth: 112,
        railSide,
      };
      const { board, mode, railWidth } = fitFlightLayout(args);
      const rail = mode === 'rail' ? railWidth + 8 : 0;
      assert.ok(board.x >= (railSide === 'right' ? 216 : 112 + rail) - 1e-8);
      assert.ok(
        board.x + board.width <= args.width - (railSide === 'right' ? 112 + rail : 216) + 1e-8,
      );
      if (height === 322) assert.equal(board.height, 322);
    }
  }
});

test('short-landscape warnings remain between manual actions and the large D-pad', () => {
  for (const railSide of ['left', 'right']) {
    const layout = fitFlightLayout({
      width: 560,
      height: 248,
      aspect: 4 / 3,
      largeText: true,
      warnings: true,
      steeringWidth: 216,
      actionWidth: 112,
      railSide,
    });
    assert.equal(layout.mode, 'strip');
    assert.equal(layout.warningWidth, 232);
    assert.equal(layout.warningX, railSide === 'right' ? 216 : 112);
    assert.ok(layout.board.y >= layout.stripHeight);
  }
});
