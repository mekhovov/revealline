import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import {
  importedRoute,
  importedCoverageRoute,
  playImportedRoute,
} from './helpers/coop-import-win.mjs';

// Native Blob/File bodies enter the production reader and image decoder. The
// finite DOM, Canvas, image decode and recorded keyboard fixtures are modeled;
// these tests make no native-browser, physical-device or public-release claim.
const options = {
  nativeFocus: true,
  nativeVisibility: true,
  capturePaint: true,
  stablePaintImages: true,
};
const sha = (value) => createHash('sha256').update(value).digest('hex');
function png(mark) {
  const chunk = (type, body) => {
    const bytes = Buffer.concat([Buffer.from(type), body]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, bytes, tail]);
  };
  const header = Buffer.alloc(13),
    pixels = Buffer.alloc((1152 * 4 + 1) * 576);
  header.writeUInt32BE(1152);
  header.writeUInt32BE(576, 4);
  header[8] = 8;
  header[9] = 6;
  pixels[1] = mark;
  pixels[4] = 255;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const pictures = [png(16), png(221)];
function bundle({ pack = importedRoute.authoredPack, corrupt = false } = {}) {
  pack = structuredClone(pack);
  const bodies = new Map(pictures.map((bytes) => [sha(bytes), bytes]));
  const assets = [...bodies]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hash, bytes]) => ({
      sha256: hash,
      bytes: bytes.length,
      mime: 'image/png',
      width: 1152,
      height: 576,
      provenance: {
        kind: 'user-supplied',
        attribution: 'Synthetic host fixture',
        source: 'Memory',
      },
    }));
  const manifest = {
    format: 'revealline-team-presentation-envelope.v1',
    pack,
    packSha256: sha(canonicalJSON(pack)),
    presentation: {
      id: 'local.host-test',
      revision: 1,
      theme: { id: 'fpv', revision: 32, collection: null },
      levels: pack.levels.map((level, index) => ({
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: sha(canonicalJSON(level)),
        pictureSha256: sha(pictures[index % pictures.length]),
      })),
      assets,
    },
  };
  const json = Buffer.from(JSON.stringify(manifest)),
    header = Buffer.alloc(12);
  header.write('RLTEAM1\n', 'ascii');
  header.writeUInt32BE(json.length, 8);
  const bytes = Buffer.concat([header, json, ...assets.map((asset) => bodies.get(asset.sha256))]);
  if (corrupt) bytes[bytes.length - 1] ^= 1;
  return {
    file: new File([bytes], 'local-team.rlteam', {
      type: 'application/vnd.revealline.team-presentation',
    }),
    pack,
    hashes: new Set(assets.map((asset) => asset.sha256)),
    firstHash: manifest.presentation.levels[0].pictureSha256,
    secondHash: manifest.presentation.levels[1].pictureSha256,
  };
}
function selectNative(f, file) {
  const input = f.$('coop-pack-file');
  input.closest('details').open = true;
  input.focus();
  input.files = [file];
  return input.onchange();
}
const preview = (f) => f.previewDrawImages.at(-1);
const image = (f) => f.drawImages.at(-1);
const status = (f) => f.$('coop-pack-status').textContent;
const localStatus = (f) => `${status(f)} ${f.$('coop-picture-status').textContent}`;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const hud = (f) =>
  [
    'coop-stage',
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-objective',
    'coop-state-0',
    'coop-state-1',
  ].map((id) => f.$(id).textContent);
const io = (f) => ({
  reads: f.artwork.calls.reads.length,
  decodes: f.artwork.calls.decodes.length,
  urls: [...f.artwork.calls.urls],
  releases: [...f.artwork.calls.releases],
});
function start(f) {
  f.$('coop-difficulty').value = 'gentle';
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
}
async function next(f) {
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
}
function localDecodeCount(f, fixture) {
  return f.artwork.calls.decodes.filter((entry) => fixture.hashes.has(entry.sha256)).length;
}
function assertReady(f, fixture) {
  assert.equal(f.$('coop-level').value, fixture.pack.levels[0].id);
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-menu').hidden, false, 'validated import never starts automatically');
  assert.equal(preview(f).sha256, fixture.firstHash);
  assert.match(localStatus(f), /local artwork/i);
}

