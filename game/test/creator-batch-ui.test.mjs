import test from 'node:test';
import assert from 'node:assert/strict';
import { createBatchCreatorController, naturalFileOrder } from '../creator/batch-ui.mjs';
import { Document } from './helpers/couch-dom.mjs';

const file = (name, size = 100) => ({ name, size, type: 'image/png' });

function harness(overrides = {}) {
  const document = new Document();
  const make = (tag, id) => {
    const element = document.createElement(tag);
    element.id = id;
    document.body.append(element);
    return element;
  };
  const nodes = {
    surface: make('section', 'batch-review'),
    list: make('div', 'batch-list'),
    progress: make('progress', 'batch-progress'),
    progressLabel: make('p', 'batch-progress-label'),
    readiness: make('p', 'batch-readiness'),
    capacity: make('p', 'batch-capacity'),
    generate: make('button', 'batch-generate'),
    cancel: make('button', 'batch-cancel'),
    removeExcluded: make('button', 'batch-remove-excluded'),
    split: make('button', 'batch-split'),
    approve: make('button', 'batch-approve'),
    intake: make('input', 'image'),
    pacing: make('select', 'pacing'),
    collectionName: make('input', 'name'),
    fit: make('select', 'fit'),
    creatorCredit: make('input', 'creator-credit'),
    pictureCredit: make('input', 'picture-credit'),
    license: make('input', 'license'),
  };
  nodes.pacing.value = 'balanced';
  nodes.collectionName.value = 'My campaign';
  nodes.fit.value = 'contain';
  nodes.creatorCredit.value = 'Creator';
  nodes.pictureCredit.value = 'Picture owner';
  nodes.license.value = 'Shared for play';
  const prepared = [];
  let active = 0,
    peak = 0,
    approved = null,
    split = null,
    revoked = 0;
  const controller = createBatchCreatorController({
    document,
    nodes,
    prepareItem:
      overrides.prepareItem ??
      (async (item, context) => {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active--;
        if (item.file.name.startsWith('bad')) throw new Error('Unsupported picture header.');
        prepared.push({ name: item.file.name, context });
        return {
          thumbnail: new Blob(['thumbnail']),
          alt: item.title,
          validation: 'Image and route verified.',
          templateLabel: `variant ${context.index}`,
          estimatedBytes: item.file.size * 2,
        };
      }),
    approveBatch:
      overrides.approveBatch ?? (async (items, settings) => (approved = { items, settings })),
    capacityFor: overrides.capacityFor,
    onSplit: (chunks, settings) => (split = { chunks, settings }),
    createObjectURL: (_blob) => `blob:test-${prepared.length}`,
    revokeObjectURL: () => revoked++,
  });
  return {
    document,
    nodes,
    controller,
    prepared,
    peak: () => peak,
    approved: () => approved,
    split: () => split,
    revoked: () => revoked,
  };
}

test('natural filename ordering is numeric and stable for duplicate names', () => {
  const duplicateA = file('picture2.png'),
    duplicateB = file('picture2.png');
  assert.deepEqual(
    naturalFileOrder([file('picture10.png'), duplicateA, file('Picture1.png'), duplicateB]),
    [file('Picture1.png'), duplicateA, duplicateB, file('picture10.png')],
  );
});

test('batch review prepares serially, keeps per-item errors, and approves only included ready items', async () => {
  const h = harness();
  h.controller.setFiles([file('10.png'), file('bad3.png'), file('2.png')]);
  assert.equal(h.nodes.surface.hidden, false);
  assert.deepEqual(
    h.controller.snapshot().items.map((item) => item.file.name),
    ['2.png', '10.png', 'bad3.png'],
  );
  assert.equal(h.nodes.list.querySelectorAll('.batch-card').length, 3);
  assert.deepEqual(
    h.nodes.list
      .querySelectorAll('.batch-card')
      .map((card) => card.children[1].children[0].textContent),
    ['1. 2', '2. 10', '3. bad3'],
  );

  await h.controller.generate();
  assert.equal(h.peak(), 1, 'only one full-size item may prepare at once');
  assert.deepEqual(
    h.controller.snapshot().items.map((item) => item.status),
    ['ready', 'ready', 'error'],
  );
  assert.match(h.nodes.readiness.textContent, /1 included item need attention/);
  assert.equal(h.nodes.approve.disabled, true);

  const failed = h.controller.snapshot().items[2];
  h.controller.setIncluded(failed.id, false);
  assert.equal(h.controller.snapshot().ready, true);
  assert.equal(h.nodes.approve.disabled, false);
  await h.nodes.approve.onclick();
  assert.deepEqual(
    h.approved().items.map((item) => item.file.name),
    ['2.png', '10.png'],
  );
  assert.equal(h.approved().settings.collectionName, 'My campaign');
  assert.equal(h.approved().settings.creatorCredit, 'Creator');
});

test('reorder controls preserve explicit play order and setting changes invalidate review', async () => {
  const h = harness();
  h.controller.setFiles([file('1.png'), file('2.png'), file('3.png')]);
  const last = h.controller.snapshot().items[2];
  const middleRemove = h.nodes.list.children[1].querySelectorAll('button')[3];
  middleRemove.focus();
  h.controller.move(last.id, -1);
  assert.deepEqual(
    h.controller.snapshot().items.map((item) => item.file.name),
    ['1.png', '3.png', '2.png'],
  );
  assert.equal(h.document.activeElement.dataset.itemId, 'picture-2');
  assert.equal(h.document.activeElement.dataset.batchAction, 'remove');
  await h.controller.generate();
  assert.equal(h.controller.snapshot().ready, true);
  const first = h.controller.snapshot().items[0];
  h.controller.setTitle(first.id, 'Opening picture');
  assert.equal(h.controller.snapshot().items[0].title, 'Opening picture');
  assert.equal(h.controller.snapshot().items[0].status, 'queued');
  await h.controller.generate();
  assert.ok(h.revoked() > 0, 're-rendered thumbnail object URLs are revoked');
  h.nodes.pacing.value = 'gentle-first';
  h.nodes.pacing.emit('change');
  assert.equal(h.controller.snapshot().ready, false);
  assert.deepEqual(
    h.controller.snapshot().items.map((item) => item.status),
    ['queued', 'queued', 'queued'],
  );
  h.controller.destroy();
  assert.ok(h.revoked() >= 3, 'destroy revokes live thumbnail object URLs');
});

