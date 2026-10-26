import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { mountRoomInvitationActions } from '../online/room-invitation-actions.mjs';
import { createRoomInvitationQr, roomInvitationAddress } from '../online/room-invitation-qr.mjs';
import { roomInvitationLink } from '../online/room-content.mjs';
import { qrcodegen } from '../vendor/qrcodegen-1.8.0.mjs';
import { Document } from './helpers/couch-dom.mjs';

const invitation = (character = 'a') =>
  roomInvitationLink(
    'https://game.example/game/online/?lang=en&endpoint=https://untrusted.example#old',
    { invite: character.repeat(64), contentHash: 'b'.repeat(64), recipe: {} },
  );
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function fixture(
  t,
  { navigator = {}, createQr, locale = 'en', secure = true, nativeDisableBlur = false } = {},
) {
  const doc = new Document();
  if (nativeDisableBlur) {
    const create = doc.createElement.bind(doc);
    doc.createElement = (...args) => {
      const node = create(...args);
      if (node.tagName === 'BUTTON') {
        let disabled = node.disabled;
        Object.defineProperty(node, 'disabled', {
          configurable: true,
          get: () => disabled,
          set(value) {
            disabled = !!value;
            // The real-browser delayed QR reproduction blurs a focused native
            // button when disabled. Model that boundary only in these cases.
            if (disabled && doc.activeElement === node) node.blur();
          },
        });
      }
      return node;
    };
  }
  const label = doc.createElement('label'),
    field = doc.createElement('input');
  field.id = 'invite';
  field.readOnly = true;
  label.append(field);
  doc.body.append(label);
  doc.hidden = false;
  let visible = true,
    selections = 0;
  field.select = () => {
    selections++;
  };
  const view = mountRoomInvitationActions({
    document: doc,
    window: { navigator, isSecureContext: secure },
    field,
    after: label,
    getVisible: () => visible,
    locale: typeof locale === 'function' ? locale : () => locale,
    ...(createQr ? { createQr } : {}),
  });
  t.after(() => view.dispose());
  return {
    doc,
    field,
    view,
    $: (id) => doc.getElementById(`invite-${id}`),
    set(value) {
      field.value = value;
      view.update(value);
    },
    visible(value) {
      visible = value;
      view.invalidate();
    },
    selections: () => selections,
    press(id) {
      const button = doc.getElementById(`invite-${id}`),
        original = button.onclick;
      if (!original) return;
      button.focus();
      let result;
      const capture = (event) => {
        result = original(event);
      };
      button.onclick = capture;
      button.click();
      if (button.onclick === capture) button.onclick = original;
      return result;
    },
  };
}

test('invitation address admits only the pinned public projection, never service or seat credentials', () => {
  const address = invitation();
  assert.equal(roomInvitationAddress(address), address);
  assert.equal(new URL(address).searchParams.has('endpoint'), false);
  assert.throws(() => roomInvitationAddress({ token: 'seat-secret' }));
  for (const value of [
    'javascript:alert(1)',
    address.replace('game.example', 'user:password@game.example'),
    address.replace('?lang=en', '?token=seat-secret'),
    `${address}&token=seat-secret`,
    `${address}&invite=${'c'.repeat(64)}`,
    address.replace(/&content=[^&]+/, ''),
    address.replace(/invite=[^&]+/, 'invite=invalid'),
  ])
    assert.throws(() => roomInvitationAddress(value));
});

