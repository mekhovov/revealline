import test from 'node:test';
import assert from 'node:assert/strict';
import { mountOverflightMotionPanel } from '../../authoring/motion-lab/overflight-panel.mjs';
import { OVERFLIGHT_MOTION_PROFILE } from '../presentation/overflight-motion.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';

function harness(t, locale) {
  const previousLocale = getLocale(),
    previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'),
    doc = new Document(),
    canvases = [];
  class PreviewElement extends Element {
    getContext() {
      return (this.context ??= new Proxy(
        {
          calls: [],
          createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        },
        {
          get(target, name) {
            if (name in target) return target[name];
            return (...args) => target.calls.push({ name, args });
          },
        },
      ));
    }
  }
  doc.createElement = (tag) => {
    const node = new PreviewElement(doc, tag);
    if (tag === 'canvas') canvases.push(node);
    return node;
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  setLocale(locale, { persist: false });
  const root = doc.createElement('details');
  doc.body.append(root);
  const panel = mountOverflightMotionPanel(root);
  t.after(() => {
    panel.dispose();
    root.remove();
    setLocale(previousLocale, { persist: false });
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });
  const [summary, note, select, age, reducedLabel, canvas, readout] = root.children;
  return {
    doc,
    root,
    panel,
    canvases,
    summary,
    note,
    select,
    age,
    reducedLabel,
    reduced: reducedLabel.querySelector('input'),
    canvas,
    readout,
  };
}

function assertCopy(view, locale) {
  const ukrainian = locale === 'uk';
  assert.equal(
    view.summary.textContent,
    ukrainian ? 'Проліт · спільні ефекти' : 'Overflight · shared effects',
  );
  assert.equal(
    view.note.textContent,
    ukrainian
      ? 'Переглядайте той самий профіль руху, що й у грі. Час попереджень і шкода визначаються симуляцією.'
      : 'Inspect the exact source motion profile used by native play. Warning timing and damage remain simulation-owned.',
  );
  assert.deepEqual(
    [...view.select.options].map((option) => [option.value, option.textContent]),
    ukrainian
      ? [
          ['drop', 'Удар заряду'],
          ['pulse', 'Імпульс'],
          ['warning', 'Попередження'],
          ['hostile-impact', 'Ворожий удар'],
          ['slow-field', 'Поле сповільнення'],
          ['chain', 'Ланцюг сканера'],
        ]
      : [
          ['drop', 'Payload impact'],
          ['pulse', 'Pulse'],
          ['warning', 'Warning'],
          ['hostile-impact', 'Hostile impact'],
          ['slow-field', 'Slow field'],
          ['chain', 'Scanner chain'],
        ],
  );
  assert.equal(view.reducedLabel.textContent, ukrainian ? 'Менше ефектів' : 'Reduced effects');
  assert.equal(view.select.getAttribute('aria-label'), ukrainian ? 'Ефект' : 'Effect');
  assert.equal(
    view.age.getAttribute('aria-label'),
    ukrainian ? 'Прогрес анімації' : 'Animation progress',
  );
  assert.equal(
    view.canvas.getAttribute('aria-label'),
    ukrainian ? 'Перегляд спільного ефекту' : 'Shared effect preview',
  );
}

test('Overflight preview live-switches all catalog text and accessibility labels without replacing controls or repainting effects', (t) => {
  const view = harness(t, 'en');
  assertCopy(view, 'en');
  view.select.value = 'chain';
  view.age.value = '73';
  view.reduced.checked = true;
  view.age.emit('input');
  view.age.focus();
  view.root.scrollTop = 137;
  view.root.scrollLeft = 9;
  const children = [...view.root.children],
    options = [...view.select.options],
    canvases = [...view.canvases],
    painting = view.canvas.getContext().calls.length,
    readout = `${OVERFLIGHT_MOTION_PROFILE.id}@${OVERFLIGHT_MOTION_PROFILE.revision} · 73%`;
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    assertCopy(view, locale);
    assert.equal(view.root.children.length, children.length);
    children.forEach((node, index) => assert.equal(view.root.children[index], node));
    assert.equal(view.select.options.length, options.length);
    options.forEach((node, index) => assert.equal(view.select.options[index], node));
    assert.equal(view.canvases.length, canvases.length);
    canvases.forEach((node, index) => assert.equal(view.canvases[index], node));
    assert.equal(view.reducedLabel.querySelector('input'), view.reduced);
    assert.equal(view.select.value, 'chain');
    assert.equal(view.age.value, '73');
    assert.equal(view.reduced.checked, true);
    assert.equal(view.canvas.width, 320);
    assert.equal(view.canvas.height, 180);
    assert.equal(view.canvas.getContext().calls.length, painting);
    assert.equal(view.readout.textContent, readout);
    assert.equal(view.doc.activeElement, view.age);
    assert.equal(view.root.scrollTop, 137);
    assert.equal(view.root.scrollLeft, 9);
  }
  view.age.value = '81';
  view.age.emit('input');
  assert.ok(view.canvas.getContext().calls.length > painting, 'Scrubbing remains connected');
  assert.match(view.readout.textContent, / · 81%$/);
});

test('Overflight preview opens in the selected catalog locale and still retires input handlers and canvases', (t) => {
  const view = harness(t, 'uk');
  assertCopy(view, 'uk');
  view.panel.dispose();
  const painting = view.canvas.getContext().calls.length;
  view.select.value = 'pulse';
  view.select.emit('input');
  assert.equal(view.canvas.getContext().calls.length, painting);
  assert.ok(view.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
});
