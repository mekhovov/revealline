import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fixture,
  corrected,
  deferred,
  until,
  hash,
  closeRestart,
  prepareOfficialPack,
  emptyPackLibrary,
  installPack,
  writeAssetStore,
} from './pr771-r2-host.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { canonicalJSON } from '../data-json.mjs';

for (const options of [{ host: false }, { host: true }, { host: true, optional: true }]) {
  test(
    'R2 host-owned selected chapter prepares and transfers once ' + JSON.stringify(options),
    async () => {
      const f = await fixture(options),
        { ctx, $ } = f;
      try {
        const before = ctx.packs,
          run = ctx.run,
          checkpoint = JSON.stringify(run),
          packSource = f.packSource;
        f.duplicateTransfer = true;
        await f.start();
        const prepares = f.prepares,
          launches = f.launches;
        // Preserved original product assertions in a new trusted-writer fixture.
        assert.equal(
          prepares,
          1,
          'Actual pack preparation must complete before classifying product failure',
        );
        assert.notEqual(
          ctx.packs,
          before,
          'Actual installPack/adoptContentCatalog must replace pack snapshot',
        );
        assert.equal(ctx.packs.packs[0].id, packSource.id);
        assert.equal(
          f.destination.host.library.availability(f.destination.next, 'solo').state,
          'ready',
        );
        assert.equal(ctx.run, run);
        assert.equal(JSON.stringify(ctx.run), checkpoint);
        assert.equal($('journey-skip').disabled, false);
        assert.equal(
          launches,
          1,
          'R2: a confirmed Skip must launch after its own successful chapter preparation without another confirmation',
        );
        assert.equal(f.transfers, 1);
        assert.equal(canonicalJSON(ctx.library), f.progress);
        assert(await f.stored());
        assert.equal(ctx.activeSkipPreparation, null);
        await assert.rejects(
          () => ctx.prepareLibraryClassic({}, { preparation: f.token }),
          /no longer owned/,
        );
      } finally {
        f.close();
      }
    },
  );
}
test('already-ready destination needs no owned publication', { skip: !corrected }, async () => {
  const f = await fixture({ ready: true });
  try {
    await f.start();
    assert.equal(f.prepares, 0);
    assert.equal(f.ctx.packs, f.before);
    assert.equal(f.transfers, 1);
  } finally {
    f.close();
  }
});
test('an already-paused confirmed Skip does not re-enter navigation cancellation', async () => {
  const f = await fixture({ ready: true });
  let redundantPauses = 0;
  f.ctx.pause = () => {
    redundantPauses++;
    // The real host's pause -> cancelPictureStart -> cancelResultAttempt path.
    f.ctx.libraryNextOperation?.cancel();
  };
  try {
    await f.start();
    assert.equal(redundantPauses, 0);
    assert.equal(f.transfers, 1);
    assert.equal(f.ctx.packs, f.before);
  } finally {
    f.close();
  }
});
for (const host of [false, true])
  for (const change of [
    'cancel',
    'checkpoint',
    'recorder',
    'settings',
    'picture',
    'writer',
    'backup',
    'stale-ticket',
  ]) {
    test(
      'actual publication boundary rejects ' + change + ' host=' + host,
      { skip: !corrected },
      async () => {
        const f = await fixture({ host }),
          { ctx } = f;
        let fired = false;
        f.hook = () => {
          if (fired) return;
          fired = true;
          if (change === 'cancel') ctx.libraryNextOperation.cancel();
          if (change === 'checkpoint') ctx.run.tick++;
          if (change === 'recorder') ctx.recorder.releaseAfter = !ctx.recorder.releaseAfter;
          if (change === 'settings') ctx.library.preferences.campaignDifficulty = 'gentle';
          if (change === 'picture') ctx.flightPictures = { pins: () => null };
          if (change === 'writer') ctx.writer.release();
          if (change === 'backup') f.values.set(ctx.libraryKey + '.backup-lock', 'pending');
          if (change === 'stale-ticket') ctx.packLaunchGuard.begin(ctx.packs);
        };
        try {
          await f.start();
          assert(fired);
          assert.equal(await f.stored(), null);
          assert.equal(ctx.packs, f.before);
          assert.equal(f.transfers, 0);
        } finally {
          f.close();
        }
      },
    );
  }