test('actual local QR encodes the exact invitation with a four-module quiet zone and numeric SVG only', async () => {
  const address = invitation(),
    first = await createRoomInvitationQr(address),
    second = await createRoomInvitationQr(address),
    changed = await createRoomInvitationQr(invitation('c'));
  assert.deepEqual(first, second);
  assert.notEqual(first.src, changed.src);
  const code = qrcodegen.QrCode.encodeText(address, qrcodegen.QrCode.Ecc.MEDIUM);
  assert.equal(first.size, code.size + 8);
  assert.equal(first.version, code.version);
  const svg = decodeURIComponent(first.src.split(',').slice(1).join(','));
  assert.match(svg, /fill="white"/);
  assert.equal(svg.includes(address), false);
  assert.equal(/href=|src=|<script|<foreignObject|<image/i.test(svg), false);
  const squares = [...svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  let count = 0;
  for (let y = 0; y < code.size; y++)
    for (let x = 0; x < code.size; x++)
      if (code.getModule(x, y)) {
        assert.deepEqual(squares[count++], [x + 4, y + 4]);
      }
  assert.equal(squares.length, count);
});

test('mounting and invalid or absent invitations perform no clipboard, sharing or QR operation', async (t) => {
  let operations = 0;
  const h = fixture(t, {
    navigator: {
      clipboard: {
        writeText() {
          operations++;
        },
      },
      share() {
        operations++;
      },
    },
    createQr() {
      operations++;
    },
  });
  assert.equal(h.view.root.hidden, true);
  h.set('https://game.example/#invite=invalid');
  assert.equal(h.view.root.hidden, true);
  for (const key of ['copy', 'share', 'qr']) await h.press(key);
  assert.equal(operations, 0);
  assert.equal(h.$('share-status').getAttribute('role'), 'status');
});

for (const locale of ['en', 'uk'])
  test(`${locale}: copy invokes the real receiver directly and reports success only after settlement`, async (t) => {
    const job = deferred(),
      calls = [],
      clipboard = {
        writeText(value) {
          assert.equal(this === clipboard, true, 'Preserve Clipboard receiver.');
          calls.push(value);
          return job.promise;
        },
      };
    const h = fixture(t, { locale, navigator: { clipboard } });
    h.set(invitation());
    const operation = h.press('copy');
    assert.deepEqual(calls, [invitation()]);
    assert.equal(h.$('share-status').textContent, '');
    assert.equal(h.view.root.getAttribute('aria-busy'), 'true');
    await h.press('copy');
    assert.equal(calls.length, 1);
    job.resolve();
    await operation;
    assert.equal(
      h.$('share-status').textContent,
      locale === 'uk' ? 'Запрошення скопійовано.' : 'Invitation copied.',
    );
    assert.equal(h.doc.activeElement === h.$('copy'), true);
    assert.equal(h.selections(), 0);
  });

for (const secure of [true, false])
  test(`manual selection works without usable Clipboard (secure=${secure})`, async (t) => {
    let calls = 0;
    const h = fixture(t, {
      secure,
      navigator: secure
        ? {}
        : {
            clipboard: {
              writeText() {
                calls++;
              },
            },
          },
    });
    h.set(invitation());
    await h.press('copy');
    assert.equal(calls, 0);
    assert.equal(h.selections(), 1);
    assert.equal(h.doc.activeElement === h.field, true);
    assert.match(h.$('share-status').textContent, /selected/);
    assert.equal(h.$('select').hidden, false);
  });

test('denied Clipboard preserves moved focus, offers manual selection and permits an explicit successful retry', async (t) => {
  const job = deferred(),
    clipboard = { writeText: () => job.promise };
  const h = fixture(t, { navigator: { clipboard } });
  h.set(invitation());
  const operation = h.press('copy');
  const elsewhere = h.doc.createElement('button');
  h.doc.body.append(elsewhere);
  elsewhere.focus();
  job.reject(new DOMException('denied', 'NotAllowedError'));
  await operation;
  assert.equal(h.doc.activeElement === elsewhere, true);
  assert.equal(h.$('select').hidden, false);
  assert.match(h.$('share-status').textContent, /unavailable/);
  await h.press('select');
  assert.equal(h.selections(), 1);
  clipboard.writeText = async () => {};
  await h.press('copy');
  assert.equal(h.$('share-status').textContent, 'Invitation copied.');
  assert.equal(h.$('select').hidden, true);
});

for (const outcome of ['success', 'cancel', 'failure', 'unsupported'])
  test(`Share ${outcome} preserves direct gesture, receiver and truthful outcome`, async (t) => {
    const job = deferred();
    let gesture = false,
      calls = 0;
    const navigator = {
      canShare(data) {
        assert.equal(this === navigator, true);
        return !!data.url;
      },
      share(data) {
        assert.equal(this === navigator, true);
        assert.equal(gesture, true);
        assert.equal(data.url, invitation());
        calls++;
        return job.promise;
      },
    };
    if (outcome === 'unsupported') delete navigator.share;
    const h = fixture(t, { navigator });
    h.set(invitation());
    gesture = true;
    const operation = h.press('share');
    gesture = false;
    if (outcome === 'success') job.resolve();
    else if (outcome === 'cancel') job.reject(new DOMException('cancelled', 'AbortError'));
    else if (outcome === 'failure') job.reject(new DOMException('denied', 'NotAllowedError'));
    await operation;
    assert.equal(calls, outcome === 'unsupported' ? 0 : 1);
    assert.match(
      h.$('share-status').textContent,
      outcome === 'success'
        ? /request completed/
        : outcome === 'cancel'
          ? /cancelled/
          : /unavailable/,
    );
    assert.equal(h.selections(), 0, 'Cancelled sharing must not silently copy or select.');
  });

test('retired Share remains single-owner across away/back and cannot publish into the reopened view', async (t) => {
  const job = deferred();
  let calls = 0;
  const h = fixture(t, {
    navigator: {
      share() {
        calls++;
        return job.promise;
      },
    },
  });
  h.set(invitation());
  const old = h.press('share');
  h.visible(false);
  h.visible(true);
  await h.press('share');
  assert.equal(calls, 1);
  job.resolve();
  await old;
  assert.equal(h.$('share-status').textContent, '');
  assert.equal(h.$('share').disabled, false);
});

test('replacement retires pending Clipboard completion without automatically copying the new room', async (t) => {
  const job = deferred(),
    calls = [];
  const h = fixture(t, {
    navigator: {
      clipboard: {
        writeText(value) {
          calls.push(value);
          return job.promise;
        },
      },
    },
  });
  h.set(invitation());
  const old = h.press('copy');
  h.set(invitation('c'));
  job.resolve();
  await old;
  assert.deepEqual(calls, [invitation()]);
  assert.equal(h.$('share-status').textContent, '');
  await h.press('copy');
  assert.deepEqual(calls, [invitation(), invitation('c')]);
});

for (const retirement of ['replace', 'hidden', 'leave', 'dispose'])
  test(`pending QR cannot reveal after ${retirement}, including return before settlement`, async (t) => {
    const job = deferred();
    let calls = 0;
    const h = fixture(t, {
      createQr(value) {
        assert.equal(value, invitation());
        calls++;
        return job.promise;
      },
    });
    h.set(invitation());
    const old = h.press('qr');
    if (retirement === 'replace') h.set(invitation('c'));
    else if (retirement === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    } else if (retirement === 'leave') {
      h.view.update(null);
      h.set(invitation());
    } else h.view.dispose();
    job.resolve({ src: 'data:image/svg+xml,test', size: 40 });
    await old;
    assert.equal(calls, 1);
    if (retirement === 'dispose') assert.equal(h.view.root.isConnected, false);
    else {
      assert.equal(h.$('qr-image').hidden, true);
      assert.equal(h.$('qr-image').getAttribute('src'), null);
      assert.equal(h.$('share-status').textContent, '');
    }
  });

test('prepared actual QR survives identical normal updates and is cleared by explicit hide or surface retirement', async (t) => {
  const h = fixture(t);
  h.set(invitation());
  await h.press('qr');
  const src = h.$('qr-image').src;
  assert.equal(h.$('qr-image').hidden, false);
  assert.equal(h.$('qr').getAttribute('aria-expanded'), 'true');
  h.set(invitation());
  assert.equal(h.$('qr-image').src, src);
  assert.equal(h.$('qr-image').hidden, false);
  await h.press('qr');
  assert.equal(h.$('qr-image').hidden, true);
  await h.press('qr');
  h.view.invalidate();
  assert.equal(h.$('qr-image').hidden, true);
  assert.equal(h.$('qr-image').getAttribute('src'), null);
});

test('QR failure leaves Copy available and retained disposed controls stay inert', async (t) => {
  let calls = 0;
  const h = fixture(t, {
    createQr: async () => {
      calls++;
      throw new Error('not enough room');
    },
  });
  h.set(invitation());
  await h.press('qr');
  assert.match(h.$('share-status').textContent, /copy the invitation/);
  assert.equal(h.$('copy').disabled, false);
  const retained = h.$('qr');
  h.view.dispose();
  retained.click();
  assert.equal(calls, 1);
});

test('connected action labels follow live English/Ukrainian localization without rebuilding controls', async (t) => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(previous, { persist: false }));
  const h = fixture(t, { locale: getLocale }),
    copy = h.$('copy');
  h.set(invitation());
  setLocale('uk', { persist: false });
  assert.equal(copy.textContent, 'Копіювати запрошення');
  assert.equal(h.$('copy') === copy, true, 'Existing native controls retain identity.');
  setLocale('en', { persist: false });
  assert.equal(copy.textContent, 'Copy invitation');
});