test('cancel stops the active preparation without discarding the draft', async () => {
  let started;
  const waiting = new Promise((resolve) => (started = resolve));
  const h = harness({
    prepareItem: (_item, { signal }) =>
      new Promise((resolve, reject) => {
        started();
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('cancelled', 'AbortError')),
          { once: true },
        );
      }),
  });
  h.controller.setFiles([file('1.png'), file('2.png')]);
  const pending = h.controller.generate();
  await waiting;
  assert.equal(h.nodes.cancel.hidden, false);
  assert.equal(h.nodes.intake.disabled, true);
  h.controller.cancel();
  await pending;
  assert.equal(h.controller.snapshot().items.length, 2);
  assert.equal(h.controller.snapshot().items[0].status, 'cancelled');
  assert.equal(h.controller.snapshot().items[1].status, 'queued');
  assert.equal(h.nodes.cancel.hidden, true);
  assert.equal(h.nodes.intake.disabled, false);
});

test('capacity overflow exposes explicit split and removal choices', async () => {
  const h = harness({
    capacityFor: (items) => ({
      estimatedBytes: items.length * 100,
      stagingBytes: items.length * 200,
      limitBytes: 250,
      fits: items.length < 2,
      maxItemsPerPack: 1,
    }),
  });
  h.controller.setFiles([file('1.png'), file('2.png'), file('3.png')]);
  assert.equal(h.nodes.split.hidden, false);
  assert.equal(h.nodes.split.disabled, true);
  assert.equal(h.nodes.approve.disabled, true);
  assert.match(h.nodes.approve.title, /explicit package split/);
  assert.match(h.nodes.capacity.textContent, /Split the campaign or remove pictures/);
  const excluded = h.controller.snapshot().items[1];
  h.controller.setIncluded(excluded.id, false);
  assert.equal(h.nodes.removeExcluded.hidden, false);
  await h.controller.generate();
  assert.equal(h.nodes.split.disabled, false);
  const chunks = h.controller.split();
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [1, 1],
  );
  assert.equal(h.split().settings.pacing, 'balanced');
  h.controller.removeExcluded();
  assert.deepEqual(
    h.controller.snapshot().items.map((item) => item.file.name),
    ['1.png', '3.png'],
  );
});

test('the review surface retains a complete 50-picture batch', () => {
  const h = harness();
  const selected = Array.from({ length: 50 }, (_, index) => file(`picture${50 - index}.png`));
  h.controller.setFiles(selected);
  assert.equal(h.controller.snapshot().items.length, 50);
  assert.equal(h.nodes.list.querySelectorAll('.batch-card').length, 50);
  assert.equal(h.controller.snapshot().items[0].file.name, 'picture1.png');
  assert.equal(h.controller.snapshot().items[49].file.name, 'picture50.png');
});

test('default capacity requires a split before the portable 24 MiB package limit', () => {
  const h = harness();
  h.controller.setFiles([
    file('large1.png', 10 * 1024 * 1024),
    file('large2.png', 10 * 1024 * 1024),
    file('large3.png', 10 * 1024 * 1024),
  ]);
  assert.equal(h.controller.snapshot().capacity.fits, false);
  assert.equal(h.nodes.split.hidden, false);
  assert.match(h.nodes.capacity.textContent, /24\.00 MiB pack limit/);
});

test('restored review reapplies settings and only rebuilds formerly prepared items', async () => {
  const h = harness();
  const sources = [file('third.png'), file('first.png'), file('failed.png')];
  h.controller.restore({
    settings: {
      collectionName: 'Recovered campaign',
      pacing: 'gentle-first',
      fit: 'cover',
      creatorCredit: 'Recovered creator',
      pictureCredit: 'Recovered owner',
      license: 'Recovered license',
    },
    items: [
      {
        id: 'picture-3',
        file: sources[0],
        title: 'Third first',
        included: true,
        status: 'queued',
        error: '',
        generation: 4,
      },
      {
        id: 'picture-1',
        file: sources[1],
        title: 'First second',
        included: true,
        status: 'queued',
        error: '',
        generation: 1,
      },
      {
        id: 'picture-2',
        file: sources[2],
        title: 'Failed excluded',
        included: false,
        status: 'excluded',
        error: 'Unsupported picture header.',
        generation: 2,
      },
    ],
  });
  assert.equal(h.nodes.collectionName.value, 'Recovered campaign');
  assert.equal(h.nodes.pacing.value, 'gentle-first');
  assert.equal(h.nodes.fit.value, 'cover');
  assert.deepEqual(
    h.controller.snapshot().items.map((item) => item.id),
    ['picture-3', 'picture-1', 'picture-2'],
  );

  await h.controller.resume(['picture-3']);
  assert.deepEqual(
    h.controller.snapshot().items.map((item) => item.status),
    ['ready', 'queued', 'excluded'],
  );
  assert.equal(h.prepared.length, 1);
  assert.equal(h.prepared[0].context.generation, 4);
  assert.equal(h.prepared[0].context.settings.collectionName, 'Recovered campaign');
  assert.equal(h.controller.snapshot().items[2].error, 'Unsupported picture header.');
});