for (const source of ['new pack', 'exact starter namespace']) {
  test(`native .rlteam ${source} validates every image, previews and requires a separate Start`, async (t) => {
    const fixture = bundle({
      pack: source === 'new pack' ? importedRoute.authoredPack : COOP_STARTER_PACK,
    });
    const f = await page(t, options);
    const old = preview(f),
      oldURL = old.src,
      reads = f.artwork.calls.reads.length;
    await selectNative(f, fixture.file);
    assertReady(f, fixture);
    assert.equal(f.doc.activeElement.id, 'coop-start');
    assert.notEqual(preview(f), old);
    assert.equal(
      localDecodeCount(f, fixture),
      3,
      'two qualification decodes plus the selected picture',
    );
    assert.equal(
      f.artwork.calls.reads.length,
      reads,
      'local artwork never reads a compiled substitute',
    );
    assert.equal(f.artwork.calls.releases.filter((url) => url === oldURL).length, 1);
    assert.equal(
      f.artwork.calls.releases.length,
      3,
      'temporary qualification images are also released',
    );
    start(f);
    assert.equal(image(f), preview(f));
    assert.equal(image(f).sha256, fixture.firstHash);
  });
}

test('local multi-core victory → distinct coverage artwork → Retry retains the accepted picture and recipe', async (t) => {
  const fixture = bundle(),
    f = await page(t, options);
  await selectNative(f, fixture.file);
  start(f);
  const firstImage = image(f);
  const route = playImportedRoute(f);
  assert.ok(route.objectives.some((text) => /1 \/ 2 secured/.test(text)));
  assert.equal(f.$('coop-objective').textContent, 'Strongholds secured together');
  await next(f);
  assert.equal(f.$('coop-stage').textContent, 'IMPORTED COVERAGE');
  assert.equal(f.$('coop-reserves').textContent, '5 reserves');
  assert.equal(image(f).sha256, fixture.secondHash);
  assert.notEqual(image(f), firstImage);
  const accepted = { hud: hud(f), image: image(f), paint: f.lastPaint },
    resources = io(f);
  playImportedRoute(f, importedCoverageRoute);
  assert.equal(f.$('coop-next').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /Final arena in this pack/);
  const firstResult = hud(f);
  f.$('coop-level').value = fixture.pack.levels[0].id;
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-experiment').value = 'independent';
  f.$('coop-retry').focus();
  f.tap('Enter');
  assert.deepEqual(hud(f), accepted.hud);
  assert.equal(image(f), accepted.image);
  assert.equal(f.lastPaint, accepted.paint);
  assert.deepEqual(
    io(f),
    resources,
    'Retry neither reparses the owner nor reads or decodes an image',
  );
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  playImportedRoute(f, importedCoverageRoute);
  assert.deepEqual(hud(f), firstResult);
  assert.equal(image(f), accepted.image);
  assert.deepEqual(io(f), resources);
  const stopped = f.lastPaint;
  f.tick(60);
  assert.equal(f.lastPaint, stopped);
});

test('Settings and its return retain local artwork, paused gameplay and explicit Resume', async (t) => {
  const fixture = bundle(),
    f = await page(t, options);
  await selectNative(f, fixture.file);
  start(f);
  f.tick(2);
  f.tap('KeyD');
  f.tick(30);
  f.tap('Escape');
  const paused = hud(f),
    acceptedImage = image(f),
    resources = io(f);
  assert.equal(f.$('coop-overlay').hidden, false);
  f.$('coop-settings-open').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-options').open, true);
  f.tick(60);
  assert.deepEqual(hud(f), paused);
  f.$('coop-settings-close').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(image(f), acceptedImage);
  assert.deepEqual(io(f), resources);
  f.tick(60);
  assert.deepEqual(hud(f), paused, 'closing Settings does not resume');
  f.$('coop-resume').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(image(f), acceptedImage);
});

test('reimporting identical bytes after lobby return gives the new owner a usable independent lease', async (t) => {
  const fixture = bundle(),
    f = await page(t, options);
  await selectNative(f, fixture.file);
  start(f);
  const old = image(f),
    oldURL = old.src;
  f.tap('Escape');
  f.$('coop-lobby').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(preview(f), old);
  await selectNative(f, fixture.file);
  assertReady(f, fixture);
  const current = preview(f),
    currentURL = current.src;
  assert.notEqual(current, old);
  assert.equal(current.sha256, old.sha256);
  assert.equal(f.artwork.calls.releases.filter((url) => url === oldURL).length, 1);
  start(f);
  playImportedRoute(f);
  const resources = io(f);
  f.$('coop-retry').focus();
  f.tap('Enter');
  assert.equal(image(f), current);
  assert.equal(image(f).src, currentURL);
  assert.deepEqual(io(f), resources);
  playImportedRoute(f);
  await next(f);
  assert.equal(
    image(f).sha256,
    fixture.secondHash,
    'retiring the first owner cannot invalidate Next',
  );
});