// Added after the original 21-case source-qualified run. These additions remain
// unrun during the disk hold; they do not extend that historical qualification.
function countTextWrites(t, element) {
  const nodes = [element, ...element.children],
    counters = [];
  for (const node of nodes) {
    const own = Object.getOwnPropertyDescriptor(node, 'textContent');
    let descriptor = own,
      prototype = node;
    while (!descriptor && (prototype = Object.getPrototypeOf(prototype)))
      descriptor = Object.getOwnPropertyDescriptor(prototype, 'textContent');
    assert.ok(descriptor);
    let value = own?.value,
      writes = 0;
    Object.defineProperty(node, 'textContent', {
      configurable: true,
      get: () => (descriptor.get ? descriptor.get.call(node) : value),
      set(next) {
        writes++;
        if (descriptor.set) descriptor.set.call(node, next);
        else value = next;
      },
    });
    counters.push(() => writes);
    t.after(() => {
      if (own) Object.defineProperty(node, 'textContent', own);
      else delete node.textContent;
    });
  }
  return () => counters.reduce((sum, count) => sum + count(), 0);
}

for (const prepared of ['copy', 'qr'])
  test(`identical accepted-URL polls do not mutate the ${prepared} status or QR label text`, async (t) => {
    let clipboardCalls = 0;
    const h = fixture(t, {
      navigator: {
        clipboard: {
          async writeText() {
            clipboardCalls++;
          },
        },
      },
    });
    h.set(invitation());
    await h.press(prepared);
    const status = h.$('share-status'),
      qr = h.$('qr'),
      statusNode = status.children[0],
      qrNode = qr.children[0],
      message = status.textContent,
      image = h.$('qr-image'),
      imageSource = image.src,
      focus = h.doc.activeElement,
      statusWrites = countTextWrites(t, status),
      qrWrites = countTextWrites(t, qr);
    for (let poll = 0; poll < 100; poll++) h.set(invitation());
    assert.equal(
      statusWrites(),
      0,
      'A modeled live region must not be rewritten on unchanged accepted polls.',
    );
    assert.equal(qrWrites(), 0);
    assert.equal(
      status.children[0] === statusNode,
      true,
      'Keep the existing owned status text node.',
    );
    assert.equal(qr.children[0] === qrNode, true);
    assert.equal(status.textContent, message);
    assert.equal(image.src, imageSource);
    assert.equal(image.hidden, prepared !== 'qr');
    assert.equal(qr.getAttribute('aria-expanded'), String(prepared === 'qr'));
    assert.equal(h.view.root.getAttribute('aria-busy'), 'false');
    assert.equal(h.doc.activeElement === focus, true);
    assert.equal(clipboardCalls, prepared === 'copy' ? 1 : 0);
  });

