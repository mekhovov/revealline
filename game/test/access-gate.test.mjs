import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('Pages game and launch entries require the same remembered password gate', async () => {
  const [game, site, boot, launch, gate] = await Promise.all([
    read('../index.html'),
    read('../../site/index.html'),
    read('../boot.mjs'),
    read('../../site/launch.mjs'),
    read('../access-gate.mjs'),
  ]);
  for (const source of [game, site]) {
    assert.match(source, /data-access-state="locked"/);
    assert.match(source, /name="revealline-access-id" content="revealline"/);
    assert.match(source, /fD62nYJ5uj8yGLsEBEAn2Blq8lcesFrR_gdebUswlxg/);
  }
  assert.match(boot, /await host\.RevealLineAccess\?\.ready/);
  assert.match(launch, /await host\.RevealLineAccess\?\.ready/);
  assert.match(gate, /localStorage\?\.setItem/);
});

const { protectPageHTML, protectPageEntries, protectSourcePages } = await import(
  '../../scripts/access-pages.mjs'
);
const { parse } = await import('parse5');
const { fileURLToPath } = await import('node:url');
const root = fileURLToPath(new URL('../../', import.meta.url));
const elements = (html) => {
  const result = [];
  const visit = (node) => {
    if (node.tagName)
      result.push({
        tag: node.tagName,
        ...Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])),
      });
    for (const child of node.childNodes || []) visit(child);
  };
  visit(parse(html));
  return result;
};

test('every shipped source page requires the shared password before any page script runs', async () => {
  const files = await protectSourcePages(root, { check: true });
  assert.ok(files.length >= 65);
  for (const file of files) {
    const source = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    const nodes = elements(source);
    assert.equal(nodes.find((n) => n.tag === 'html')['data-access-state'], 'locked', file);
    const activeScripts = nodes.filter(
      (n) =>
        n.tag === 'script' &&
        !['application/x-revealline-locked', 'application/json', 'application/ld+json'].includes(
          n.type,
        ),
    );
    assert.equal(activeScripts.length, 1, file);
    assert.match(activeScripts[0].src, /access-gate\.mjs$/, file);
    assert.match(source, /html:not\(\[data-access-state=['"]unlocked['"]\]\)/, file);
    assert.equal(nodes.find((n) => n.name === 'revealline-access-id').content, 'revealline', file);
    assert.equal(
      nodes.find((n) => n.name === 'revealline-access-verifier').content,
      elements(await read('../index.html')).find((n) => n.name === 'revealline-access-verifier')
        .content,
      file,
    );
  }
});

test('generated pages, inline scripts and later-injected modules are gated idempotently', async () => {
  const config = await read('../index.html');
  const original =
    '<!doctype html><html><head><title>Fixture</title><script src="first.js"></script><script type="module" src="main.mjs"></script><script type="application/json">{"keep":true}</script></head><body><script>window.started = true;</script></body></html>';
  const entries = [
    { name: 'game/index.html', bytes: Buffer.from(config) },
    { name: 'privacy.html', bytes: Buffer.from(original) },
  ];
  protectPageEntries(entries);
  const source = entries[1].bytes.toString();
  assert.match(source, /src="game\/access-gate.mjs"/);
  assert.equal(elements(source).filter((n) => n['data-access-type'] !== undefined).length, 3);
  assert.match(source, /<script type="application\/json">/);
  assert.equal(protectPageHTML(source, 'privacy.html', config), source);
  const rotated = config.replace(
    /(name="revealline-access-verifier" content=")[^"]+/,
    '$1test-rotation',
  );
  assert.match(protectPageHTML(source, 'privacy.html', rotated), /content="test-rotation"/);
  const later = source.replace(
    '</head>',
    '<script type="module" src="install.mjs"></script></head>',
  );
  assert.equal(
    elements(protectPageHTML(later, 'privacy.html', config)).filter(
      (n) => n['data-access-type'] !== undefined,
    ).length,
    4,
  );
  assert.match(
    protectPageHTML(original, 'nested/deep/index.html', config),
    /src="\.\.\/\.\.\/game\/access-gate.mjs"/,
  );
});

test('offline launcher and generated update pages retain protected bytes in their cache descriptors', async () => {
  const { addOfflineLauncher, addOfflineUpdater } = await import(
    '../../scripts/offline-launcher.mjs'
  );
  const { createHash } = await import('node:crypto');
  const entries = [
    { name: 'game/installed-app.mjs', bytes: Buffer.from('fixture') },
    { name: 'game/index.html', bytes: Buffer.from(await read('../index.html')) },
    { name: 'game/downloads.html', bytes: Buffer.from(await read('../downloads.html')) },
    ...[180, 192, 512].map((size) => ({
      name: `icons/icon-${size}.png`,
      bytes: Buffer.from('fixture-icon'),
    })),
  ];
  await addOfflineLauncher(root, entries, '1.2.3');
  addOfflineUpdater(entries, {}, 'a'.repeat(64));
  protectPageEntries(entries);
  const worker = entries.find((e) => e.name === 'app/service-worker.js').bytes.toString();
  const config = JSON.parse(worker.match(/const CONFIG = (\{[^\n]+\});/)[1]);
  for (const descriptor of config.files) {
    const bytes = entries.find((e) => e.name === 'app/' + descriptor.path).bytes;
    assert.equal(bytes.length, descriptor.bytes, descriptor.path);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      descriptor.sha256,
      descriptor.path,
    );
  }
  assert.ok(config.files.some((e) => e.path === 'access-gate.mjs'));
  assert.ok(config.files.some((e) => e.path === 'access-gate.css'));
  for (const name of ['app/index.html', 'app/update.html', 'game-update.html']) {
    const source = entries.find((e) => e.name === name).bytes.toString();
    assert.match(source, /access-gate:start/, name);
    assert.equal(
      elements(source).filter(
        (n) =>
          n.tag === 'script' &&
          !n['data-access-type'] &&
          n.type !== 'application/x-revealline-locked',
      ).length,
      1,
      name,
    );
  }
});
