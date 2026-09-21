import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoopPresentationDisplay } from '../couch/coop-presentation-display.mjs';
import { createPresentationDOMOwner } from '../presentation/dom-ownership.mjs';
import { attachMenuStyleControls } from '../ui/menu-style-controls.mjs';
import { MENU_STYLE_PREFERENCES_KEY } from '../menu-style-preferences.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const theme = (id, color) => Object.freeze({ resolved: { theme: { id, revision: 1 } }, color });
const fpv = theme('fpv', '#112233'),
  retro = theme('retro', '#442211'),
  culture = theme('culture', '#335522');
function fixture(t, initial = fpv) {
  const doc = new Document(),
    win = new Events(),
    writes = [],
    values = new Map([
      [MENU_STYLE_PREFERENCES_KEY, JSON.stringify({ palette: 'auto', ornaments: 'subtle' })],
    ]);
  win.setTimeout = () => 1;
  win.clearTimeout = () => {};
  const nodes = {};
  for (const [id, tag] of [
    ['menu-palette', 'select'],
    ['menu-ornaments', 'select'],
    ['menu-style-status', 'p'],
    ['keep-focus', 'button'],
  ]) {
    const node = doc.createElement(tag);
    node.id = id;
    doc.body.append(node);
    nodes[id] = node;
  }
  nodes['keep-focus'].focus();
  const menu = attachMenuStyleControls({
    document: doc,
    window: win,
    getStorage: () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        writes.push([key, value]);
        values.set(key, value);
      },
    }),
  });
  menu.setPresentation(initial);
  const element = doc.documentElement;
  const styles = new Map();
  element.style = {
    getPropertyValue: (key) => styles.get(key)?.value ?? '',
    getPropertyPriority: (key) => styles.get(key)?.priority ?? '',
    setProperty(key, value, priority = '') {
      styles.set(key, { value, priority });
    },
    removeProperty(key) {
      styles.delete(key);
    },
  };
  const page = createPresentationDOMOwner();
  page.style(element, '--example-color', initial?.color ?? '#000000');
  let selected = null,
    defaultSnapshot = initial,
    disposed = false,
    menuHook,
    painterHook,
    paintHook,
    optionsHook;
  const menuCalls = [],
    painterCalls = [],
    paints = [];
  const painter = {
    presentation: initial,
    setPresentation(snapshot) {
      this.presentation = snapshot;
      painterCalls.push(snapshot);
      painterHook?.(snapshot);
    },
    paint(candidate, options) {
      paints.push({ candidate, options, snapshot: this.presentation });
      paintHook?.(candidate, options);
    },
  };
  const display = createCoopPresentationDisplay({
    getSelection: () => selected,
    getDefaultSnapshot: () => defaultSnapshot,
    painter,
    element,
    initialMenuSnapshot: initial,
    setMenuPresentation(snapshot) {
      menu.setPresentation(snapshot);
      menuCalls.push(snapshot);
      menuHook?.(snapshot);
    },
    isDisposed: () => disposed,
    paintOptions() {
      optionsHook?.();
      return { reduced: true, textFace: 'plain', picture: 'must-be-overridden' };
    },
  });
  const selections = [];
  function selection(snapshot, hook) {
    const item = {
      binding: { snapshot },
      applies: 0,
      cleanups: 0,
      lease: {
        apply() {
          item.applies++;
          const layer = createPresentationDOMOwner();
          layer.style(element, '--example-color', snapshot.color);
          layer.attribute(element, 'data-test-theme', snapshot.resolved.theme.id);
          let closed = false;
          const release = () => {
            if (closed) return;
            closed = true;
            item.cleanups++;
            layer.release();
          };
          try {
            hook?.({ release, layer });
          } catch (error) {
            release();
            throw error;
          }
          return release;
        },
      },
    };
    selections.push(item);
    return item;
  }
  t.after(() => {
    display.dispose();
    menu.dispose();
    page.release();
  });
  return {
    doc,
    win,
    menu,
    display,
    painter,
    nodes,
    writes,
    menuCalls,
    painterCalls,
    paints,
    selection,
    set selected(value) {
      selected = value;
    },
    get selected() {
      return selected;
    },
    set defaultSnapshot(value) {
      defaultSnapshot = value;
    },
    set disposed(value) {
      disposed = value;
    },
    set menuHook(value) {
      menuHook = value;
    },
    set painterHook(value) {
      painterHook = value;
    },
    set paintHook(value) {
      paintHook = value;
    },
    set optionsHook(value) {
      optionsHook = value;
    },
    color: () => element.style.getPropertyValue('--example-color'),
    palette: () => doc.body.dataset.menuPalette,
    choose(palette) {
      nodes['menu-palette'].value = palette;
      nodes['menu-palette'].emit('change');
    },
    refresh() {
      win.emit('pageshow', { persisted: true });
    },
    assertUnaffected() {
      assert.equal(doc.activeElement, nodes['keep-focus']);
      assert.equal(nodes['menu-palette'].value, 'auto');
      assert.equal(nodes['menu-ornaments'].value, 'subtle');
      assert.deepEqual(writes, []);
    },
  };
}