test('failed prepared local picture retains the qualified draft for explicit Retry without requalifying it', async (t) => {
  const fixture = bundle();
  let occurrences = 0;
  const f = await page(t, {
    ...options,
    presentation: {
      decode: ({ image: decoded }) => {
        if (decoded.sha256 === fixture.firstHash && ++occurrences === 2)
          throw new Error('fixture selected image failed');
      },
    },
  });
  const old = preview(f),
    reads = f.artwork.calls.reads.length;
  await selectNative(f, fixture.file);
  assert.equal(f.$('coop-pack-status').dataset.state, 'error');
  assert.match(status(f), /fixture selected image failed/);
  assert.equal(preview(f), old);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-pack-retry').hidden, false);
  assert.equal(localDecodeCount(f, fixture), 3);
  await f.$('coop-pack-retry').onclick();
  assertReady(f, fixture);
  assert.equal(localDecodeCount(f, fixture), 4, 'Retry repeats only selected-picture preparation');
  assert.equal(f.artwork.calls.reads.length, reads);
  start(f);
  assert.equal(image(f).sha256, fixture.firstHash);
});

test('Cancel during qualification fences late decode and ignores another picker event until ownership settles', async (t) => {
  const fixture = bundle(),
    gate = deferred();
  t.after(() => gate.resolve());
  let once = true;
  const f = await page(t, {
    ...options,
    presentation: {
      decode: ({ image: decoded }) => {
        if (fixture.hashes.has(decoded.sha256) && once) {
          once = false;
          return gate.promise;
        }
      },
    },
  });
  const old = preview(f),
    oldURL = old.src;
  const pending = selectNative(f, fixture.file);
  await waitFor(() => localDecodeCount(f, fixture) === 1);
  assert.equal(f.$('coop-pack-file').disabled, true);
  assert.equal(preview(f), old);
  f.$('coop-pack-cancel').click();
  assert.equal(
    f.$('coop-pack-file').disabled,
    true,
    'the owned decoder must settle before another file can enter',
  );
  assert.equal(f.$('coop-pack-retry').disabled, true);
  const newer = structuredClone(fixture.pack);
  newer.id = 'ignored-while-pending';
  newer.levels.reverse();
  await selectNative(f, bundle({ pack: newer }).file);
  assert.equal(f.$('coop-pack-file').value, '');
  assert.equal(localDecodeCount(f, fixture), 1);
  gate.resolve();
  await pending;
  assert.equal(preview(f), old);
  assert.equal(old.src, oldURL);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-pack-file').disabled, false);
  assert.equal(f.$('coop-pack-retry').disabled, false);
  assert.match(status(f), /cancelled/i);
  await f.$('coop-pack-retry').onclick();
  assertReady(f, fixture);
  assert.equal(
    localDecodeCount(f, fixture),
    4,
    'Retry rereads the cancelled file, qualifies both images and prepares the first',
  );
  start(f);
});

test('a corrupt required body leaves the existing pack and picture usable without substitution', async (t) => {
  const fixture = bundle({ corrupt: true }),
    f = await page(t, options);
  const old = preview(f),
    oldURL = old.src,
    reads = f.artwork.calls.reads.length;
  await selectNative(f, fixture.file);
  assert.equal(f.$('coop-pack-status').dataset.state, 'error');
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(preview(f), old);
  assert.equal(old.src, oldURL);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.$('coop-pack-retry').hidden, false);
  assert.equal(f.$('coop-menu').hidden, false);
  start(f);
  assert.equal(image(f), old);
});

test('changing another arena under the reserved starter identity rejects the whole local-art source', async (t) => {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.levels[1].name += ' locally altered';
  const fixture = bundle({ pack }),
    f = await page(t, options);
  const old = preview(f),
    reads = f.artwork.calls.reads.length;
  await selectNative(f, fixture.file);
  assert.equal(f.$('coop-pack-status').dataset.state, 'error');
  assert.equal(preview(f), old);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(
    f.artwork.calls.reads.length,
    reads,
    'a reserved mismatch cannot fall back to generic reviewed artwork',
  );
  assert.equal(f.$('coop-menu').hidden, false);
  start(f);
  assert.equal(image(f), old);
});

