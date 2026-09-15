import { Element as DOMElement } from './helpers/couch-dom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachProfileRecoveryView } from '../ui/profile-recovery.mjs';

// Model the real page's named controls and explicit events, without claiming layout,
// browser downloads, image decoding or storage integration from this small fixture.
const markup = readFileSync(new URL('../profile-recovery.html', import.meta.url), 'utf8');
const channel = Object.freeze({ id: 'release-v0.41.0', version: 'v0.41.0' });
const alias = Object.freeze({ id: 'release-0.41.0', version: '0.41.0' });
const rawReview = (selected) =>
  Object.freeze({
    channel: selected,
    profile: { status: 'valid-structure', completedLevels: 2, pictures: 1, scores: 3 },
    saved: { status: 'stored-unverified' },
    diagnostics: [],
    recoveryPending: false,
  });
const original = (id, availability = 'available-unverified') =>
  Object.freeze({
    asset: Object.freeze({ id, width: 2, height: 1, bytes: 79, sha256: 'a'.repeat(64) }),
    references: Object.freeze([{ id: `${id}-presentation` }]),
    availability,
    verified: false,
  });
const first = original('first-original');
const second = original('second-original');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

class Element extends DOMElement {
  constructor(doc, attributes = '', tag = 'span') {
    super(doc, tag);
    this.doc = doc;
    this.hidden = /\bhidden\b/.test(attributes);
    this.disabled = /\bdisabled\b/.test(attributes);
    this.clicks = 0;
  }
  removeAttribute(name) {
    super.removeAttribute(name);
    delete this[name];
  }
  focus() {
    this.doc.activeElement = this;
  }
  click() {
    this.clicks++;
    return this.onclick?.();
  }
}

function fixture(options = {}) {
  const doc = { activeElement: null };
  doc.createElement = (tag) => new Element(doc, '', tag);
  const elements = new Map();
  for (const match of markup.matchAll(/<[^>]+\bid="(profile-recovery-[^"]+)"[^>]*>/g))
    elements.set(match[1], new Element(doc, match[0]));
  doc.getElementById = (id) => elements.get(id) ?? null;
  const $ = (id) => doc.getElementById(`profile-recovery-${id}`);
  const calls = {
    discover: [],
    review: [],
    raw: [],
    originals: [],
    verify: [],
    export: [],
    close: 0,
  };
  const rawBlob = new Blob(['stored profile'], { type: 'application/json' });
  const fileBlob = new Blob(['selected bytes'], { type: 'image/png' });
  const reportBlob = new Blob(['identity only'], { type: 'application/json' });
  const verified = Object.freeze({ asset: first.asset, verified: true, fullBackup: false });
  const reader = {
    async discover(args) {
      calls.discover.push(args);
      return { channels: options.channels ?? [channel], diagnostics: [] };
    },
    async review(selected, args) {
      calls.review.push({ selected, args });
      return rawReview(selected);
    },
    async exportStoredData(value, args) {
      calls.raw.push({ value, args });
      return { blob: rawBlob, filename: 'stored.json', completeStoredSnapshot: true };
    },
    async reviewOriginals(value, args) {
      calls.originals.push({ value, args });
      return {
        originals: options.originals ?? [first, second],
        diagnostics: options.diagnostics ?? [],
      };
    },
    async verifyOriginal(value, args) {
      calls.verify.push({ value, args });
      return verified;
    },
    async exportOriginalComponent(value, args) {
      calls.export.push({ value, args });
      return args.component === 'original-file'
        ? { blob: fileBlob, filename: 'first-original.png' }
        : { blob: reportBlob, filename: 'first-original-report.json' };
    },
    async close() {
      calls.close++;
    },
    ...options.reader,
  };
  const urls = [],
    revoked = [],
    backs = [];
  let view;
  view = attachProfileRecoveryView({
    document: doc,
    reader,
    supportedChannels: options.supportedChannels ?? [channel.id],
    catalogIssue: options.catalogIssue ?? '',
    createURL(blob) {
      const url = `blob:fixture-${urls.length + 1}`;
      urls.push({ blob, url });
      options.onCreateURL?.({ blob, url, view });
      return url;
    },
    revokeURL(url) {
      revoked.push(url);
    },
    onBack() {
      backs.push('back');
      return options.onBack?.();
    },
  });
  return {
    $,
    doc,
    view,
    calls,
    urls,
    revoked,
    backs,
    reader,
    rawBlob,
    fileBlob,
    reportBlob,
    verified,
  };
}
async function review(f) {
  await f.$('find').onclick();
  await f.$('review').onclick();
}
async function prepare(f) {
  await review(f);
  await f.$('export').onclick();
  await f.$('originals-review').onclick();
  await f.$('original-verify').onclick();
  await f.$('original-file').onclick();
  f.$('original-report').focus();
  await f.$('original-report').onclick();
}