test('sync adopts exact painter, menu Auto palette and DOM layer, then restores page default', (t) => {
  const f = fixture(t);
  assert.equal(f.display.sync(), true);
  const selected = f.selection(retro);
  f.selected = selected;
  assert.equal(f.display.sync(), true);
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.color(), retro.color);
  assert.equal(f.palette(), 'authored');
  assert.equal(f.display.sync(), true);
  assert.equal(selected.applies, 1);
  f.selected = null;
  assert.equal(f.display.sync(), true);
  assert.equal(f.painter.presentation, fpv);
  assert.equal(f.color(), fpv.color);
  assert.equal(f.palette(), 'ukrainian');
  assert.equal(selected.cleanups, 1);
  f.assertUnaffected();
});

test('menu setter that writes then throws restores visible and internal Auto theme before fast-path retry', (t) => {
  const f = fixture(t);
  f.display.sync();
  const previous = f.selection(retro);
  f.selected = previous;
  f.display.sync();
  const rejected = f.selection(fpv);
  f.selected = rejected;
  f.menuHook = (snapshot) => {
    if (snapshot === fpv) throw Error('after menu write');
  };
  assert.throws(() => f.display.sync(), /after menu write/);
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.color(), retro.color);
  assert.equal(f.palette(), 'authored');
  f.refresh();
  assert.equal(
    f.palette(),
    'authored',
    'stored menu theme was rolled back, not only data attribute',
  );
  f.menuHook = null;
  f.selected = previous;
  assert.equal(f.display.sync(), true);
  assert.equal(f.palette(), 'authored');
  assert.equal(rejected.cleanups, 1);
  assert.equal(previous.cleanups, 1);
  f.assertUnaffected();
});

test('stale setter restores previous menu even when selection changes without recursive sync', (t) => {
  const f = fixture(t);
  f.display.sync();
  const previous = f.selection(retro);
  f.selected = previous;
  f.display.sync();
  const rejected = f.selection(fpv);
  f.selected = rejected;
  f.menuHook = (snapshot) => {
    if (snapshot === fpv) f.selected = previous;
  };
  assert.equal(f.display.sync(), false);
  assert.equal(f.color(), retro.color);
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.palette(), 'authored');
  f.refresh();
  assert.equal(f.palette(), 'authored');
  f.menuHook = null;
  assert.equal(f.display.sync(), true);
  assert.equal(rejected.cleanups, 1);
});

test('first failed transaction restores null menu fallback and null painter explicitly', (t) => {
  const f = fixture(t, null),
    rejected = f.selection(retro);
  f.selected = rejected;
  f.menuHook = (snapshot) => {
    if (snapshot === retro) throw Error('reject initial');
  };
  assert.throws(() => f.display.sync(), /reject initial/);
  assert.equal(f.painter.presentation, null);
  assert.equal(f.palette(), 'ukrainian');
  assert.equal(f.menuCalls.at(-1), null);
  f.refresh();
  assert.equal(f.palette(), 'ukrainian');
  assert.equal(f.color(), '#000000');
  f.menuHook = null;
  f.selected = null;
  assert.equal(f.display.sync(), true);
  f.assertUnaffected();
});

