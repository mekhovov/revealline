import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './pr771-r2-host.mjs';

function newerIntent(f) {
  const operation = { cancel() {} },
    destination = { name: 'newer confirmation' };
  ++f.ctx.skipLifecycleEpoch;
  f.ctx.libraryNextOperation = operation;
  f.ctx.preparationButtonBusy(f.$('journey-skip'), true, operation);
  f.ctx.journeySkipDestination = destination;
  f.ctx.journeySkipArmed = 'newer-run';
  f.document.activeElement = f.$('newer-action');
  return { operation, destination };
}
function retained(f, newer) {
  assert.equal(f.ctx.libraryNextOperation, newer.operation);
  assert.equal(f.ctx.journeySkipDestination, newer.destination);
  assert.equal(f.ctx.journeySkipArmed, 'newer-run');
  assert.equal(f.$('journey-skip').getAttribute('aria-busy'), 'true');
  assert.equal(f.$('journey-skip').disabled, false);
  assert.equal(f.document.activeElement, f.$('newer-action'));
  assert.equal(f.transfers, 0);
}
for (const host of [false, true]) {
  test(
    'finalization: owned transfer adopts once and rejects early/duplicate settlement host=' + host,
    async () => {
      const f = await fixture({ host });
      f.adoptCallbacks = true;
      f.duplicateTransfer = true;
      f.activationHook = (activation) => {
        activation.onSkipAdopt();
        assert.equal(f.adoptions, 0);
        assert.throws(() =>
          f.ctx.adoptContentCatalog(f.ctx.prepareContentCatalog(f.ctx.packs), f.token),
        );
      };
      try {
        await f.start();
        assert.equal(f.transfers, 1);
        assert.equal(f.adoptions, 1);
        assert.equal(f.attemptInvalidations, 2);
        assert(await f.stored());
        assert.equal(f.ctx.activeSkipPreparation, null);
      } finally {
        f.close();
      }
    },
  );
}
test('finalization: error feedback cannot clear a newer confirmation', async () => {
  const f = await fixture();
  let newer;
  f.prepareHook = () => {
    throw Error('controlled preparation failure');
  };
  f.finishHook = (state) => {
    if (state === 'error' && !newer) newer = newerIntent(f);
  };
  try {
    await f.start();
    assert(newer);
    retained(f, newer);
    assert.equal(await f.stored(), null);
  } finally {
    f.close();
  }
});
test('finalization: cancel currentness callback cannot clear or focus over a newer intent', async () => {
  const f = await fixture({ ready: true });
  let newer;
  f.activationHook = () => {
    f.document.hasFocus = () => {
      if (!newer) newer = newerIntent(f);
      return true;
    };
    f.ctx.libraryNextOperation.cancel({ restoreFocus: true });
  };
  try {
    const before = await f.stored();
    await f.start();
    assert(newer);
    retained(f, newer);
    assert.equal(await f.stored(), before);
  } finally {
    f.close();
  }
});
test('finalization: final detach cannot retire a replacement operation', async () => {
  const f = await fixture();
  let newer;
  f.prepareHook = () => {
    throw Error('controlled preparation failure');
  };
  f.ctx.window.removeEventListener = () => {
    if (!newer) newer = newerIntent(f);
  };
  try {
    await f.start();
    assert(newer);
    retained(f, newer);
    assert.equal(await f.stored(), null);
  } finally {
    f.close();
  }
});
for (const callback of ['detach', 'feedback']) {
  test(
    'finalization: transfer ' + callback + ' reentry preserves the newer confirmation',
    async () => {
      const f = await fixture({ host: true });
      let newer;
      const replace = () => {
        if (!newer) newer = newerIntent(f);
      };
      f.activationHook = () => {
        if (callback === 'detach') f.ctx.window.removeEventListener = replace;
        else f.finishHook = replace;
      };
      try {
        await f.start();
        assert(newer);
        retained(f, newer);
        assert(await f.stored(), 'Committed preparation bytes remain after late cancellation');
      } finally {
        f.close();
      }
    },
  );
}
test('finalization: already-ready transfer remains successful with single adoption', async () => {
  const f = await fixture({ ready: true });
  f.adoptCallbacks = true;
  try {
    await f.start();
    assert.equal(f.prepares, 0);
    assert.equal(f.transfers, 1);
    assert.equal(f.adoptions, 1);
    assert.equal(f.ctx.packs, f.before);
  } finally {
    f.close();
  }
});
test('finalization: ordinary external-host mutation remains available without a Skip guard', async () => {
  const f = await fixture({ host: true });
  try {
    const snapshot = await f.ctx.checkedChapters();
    const review = await f.ctx.externalChapters.prepareMutation(snapshot, f.ctx.packs);
    await f.ctx.externalChapters.commitMutation(review);
    assert(await f.stored());
    assert.equal(f.ctx.activeSkipPreparation, null);
  } finally {
    f.close();
  }
});
