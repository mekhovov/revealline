import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_FEEDBACK_FORMAT,
  VICTORY_MOTIFS,
  validateCampaignFeedback,
  campaignResultLine,
  campaignVictoryMotif,
} from '../journey/campaign-feedback.mjs';
import { editCampaignFeedback } from '../content-design/campaign-feedback.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { journeyResultReaction } from '../journey/reactions.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { attachJourneyReactions } from '../ui/journey-reactions.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';

const lines = { en: ['A connection worth keeping.'], uk: ['З’єднання, яке варто зберегти.'] };
const input = () => ({
  format: CAMPAIGN_FEEDBACK_FORMAT,
  revision: 'r1',
  lines: structuredClone(lines),
  victoryMotif: 'shared-spark-v1',
});
const context = (feedback = validateCampaignFeedback(input())) => ({
  owned: true,
  mode: 'solo',
  outcome: 'won',
  missionId: 'mission-one',
  feedback,
});
test('versioned campaign feedback admits only bounded translated lines and registered fixed motifs', () => {
  const value = validateCampaignFeedback(input());
  assert(Object.isFrozen(value) && Object.isFrozen(value.lines.en));
  assert.deepEqual(campaignVictoryMotif(context(value)), VICTORY_MOTIFS['shared-spark-v1']);
  assert.equal(campaignResultLine(context(value), 'uk').text, lines.uk[0]);
  for (const change of [
    { format: 'future' },
    { revision: '' },
    { victoryMotif: 'https://remote.example/music' },
    { lines: { en: [], uk: [] } },
    { lines: { en: ['one'], uk: ['one', 'two'] } },
    { lines: { en: ['x'.repeat(241)], uk: ['one'] } },
    { duration: 999 },
    { score: 100 },
    { soundUrl: 'https://example.org' },
  ])
    assert.throws(() => validateCampaignFeedback({ ...input(), ...change }));
  let called = 0;
  assert.throws(() =>
    validateCampaignFeedback({
      ...input(),
      get lines() {
        called++;
        return lines;
      },
    }),
  );
  assert.equal(called, 0);
});
test('only accepted owned results select lines or motifs; old reactions keep their exact fallback', () => {
  for (const change of [
    { owned: false },
    { outcome: 'running' },
    { outcome: 'lost' },
    { outcome: 'draw' },
    { mode: 'other' },
    { missionId: '' },
  ]) {
    assert.equal(campaignResultLine({ ...context(), ...change }), null);
    assert.equal(campaignVictoryMotif({ ...context(), ...change }), null);
  }
  assert.equal(journeyResultReaction({ ...context(), feedback: undefined }).speaker, 'guide');
  assert.equal(journeyResultReaction(context()).speaker, 'campaign');
  assert.equal(
    campaignResultLine({ ...context(), mode: 'versus', outcome: 'draw' }).text,
    lines.en[0],
  );
});
test('source edits round trip in the project without changing core gameplay bindings or absent legacy entry shape', () => {
  const source = createStarterProject('feedback-fixture'),
    id = source.campaigns[0].id,
    before = JSON.stringify(source),
    bindings = createRewardMissionBindings(source);
  const oldCatalog = createContentExecutionCatalog(source);
  assert(oldCatalog.entries.every((entry) => !Object.hasOwn(entry, 'campaignFeedback')));
  const updated = editCampaignFeedback(source, id, { lines, victoryMotif: 'shared-spark-v1' });
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(createRewardMissionBindings(updated), bindings);
  const catalog = createContentExecutionCatalog(updated);
  assert(catalog.entries.every((entry) => entry.campaignFeedback.lines.uk[0] === lines.uk[0]));
  assert.deepEqual(
    catalog.entries.map((entry) => entry.campaign.levels),
    oldCatalog.entries.map((entry) => entry.campaign.levels),
  );
  assert.deepEqual(
    createContentExecutionCatalog(JSON.parse(JSON.stringify(updated))).entries,
    catalog.entries,
  );
  const reset = editCampaignFeedback(updated, id, null);
  assert.equal(reset.campaigns[0].discovery.feedback, undefined);
});
test('native reaction presenter rerenders locale, respects preference and keeps authored markup plain text', () => {
  const doc = new Document(),
    window = new Events();
  for (const [id, tag] of [
    ['', 'p'],
    ['-enabled', 'input'],
    ['-status', 'p'],
    ['-retry', 'button'],
  ]) {
    const item = doc.createElement(tag);
    item.id = 'journey-reactions' + id;
    doc.body.append(item);
  }
  const value = input();
  value.lines.en = ['<strong>A connection</strong>'];
  const previous = getLocale();
  const presenter = attachJourneyReactions({
    document: doc,
    window,
    getStorage: () => memoryStorage(),
  });
  try {
    setLocale('en');
    presenter.present(context(validateCampaignFeedback(value)));
    const caption = doc.getElementById('journey-reactions');
    assert.equal(caption.children.length, 0);
    assert.equal(caption.textContent, value.lines.en[0]);
    setLocale('uk');
    assert.equal(caption.textContent, value.lines.uk[0]);
    presenter.present({ ...context(), outcome: 'running' });
    assert.equal(caption.hidden, true);
  } finally {
    presenter.dispose();
    setLocale(previous);
  }
});
test('Soundscape accepted event adapter changes only the victory phrase and honors existing gates and duplicate suppression', () => {
  const make = () => {
    const sound = new Soundscape();
    sound.enabled = true;
    sound.context = { currentTime: 1 };
    const notes = [];
    sound.play = (value, time) => notes.push({ value, time });
    return { sound, notes };
  };
  const normal = make(),
    authored = make();
  const event = { type: 'run.completed', won: true, tick: 10, levelId: 'level' };
  normal.sound.event(event);
  authored.sound.event(event, {}, context());
  assert.equal(normal.notes.length, authored.notes.length);
  assert.deepEqual(
    normal.notes.map((note) => note.time),
    authored.notes.map((note) => note.time),
  );
  assert.notDeepEqual(
    normal.notes.slice(0, 6).map((note) => note.value.frequency),
    authored.notes.slice(0, 6).map((note) => note.value.frequency),
  );
  authored.sound.event(event, {}, context());
  assert.equal(authored.notes.length, normal.notes.length);
  for (const field of ['paused']) {
    const item = make();
    item.sound[field] = true;
    if (field === 'paused') {
      item.sound.event(event, {}, context());
      assert.equal(item.notes.length, 0);
    }
  }
  const unowned = make();
  unowned.sound.event(event, {}, { ...context(), owned: false });
  assert.deepEqual(unowned.notes, normal.notes);
  const failed = make(),
    failedDefault = make();
  failed.sound.event({ ...event, won: false }, {}, context());
  failedDefault.sound.event({ ...event, won: false });
  assert.deepEqual(failed.notes, failedDefault.notes);
});