test('failed application leaves prior owner and palette intact without double cleanup', (t) => {
  const f = fixture(t);
  f.display.sync();
  const previous = f.selection(retro);
  f.selected = previous;
  f.display.sync();
  const rejected = f.selection(fpv, () => {
    throw Error('apply failed after layer');
  });
  f.selected = rejected;
  assert.throws(() => f.display.sync(), /apply failed/);
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.palette(), 'authored');
  assert.equal(f.color(), retro.color);
  assert.equal(rejected.cleanups, 1);
  assert.equal(previous.cleanups, 0);
  f.assertUnaffected();
});

test('painter setter failure after mutation rolls both surfaces back', (t) => {
  const f = fixture(t);
  f.display.sync();
  const rejected = f.selection(retro);
  f.selected = rejected;
  f.painterHook = (snapshot) => {
    if (snapshot === retro) throw Error('painter failed after write');
  };
  assert.throws(() => f.display.sync(), /painter failed/);
  assert.equal(f.painter.presentation, fpv);
  assert.equal(f.palette(), 'ukrainian');
  assert.equal(f.color(), fpv.color);
  assert.equal(rejected.cleanups, 1);
});

test('menu callback reentering a newer accepted owner cannot be rolled back by outer stale transaction', (t) => {
  const f = fixture(t);
  f.display.sync();
  const rejected = f.selection(retro),
    newer = f.selection(culture);
  f.selected = rejected;
  f.menuHook = (snapshot) => {
    if (snapshot === retro) {
      f.selected = newer;
      assert.equal(f.display.sync(), true);
    }
  };
  assert.equal(f.display.sync(), false);
  assert.equal(f.painter.presentation, culture);
  assert.equal(f.color(), culture.color);
  assert.equal(f.palette(), 'authored');
  assert.equal(f.menuCalls.at(-1), culture);
  assert.equal(rejected.cleanups, 1);
  assert.equal(newer.cleanups, 0);
  f.refresh();
  assert.equal(f.palette(), 'authored');
  assert.equal(f.display.sync(), true);
  assert.equal(newer.applies, 1);
});

test('throw after newer menu owner commits preserves that owner', (t) => {
  const f = fixture(t);
  f.display.sync();
  const rejected = f.selection(retro),
    newer = f.selection(fpv);
  f.selected = rejected;
  f.menuHook = (snapshot) => {
    if (snapshot === retro) {
      f.selected = newer;
      f.display.sync();
      throw Error('outer rejected');
    }
  };
  assert.throws(() => f.display.sync(), /outer rejected/);
  assert.equal(f.painter.presentation, fpv);
  assert.equal(f.color(), fpv.color);
  assert.equal(f.palette(), 'ukrainian');
  assert.equal(newer.cleanups, 0);
  assert.equal(rejected.cleanups, 1);
  f.refresh();
  assert.equal(f.palette(), 'ukrainian');
});

test('application callback reentry preserves newer DOM layers and does not call stale menu setter', (t) => {
  const f = fixture(t);
  f.display.sync();
  const newer = f.selection(culture);
  const rejected = f.selection(retro, () => {
    f.selected = newer;
    f.display.sync();
  });
  f.selected = rejected;
  assert.equal(f.display.sync(), false);
  assert.equal(f.color(), culture.color);
  assert.equal(f.painter.presentation, culture);
  assert.equal(f.menuCalls.includes(retro), false);
  assert.equal(rejected.cleanups, 1);
  assert.equal(newer.cleanups, 0);
});