test(
  'checked storage mismatch cannot publish over a foreign catalog',
  { skip: !corrected },
  async () => {
    const f = await fixture(),
      gate = deferred();
    f.prepareHook = () => gate.promise;
    try {
      const work = f.start();
      await until(() => f.prepares === 1);
      await writeAssetStore(f.ctx.packsKey, '{"foreign":"pointer"}');
      gate.resolve();
      await work;
      assert.equal(await f.stored(), '{"foreign":"pointer"}');
      assert.equal(f.transfers, 0);
      assert.equal(f.ctx.packs, f.before);
    } finally {
      gate.resolve();
      f.close();
    }
  },
);
test(
  'same-ID changed selected content has no owned edition authority',
  { skip: !corrected },
  async () => {
    const f = await fixture();
    f.ctx.fetchBundledChapter = async () => {
      f.prepares++;
      const value = JSON.parse(f.packText);
      value.name += ' changed';
      return value;
    };
    try {
      await f.start();
      assert.equal(await f.stored(), null);
      assert.equal(f.transfers, 0);
      assert.equal(f.ctx.packs, f.before);
    } finally {
      f.close();
    }
  },
);
test('a forged or foreign-row capability cannot prepare', { skip: !corrected }, async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      () => f.ctx.prepareLibraryClassic({}, { preparation: {} }),
      /no longer owned/,
    );
    assert.equal(await f.stored(), null);
  } finally {
    f.close();
  }
});
test(
  'the private indexed row must match the exact library-selected row',
  { skip: !corrected },
  async () => {
    const f = await fixture();
    f.bindHook = (row, context) =>
      f.ctx.prepareLibraryClassic({ ...row, levelId: 'wrong-mission' }, context);
    try {
      await f.start();
      assert.equal(f.prepares, 0);
      assert.equal(f.transfers, 0);
      assert.equal(await f.stored(), null);
    } finally {
      f.close();
    }
  },
);
test(
  'external preparation refuses owned exemption before invoking an installer',
  { skip: !corrected },
  async () => {
    const f = await fixture({ external: true });
    try {
      await f.start();
      assert.equal(f.prepares, 0);
      assert.equal(f.transfers, 0);
      assert.equal(await f.stored(), null);
      assert(
        f.statuses.some((s) => s.state === 'error' && /current flight is kept/.test(s.message)),
      );
    } finally {
      f.close();
    }
  },
);
test(
  'local official chapter uses verified cached bytes through actual mount storage',
  { skip: !corrected },
  async () => {
    const prior = new Map(
      ['caches', 'navigator', 'location'].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ]),
    );
    const caches = new Map();
    globalThis.caches = {
      async open(name) {
        if (!caches.has(name)) caches.set(name, new Map());
        const rows = caches.get(name);
        return {
          async match(key) {
            return rows.get(String(key))?.clone();
          },
          async put(key, value) {
            rows.set(String(key), value.clone());
          },
        };
      },
    };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: async (_key, work) => work() } },
    });
    globalThis.location = { origin: 'https://fixture.invalid' };
    let f;
    try {
      f = await fixture({ official: true, host: true });
      const cache = await globalThis.caches.open('revealline-official-content-v1');
      await cache.put(
        'https://fixture.invalid/.revealline-official/sha256/' + hash(f.packText),
        new Response(f.packText),
      );
      await f.start();
      assert.equal(f.prepares, 0);
      assert.equal(f.transfers, 1);
      assert(await f.stored());
      assert.equal(f.ctx.packs.packs[0].id, f.packSource.id);
    } finally {
      f?.close();
      for (const [key, descriptor] of prior)
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
    }
  },
);
for (const phase of [1, 2]) {
  test(
    'abort/detach reentry during owned invalidation ' + phase + ' cannot revive Skip',
    { skip: !corrected },
    async () => {
      const f = await fixture();
      f.onInvalidate = () => {
        if (f.attemptInvalidations === phase) {
          // Same reference/null flags after the callback; only monotonic intent differs.
          f.ctx.modeDeparture = {};
          f.ctx.advanceSkipLifecycle();
          f.ctx.modeDeparture = null;
        }
      };
      try {
        await f.start();
        assert.equal(f.transfers, 0);
        assert.equal(f.ctx.packs, f.before);
        assert.equal(!!(await f.stored()), phase === 2);
      } finally {
        f.close();
      }
    },
  );
}
test(
  'generic attempt preparation started and cancelled invalidates suspended Skip',
  { skip: !corrected },
  async () => {
    const f = await fixture(),
      gate = deferred();
    f.prepareHook = () => gate.promise;
    try {
      const work = f.start();
      await until(() => f.prepares === 1);
      await f.ctx.attemptFiles.prepare();
      gate.resolve();
      await work;
      assert.equal(f.transfers, 0);
      assert.equal(await f.stored(), null);
    } finally {
      gate.resolve();
      f.close();
    }
  },
);
test(
  'actual Restart start and close retire a pending Skip without changing the flight',
  { skip: !corrected },
  async () => {
    const f = await fixture(),
      gate = deferred(),
      { ctx, $ } = f;
    f.prepareHook = () => gate.promise;
    Object.assign(ctx, {
      defeatActive: false,
      coursePhase: null,
      modeDepartureHold: false,
      controllerDialog: () => null,
      availableFocusTarget: (element) => !!element && !element.disabled,
      restartDialog: {
        open: false,
        showModal() {
          this.open = true;
        },
      },
      restartCopy: 'Restart fixture',
    });
    try {
      const work = f.start();
      await until(() => f.prepares === 1);
      const epoch = ctx.skipLifecycleEpoch;
      ctx.requestRestart($('restart-button'));
      assert(ctx.restartRequest);
      assert(ctx.restartDialog.open);
      closeRestart(ctx);
      assert.equal(ctx.restartRequest, null);
      assert(ctx.skipLifecycleEpoch > epoch);
      gate.resolve();
      await work;
      assert.equal(f.transfers, 0);
      assert.equal(await f.stored(), null);
      assert.equal(canonicalJSON(authoritativeCheckpoint(ctx.run)), f.checkpoint);
    } finally {
      gate.resolve();
      f.close();
    }
  },
);
test(
  'picker opening retires the old intent before cancellation callbacks',
  { skip: !corrected },
  async () => {
    const f = await fixture(),
      gate = deferred(),
      { ctx } = f;
    f.prepareHook = () => gate.promise;
    try {
      const work = f.start();
      await until(() => f.prepares === 1);
      const epoch = ctx.skipLifecycleEpoch;
      ctx.cancelUnifiedOpening = () => {
        assert(ctx.skipLifecycleEpoch > epoch);
        throw Error('controlled opener cancellation');
      };
      await assert.rejects(() => ctx.openUnifiedMissions(null), /controlled opener cancellation/);
      ctx.cancelUnifiedOpening = null;
      gate.resolve();
      await work;
      assert.equal(f.transfers, 0);
      assert.equal(await f.stored(), null);
    } finally {
      gate.resolve();
      f.close();
    }
  },
);
test(
  'a foreign same-byte adoption cannot borrow the selected-writer exemption',
  { skip: !corrected },
  async () => {
    const f = await fixture(),
      gate = deferred();
    f.prepareHook = () => gate.promise;
    try {
      const work = f.start();
      await until(() => f.prepares === 1);
      f.ctx.adoptContentCatalog(f.ctx.prepareContentCatalog(installPack(f.ctx.packs, f.prepared)));
      gate.resolve();
      await work;
      assert.equal(f.transfers, 0);
      assert.equal(await f.stored(), null);
    } finally {
      gate.resolve();
      f.close();
    }
  },
);
test(
  'late cancellation after publication preserves committed bytes without adoption',
  { skip: !corrected },
  async () => {
    const f = await fixture();
    let fired = false;
    f.hook = () => {
      if (!fired) {
        fired = true;
        queueMicrotask(() => f.ctx.run.tick++);
      }
    };
    try {
      await f.start();
      assert(fired);
      assert(await f.stored());
      assert.equal(f.ctx.packs, f.before);
      assert.equal(f.transfers, 0);
    } finally {
      f.close();
    }
  },
);
test(
  'a nonselected large official mounted owner is never silently evicted',
  { skip: !corrected },
  async () => {
    const f = await fixture();
    const make = async (id) => {
      const value = JSON.parse(f.packText);
      value.id = id;
      value.campaigns[0].id = id;
      const text = JSON.stringify(value) + ' '.repeat(65537);
      return (
        await prepareOfficialPack(
          { id, version: value.version, bytes: Buffer.byteLength(text), sha256: hash(text) },
          { readOfficial: async () => new Blob([text]) },
        )
      ).pack;
    };
    try {
      const a = await make('first-mounted'),
        b = await make('second-mounted');
      f.ctx.packs = installPack(installPack(emptyPackLibrary(), a), b);
      f.before = f.ctx.packs;
      await f.ctx.unifiedLibrary.refreshInstalled();
      f.destination.snapshot = f.ctx.skipSnapshot();
      const text = f.packText + ' '.repeat(65537);
      f.ctx.localOfficialChapter = async () =>
        (
          await prepareOfficialPack(
            {
              id: f.packSource.id,
              version: f.packSource.version,
              bytes: Buffer.byteLength(text),
              sha256: hash(text),
            },
            { readOfficial: async () => new Blob([text]) },
          )
        ).pack;
      await f.start();
      assert.equal(f.ctx.packs, f.before);
      assert.equal(f.ctx.packs.packs.length, 2);
      assert.equal(await f.stored(), null);
      assert.equal(f.transfers, 0);
      assert(
        f.statuses.some((s) => s.state === 'error' && /current flight is kept/.test(s.message)),
      );
    } finally {
      f.close();
    }
  },
);
test(
  'transfer reentry cannot start another flight or transfer twice',
  { skip: !corrected },
  async () => {
    const f = await fixture();
    f.transferHook = () => {
      f.ctx.advanceSkipLifecycle();
    };
    try {
      await f.start();
      assert.equal(f.transfers, 0);
      assert(await f.stored());
      assert.equal(canonicalJSON(authoritativeCheckpoint(f.ctx.run)), f.checkpoint);
    } finally {
      f.close();
    }
  },
);
