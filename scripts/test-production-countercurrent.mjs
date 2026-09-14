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
const baseline = await read('authoring/production/register-fracture-themes.json');
const candidate = await read('authoring/production/register-countercurrent.json');
const clone = (value) => JSON.parse(JSON.stringify(value));
const countercurrentWorks = (value) => value.works.filter((w) => w.adapter === 'countercurrent');
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
  const fixture = await mkdtemp(path.join(root, '.cache/countercurrent-register-source-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const name of pins.keys()) {
    const target = path.join(fixture, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, name), target);
  }
  // Historical metadata remains part of the source fixture, not original media.
  const historyRoot = 'authoring/production/history';
  const history = JSON.parse(await readFile(path.join(root, historyRoot, 'index.json'), 'utf8'));
  await mkdir(path.join(fixture, historyRoot), { recursive: true });
  for (const name of [
    'index.json',
    ...history.entries.map((p) => `${p.sha256}${path.posix.extname(p.path)}`),
  ])
    await writeFile(
      path.join(fixture, historyRoot, name),
      await readFile(path.join(root, historyRoot, name)),
    );
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

test('Countercurrent appends twelve exact picture cells and three proposed families without approving quality', () => {
  const valid = validateProductionRegister(candidate, { previous: baseline });
  const summary = summarizeProduction(valid);
  assert.equal(candidate.revision, 4);
  assert.equal(summary.uniquePictureWorks, 60);
  assert.equal(summary.domains.picture.missing, 56);
  assert.equal(summary.domains.picture.stages.produced, 60);
  assert.equal(summary.domains.picture.stages.released, 0);
  assert.deepEqual(summary.maps, { target: 29, proposed: 15, approved: 0, unassigned: 14 });
  for (const key of ['assessments', 'deliveries', 'enemies', 'basis'])
    assert.deepEqual(candidate[key], baseline[key]);
  for (const key of ['works', 'bindings', 'layouts', 'authorities'])
    assert.deepEqual(candidate[key].slice(0, baseline[key].length), baseline[key]);
  assert.deepEqual(
    candidate.maps.map((m) => m.id),
    baseline.maps.map((m) => m.id),
  );
  for (let i = 13; i <= 15; i++) {
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

test('finite data adapters authenticate twelve distinct Countercurrent originals and all retained source bodies', async () => {
  const result = await verifyProductionSources(candidate, { root, files: true });
  assert.equal(result.metadata, 'verified');
  assert.equal(result.originalBytesVerified, true);
  assert.equal(result.originals.length, 68);
  const works = countercurrentWorks(candidate);
  assert.equal(works.length, 12);
  assert.equal(new Set(works.map((w) => w.files[0].file.sha256)).size, 12);
  assert.equal(
    works.reduce((n, w) => n + w.files[0].file.bytes, 0),
    31692501,
  );
  assert.equal(new Set(works.map((w) => w.owners[0].baseCampaignKey)).size, 4);
  assert.equal(new Set(works.map((w) => w.owners[0].levelId)).size, 3);
});

test('the uniform adapter rejects borrowed source IDs, same-body wrong paths and invented dimensions', async () => {
  for (const theme of themes) {
    for (const mutation of ['sourceId', 'path', 'width']) {
      const next = clone(candidate);
      const [first, second] = countercurrentWorks(next).filter((w) => w.themeId === theme);
      if (mutation === 'sourceId') first.sourceId = second.sourceId;
      if (mutation === 'path') first.files[0].file.path = second.files[0].file.path;
      if (mutation === 'width') first.files[0].width++;
      await assert.rejects(
        verifyProductionSources(next, { root }),
        /Original mismatch|Countercurrent original path\/dimensions differ/,
      );
    }
  }
});

test('crossed theme or mission bindings do not borrow an exact original from a different owner', () => {
  for (const theme of themes) {
    const wrongTheme = clone(candidate);
    const binding = wrongTheme.bindings.find((b) => b.slotId === `picture.unassigned-13.${theme}`);
    binding.handle.owner = clone(
      countercurrentWorks(wrongTheme).find(
        (w) => w.themeId === themes[(themes.indexOf(theme) + 1) % themes.length],
      ).owners[0],
    );
    assert.throws(() => validateProductionRegister(wrongTheme), /owner/);
    const wrongMission = clone(candidate);
    const target = wrongMission.bindings.find((b) => b.slotId === `picture.unassigned-13.${theme}`);
    const other = countercurrentWorks(wrongMission).find(
      (w) => w.themeId === theme && w.owners[0].levelId === 'countercurrent-sandbar-braid',
    );
    target.workId = other.id;
    target.handle.owner = clone(other.owners[0]);
    assert.throws(() => validateProductionRegister(wrongMission), /another planned layout/);
  }
});

test('coherently edited register owner and layout still must match the authored descriptor', async () => {
  const next = clone(candidate);
  const work = countercurrentWorks(next)[0];
  const originalOwner = clone(work.owners[0]);
  work.owners[0].baseCampaignKey = 'countercurrent-fpv/1/0000000000000000';
  const binding = next.bindings.find((b) => b.workId === work.id);
  binding.handle.owner = clone(work.owners[0]);
  const layout = next.layouts.find((l) => l.id === 'countercurrent-offset-docks');
  layout.owners[
    layout.owners.findIndex((o) => o.baseCampaignKey === originalOwner.baseCampaignKey)
  ] = clone(work.owners[0]);
  validateProductionRegister(next);
  await assert.rejects(verifyProductionSources(next, { root }), /Authored owners changed/);
});

test('freshly pinned authority cannot redirect an FPV original to another source path', async (t) => {
  const { next, fixture } = await forgedSources(t, async (change) => {
    await change('authoring/library/countercurrent-chapters/editions.json', (d) => {
      d.editions[0].images[0].path = d.editions[0].images[1].path;
    });
  });
  await assert.rejects(
    verifyProductionSources(next, { root: fixture }),
    /Countercurrent source\/owner differs/,
  );
});

test('freshly pinned theme descriptor cannot relabel an original as another mission', async (t) => {
  const { next, fixture } = await forgedSources(t, async (change) => {
    await change('authoring/library/countercurrent-chapters/descriptors/ukraine.json', (d) => {
      d.originals[0].levelId = d.originals[1].levelId;
    });
  });
  await assert.rejects(
    verifyProductionSources(next, { root: fixture }),
    /Countercurrent source\/owner differs/,
  );
});

test('old register history stays immutable and a Countercurrent family cannot count twice', async () => {
  const changed = clone(candidate);
  changed.layouts[0].owners.pop();
  assert.throws(() => validateProductionRegister(changed, { previous: baseline }));
  const duplicate = clone(candidate);
  duplicate.maps[15] = {
    ...duplicate.maps[15],
    selection: 'proposed',
    layoutId: 'countercurrent-offset-docks',
  };
  assert.throws(() => validateProductionRegister(duplicate), /family/);
  const falseSource = clone(candidate);
  falseSource.layouts.find((l) => l.id === 'countercurrent-offset-docks').source = clone(
    baseline.layouts[0].source,
  );
  await assert.rejects(
    verifyProductionSources(falseSource, { root }),
    /Countercurrent layout source differs/,
  );
  const oldSummary = summarizeProduction(baseline);
  assert.equal(oldSummary.uniquePictureWorks, 48);
  assert.equal(oldSummary.domains.picture.missing, 68);
  assert.deepEqual(oldSummary.maps, { target: 29, proposed: 12, approved: 0, unassigned: 17 });
});

test('freshly pinned art manifest cannot invent dimensions beside unchanged provenance', async (t) => {
  const { next, fixture } = await forgedSources(t, async (change) => {
    await change('authoring/library/countercurrent-art/manifest.json', (d) => {
      d.images[0].width--;
    });
  });
  await assert.rejects(
    verifyProductionSources(next, { root: fixture }),
    /Countercurrent source\/owner differs/,
  );
});

test('freshly pinned cohort cannot duplicate a theme and hide another exact edition', async (t) => {
  const { next, fixture } = await forgedSources(t, async (change) => {
    await change('authoring/library/countercurrent-chapters/editions.json', (d) => {
      d.editions[3].themeId = 'fpv';
    });
  });
  await assert.rejects(
    verifyProductionSources(next, { root: fixture }),
    /Unknown Countercurrent cohort/,
  );
});