test('rollback callback reentry stops before overwriting newer painter', (t) => {
  const f = fixture(t);
  f.display.sync();
  const previous = f.selection(retro);
  f.selected = previous;
  f.display.sync();
  const newer = f.selection(culture),
    rejected = f.selection(fpv);
  f.selected = rejected;
  let rejecting = true;
  f.menuHook = (snapshot) => {
    if (snapshot === fpv && rejecting) {
      rejecting = false;
      throw Error('rejected');
    }
    if (snapshot === retro && !rejecting) {
      f.selected = newer;
      f.display.sync();
    }
  };
  assert.throws(() => f.display.sync(), /rejected/);
  assert.equal(f.painter.presentation, culture);
  assert.equal(f.color(), culture.color);
  assert.equal(f.palette(), 'authored');
  assert.equal(newer.cleanups, 0);
  assert.equal(rejected.cleanups, 1);
});

test('preflight uses exact binding/options but never adopts menu/DOM and restores painter on failure', (t) => {
  const f = fixture(t);
  f.display.sync();
  const beforeMenus = f.menuCalls.length;
  const candidate = { id: 'new-run' },
    binding = { snapshot: retro };
  f.display.paintPrepared(candidate, binding);
  assert.deepEqual(f.paints.at(-1), {
    candidate,
    options: { reduced: true, textFace: 'plain', picture: binding },
    snapshot: retro,
  });
  assert.equal(f.painter.presentation, fpv);
  assert.equal(f.menuCalls.length, beforeMenus);
  assert.equal(f.color(), fpv.color);
  assert.equal(f.palette(), 'ukrainian');
  f.paintHook = () => {
    throw Error('preflight paint failed');
  };
  assert.throws(() => f.display.paintPrepared(candidate, binding), /preflight paint failed/);
  assert.equal(f.painter.presentation, fpv);
  f.assertUnaffected();
});

test('preflight never restores over reentrant newer owner even when snapshot reference is equal', (t) => {
  const f = fixture(t);
  f.display.sync();
  const newer = f.selection(retro);
  f.paintHook = () => {
    f.selected = newer;
    f.display.sync();
  };
  assert.throws(() => f.display.paintPrepared({}, { snapshot: retro }), { name: 'AbortError' });
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.color(), retro.color);
  assert.equal(f.palette(), 'authored');
  assert.equal(newer.cleanups, 0);
});

test('nested preflights restore in stack order without menu adoption', (t) => {
  const f = fixture(t);
  f.display.sync();
  let nested = false;
  f.paintHook = () => {
    if (!nested) {
      nested = true;
      f.display.paintPrepared({ inner: true }, { snapshot: culture });
      assert.equal(f.painter.presentation, retro);
    }
  };
  f.display.paintPrepared({ outer: true }, { snapshot: retro });
  assert.equal(f.painter.presentation, fpv);
  assert.equal(f.color(), fpv.color);
  assert.equal(f.palette(), 'ukrainian');
});

test('preflight options reentry aborts before stale painting or candidate mutation', (t) => {
  const f = fixture(t);
  f.display.sync();
  const newer = f.selection(culture);
  f.optionsHook = () => {
    f.selected = newer;
    f.display.sync();
  };
  assert.throws(() => f.display.paintPrepared({}, { snapshot: retro }), { name: 'AbortError' });
  assert.equal(f.paints.length, 0);
  assert.equal(f.painter.presentation, culture);
  assert.equal(f.color(), culture.color);
});

test('explicit palette preference stays unchanged across adoption and rollback', (t) => {
  const f = fixture(t);
  f.choose('ukrainian');
  const before = [...f.writes];
  f.display.sync();
  const selected = f.selection(retro);
  f.selected = selected;
  f.display.sync();
  assert.equal(f.palette(), 'ukrainian');
  f.refresh();
  assert.equal(f.palette(), 'ukrainian');
  assert.equal(f.nodes['menu-palette'].value, 'ukrainian');
  assert.deepEqual(f.writes, before);
});

