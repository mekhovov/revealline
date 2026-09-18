import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createStudioStore, STUDIO_DATABASE } from '../presentation/studio-store.mjs';
import { iconForSlot } from '../presentation/icons.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const until = (predicate) =>
  waitFor(predicate, { message: 'Studio operation did not reach the expected state.' });
function mount(doc, html) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) continue;
    const tag = token.match(/^<([\w-]+)/)[1];
    const element = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name.startsWith('data-'))
        element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) element[name] = true;
    }
    stack.at(-1).append(element);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(element);
  }
}

test('actual Studio handlers show startup/read/encode stages, cancel a late upload, and save exact source bytes in Studio storage only', async (t) => {
  const pixels = iconForSlot('icon.play');
  const bytes = encodeSpritePNG(pixels);
  const doc = new Document(),
    window = new Events();
  const readGate = deferred(),
    decodeGate = deferred(),
    startupGate = deferred();
  let encodeGate = deferred();
  let delayRead = false,
    delayDecode = false,
    delayEncode = false,
    cancelledReads = 0,
    lateClosed = 0,
    narrow = false;
  const opened = [];
  const db = memoryIndexedDB();
  const indexedDB = {
    open(name, version) {
      opened.push(name);
      const inner = db.indexedDB.open(name, version),
        request = {};
      inner.onupgradeneeded = (event) => {
        request.result = inner.result;
        request.transaction = inner.transaction;
        request.onupgradeneeded?.(event);
      };
      inner.onsuccess = () => {
        request.result = inner.result;
        startupGate.promise.then(() => request.onsuccess?.());
      };
      inner.onerror = () => {
        request.error = inner.error;
        request.onerror?.();
      };
      return request;
    },
  };
  class StudioElement extends Element {
    constructor(document, tag) {
      super(document, tag);
      this.style.getPropertyValue = (name) => this.style[name] || '';
      this.style.removeProperty = (name) => delete this.style[name];
    }
    remove() {
      // Real browsers return focus to the body when a focused subtree is removed.
      const lostFocus = this.isConnected && this.contains(this.ownerDocument.activeElement);
      super.remove();
      if (lostFocus) this.ownerDocument.activeElement = this.ownerDocument.body;
    }
    getContext() {
      return new Proxy(
        {
          putImageData: (value) => {
            this.paintedPixels = new Uint8ClampedArray(value.data);
          },
          getImageData: () => ({
            width: this.width,
            height: this.height,
            data: new Uint8ClampedArray(pixels.rgba),
          }),
        },
        {
          get(target, name) {
            return target[name] ?? (() => {});
          },
        },
      );
    }
    toBlob(callback) {
      if (delayEncode)
        encodeGate.promise.then(() => callback(new Blob([bytes], { type: 'image/png' })));
      else callback(new Blob([bytes], { type: 'image/png' }));
    }
    toDataURL() {
      return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    }
  }
  doc.createElement = (tag) => new StudioElement(doc, tag);
  doc.createDocumentFragment = () => new StudioElement(doc, 'fragment');
  class Reader {
    readAsDataURL(blob) {
      this.pending = (async () => {
        const read = Buffer.from(await blob.arrayBuffer());
        if (delayRead) await readGate.promise;
        if (this.aborted) return;
        this.result = `data:image/png;base64,${read.toString('base64')}`;
        this.onload();
      })();
    }
    abort() {
      this.aborted = true;
      cancelledReads++;
    }
  }
  const preferenceWrites = [];
  const sharedPreferences = new Map();
  const systemMotion = new Events();
  systemMotion.matches = false;
  const matchMedia = (query) =>
    query === '(prefers-reduced-motion: reduce)'
      ? systemMotion
      : { matches: query === '(max-width: 700px)' && narrow };
  window.matchMedia = matchMedia;
  let denyPreferenceSave = false;
  const localStorage = {
    getItem: (key) => sharedPreferences.get(key) ?? null,
    setItem(key, value) {
      preferenceWrites.push([key, value]);
      assert.equal(key, DISPLAY_PREFERENCES_KEY, 'Interface choices never write Solo progress.');
      if (denyPreferenceSave) throw new Error('Preference storage is unavailable.');
      sharedPreferences.set(key, value);
    },
  };
  const globals = {
    localStorage,
    document: doc,
    window,
    indexedDB,
    FileReader: Reader,
    ImageData: class {
      constructor(data, width, height) {
        Object.assign(this, { data, width, height });
      }
    },
    matchMedia,
    fetch: async () => new Response('', { status: 404 }),
    createImageBitmap: async () => {
      if (delayDecode) {
        await decodeGate.promise;
        return {
          width: 24,
          height: 24,
          close() {
            lateClosed++;
          },
        };
      }
      return { width: 24, height: 24, close() {} };
    },
    cancelAnimationFrame() {},
  };
  const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  t.after(() => {
    window.emit('pagehide', { persisted: false });
    Object.assign(globalThis, previous);
  });
  mount(
    doc,
    await readFile(new URL('../../authoring/asset-studio/index.html', import.meta.url), 'utf8'),
  );
  const $ = (id) => doc.getElementById(id);
  const message = () => $('studio-status').querySelector('.operation-status-label').textContent;
  for (const id of [
    'save-workspace',
    'export-workspace',
    'import-workspace',
    'reload-workspace',
    'load-release',
    'studio-interface-font',
    'studio-interface-size',
    'studio-interface-reduced',
  ])
    assert.equal($(id).disabled, true, `${id} is disabled before the Studio module owns it`);
  assert.equal($('studio-status').querySelector('.operation-status-signal').children.length, 3);
  assert.equal(
    $('studio-guide-close')?.hidden,
    true,
    'Close is unavailable before its helper mounts.',
  );
  await import(`../../authoring/asset-studio/studio.mjs?loading-host=${Date.now()}`);
  assert.match(message(), /Loading saved Studio/);
  const guide = $('studio-guide'),
    guideOpen = $('studio-guide-open'),
    guideClose = $('studio-guide-close');
  assert.ok(guide, 'Studio has an in-page guide instead of navigating away from edits.');
  assert.equal(guide.tagName, 'DETAILS');
  assert.equal(guideOpen.tagName, 'SUMMARY');
  assert.equal(
    guide.closest('header'),
    doc.querySelector('header'),
    'Guide stays in the stable header above asynchronously populated workspace content.',
  );
  const inDocumentOrder = (element) => [element, ...element.children.flatMap(inDocumentOrder)];
  const documentOrder = inDocumentOrder(doc.body);
  for (const selector of ['.workspace-state', 'main']) {
    const dynamicRegion = doc.querySelector(selector);
    assert.ok(dynamicRegion);
    assert.ok(documentOrder.indexOf(guide) < documentOrder.indexOf(dynamicRegion));
  }
  assert.equal(
    guide.closest(
      '.workspace-actions,.workspace-state,.inventory,#replacement-panel,#sprite-panel,#token-form,#asset-history,#review-panel',
    ),
    null,
    'Stable placement does not put help inside an operation-owned mutation region.',
  );
  const openGuide = () => {
    guideOpen.focus();
    // Model only the browser's native <details> toggle boundary. Native
    // Enter/Tab behavior and layout are qualified separately in the browser.
    guide.open = true;
    guide.emit('toggle');
    assert.equal(guideClose.hidden, false);
    assert.equal(guide.closest('[inert]'), null, 'Guide stays available during authoring work.');
  };
  const closeGuide = (escape = false) => {
    guideClose.focus();
    if (escape) {
      const event = guideClose.emit('keydown', { key: 'Escape' });
      // The minimal DOM omits the document-to-window edge. Only an
      // unconsumed key reaches the real host's window cancellation owner.
      if (!event.cancelBubble) window.dispatchEvent(event);
      assert.equal(event.cancelBubble, true);
      assert.equal(
        event.defaultPrevented,
        true,
        'Guide owns Escape before operation cancellation.',
      );
    } else guideClose.click();
    assert.equal(guide.open, false);
    // Native closed details hides descendants without changing Close.hidden.
    assert.equal(doc.activeElement, guideOpen, 'Close restores the actual disclosure opener.');
  };
  const startupMessage = message();
  openGuide();
  closeGuide(true);
  assert.equal(message(), startupMessage, 'Guide Escape does not cancel startup.');

  assert.equal($('cancel-studio-operation').hidden, false);
  assert.equal($('cancel-studio-operation').closest('[inert]'), null);
  assert.equal($('current-preview-cancel').closest('[inert]'), null);
  for (const id of ['studio-interface-font', 'studio-interface-size', 'studio-interface-reduced']) {
    assert.equal(
      $(id).closest('[inert]'),
      null,
      'Interface stays available during authoring work.',
    );
    assert.equal($(id).disabled, false);
  }
  assert.equal(preferenceWrites.length, 0, 'Mounting preferences does not write storage.');
  const busyStatus = message();
  $('studio-interface-size').value = 'large';
  $('studio-interface-size').emit('change');
  assert.equal(doc.body.dataset.textSize, 'large');
  assert.equal(message(), busyStatus, 'Preference changes preserve the active operation message.');
  for (const id of [
    'save-workspace',
    'export-workspace',
    'import-workspace',
    'reload-workspace',
    'load-release',
    'studio-interface-font',
    'studio-interface-size',
    'studio-interface-reduced',
  ])
    assert.equal($(id).hasAttribute('data-studio-startup-disabled'), false);
  startupGate.resolve();
  await until(() => $('cancel-studio-operation').hidden);
  assert.match(message(), /Source registry loaded/);
  // The actual click handler is the browser's keyboard/pointer activation path.
  // This models DOM focus ownership; native Enter/Tab behavior is checked separately.
  const inventoryButton = (slotId) =>
    $('asset-list')
      .querySelectorAll('button')
      .find((button) => button.querySelector('small')?.textContent.startsWith(`${slotId} ·`));
  const originalSlot = $('slot-id').textContent;
  // This source host deliberately has no compiled release: its font slots are
  // recipes. Filter those same three slots without inventing installed font files.
  $('filter-kind').value = 'recipe';
  $('filter-kind').emit('change');
  $('filter-search').value = 'font.';
  $('filter-search').emit('input');
  assert.equal($('asset-list').querySelectorAll('button').length, 3);
  const exo = inventoryButton('font.ui');
  assert.ok(exo, 'The filtered inventory includes the second UI font.');
  exo.focus();
  exo.click();
  const selectedExo = inventoryButton('font.ui');
  assert.equal($('slot-id').textContent, 'font.ui');
  assert.equal(exo.isConnected, false);
  assert.notEqual(selectedExo, exo);
  assert.equal(selectedExo.isConnected, true);
  assert.equal(selectedExo.getAttribute('aria-pressed'), 'true');
  assert.ok(doc.activeElement === selectedExo, 'Desktop activation retains the selected row.');
  $('filter-kind').focus();
  await flush();
  assert.equal(
    doc.activeElement,
    $('filter-kind'),
    'Late preview completion never restores focus.',
  );
  selectedExo.focus();
  selectedExo.click();
  assert.equal(
    doc.activeElement,
    inventoryButton('font.ui'),
    'Reselecting the same row also retains focus.',
  );
  assert.notEqual(doc.activeElement, selectedExo);
  await flush();
  $('filter-kind').focus();
  inventoryButton('font.numeric').click();
  assert.equal(
    doc.activeElement,
    $('filter-kind'),
    'An unfocused desktop trigger cannot steal focus.',
  );
  await flush();
  doc.focused = false;
  inventoryButton('font.ui').focus();
  inventoryButton('font.ui').click();
  assert.equal(doc.activeElement, doc.body, 'A background document cannot restore desktop focus.');
  await flush();
  doc.focused = true;
  narrow = true;
  inventoryButton('font.numeric').focus();
  inventoryButton('font.numeric').click();
  assert.equal(
    doc.activeElement,
    $('inspector'),
    'The existing narrow inspector handoff is retained.',
  );
  await flush();
  $('filter-kind').focus();
  inventoryButton('font.ui').click();
  assert.equal(
    doc.activeElement,
    $('inspector'),
    'Foreground narrow activation keeps its deliberate handoff even without button focus.',
  );
  await flush();
  doc.focused = false;
  inventoryButton('font.numeric').focus();
  inventoryButton('font.numeric').click();
  assert.equal(
    doc.activeElement,
    doc.body,
    'Background narrow activation cannot move focus to Inspector.',
  );
  await flush();
  doc.focused = true;
  narrow = false;
  $('filter-kind').value = '';
  $('filter-kind').emit('change');
  $('filter-search').value = '';
  $('filter-search').emit('input');
  inventoryButton(originalSlot).focus();
  inventoryButton(originalSlot).click();
  await flush();
  const summary = $('workspace-summary').textContent;
  const original = new File([bytes], 'original.png', { type: 'image/png' });
  $('asset-upload').files = [original];
  delayRead = true;
  $('asset-upload').onchange();
  assert.match(message(), /Reading the image header/);
  $('cancel-studio-operation').onclick();
  readGate.resolve();
  await flush();
  assert.equal(cancelledReads, 1);
  assert.equal($('workspace-summary').textContent, summary);
  assert.equal($('stage-asset').disabled, true);
  delayRead = false;
  delayDecode = true;
  $('asset-upload').onchange();
  await until(() => /Decoding the original/.test(message()));
  $('cancel-studio-operation').onclick();
  delayDecode = false;
  delayEncode = true;
  $('asset-upload').onchange();
  await until(() => /Encoding the crop/.test(message()));
  assert.equal(
    $('stage-asset').disabled,
    true,
    'No partial prepared asset is published during encode.',
  );
  const encodingMessage = message();
  openGuide();
  closeGuide(true);
  assert.equal(message(), encodingMessage, 'Guide Escape cannot cancel a held image encode.');
  assert.equal($('cancel-studio-operation').hidden, false);
  assert.equal($('replacement-panel').inert, true);
  decodeGate.resolve();
  await flush();
  assert.equal(lateClosed, 1);
  assert.match(message(), /Encoding the crop/);
  assert.equal(
    $('replacement-panel').inert,
    true,
    'Old finally cannot release the newer upload lock.',
  );
  encodeGate.resolve();
  await until(() => $('cancel-studio-operation').hidden);
  assert.match(message(), /Replacement prepared/);
  assert.equal($('stage-asset').disabled, false);
  assert.equal($('workspace-summary').textContent, summary);
  const preparedSelection = $('slot-id').textContent,
    refusedPreparedButton = inventoryButton('font.ui'),
    preparedCurrentMarker = $('current-preview').previewMarker,
    preparedDraftMarker = $('draft-preview').previewMarker;
  refusedPreparedButton.focus();
  refusedPreparedButton.click();
  assert.match(message(), /Validate and stage the prepared slot/);
  assert.equal(doc.activeElement, refusedPreparedButton);
  assert.equal(refusedPreparedButton.isConnected, true);
  assert.equal(inventoryButton('font.ui'), refusedPreparedButton);
  assert.equal($('slot-id').textContent, preparedSelection);
  assert.equal($('current-preview').previewMarker, preparedCurrentMarker);
  assert.equal($('draft-preview').previewMarker, preparedDraftMarker);
  $('asset-creator').value = 'Fixture author';
  $('asset-source').value = 'Owned original fixture';
  $('asset-license').value = 'Fixture rights';
  $('asset-creator').focus();
  const creator = $('asset-creator'),
    preparedImage = $('source-image'),
    savedSurface = $('current-preview'),
    draftSurface = $('draft-preview'),
    savedMarker = savedSurface.previewMarker,
    draftMarker = draftSurface.previewMarker,
    preparedSummary = $('upload-summary').textContent;
  $('studio-interface-font').value = 'plain';
  $('studio-interface-font').emit('change');
  assert.equal(doc.body.dataset.textFace, 'plain');
  assert.equal(doc.activeElement, creator);
  assert.equal($('asset-creator'), creator);
  assert.equal(creator.value, 'Fixture author');
  assert.equal($('asset-source').value, 'Owned original fixture');
  assert.equal($('asset-license').value, 'Fixture rights');
  assert.equal($('source-image'), preparedImage);
  assert.equal($('upload-summary').textContent, preparedSummary);
  assert.equal(savedSurface.previewMarker, savedMarker);
  assert.equal(draftSurface.previewMarker, draftMarker);
  assert.equal($('stage-asset').disabled, false);
  const preparedGuideState = {
    crop: ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    motion: $('preview-motion').value,
    currentCleanup: savedSurface.previewCleanup,
    draftCleanup: draftSurface.previewCleanup,
    status: message(),
    preferenceWrites: preferenceWrites.length,
  };
  openGuide();
  closeGuide();
  assert.equal($('slot-id').textContent, preparedSelection);
  assert.equal($('asset-upload').files[0], original);
  assert.equal($('source-image'), preparedImage);
  assert.equal(creator.value, 'Fixture author');
  assert.equal($('asset-source').value, 'Owned original fixture');
  assert.equal($('asset-license').value, 'Fixture rights');
  assert.deepEqual(
    ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    preparedGuideState.crop,
  );
  assert.equal($('upload-summary').textContent, preparedSummary);
  assert.equal(message(), preparedGuideState.status);
  assert.equal($('stage-asset').disabled, false);
  assert.equal(savedSurface.previewMarker, savedMarker);
  assert.equal(draftSurface.previewMarker, draftMarker);
  assert.equal(savedSurface.previewCleanup, preparedGuideState.currentCleanup);
  assert.equal(draftSurface.previewCleanup, preparedGuideState.draftCleanup);
  assert.equal($('preview-motion').value, preparedGuideState.motion);
  assert.equal(preferenceWrites.length, preparedGuideState.preferenceWrites);
  assert.equal(doc.body.dataset.textFace, 'plain');
  assert.equal(doc.body.dataset.textSize, 'large');
  creator.focus();
  // Model a return after another page changed preferences while this document
  // was frozen. The real host may refresh preview leases, but its prepared
  // original, metadata, selected row and current editor focus must survive.
  const preparedRow = inventoryButton(preparedSelection),
    preparedDimensions = [preparedImage.width, preparedImage.height],
    preparedCrop = ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    writesBeforePreparedReturn = preferenceWrites.length;
  assert.equal(preparedRow.getAttribute('aria-pressed'), 'true');
  assert.ok(preparedDimensions.every((value) => value > 0));
  window.emit('pagehide', { persisted: true });
  sharedPreferences.set(
    DISPLAY_PREFERENCES_KEY,
    JSON.stringify({ textFace: 'pixel', textSize: 'large', reducedEffects: false }),
  );
  systemMotion.matches = true;
  window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(doc.body.dataset.textFace, 'pixel');
  assert.equal(doc.body.dataset.textSize, 'large');
  assert.equal(doc.body.dataset.effects, 'reduced');
  assert.equal($('studio-interface-font').value, 'pixel');
  assert.equal($('studio-interface-size').value, 'large');
  assert.equal($('studio-interface-reduced').checked, false, 'System cap is not saved intent.');
  assert.equal($('studio-interface-cap').hidden, false);
  assert.equal(preferenceWrites.length, writesBeforePreparedReturn, 'Restoration never saves.');
  assert.equal($('slot-id').textContent, preparedSelection);
  assert.equal(inventoryButton(preparedSelection), preparedRow);
  assert.equal(preparedRow.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.activeElement, creator);
  assert.equal($('asset-creator'), creator);
  assert.equal(creator.value, 'Fixture author');
  assert.equal($('asset-source').value, 'Owned original fixture');
  assert.equal($('asset-license').value, 'Fixture rights');
  assert.equal($('source-image'), preparedImage);
  assert.deepEqual([preparedImage.width, preparedImage.height], preparedDimensions);
  assert.deepEqual(
    ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    preparedCrop,
  );
  assert.equal($('upload-summary').textContent, preparedSummary);
  assert.equal($('asset-upload').files[0], original);
  assert.equal($('stage-asset').disabled, false);
  // The following real stage/save/restore byte assertion also proves that the
  // prepared asset survived the return, rather than only its visible labels.
  await $('stage-asset').onclick();
  assert.match(message(), /validated and staged/);
  assert.match($('workspace-summary').textContent, /unsaved changes/);
  const stagedSummary = $('workspace-summary').textContent,
    stagedStatus = message(),
    stagedHistory = [$('undo-draft').disabled, $('redo-draft').disabled];
  openGuide();
  closeGuide(true);
  assert.equal($('workspace-summary').textContent, stagedSummary);
  assert.equal(message(), stagedStatus);
  assert.deepEqual([$('undo-draft').disabled, $('redo-draft').disabled], stagedHistory);
  await $('save-workspace').onclick();
  assert.match(message(), /saved atomically/);
  const saved = await createStudioStore({ indexedDB: db.indexedDB }).load();
  const hash = await hashPresentationBytes(bytes);
  assert.deepEqual(Buffer.from(await saved.assets.get(hash).arrayBuffer()), Buffer.from(bytes));
  assert.equal(saved.generation, 1);
  assert.ok(saved.document.assets.some((asset) => asset.id.endsWith('.source')));
  assert.deepEqual(new Set(opened), new Set([STUDIO_DATABASE]));
  $('new-sprite').onclick();
  const originalSpritePixels = new Uint8ClampedArray($('sprite-canvas').paintedPixels);
  $('sprite-canvas').emit('keydown', { code: 'Space' });
  const editedSpritePixels = new Uint8ClampedArray($('sprite-canvas').paintedPixels),
    spriteCanvas = $('sprite-canvas'),
    spriteCursor = $('sprite-cursor').textContent;
  assert.notDeepEqual(editedSpritePixels, originalSpritePixels);
  openGuide();
  closeGuide();
  assert.equal($('sprite-canvas'), spriteCanvas);
  assert.equal($('sprite-cursor').textContent, spriteCursor);
  assert.deepEqual(spriteCanvas.paintedPixels, editedSpritePixels);
  assert.equal($('sprite-undo').disabled, false);
  $('sprite-undo').click();
  assert.deepEqual(
    spriteCanvas.paintedPixels,
    originalSpritePixels,
    'Guide preserves real pixel undo.',
  );
  assert.equal($('sprite-redo').disabled, false);
  $('sprite-redo').click();
  assert.deepEqual(
    spriteCanvas.paintedPixels,
    editedSpritePixels,
    'Guide preserves real pixel redo.',
  );
  encodeGate = deferred();
  const preparingSprite = $('use-sprite').onclick();
  assert.match(message(), /Encoding the edited sprite/);
  $('cancel-studio-operation').onclick();
  encodeGate.resolve();
  await preparingSprite;
  const refusedSpriteButton = inventoryButton('font.ui'),
    spriteSelection = $('slot-id').textContent,
    spriteCurrentMarker = $('current-preview').previewMarker,
    spriteDraftMarker = $('draft-preview').previewMarker;
  refusedSpriteButton.focus();
  refusedSpriteButton.click();
  assert.match(message(), /Prepare the edited sprite/);
  assert.equal(doc.activeElement, refusedSpriteButton);
  assert.equal(refusedSpriteButton.isConnected, true);
  assert.equal(inventoryButton('font.ui'), refusedSpriteButton);
  assert.equal($('slot-id').textContent, spriteSelection);
  assert.equal($('current-preview').previewMarker, spriteCurrentMarker);
  assert.equal($('draft-preview').previewMarker, spriteDraftMarker);
  $('studio-interface-size').value = 'standard';
  $('studio-interface-size').emit('change');
  assert.equal(doc.body.dataset.textSize, 'standard');
  assert.equal(preferenceWrites.length, 3, 'Only the three explicit interface choices persist.');
  await $('save-workspace').onclick();
  assert.match(
    message(),
    /Prepare the edited sprite/,
    'Cancelled sprite encoding preserves the edited pixels and baseline.',
  );
  assert.equal($('sprite-workbench').hidden, false);
  // Failed explicit saves keep their local intent on return, even if another
  // page wrote newer shared values. The current system cap still takes effect.
  // These are modeled events, not proof of native BFCache admission.
  const dirtyRow = inventoryButton(spriteSelection),
    dirtyCanvas = $('sprite-canvas'),
    dirtyCursor = $('sprite-cursor').textContent;
  dirtyRow.focus();
  assert.equal(dirtyRow.getAttribute('aria-pressed'), 'true');
  assert.equal($('sprite-undo').disabled, false, 'The actual sprite editor has an edit.');
  denyPreferenceSave = true;
  $('studio-interface-font').value = 'plain';
  $('studio-interface-font').emit('change');
  assert.equal(doc.body.dataset.textFace, 'plain');
  assert.equal(doc.activeElement, dirtyRow);
  const saveWarning = $('studio-interface-status').textContent,
    writesAfterDenial = preferenceWrites.length;
  assert.match(saveWarning, /could not be saved/);
  assert.equal(writesAfterDenial, 4, 'The rejected preference save is recorded as an attempt.');
  window.emit('pagehide', { persisted: true });
  const remotePreferences = JSON.stringify({
    textFace: 'pixel',
    textSize: 'large',
    reducedEffects: false,
  });
  sharedPreferences.set(DISPLAY_PREFERENCES_KEY, remotePreferences);
  systemMotion.matches = false;
  window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(doc.body.dataset.textFace, 'plain', 'Unsaved local font intent wins.');
  assert.equal(doc.body.dataset.textSize, 'standard', 'Unsaved local size intent wins.');
  assert.equal(doc.body.dataset.effects, 'full', 'The missed system cap change is adopted.');
  assert.equal($('studio-interface-font').value, 'plain');
  assert.equal($('studio-interface-size').value, 'standard');
  assert.equal($('studio-interface-reduced').checked, false);
  assert.equal($('studio-interface-cap').hidden, true);
  assert.equal($('studio-interface-status').textContent, saveWarning);
  assert.equal($('studio-interface-status').hidden, false);
  assert.equal(preferenceWrites.length, writesAfterDenial, 'Returning cannot retry a failed save.');
  assert.equal(sharedPreferences.get(DISPLAY_PREFERENCES_KEY), remotePreferences);
  assert.equal($('slot-id').textContent, spriteSelection);
  assert.equal(inventoryButton(spriteSelection), dirtyRow);
  assert.equal(dirtyRow.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.activeElement, dirtyRow);
  assert.equal($('sprite-canvas'), dirtyCanvas);
  assert.equal($('sprite-cursor').textContent, dirtyCursor);
  assert.equal($('sprite-undo').disabled, false);
  assert.equal($('sprite-workbench').hidden, false);
  await $('save-workspace').onclick();
  assert.match(message(), /Prepare the edited sprite/, 'Return cannot discard the edited sprite.');
  // Only a later explicit successful save releases the unsaved-intent guard.
  denyPreferenceSave = false;
  $('studio-interface-font').emit('change');
  assert.equal(preferenceWrites.length, writesAfterDenial + 1);
  assert.equal($('studio-interface-status').hidden, true);
  assert.deepEqual(JSON.parse(sharedPreferences.get(DISPLAY_PREFERENCES_KEY)), {
    textFace: 'plain',
    textSize: 'standard',
    reducedEffects: false,
  });
  dirtyRow.focus();
  window.emit('pagehide', { persisted: true });
  sharedPreferences.set(DISPLAY_PREFERENCES_KEY, remotePreferences);
  systemMotion.matches = true;
  window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(doc.body.dataset.textFace, 'pixel', 'Successfully saved intent shares again.');
  assert.equal(doc.body.dataset.textSize, 'large');
  assert.equal(doc.body.dataset.effects, 'reduced');
  assert.equal(preferenceWrites.length, writesAfterDenial + 1);
  assert.equal(doc.activeElement, dirtyRow);
  assert.equal(inventoryButton(spriteSelection), dirtyRow);
  assert.equal($('sprite-canvas'), dirtyCanvas);
  assert.equal($('sprite-undo').disabled, false);
  await $('save-workspace').onclick();
  assert.match(message(), /Prepare the edited sprite/);
  assert.ok(
    preferenceWrites.every(([key]) => key === DISPLAY_PREFERENCES_KEY),
    'All attempted preference writes target only the separate shared display record.',
  );
  window.emit('pagehide', { persisted: false });
  assert.equal(guideClose.hidden, true, 'Terminal disposal removes the enhanced Close control.');
  assert.equal(guideClose.onclick, null);
});
