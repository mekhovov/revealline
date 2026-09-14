import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateProductionRegister,
  summarizeProduction,
  inspectProductionSlot,
} from '../authoring/production/model.mjs';
import { verifyProductionSources } from '../authoring/production/sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async (name) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const baseline = await read('authoring/production/register-sentinel-themes.json');
const candidate = await read('authoring/production/register-fracture-themes.json');
const clone = (value) => JSON.parse(JSON.stringify(value));
const fractureWorks = (value) => value.works.filter((w) => w.adapter.startsWith('fracture'));
const themes = ['fpv', 'ukraine', 'retro', 'coupa'];

// Copy only declared metadata to an isolated source tree, then genuinely re-pin a
// forged authority. Refusals must concern source relationships, not stale hashes.
async function forgedSources(t, edit) {
  const next = clone(candidate);
  const pins = new Map();
  const visit = (v, fn) => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.path === 'string' && typeof v.sha256 === 'string') fn(v);
    for (const child of Object.values(v)) visit(child, fn);
  };
  const originalPaths = new Set(next.works.flatMap((w) => w.files.map((f) => f.file.path)));
  visit(next, (p) => {
    if (!originalPaths.has(p.path)) pins.set(p.path, p);
  });
  await mkdir(path.join(root, '.cache'), { recursive: true });
  const fixture = await mkdtemp(path.join(root, '.cache/fracture-register-source-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const name of pins.keys()) {
    const target = path.join(fixture, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, name), target);
  }
  // Historical metadata remains part of the source fixture, not original media.
  const historyRoot = 'authoring/production/history';
  await mkdir(path.join(fixture, historyRoot), { recursive: true });
  for (const [indexName, extension] of [
    ['index.json', null],
    ['source-index.json', 'source'],
  ]) {
    const history = JSON.parse(await readFile(path.join(root, historyRoot, indexName), 'utf8'));
    for (const name of [
      indexName,
      ...history.entries.map(
        (p) => `${p.sha256}${extension ? `.${extension}` : path.posix.extname(p.path)}`,
      ),
    ])
      await writeFile(
        path.join(fixture, historyRoot, name),
        await readFile(path.join(root, historyRoot, name)),
      );
  }
  await edit(async (name, mutate) => {
    assert.ok(pins.has(name), 'fixture edits only declared metadata');
    const target = path.join(fixture, name);
    const data = JSON.parse(await readFile(target, 'utf8'));
    mutate(data);
    const bytes = Buffer.from(`${JSON.stringify(data)}\n`);
    await writeFile(target, bytes);
    visit(next, (p) => {
      if (p.path === name) {
        p.bytes = bytes.length;
        p.sha256 = createHash('sha256').update(bytes).digest('hex');
      }
    });
  });
  return { next, fixture };
}

test('Fracture appends twelve exact picture cells and three proposed families without approving quality', () => {
  const valid = validateProductionRegister(candidate, { previous: baseline });
  const summary = summarizeProduction(valid);
  assert.equal(candidate.revision, 3);
  assert.equal(summary.uniquePictureWorks, 48);
  assert.equal(summary.domains.picture.missing, 68);
  assert.equal(summary.domains.picture.stages.produced, 48);
  assert.equal(summary.domains.picture.stages.released, 0);
  assert.deepEqual(summary.maps, { target: 29, proposed: 12, approved: 0, unassigned: 17 });
  for (const key of ['assessments', 'deliveries', 'enemies', 'basis'])
    assert.deepEqual(candidate[key], baseline[key]);
  for (const key of ['works', 'bindings', 'layouts', 'authorities'])
    assert.deepEqual(candidate[key].slice(0, baseline[key].length), baseline[key]);
  assert.deepEqual(
    candidate.maps.map((m) => m.id),
    baseline.maps.map((m) => m.id),
  );
  for (let i = 10; i <= 12; i++) {
    const map = candidate.maps.find((m) => m.id === `unassigned-${i}`);
    assert.equal(map.selection, 'proposed');
    const layout = candidate.layouts.find((l) => l.id === map.layoutId);
    assert.equal(layout.variantOf, null);
    assert.deepEqual(
      layout.owners.map((o) => o.themeId),
      themes,
    );
    for (const theme of themes) {
      const slot = inspectProductionSlot(candidate, `picture.unassigned-${i}.${theme}`);
      assert.equal(slot.stage, 'produced');
      assert.equal(slot.missingChecks.length, 9);
    }
  }
});

