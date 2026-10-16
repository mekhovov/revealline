import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { exportThemeBundle, hashPresentationBytes } from '../presentation/bundle.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import {
  PRODUCTION_LEDGER,
  checkFieldKitReadiness,
  checkCommittedFieldKitReadiness,
} from '../../scripts/check-field-kit-readiness.mjs';

function declaredFixture() {
  const document = structuredClone(createDefaultThemeBundle());
  const selected = resolvePresentation(document);
  for (const slot of document.slots.filter((row) => row.required)) {
    const ref = selected.assets[slot.id];
    document.assets.find((row) => row.id === ref.id && row.revision === ref.revision).quality = {
      stage: 'reviewed',
      evidence: ['Synthetic declaration fixture; never production visual approval.'],
    };
  }
  return document;
}

test('readiness accepts declared required revisions and retains optional historical source slots', async () => {
  const document = declaredFixture(),
    before = structuredClone(document),
    ledger = await exportThemeBundle(document);
  const result = await checkFieldKitReadiness(ledger);
  assert.equal(result.requiredReviewed, 194);
  assert.equal(document.slots.length, 335);
  assert.equal(
    document.slots.filter((slot) => slot.id.startsWith('team.') && !slot.required).length,
    42,
  );
  assert.equal(result.optionalSlots, 141);
  assert.deepEqual(result.coverage, { missing: 0, source: 141, produced: 0, reviewed: 194 });
  assert.equal(result.declarationOnly, true);
  assert.match(result.limitation, /no visual acceptance inferred/);
  assert.deepEqual(document, before);
});

test('readiness lists every required source and produced slot by exact identity', async () => {
  const document = declaredFixture();
  const selected = resolvePresentation(document);
  const asset = (id) => document.assets.find((row) => row.id === selected.assets[id].id);
  asset('trail.active').quality = { stage: 'source', evidence: [] };
  const image = asset('player.scout.compact'),
    bytes = encodeSpritePNG({ width: 32, height: 32, rgba: new Uint8Array(32 * 32 * 4) }),
    sha256 = await hashPresentationBytes(bytes);
  image.kind = 'image';
  image.recipe = null;
  image.geometry = structuredClone(
    document.slots.find((row) => row.id === 'player.scout.compact').geometry,
  );
  image.file = { sha256, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 };
  image.quality = { stage: 'produced', evidence: [] };
  const ledger = await exportThemeBundle(document, new Map([[sha256, new Blob([bytes])]]));
  await assert.rejects(checkFieldKitReadiness(ledger), (error) => {
    assert.deepEqual(error.unresolved.map((row) => row.slotId).sort(), [
      'player.scout.compact',
      'trail.active',
    ]);
    for (const id of ['player.scout.compact', 'trail.active'])
      assert.ok(error.message.includes(id));
    assert.match(error.message, /player.scout.compact.default@1/);
    return true;
  });
});

test('readiness verifies bundle integrity and evidence validity before accepting declarations', async () => {
  const ledger = await exportThemeBundle(declaredFixture());
  const bytes = new Uint8Array(await ledger.arrayBuffer());
  bytes[0] ^= 1;
  await assert.rejects(checkFieldKitReadiness(new Blob([bytes])), /Unsupported theme bundle/);
  await assert.rejects(
    checkFieldKitReadiness(new Blob([await ledger.arrayBuffer(), 'extra'])),
    /trailing/,
  );
  const blankEvidence = Buffer.from(await ledger.arrayBuffer()),
    marker = Buffer.from('Synthetic declaration fixture; never production visual approval.'),
    start = blankEvidence.indexOf(marker);
  assert.ok(start >= 12);
  blankEvidence.fill(32, start, start + marker.length);
  await assert.rejects(checkFieldKitReadiness(new Blob([blankEvidence])), /quality evidence/);
});

test('a reviewed historical revision cannot qualify a selected unreviewed successor', async () => {
  const document = declaredFixture(),
    id = 'trail.active',
    previous = resolvePresentation(document).assets[id],
    revision = {
      ...structuredClone(previous),
      revision: previous.revision + 1,
      provenance: {
        ...previous.provenance,
        parent: { id: previous.id, revision: previous.revision },
      },
      quality: { stage: 'source', evidence: [] },
    };
  const next = reviseStudioTheme(document, {
    assets: [revision],
    bindings: { [id]: { id: revision.id, revision: revision.revision } },
  });
  await assert.rejects(checkFieldKitReadiness(await exportThemeBundle(next)), (error) => {
    assert.deepEqual(
      error.unresolved.map((row) => row.slotId),
      [id],
    );
    assert.match(error.message, /trail.active.default@2/);
    return true;
  });
});

test('committed readiness binds the source tree and ledger and rejects an unstaged declaration', async (t) => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'presentation-readiness-'));
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  const file = path.join(projectRoot, PRODUCTION_LEDGER);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const ledger = Buffer.from(await (await exportThemeBundle(declaredFixture())).arrayBuffer());
  await fs.writeFile(file, ledger);
  git('add', '--', PRODUCTION_LEDGER);
  git(
    '-c',
    'user.name=Readiness fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgSign=false',
    'commit',
    '--quiet',
    '-m',
    'Synthetic readiness fixture',
  );
  const result = await checkCommittedFieldKitReadiness(projectRoot);
  assert.equal(result.sourceRevision, git('rev-parse', 'HEAD'));
  assert.equal(result.sourceTree, git('rev-parse', 'HEAD^{tree}'));
  assert.equal(result.ledgerSha256, await hashPresentationBytes(ledger));
  await fs.appendFile(file, '\n');
  await assert.rejects(checkCommittedFieldKitReadiness(projectRoot), /differs from HEAD/);
});
