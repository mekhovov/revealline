import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { editCampaignFeedback } from '../content-design/campaign-feedback.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

test(
  'real selected-edition Solo win feeds its exact recipe to one accepted sound event and bilingual result without changing physics',
  { timeout: 30000 },
  async (t) => {
    const f = await editionProviderFixture(),
      descriptor = f.catalog.campaigns[0];
    f.source.maps[0].foundations = [];
    f.source.missions[0].coverage = 0.4;
    const source = editCampaignFeedback(f.source, descriptor.id, {
      lines: { en: ['Your paths made a connection.'], uk: ['Ваші шляхи створили з’єднання.'] },
      victoryMotif: 'shared-spark-v1',
    });
    f.files.set(descriptor.sourcePath, source);
    const manifest = resolveMission(compileContentProject(source), source.missions[0].id, {
      difficulty: 'standard',
    });
    f.data.campaign.levels = [manifest.level];
    const accepted = [],
      event = Soundscape.prototype.event;
    t.mock.method(Soundscape.prototype, 'event', function (value, details, context) {
      if (value?.type === 'run.completed') accepted.push(context);
      return event.call(this, value, details, context);
    });
    const page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      storage: memoryStorage(),
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    });
    assert.equal(page.$('journey-reactions').hidden, true);
    page.$('shell-featured').click();
    await settle(() => {
      page.frame(0);
      return page.doc.body.dataset.flightState === 'running';
    });
    const expected = createRun(
      applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
      { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
    );
    page.key('ArrowDown');
    let ticks = 0;
    while (expected.status === 'running' && ticks++ < 1200) {
      stepRun(expected, { direction: 'down' }, FIXED_DT);
      page.frame(FIXED_DT * 1000);
    }
    page.key('ArrowDown', false);
    page.frame(0);
    assert.equal(expected.status, 'won');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(expected));
    assert.equal(accepted.length, 1);
    assert.deepEqual(accepted[0].feedback, source.campaigns[0].discovery.feedback);
    assert.equal(accepted[0].owned, true);
    if (!page.$('skip-celebration').hidden) page.$('skip-celebration').click();
    page.$('show-result').click();
    const previous = getLocale();
    try {
      setLocale('en');
      page.frame(0);
      assert.equal(page.$('journey-reactions').textContent, 'Your paths made a connection.');
      setLocale('uk');
      assert.equal(page.$('journey-reactions').textContent, 'Ваші шляхи створили з’єднання.');
    } finally {
      setLocale(previous);
    }
    for (let i = 0; i < 20; i++) page.frame(0);
    assert.equal(accepted.length, 1);
    assert.deepEqual(page.errors, []);
  },
);