test('finite data adapters authenticate twelve distinct Fracture originals and all retained source bodies', async () => {
  const result = await verifyProductionSources(candidate, { root, files: true });
  assert.equal(result.metadata, 'verified');
  assert.equal(result.originalBytesVerified, true);
  assert.equal(result.originals.length, 56);
  const works = fractureWorks(candidate);
  assert.equal(works.length, 12);
  assert.equal(new Set(works.map((w) => w.files[0].file.sha256)).size, 12);
  assert.equal(
    works.reduce((n, w) => n + w.files[0].file.bytes, 0),
    34040565,
  );
  assert.equal(new Set(works.map((w) => w.owners[0].baseCampaignKey)).size, 4);
  assert.equal(new Set(works.map((w) => w.owners[0].levelId)).size, 3);
});

test('both adapters reject borrowed source IDs, same-body wrong paths and invented dimensions', async () => {
  for (const theme of ['fpv', 'ukraine']) {
    for (const mutation of ['sourceId', 'path', 'width']) {
      const next = clone(candidate);
      const [first, second] = fractureWorks(next).filter((w) => w.themeId === theme);
      if (mutation === 'sourceId') first.sourceId = second.sourceId;
      if (mutation === 'path') first.files[0].file.path = second.files[0].file.path;
      if (mutation === 'width') first.files[0].width++;
      await assert.rejects(
        verifyProductionSources(next, { root }),
        /Original mismatch|Fracture original path\/dimensions differ/,
      );
    }
  }
});

test('crossed theme or mission bindings do not borrow an exact original from a different owner', () => {
  for (const theme of ['fpv', 'ukraine']) {
    const wrongTheme = clone(candidate);
    const binding = wrongTheme.bindings.find((b) => b.slotId === `picture.unassigned-10.${theme}`);
    binding.handle.owner = clone(
      fractureWorks(wrongTheme).find((w) => w.themeId === 'retro').owners[0],
    );
    assert.throws(() => validateProductionRegister(wrongTheme), /owner/);
    const wrongMission = clone(candidate);
    const target = wrongMission.bindings.find((b) => b.slotId === `picture.unassigned-10.${theme}`);
    const other = fractureWorks(wrongMission).find(
      (w) => w.themeId === theme && w.owners[0].levelId === 'fracture-lines-fault-fan',
    );
    target.workId = other.id;
    target.handle.owner = clone(other.owners[0]);
    assert.throws(() => validateProductionRegister(wrongMission), /another planned layout/);
  }
});

test('coherently edited register owner and layout still must match the authored descriptor', async () => {
  const next = clone(candidate);
  const work = fractureWorks(next)[0];
  const originalOwner = clone(work.owners[0]);
  work.owners[0].baseCampaignKey = 'fracture-lines-fpv/1/0000000000000000';
  const binding = next.bindings.find((b) => b.workId === work.id);
  binding.handle.owner = clone(work.owners[0]);
  const layout = next.layouts.find((l) => l.id === 'fracture-split-ring');
  layout.owners[
    layout.owners.findIndex((o) => o.baseCampaignKey === originalOwner.baseCampaignKey)
  ] = clone(work.owners[0]);
  validateProductionRegister(next);
  await assert.rejects(verifyProductionSources(next, { root }), /Authored owners changed/);
});

test('freshly pinned authority cannot redirect an FPV original to another source path', async (t) => {
  const { next, fixture } = await forgedSources(t, async (change) => {
    await change('authoring/library/fracture-lines-chapter/edition.json', (d) => {
      d.images[0].path = d.images[1].path;
    });
  });
  await assert.rejects(
    verifyProductionSources(next, { root: fixture }),
    /Fracture source\/owner differs/,
  );
});

test('freshly pinned theme descriptor cannot relabel an original as another mission', async (t) => {
  const { next, fixture } = await forgedSources(t, async (change) => {
    await change('authoring/library/fracture-theme-chapters/descriptors/ukraine.json', (d) => {
      d.originals[0].levelId = d.originals[1].levelId;
    });
  });
  await assert.rejects(
    verifyProductionSources(next, { root: fixture }),
    /Fracture source\/owner differs/,
  );
});

test('old register history stays immutable and a Fracture family cannot count twice', async () => {
  const changed = clone(candidate);
  changed.layouts[0].owners.pop();
  assert.throws(() => validateProductionRegister(changed, { previous: baseline }));
  const duplicate = clone(candidate);
  duplicate.maps[12] = {
    ...duplicate.maps[12],
    selection: 'proposed',
    layoutId: 'fracture-split-ring',
  };
  assert.throws(() => validateProductionRegister(duplicate), /family/);
  const falseSource = clone(candidate);
  falseSource.layouts.find((l) => l.id === 'fracture-split-ring').source = clone(
    baseline.layouts[0].source,
  );
  await assert.rejects(
    verifyProductionSources(falseSource, { root }),
    /Fracture layout source differs/,
  );
  const oldSummary = summarizeProduction(baseline);
  assert.equal(oldSummary.uniquePictureWorks, 36);
  assert.equal(oldSummary.domains.picture.missing, 80);
  assert.deepEqual(oldSummary.maps, { target: 29, proposed: 9, approved: 0, unassigned: 20 });
});