test('reentrant Cancel then Start during tentative setup cannot start uncommitted local content', async (t) => {
  const fixture = bundle(),
    f = await page(t, options);
  const old = preview(f),
    oldURL = old.src;
  const select = f.$('coop-level'),
    replace = select.replaceChildren.bind(select);
  let once = true,
    during;
  t.mock.method(select, 'replaceChildren', (...nodes) => {
    replace(...nodes);
    if (!once) return;
    once = false;
    f.$('coop-pack-cancel').onclick();
    f.$('coop-start').onclick();
    during = { menu: f.$('coop-menu').hidden, overlay: f.$('coop-overlay').hidden };
  });
  await selectNative(f, fixture.file);
  assert.deepEqual(during, { menu: false, overlay: true });
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(preview(f), old);
  assert.equal(old.src, oldURL);
  assert.equal(f.$('coop-pack-retry').hidden, false);
  assert.equal(f.$('coop-menu').hidden, false);
  start(f);
  assert.equal(image(f), old);
  const candidateURLs = f.artwork.calls.urls.filter((url) => url !== oldURL);
  assert.equal(
    candidateURLs.length,
    3,
    'qualification and tentative preparation made three leases',
  );
  for (const url of candidateURLs)
    assert.equal(
      f.artwork.calls.releases.filter((released) => released === url).length,
      1,
      'rolled-back local content cannot leave an orphan drawable',
    );
  f.win.emit('pagehide', { persisted: false });
  assert.deepEqual(new Set(f.artwork.calls.releases), new Set(f.artwork.calls.urls));
  assert.equal(f.artwork.calls.releases.length, f.artwork.calls.urls.length);
});

for (const action of ['replacement', 'reset']) {
  test(`a ${action} during completed local import UI keeps ownership over the older success tail`, async (t) => {
    const fixture = bundle(),
      f = await page(t, options);
    const initialHash = preview(f).sha256;
    const newerPack = structuredClone(fixture.pack);
    newerPack.id = 'completion-replacement';
    newerPack.name = 'Completion replacement';
    newerPack.levels.reverse();
    const newer = bundle({ pack: newerPack });
    const button = f.$('coop-start');
    const descriptor = Object.getOwnPropertyDescriptor(button, 'disabled');
    assert.equal(typeof descriptor.set, 'function');
    let once = true,
      replacement;
    Object.defineProperty(button, 'disabled', {
      configurable: true,
      get() {
        return descriptor.get.call(this);
      },
      set(value) {
        descriptor.set.call(this, value);
        // The initial tentative-ready render writes disabled before its status
        // text. This later render follows accepted setup, at completion/closure.
        if (
          !once ||
          !/Local artwork ready/.test(f.$('coop-picture-status').textContent) ||
          preview(f)?.sha256 !== fixture.firstHash
        )
          return;
        once = false;
        if (action === 'replacement') replacement = selectNative(f, newer.file);
        else {
          f.$('coop-pack-reset').onclick();
          f.$('coop-level').focus();
        }
      },
    });
    t.after(() => Object.defineProperty(button, 'disabled', descriptor));
    await selectNative(f, fixture.file);
    assert.equal(once, false, 'the completion callback must actually execute');
    if (action === 'replacement') {
      await replacement;
      assertReady(f, newer);
      assert.match(status(f), /Completion replacement/);
      assert.equal(
        f.doc.activeElement.id,
        'coop-start',
        'only the completed replacement owns return focus',
      );
    } else {
      await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
      assert.equal(f.$('coop-level').value, 'first-connection');
      assert.equal(preview(f).sha256, initialHash);
      assert.equal(
        f.doc.activeElement.id,
        'coop-level',
        'older completion must not steal the newer focus intent',
      );
    }
    assert.equal(f.$('coop-start').disabled, false);
    assert.equal(f.$('coop-menu').hidden, false);
    assert.equal(f.$('coop-pack-retry').hidden, true);
    const current = preview(f);
    start(f);
    assert.equal(image(f), current);
    f.win.emit('pagehide', { persisted: false });
    assert.deepEqual(new Set(f.artwork.calls.releases), new Set(f.artwork.calls.urls));
    assert.equal(
      f.artwork.calls.releases.length,
      f.artwork.calls.urls.length,
      'each owner retires exactly once',
    );
  });
}