test('dispose releases DOM layer once and never paints or rewrites separately owned menu afterwards', (t) => {
  const f = fixture(t);
  f.display.sync();
  const selected = f.selection(retro);
  f.selected = selected;
  f.display.sync();
  const beforeMenus = f.menuCalls.length;
  f.display.dispose();
  f.display.dispose();
  assert.equal(selected.cleanups, 1);
  assert.equal(f.color(), fpv.color);
  assert.equal(f.menuCalls.length, beforeMenus);
  assert.equal(f.display.sync(), false);
  assert.throws(() => f.display.paintPrepared({}, { snapshot: culture }), { name: 'AbortError' });
});

test('failed rollback reports both failures and next sync repairs rather than taking stale fast path', (t) => {
  const f = fixture(t);
  f.display.sync();
  const previous = f.selection(retro);
  f.selected = previous;
  f.display.sync();
  const rejected = f.selection(fpv);
  f.selected = rejected;
  f.menuHook = () => {
    throw Error('menu write rejected');
  };
  assert.throws(
    () => f.display.sync(),
    (error) => error instanceof AggregateError && error.errors.length === 2,
  );
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.color(), retro.color);
  assert.equal(rejected.cleanups, 1);
  f.menuHook = null;
  f.selected = previous;
  const before = f.menuCalls.length;
  assert.equal(f.display.sync(), true);
  assert.equal(f.menuCalls.length, before + 1);
  f.refresh();
  assert.equal(f.palette(), 'authored');
});

test('disposal during application releases previous and candidate DOM owners exactly once', (t) => {
  const f = fixture(t);
  f.display.sync();
  const previous = f.selection(retro);
  f.selected = previous;
  f.display.sync();
  const rejected = f.selection(culture, () => f.display.dispose());
  f.selected = rejected;
  assert.equal(f.display.sync(), false);
  assert.equal(previous.cleanups, 1);
  assert.equal(rejected.cleanups, 1);
  assert.equal(f.color(), fpv.color);
  f.display.dispose();
  assert.equal(rejected.cleanups, 1);
});

test('read-only preflight inside menu adoption does not steal or invalidate outer display ownership', (t) => {
  const f = fixture(t);
  f.display.sync();
  const selected = f.selection(retro);
  f.selected = selected;
  f.menuHook = (snapshot) => {
    if (snapshot === retro) f.display.paintPrepared({}, { snapshot: culture });
  };
  assert.equal(f.display.sync(), true);
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.palette(), 'authored');
  assert.equal(f.color(), retro.color);
  assert.equal(selected.applies, 1);
  assert.equal(selected.cleanups, 0);
});

test('page readiness reconciles a null default without writing menu preferences or using a stale shortcut', (t) => {
  const f = fixture(t, null);
  assert.equal(f.display.sync(), true);
  f.defaultSnapshot = retro;
  assert.equal(f.display.sync(), true);
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.palette(), 'authored');
  f.refresh();
  assert.equal(f.palette(), 'authored');
  f.assertUnaffected();
});

test('external page disposal blocks new sync and preflight without acquiring layers', (t) => {
  const f = fixture(t);
  f.display.sync();
  const selected = f.selection(retro);
  f.selected = selected;
  f.disposed = true;
  assert.equal(f.display.sync(), false);
  assert.throws(() => f.display.paintPrepared({}, selected.binding), { name: 'AbortError' });
  assert.equal(selected.applies, 0);
  assert.equal(f.painter.presentation, fpv);
  assert.equal(f.palette(), 'ukrainian');
});

test('first-sync rollback uses declared null menu baseline even if page already bound another painter theme', (t) => {
  const f = fixture(t, null);
  f.defaultSnapshot = retro;
  f.painter.presentation = retro;
  f.menuHook = (snapshot) => {
    if (snapshot === retro) throw Error('first ready menu failed');
  };
  assert.throws(() => f.display.sync(), /first ready menu failed/);
  assert.equal(f.painter.presentation, retro);
  assert.equal(f.menuCalls.at(-1), null);
  assert.equal(f.palette(), 'ukrainian');
  f.refresh();
  assert.equal(f.palette(), 'ukrainian');
  f.menuHook = null;
  assert.equal(f.display.sync(), true);
  assert.equal(f.palette(), 'authored');
  f.assertUnaffected();
});
