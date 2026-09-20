import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createRun } from '../core/index.mjs';
import { createRecorder, verifyReplay } from '../replay.mjs';
import { suspendSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';

class CandidateImage {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
  removeAttribute() {
    this.source = '';
  }
}

test('an older authored policy save is retained and given truthful edition recovery guidance', async (t) => {
  const source = createOpeningCandidates({ artwork: true });
  source.policyId = 'journey-v1';
  const { themes } = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const host = createCandidateSoloHost(source, { themes, buildVersion: 'dev' });
  const entry = host.select(host.catalog.missions[0], 'standard');
  const level = entry.campaign.levels[0];
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options);
  const saved = suspendSession({
    run,
    recorder: createRecorder(level, options),
    campaignKey: campaignKey(entry.campaign),
    themeId: 'horizon',
    bodyId: themes.find((theme) => theme.id === 'horizon').player,
    runId: 'legacy-policy-save',
    savedAt: '2026-09-20T08:00:00.000Z',
  });
  assert.equal(verifyReplay(saved.replay).match, true);
  const raw = JSON.stringify(saved);
  const storage = memoryStorage();
  const key = 'revealline.suspended.journey-opening.v1';
  storage.setItem(key, raw);
  const p = await soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    storage,
    pictures: { Image: CandidateImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
  p.$('shell-continue').click();
  await settle(() => p.$('shell-flight-status').textContent.includes('original test edition'));
  assert.match(p.$('shell-flight-status').textContent, /saved bytes are unchanged/);
  assert.match(p.$('shell-flight-status').textContent, /Export the saved attempt/);
  assert.doesNotMatch(p.$('shell-flight-status').textContent, /Install the matching/);
  assert.equal(storage.getItem(key), raw);
  assert.equal(p.$('shell-home').open, true);
  assert.equal(p.$('shell-continue').disabled, false);
  assert.deepEqual(p.errors, []);
});
