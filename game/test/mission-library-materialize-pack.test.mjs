import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMissionLibraryInventory } from '../mission-library/installed-inventory.mjs';
import { materializeMissionPack } from '../mission-library/materialize-pack.mjs';
import { importPackLibrary, PACK_LIBRARY_VERSION, resolvePackCampaign } from '../packs.mjs';

const source = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
);
const text = (pack = source) => JSON.stringify({ format: PACK_LIBRARY_VERSION, packs: [pack] });
async function fixture(t) {
  const snapshot = Object.freeze({ packs: text(), sha256: 'owned-snapshot', index: null });
  let valid = true;
  const inventory = await createMissionLibraryInventory({
    reader: {
      snapshot: async () => snapshot,
      confirm: async (value) => {
        assert.equal(value, snapshot);
        if (!valid) throw new Error('Storage changed');
        return true;
      },
      close() {},
    },
  });
  t.after(() => inventory.close());
  const metadata = await inventory.refresh();
  return {
    inventory,
    metadata,
    metadataPack: metadata.packs[0],
    replace: () => {
      valid = false;
    },
    inspect: async () => ({ library: await importPackLibrary(snapshot.packs) }),
  };
}

test('explicit materialization returns the genuine exact prepared pack, never the browsing DTO', async (t) => {
  const f = await fixture(t);
  const pack = await materializeMissionPack(f);
  assert.notEqual(pack, f.metadataPack);
  assert.equal(resolvePackCampaign(pack, source.campaigns[0].id).campaign.levels.length, 3);
  assert.throws(() => resolvePackCampaign(f.metadataPack, source.campaigns[0].id), /prepared/);
});

test('forged metadata owners and unprepared inspection results cannot reach a runtime', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const inspect = async () => {
    calls++;
    return { library: { packs: [source] } };
  };
  await assert.rejects(
    materializeMissionPack({ ...f, metadataPack: { ...f.metadataPack }, inspect }),
    /exact inspected/,
  );
  assert.equal(calls, 0);
  await assert.rejects(materializeMissionPack({ ...f, inspect }), /prepared/);
  assert.equal(calls, 1);
});

test('same-ID altered prepared edition and missing pack reject rather than replacing the selected edition', async (t) => {
  const f = await fixture(t),
    changed = structuredClone(source);
  changed.themes[0].palette.accent = '#112233';
  const library = await importPackLibrary(text(changed));
  await assert.rejects(
    materializeMissionPack({ ...f, inspect: async () => ({ library }) }),
    /changed/,
  );
  await assert.rejects(
    materializeMissionPack({ ...f, inspect: async () => ({ library: { packs: [] } }) }),
    /removed/,
  );
});

test('real inspection failure, storage replacement and cancelled input cannot adopt an owner', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    materializeMissionPack({
      ...f,
      inspect: async () => {
        throw new Error('Real decode failed');
      },
    }),
    /Real decode failed/,
  );
  await assert.rejects(
    materializeMissionPack({
      ...f,
      inspect: async () => {
        const result = await f.inspect();
        f.replace();
        return result;
      },
    }),
    /Storage changed/,
  );
  const g = await fixture(t),
    controller = new AbortController();
  await assert.rejects(
    materializeMissionPack({
      ...g,
      signal: controller.signal,
      inspect: async () => {
        const result = await g.inspect();
        controller.abort();
        return result;
      },
    }),
    /cancelled/,
  );
});