async function actualPageOwners(h) {
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8'),
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
    callbacks = {};
  for (const statement of ast.body) {
    const call = statement.expression;
    if (
      call?.callee?.object?.name === 'window' &&
      call.callee.property.name === 'addEventListener' &&
      ['pagehide', 'pageshow'].includes(call.arguments[0]?.value)
    )
      callbacks[call.arguments[0].value] = source.slice(
        call.arguments[1].start,
        call.arguments[1].end,
      );
  }
  assert.deepEqual(Object.keys(callbacks).sort(), ['pagehide', 'pageshow']);
  let suspensions = 0,
    polls = 0;
  const context = {
    invitationActions: h.view,
    stopped: false,
    previousFrame: 17,
    suspend() {
      suspensions++;
    },
    poll() {
      polls++;
    },
    roomUI: null,
    effects: [],
    removeNativeInactive: null,
  };
  const hide = runInNewContext(`(${callbacks.pagehide})`, context),
    show = runInNewContext(`(${callbacks.pageshow})`, context);
  return { hide, show, context, suspensions: () => suspensions, polls: () => polls };
}

const deferredOutcomes = [
  ['share', ['success', 'cancel', 'failure']],
  ['copy', ['success', 'failure']],
];
function settleOutcome(job, outcome) {
  if (outcome === 'success') job.resolve();
  else
    job.reject(
      new DOMException('Modeled outcome', outcome === 'cancel' ? 'AbortError' : 'NotAllowedError'),
    );
}