test('Back completion includes the asynchronous parent close and focus callback', async () => {
  const pending = deferred();
  const f = fixture({ onBack: () => pending.promise });
  let settled = false;
  const back = f
    .$('back')
    .onclick()
    .then(() => {
      settled = true;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.backs, ['back']);
  assert.equal(settled, false);
  pending.resolve();
  await back;
  assert.equal(settled, true);
});

test('overlapping Back and close share reader cleanup before either caller can leave', async () => {
  const pending = deferred();
  let closes = 0;
  const f = fixture({
    reader: {
      close: () => {
        closes++;
        return pending.promise;
      },
    },
  });
  await prepare(f);
  const back = f.$('back').onclick();
  const first = f.view.close(),
    second = f.view.close();
  assert.equal(first, second, 'Every close caller joins the same cleanup');
  await Promise.resolve();
  assert.equal(closes, 1);
  assert.deepEqual(f.backs, []);
  assert.equal(f.$('download').hidden, true);
  assert.equal(f.$('original-download').hidden, true);
  assert.equal(f.$('report-download').hidden, true);
  assert.equal(f.revoked.length, 3);
  pending.resolve();
  await Promise.all([back, first, second]);
  assert.deepEqual(f.backs, ['back']);
});

test('original review is explicit and lists unverified metadata without claiming an earned picture', async () => {
  const f = fixture({ diagnostics: [{ message: 'Another stored body is absent.' }] });
  assert.equal(f.$('originals-review').disabled, true);
  await review(f);
  assert.equal(f.calls.originals.length, 0);
  assert.equal(f.$('originals-review').disabled, false);
  await f.$('originals-review').onclick();
  assert.equal(f.calls.originals[0].value.channel, channel);
  assert.equal(f.calls.originals[0].args.signal instanceof AbortSignal, true);
  assert.deepEqual(
    f.$('original').children.map((o) => o.value),
    ['0', '1'],
  );
  assert.match(f.$('original-summary').textContent, /first-original · 2 × 1 · 79 bytes/);
  assert.match(f.$('original-summary').textContent, /have not been verified/);
  assert.match(f.$('status').textContent, /not proof of pictures earned/);
  assert.match(f.$('status').textContent, /1 stored media availability issues/);
  assert.equal(f.calls.verify.length, 0);
  assert.equal(f.$('original-file').disabled, true);
  assert.equal(f.$('original-report').disabled, true);
  await f.view.close();
});

test('an empty shared-original list explains built-in pictures and retains raw recovery', async () => {
  const f = fixture({
    originals: [],
    diagnostics: [{ message: 'A separate media issue remains.' }],
  });
  await review(f);
  await f.$('export').onclick();
  const rawURL = f.$('download').href;
  await f.$('originals-review').onclick();
  assert.match(f.$('status').textContent, /0 shared originals listed/);
  assert.match(f.$('status').textContent, /Built-in pictures come from game files/);
  assert.match(f.$('status').textContent, /Only uploaded or restored shared originals appear/);
  assert.match(f.$('status').textContent, /does not mean your earned pictures were lost/);
  assert.match(f.$('status').textContent, /1 stored media availability issues remain/);
  assert.equal(f.$('original').children.length, 0);
  assert.equal(f.$('original').disabled, true);
  assert.equal(f.$('original-verify').disabled, true);
  assert.equal(f.$('original-file').disabled, true);
  assert.equal(f.$('original-report').disabled, true);
  assert.equal(f.$('download').href, rawURL);
  assert.equal(f.$('download').hidden, false);
  assert.equal(f.calls.verify.length, 0);
  assert.equal(f.calls.export.length, 0);
  await f.view.close();
});

test('an unsupported exact alias cannot borrow another channel catalog but retains raw export', async () => {
  const f = fixture({ channels: [alias] });
  await review(f);
  assert.match(f.$('catalog-status').textContent, /release-v0\.41\.0/);
  assert.equal(f.$('originals-review').disabled, true);
  await f.$('export').onclick();
  const rawURL = f.$('download').href;
  // Invoke the handler directly as well: a disabled control is not the authority guard.
  await f.$('originals-review').onclick();
  assert.equal(f.calls.originals.length, 0);
  assert.match(f.$('status').textContent, /this exact channel/);
  assert.equal(f.$('download').href, rawURL);
  assert.equal(f.$('download').hidden, false);
  assert.equal(f.calls.raw[0].value.channel, alias);
  assert.equal(f.urls[0].blob, f.rawBlob);
  await f.view.close();
});

test('catalog loading failure leaves the current exact channel raw review and export usable', async () => {
  const f = fixture({ supportedChannels: [], catalogIssue: 'Catalog digest mismatch.' });
  assert.match(f.$('catalog-status').textContent, /Catalog digest mismatch/);
  await review(f);
  assert.equal(f.$('originals-review').disabled, true);
  assert.equal(f.$('export').disabled, false);
  await f.$('export').onclick();
  assert.equal(f.$('download').hidden, false);
  assert.equal(f.calls.raw[0].value.channel, channel);
  assert.equal(f.urls[0].blob, f.rawBlob);
  await f.$('originals-review').onclick();
  assert.equal(f.calls.originals.length, 0);
  assert.equal(f.$('download').href, 'blob:fixture-1');
  await f.view.close();
});

test('missing and length-mismatched originals remain visible but cannot start verification', async () => {
  const f = fixture({
    originals: [original('missing', 'missing'), original('truncated', 'length-mismatch')],
  });
  await review(f);
  await f.$('originals-review').onclick();
  for (const [index, text] of [
    [0, /file is missing/],
    [1, /Stored length differs/],
  ]) {
    f.$('original').value = String(index);
    f.$('original').onchange();
    assert.match(f.$('original-summary').textContent, text);
    assert.equal(f.$('original-verify').disabled, true);
    await f.$('original-verify').onclick();
  }
  for (const value of ['', '99', '-1', '0e0']) {
    f.$('original').value = value;
    f.$('original').onchange();
    await f.$('original-verify').onclick();
  }
  assert.equal(f.calls.verify.length, 0);
  assert.equal(f.calls.export.length, 0);
  assert.equal(f.$('original-summary').textContent, '');
  await f.view.close();
});

test('opaque reader handles and separate component links preserve the raw download and revoke only replaced URLs', async () => {
  const f = fixture();
  await prepare(f);
  assert.match(f.$('original-summary').textContent, /verified during this review/);
  assert.doesNotMatch(f.$('original-summary').textContent, /have not been verified/);
  assert.match(f.$('original').children[0].textContent, /verified during review/);
  assert.match(f.$('original').children[1].textContent, /available unverified/);
  assert.equal(first.verified, false, 'Reader inventory and opaque handles remain unchanged');
  assert.equal(f.calls.originals[0].value, f.calls.raw[0].value);
  assert.equal(f.calls.verify[0].value, first);
  assert.equal(f.calls.verify[0].args.signal instanceof AbortSignal, true);
  assert.equal(f.calls.export.length, 2);
  for (const row of f.calls.export) {
    assert.equal(row.value, f.verified);
    assert.equal(row.args.signal instanceof AbortSignal, true);
  }
  assert.deepEqual(
    f.calls.export.map((row) => row.args.component),
    ['original-file', 'identity-report'],
  );
  assert.deepEqual(
    f.urls.map((row) => row.blob),
    [f.rawBlob, f.fileBlob, f.reportBlob],
  );
  assert.equal(f.$('download').href, 'blob:fixture-1');
  assert.equal(f.$('original-download').download, 'first-original.png');
  assert.equal(f.$('report-download').download, 'first-original-report.json');
  assert.equal(f.doc.activeElement, f.$('report-download'));
  assert.match(f.$('status').textContent, /download completion is not checked/);
  assert.deepEqual(f.revoked, []);
  await f.$('original-file').onclick();
  assert.deepEqual(f.revoked, ['blob:fixture-2']);
  assert.equal(f.$('original-download').href, 'blob:fixture-4');
  assert.equal(f.$('report-download').href, 'blob:fixture-3');
  assert.equal(f.$('download').href, 'blob:fixture-1');
  for (const id of ['download', 'original-download', 'report-download'])
    assert.equal(f.$(id).clicks, 0);
  await f.view.close();
  assert.equal(new Set(f.revoked).size, 4);
  assert.equal(f.revoked.length, 4);
});

test('changing the selected original drops verification and both component links without dropping raw data', async () => {
  const f = fixture();
  await prepare(f);
  f.$('original').value = '1';
  f.$('original').onchange();
  assert.match(
    f.$('original-summary').textContent,
    /second-original.*\n.*\n.*have not been verified/,
  );
  assert.match(f.$('original').children[0].textContent, /available unverified/);
  assert.match(f.$('original').children[1].textContent, /available unverified/);
  assert.equal(f.$('original-file').disabled, true);
  assert.equal(f.$('original-report').disabled, true);
  assert.equal(f.$('original-download').hidden, true);
  assert.equal(f.$('report-download').hidden, true);
  assert.equal(f.$('download').href, 'blob:fixture-1');
  await f.$('original-file').onclick();
  assert.equal(f.calls.export.length, 2);
  await f.$('original-verify').onclick();
  assert.equal(f.calls.verify.at(-1).value, second);
  assert.match(f.$('original-summary').textContent, /verified during this review/);
  assert.match(f.$('original').children[1].textContent, /verified during review/);
  assert.equal(f.$('original-file').disabled, false);
  await f.view.close();
});

test('a new Find, Review or exact channel choice clears every prepared link and original handle', async () => {
  for (const action of ['find', 'review', 'channel']) {
    const f = fixture({ channels: [channel, alias] });
    await prepare(f);
    if (action === 'channel') {
      f.$('channel').value = '1';
      f.$('channel').onchange();
    } else await f.$(action).onclick();
    assert.deepEqual(
      new Set(f.revoked),
      new Set(['blob:fixture-1', 'blob:fixture-2', 'blob:fixture-3']),
      action,
    );
    for (const id of ['download', 'original-download', 'report-download']) {
      assert.equal(f.$(id).hidden, true, action);
      assert.equal(f.$(id).href, undefined, action);
    }
    assert.equal(f.$('original').children.length, 0, action);
    assert.equal(f.$('original-file').disabled, true, action);
    assert.equal(f.$('original-report').disabled, true, action);
    await f.view.close();
  }
});

test('cancelled original metadata review cannot publish late choices and preserves the raw link', async () => {
  const pending = deferred();
  let signal;
  const f = fixture({
    reader: {
      reviewOriginals(value, args) {
        signal = args.signal;
        return pending.promise;
      },
    },
  });
  await review(f);
  await f.$('export').onclick();
  const checking = f.$('originals-review').onclick();
  f.$('cancel').focus();
  f.$('cancel').onclick();
  assert.equal(signal.aborted, true);
  pending.resolve({ originals: [first], diagnostics: [] });
  await checking;
  assert.equal(f.$('original').children.length, 0);
  assert.equal(f.$('original-verify').disabled, true);
  assert.equal(f.$('download').href, 'blob:fixture-1');
  assert.match(f.$('status').textContent, /cancelled/);
  assert.equal(f.doc.activeElement, f.$('review'));
  await f.view.close();
});

test('cancelled verification cannot promote a late opaque verified handle', async () => {
  const pending = deferred();
  let signal;
  const f = fixture({
    reader: {
      verifyOriginal(value, args) {
        assert.equal(value, first);
        signal = args.signal;
        return pending.promise;
      },
    },
  });
  await review(f);
  await f.$('originals-review').onclick();
  const verifying = f.$('original-verify').onclick();
  assert.equal(f.$('original').disabled, true);
  f.view.cancel();
  pending.resolve(f.verified);
  await verifying;
  assert.equal(signal.aborted, true);
  assert.equal(f.$('original-file').disabled, true);
  await f.$('original-file').onclick();
  assert.equal(f.calls.export.length, 0);
  assert.deepEqual(f.urls, []);
  await f.view.close();
});

test('Back awaits reader closure and a late component export cannot publish a URL', async () => {
  const exporting = deferred(),
    closing = deferred();
  let signal,
    closeCalls = 0;
  const f = fixture({
    reader: {
      exportOriginalComponent(value, args) {
        assert.equal(value, f.verified);
        signal = args.signal;
        return exporting.promise;
      },
      close() {
        closeCalls++;
        return closing.promise;
      },
    },
  });
  await review(f);
  await f.$('export').onclick();
  await f.$('originals-review').onclick();
  await f.$('original-verify').onclick();
  const preparing = f.$('original-file').onclick();
  const back = f.$('back').onclick();
  assert.equal(closeCalls, 1);
  assert.equal(signal.aborted, true);
  assert.deepEqual(f.backs, []);
  exporting.resolve({ blob: f.fileBlob, filename: 'late.png' });
  await preparing;
  assert.equal(f.urls.length, 1);
  assert.deepEqual(f.revoked, ['blob:fixture-1']);
  assert.equal(f.$('original-download').hidden, true);
  closing.resolve();
  await back;
  assert.deepEqual(f.backs, ['back']);
  await f.view.close();
  assert.equal(closeCalls, 1);
});

test('cancellation during object URL creation revokes the new component URL before publication', async () => {
  for (const component of ['original-file', 'original-report']) {
    const f = fixture({
      onCreateURL({ blob, view }) {
        if (blob !== f.rawBlob) view.cancel();
      },
    });
    await review(f);
    await f.$('export').onclick();
    await f.$('originals-review').onclick();
    await f.$('original-verify').onclick();
    await f.$(component).onclick();
    assert.deepEqual(f.revoked, ['blob:fixture-2']);
    assert.equal(f.$('original-download').hidden, true);
    assert.equal(f.$('report-download').hidden, true);
    assert.equal(f.$('download').href, 'blob:fixture-1');
    assert.equal(f.$('download').hidden, false);
    await f.view.close();
  }
});

test('fresh component verification failure removes that stale link and keeps the other component and raw link', async () => {
  const f = fixture();
  await prepare(f);
  f.reader.exportOriginalComponent = async () => {
    throw new Error('Selected bytes changed. Review again.');
  };
  await f.$('original-file').onclick();
  assert.match(f.$('status').textContent, /Selected bytes changed/);
  assert.match(f.$('original-summary').textContent, /verified during this review/);
  assert.match(f.$('original-summary').textContent, /File preparation rechecks them/);
  assert.equal(f.$('original-download').hidden, true);
  assert.equal(f.$('original-download').href, undefined);
  assert.equal(f.$('report-download').href, 'blob:fixture-3');
  assert.equal(f.$('download').href, 'blob:fixture-1');
  assert.deepEqual(f.revoked, ['blob:fixture-2']);
  await f.view.close();
});

test('reverification clears the earlier label before waiting and cancel or failure cannot restore it', async () => {
  const f = fixture();
  await prepare(f);
  const pending = deferred();
  f.reader.verifyOriginal = () => pending.promise;
  const checking = f.$('original-verify').onclick();
  assert.match(f.$('original-summary').textContent, /have not been verified/);
  assert.match(f.$('original').children[0].textContent, /available unverified/);
  assert.equal(f.$('original-download').hidden, true);
  assert.equal(f.$('report-download').hidden, true);
  f.view.cancel();
  pending.resolve(f.verified);
  await checking;
  assert.match(f.$('status').textContent, /cancelled/);
  assert.match(f.$('original-summary').textContent, /have not been verified/);
  assert.equal(f.$('original-file').disabled, true);
  f.reader.verifyOriginal = async () => {
    throw new Error('Original hash changed');
  };
  await f.$('original-verify').onclick();
  assert.match(f.$('status').textContent, /Original hash changed/);
  assert.match(f.$('original-summary').textContent, /have not been verified/);
  assert.match(f.$('original').children[0].textContent, /available unverified/);
  assert.equal(f.$('original-file').disabled, true);
  f.reader.verifyOriginal = async () => f.verified;
  await f.$('original-verify').onclick();
  assert.match(f.$('original-summary').textContent, /verified during this review/);
  assert.match(f.$('original').children[0].textContent, /verified during review/);
  assert.equal(f.$('original-file').disabled, false);
  await f.$('originals-review').onclick();
  assert.match(f.$('original-summary').textContent, /have not been verified/);
  assert.match(f.$('original').children[0].textContent, /available unverified/);
  assert.equal(f.$('original-file').disabled, true);
  await f.view.close();
});