for (const action of ['reset', 'arena change']) {
  test(`${action} during tentative replacement cannot restore a retired local owner`, async (t) => {
    const accepted = bundle(),
      f = await page(t, options);
    const builtinHash = preview(f).sha256;
    await selectNative(f, accepted.file);
    assertReady(f, accepted);
    const replacementPack = structuredClone(accepted.pack);
    replacementPack.id = 'tentative-replacement';
    replacementPack.name = 'Tentative replacement';
    const replacement = bundle({ pack: replacementPack });
    const select = f.$('coop-level'),
      replace = select.replaceChildren.bind(select);
    let once = true,
      change;
    t.mock.method(select, 'replaceChildren', (...nodes) => {
      replace(...nodes);
      if (!once) return;
      once = false;
      if (action === 'reset') f.$('coop-pack-reset').onclick();
      else change = f.choose('coop-level', accepted.pack.levels[1].id);
    });
    await selectNative(f, replacement.file);
    await change;
    await waitFor(
      () => f.$('coop-picture-status').dataset.state === 'ready',
      () => localStatus(f),
    );
    assert.equal(once, false, 'the tentative setup callback must execute');
    assert.equal(f.$('coop-menu').hidden, false);
    assert.equal(f.$('coop-start').disabled, false);
    if (action === 'reset') {
      assert.equal(f.$('coop-level').value, 'first-connection');
      assert.equal(preview(f).sha256, builtinHash);
      assert.match(status(f), new RegExp(COOP_STARTER_PACK.name));
      assert.doesNotMatch(status(f), /Local artwork/);
    } else {
      assert.ok(accepted.pack.levels.some((level) => level.id === f.$('coop-level').value));
      assert.ok(accepted.hashes.has(preview(f).sha256));
      assert.match(status(f), new RegExp(accepted.pack.name));
      assert.doesNotMatch(status(f), /Tentative replacement/);
      assert.match(localStatus(f), /Local artwork/);
    }
    const current = preview(f);
    start(f);
    assert.equal(
      image(f),
      current,
      'Start confirms the surviving source and its exact decoded image',
    );
    f.win.emit('pagehide', { persisted: false });
    assert.deepEqual(new Set(f.artwork.calls.releases), new Set(f.artwork.calls.urls));
    assert.equal(f.artwork.calls.releases.length, f.artwork.calls.urls.length);
  });
}

test('cancelled local Next keeps the earned result and a deliberate retry selects the pinned successor', async (t) => {
  const fixture = bundle(),
    gate = deferred();
  t.after(() => gate.resolve());
  let occurrences = 0;
  const f = await page(t, {
    ...options,
    presentation: {
      decode: ({ image: decoded }) => {
        if (decoded.sha256 === fixture.secondHash && ++occurrences === 2) return gate.promise;
      },
    },
  });
  await selectNative(f, fixture.file);
  start(f);
  playImportedRoute(f);
  const result = hud(f),
    earned = image(f),
    earnedURL = earned.src;
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(() => occurrences === 2);
  assert.deepEqual(hud(f), result);
  assert.equal(image(f), earned);
  f.$('coop-next-cancel').click();
  gate.resolve();
  await flush();
  assert.deepEqual(hud(f), result);
  assert.equal(image(f), earned);
  assert.equal(earned.src, earnedURL);
  assert.equal(f.$('coop-overlay').hidden, false);
  await next(f);
  assert.equal(image(f).sha256, fixture.secondHash);
  assert.equal(f.$('coop-level').value, fixture.pack.levels[1].id);
});

test('terminal departure during qualification releases the late decoder and the existing image exactly once', async (t) => {
  const fixture = bundle(),
    gate = deferred();
  t.after(() => gate.resolve());
  let once = true;
  const f = await page(t, {
    ...options,
    presentation: {
      decode: ({ image: decoded }) => {
        if (fixture.hashes.has(decoded.sha256) && once) {
          once = false;
          return gate.promise;
        }
      },
    },
  });
  const pending = selectNative(f, fixture.file);
  await waitFor(() => localDecodeCount(f, fixture) === 1);
  f.win.emit('pagehide', { persisted: false });
  gate.resolve();
  await pending;
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.artwork.calls.urls.length, 2);
  assert.equal(f.artwork.calls.releases.length, 2);
  assert.equal(new Set(f.artwork.calls.releases).size, 2);
  assert.deepEqual(new Set(f.artwork.calls.releases), new Set(f.artwork.calls.urls));
});