for (const [action, outcomes] of deferredOutcomes)
  for (const outcome of outcomes)
    for (const retirement of [
      'hidden-return',
      'persisted-pagehide-return',
      'nonpersisted-pagehide',
      'dispose',
    ])
      test(`${action} ${outcome} after ${retirement} and locale refresh cannot publish stale feedback or move focus`, async (t) => {
        const previous = getLocale();
        setLocale('en', { persist: false });
        t.after(() => setLocale(previous, { persist: false }));
        const job = deferred();
        let calls = 0,
          qrCalls = 0;
        const h = fixture(t, {
          locale: getLocale,
          navigator: {
            share() {
              calls++;
              return job.promise;
            },
            clipboard: {
              writeText() {
                calls++;
                return job.promise;
              },
            },
          },
          createQr() {
            qrCalls++;
            throw new Error('No QR requested.');
          },
        });
        h.set(invitation());
        const button = h.$(action),
          status = h.$('share-status'),
          image = h.$('qr-image'),
          select = h.$('select'),
          qr = h.$('qr'),
          englishLabel = button.textContent,
          operation = h.press(action),
          elsewhere = h.doc.createElement('button');
        h.doc.body.append(elsewhere);
        elsewhere.focus();
        assert.equal(calls, 1);
        let owners = null;
        if (retirement === 'hidden-return') {
          h.doc.hidden = true;
          h.doc.emit('visibilitychange');
        } else if (retirement.includes('pagehide')) {
          owners = await actualPageOwners(h);
          owners.hide({ persisted: retirement === 'persisted-pagehide-return' });
          assert.equal(owners.context.stopped, true);
          assert.equal(owners.suspensions(), 1);
        } else h.view.dispose();
        const disposed = ['dispose', 'nonpersisted-pagehide'].includes(retirement);
        setLocale('uk', { persist: false });
        assert.equal(
          button.textContent,
          disposed
            ? englishLabel
            : action === 'copy'
              ? 'Копіювати запрошення'
              : 'Поділитися запрошенням',
        );
        assert.equal(h.doc.activeElement === elsewhere, true);
        if (retirement === 'hidden-return') {
          h.doc.hidden = false;
          h.doc.emit('visibilitychange');
        } else if (retirement === 'persisted-pagehide-return') {
          owners.show();
          assert.equal(owners.context.stopped, false);
          assert.equal(owners.polls(), 1);
        }
        h.set(invitation());
        button.click();
        qr.click();
        assert.equal(calls, 1, 'Retirement and return cannot create a second pending operation.');
        assert.equal(qrCalls, 0);
        settleOutcome(job, outcome);
        await operation;
        assert.equal(status.textContent, '');
        assert.equal(image.hidden, true);
        assert.equal(image.getAttribute('src'), null);
        assert.equal(
          select.hidden,
          true,
          'A stale Clipboard denial must not expose a new manual-selection state.',
        );
        assert.equal(h.field.value, invitation());
        assert.equal(h.selections(), 0);
        assert.equal(h.doc.activeElement === elsewhere, true);
        assert.equal(h.view.root.isConnected, !disposed);
        if (!disposed) {
          assert.equal(button.disabled, false);
          assert.equal(h.view.root.getAttribute('aria-busy'), 'false');
        } else assert.equal(button.onclick, null);
        setLocale('en', { persist: false });
        assert.equal(button.textContent, englishLabel);
        assert.equal(status.textContent, '');
        assert.equal(h.doc.activeElement === elsewhere, true);
        assert.equal(calls, 1);
        assert.equal(qrCalls, 0);
      });

for (const [action, outcomes] of deferredOutcomes)
  for (const outcome of outcomes)
    test(`${action} ${outcome} remains current through locale refresh and paints only current-language feedback`, async (t) => {
      const previous = getLocale();
      setLocale('en', { persist: false });
      t.after(() => setLocale(previous, { persist: false }));
      const job = deferred();
      let calls = 0;
      const h = fixture(t, {
        locale: getLocale,
        navigator: {
          share() {
            calls++;
            return job.promise;
          },
          clipboard: {
            writeText() {
              calls++;
              return job.promise;
            },
          },
        },
      });
      h.set(invitation());
      const button = h.$(action),
        status = h.$('share-status'),
        operation = h.press(action),
        elsewhere = h.doc.createElement('button');
      h.doc.body.append(elsewhere);
      elsewhere.focus();
      setLocale('uk', { persist: false });
      assert.equal(h.$(action) === button, true);
      assert.equal(button.disabled, false);
      assert.equal(button.getAttribute('aria-disabled'), 'true');
      assert.equal(status.textContent, '');
      assert.equal(calls, 1);
      settleOutcome(job, outcome);
      await operation;
      assert.match(
        status.textContent,
        action === 'copy'
          ? outcome === 'success'
            ? /^Запрошення скопійовано\.$/
            : /^Копіювання недоступне\./
          : outcome === 'success'
            ? /^Запит на поширення завершено\.$/
            : outcome === 'cancel'
              ? /^Поширення скасовано\./
              : /^Поширення тут недоступне\./,
      );
      assert.equal(h.$('qr-image').hidden, true);
      assert.equal(h.doc.activeElement === elsewhere, true);
      assert.equal(h.selections(), 0);
      assert.equal(h.view.root.getAttribute('aria-busy'), 'false');
      setLocale('en', { persist: false });
      assert.match(
        status.textContent,
        action === 'copy'
          ? outcome === 'success'
            ? /^Invitation copied\.$/
            : /^Copying is unavailable\./
          : outcome === 'success'
            ? /^Share request completed\.$/
            : outcome === 'cancel'
              ? /^Sharing cancelled\./
              : /^Sharing is unavailable here\./,
      );
      assert.equal(h.doc.activeElement === elsewhere, true);
      assert.equal(calls, 1);
    });

