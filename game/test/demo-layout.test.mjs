import test from 'node:test';
import assert from 'node:assert/strict';
import { demoInfoPlacement, attachDemoLayout } from '../ui/demo-layout.mjs';

test('information fits only in unused image margins across map and viewport shapes', () => {
  for (const width of [304, 374, 651, 828, 1000, 1400]) {
    for (const height of [180, 326, 500, 700]) {
      for (const aspect of [1, 4 / 3, 16 / 9, 3]) {
        for (const textFactor of [1, 1.3]) {
          const { layout, margin } = demoInfoPlacement({ width, height, aspect, textFactor });
          if (layout === 'rows') assert.equal(margin, 0);
          else {
            const reserved = margin * (layout === 'margins' ? 2 : 1);
            assert.ok(reserved + height * aspect < width, 'Text never touches the game image.');
            assert.ok(margin >= 180 * textFactor, 'Columns retain readable text width.');
            assert.ok(width > 600, 'Portrait phones keep horizontal information.');
          }
        }
      }
    }
  }
  assert.equal(demoInfoPlacement({ width: 828, height: 326, aspect: 4 / 3 }).layout, 'margins');
  assert.equal(demoInfoPlacement({ width: 828, height: 326, aspect: 16 / 9 }).layout, 'side');
  assert.equal(demoInfoPlacement({ width: 828, height: 326, aspect: 3 }).layout, 'rows');
});

test('resize, scene changes and details update layout; disposal releases both observers', () => {
  const observers = [];
  class Observer {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  const header = { getBoundingClientRect: () => ({ height: 44 }) };
  const styles = new Map();
  const dialog = {
    open: true,
    clientWidth: 828,
    clientHeight: 374,
    dataset: {},
    querySelector: () => header,
    style: {
      getPropertyValue: (key) => styles.get(key),
      setProperty: (key, value) => styles.set(key, value),
    },
  };
  const canvas = { width: 768, height: 576 };
  const document = {
    defaultView: {
      ResizeObserver: Observer,
      MutationObserver: Observer,
      getComputedStyle: () => ({ rowGap: '4px', getPropertyValue: () => '1' }),
    },
  };
  const owner = attachDemoLayout({ document, dialog, canvas });
  assert.equal(dialog.dataset.infoLayout, 'margins');
  canvas.width = 1728;
  observers[1].callback();
  assert.equal(dialog.dataset.infoLayout, 'rows');
  canvas.width = 768;
  dialog.dataset.details = 'open';
  owner.refresh();
  assert.equal(dialog.dataset.infoLayout, 'rows');
  dialog.dataset.details = 'closed';
  owner.refresh();
  assert.equal(dialog.dataset.infoLayout, 'margins');
  owner.dispose();
  assert.ok(observers.every((item) => item.disconnected));
  dialog.clientWidth = 374;
  observers[0].callback();
  assert.equal(
    dialog.dataset.infoLayout,
    'margins',
    'Queued observer cannot mutate after disposal.',
  );
});