test('Versus and Team host adapters carry feedback only on their exact owned campaign rows and preserve levels', async () => {
  const f = await editionProviderFixture();
  f.source.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'test-art',
      revision: 'r1',
      kind: 'reveal-background',
      path: 'content-design/assets/test.png',
      sha256: 'a'.repeat(64),
      bytes: 100,
      width: 1,
      height: 1,
      alt: 'Fictional test.',
      review: 'candidate',
    },
  ];
  f.source.missions[0].presentation.backgroundAssetId = 'test-art';
  const args = { themes: f.data.themes.themes, corePackIds: f.source.packs.map((item) => item.id) };
  const prior = createCandidateVersusHost(f.source, args),
    next = createCandidateVersusHost(
      editCampaignFeedback(f.source, f.source.campaigns[0].id, {
        lines,
        victoryMotif: 'shared-spark-v1',
      }),
      args,
    );
  assert.deepEqual(
    next.rows.map((row) => row.level),
    prior.rows.map((row) => row.level),
  );
  assert(
    next.rows.every((row) => next.owns(row) && row.campaignFeedback.lines.en[0] === lines.en[0]),
  );
  assert.equal(next.owns({ ...next.rows[0] }), false);
  f.source.maps[0].spawns.push({ id: 'island', x: 32.5, y: 17.5 });
  f.source.missions[0].modes = ['team'];
  f.source.missions[0].team = { format: 'TeamMissionV1', spawnIds: ['home', 'island'] };
  f.source.missions[0].design.difficulty.coordination = 1;
  const teamPrior = createCandidateTeamHost(f.source, args),
    teamNext = createCandidateTeamHost(
      editCampaignFeedback(f.source, f.source.campaigns[0].id, {
        lines,
        victoryMotif: 'open-horizon-v1',
      }),
      args,
    );
  assert.deepEqual(
    teamNext.rows.map((row) => row.level),
    teamPrior.rows.map((row) => row.level),
  );
  assert(
    teamNext.rows.every(
      (row) => teamNext.owns(row) && row.campaignFeedback.victoryMotif === 'open-horizon-v1',
    ),
  );
  assert.equal(teamNext.owns({ ...teamNext.rows[0] }), false);
});