const focusOutcomes = [
  ['copy', 'success'],
  ['copy', 'failure'],
  ['share', 'success'],
  ['share', 'failure'],
  ['share', 'cancel'],
  ['qr', 'success'],
  ['qr', 'failure'],
];
for (const [action, outcome] of focusOutcomes)
  for (const focusOwner of ['retained', 'moved', 'retired-return'])
    test(`deferred ${action} ${outcome} preserves ${focusOwner} focus with native disabled blur`, async (t) => {
      const job = deferred(),
        calls = { copy: 0, share: 0, qr: 0 };
      const h = fixture(t, {
        nativeDisableBlur: true,
        navigator: {
          clipboard: {
            writeText() {
              calls.copy++;
              return job.promise;
            },
          },
          share() {
            calls.share++;
            return job.promise;
          },
        },
        createQr() {
          calls.qr++;
          return job.promise;
        },
      });
      h.set(invitation());
      const button = h.$(action),
        operation = h.press(action);
      assert.equal(
        h.doc.activeElement === button,
        true,
        'A pending action must not natively blur its focused button.',
      );
      assert.equal(button.disabled, false);
      assert.equal(button.getAttribute('aria-disabled'), 'true');
      assert.equal(h.view.root.getAttribute('aria-busy'), 'true');
      const elsewhere = h.doc.createElement('button');
      h.doc.body.append(elsewhere);
      if (focusOwner !== 'retained') elsewhere.focus();
      if (focusOwner === 'retired-return') {
        h.visible(false);
        assert.equal(button.disabled, true, 'Unavailable actions remain natively disabled.');
        h.visible(true);
        h.set(invitation());
        assert.equal(button.disabled, false);
        assert.equal(button.getAttribute('aria-disabled'), 'true');
      }
      for (const other of ['copy', 'share', 'qr', 'select']) h.$(other).click();
      assert.deepEqual(calls, {
        copy: Number(action === 'copy'),
        share: Number(action === 'share'),
        qr: Number(action === 'qr'),
      });
      assert.equal(h.selections(), 0);
      if (outcome === 'success')
        job.resolve(action === 'qr' ? { src: 'data:image/svg+xml,test', size: 29 } : undefined);
      else
        job.reject(
          Object.assign(new Error('test outcome'), {
            name: outcome === 'cancel' ? 'AbortError' : 'Error',
          }),
        );
      await operation;
      assert.equal(
        h.doc.activeElement === (focusOwner === 'retained' ? button : elsewhere),
        true,
        'Completion must neither lose retained focus nor steal moved focus.',
      );
      assert.equal(button.disabled, false);
      assert.equal(button.getAttribute('aria-disabled'), 'false');
      assert.equal(h.view.root.getAttribute('aria-busy'), 'false');
      assert.equal(h.field.value, invitation());
      assert.equal(h.selections(), 0);
      if (focusOwner === 'retired-return') {
        assert.equal(h.$('share-status').textContent, '');
        assert.equal(h.$('qr-image').hidden, true);
        assert.equal(h.$('qr-image').getAttribute('src'), null);
      } else {
        assert.match(
          h.$('share-status').textContent,
          action === 'qr'
            ? outcome === 'success'
              ? /^Scan to open the invitation/
              : /copy the invitation/
            : action === 'copy'
              ? outcome === 'success'
                ? /^Invitation copied/
                : /^Copying is unavailable/
              : outcome === 'success'
                ? /^Share request completed/
                : outcome === 'cancel'
                  ? /^Sharing cancelled/
                  : /^Sharing is unavailable/,
        );
        assert.equal(h.$('qr-image').hidden, !(action === 'qr' && outcome === 'success'));
      }
    });
