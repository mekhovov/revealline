import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamMissionCardPresenter } from '../content-design/team-mission-card.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { emptyJourneyProfile } from '../journey/profile.mjs';
import { setLocale } from '../i18n/index.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';

const source = createTeamJourneyCandidates(),
  journey = createCandidateTeamHost(source, { corePackIds: source.packs.map((pack) => pack.id) });

function fixture({ context = true, failPaint = false } = {}) {
  const document = new Document(),
    profile = emptyJourneyProfile(),
    labels = [];
  document.createElement = (tag) => {
    const element = new Element(document, tag);
    if (tag === 'canvas')
      element.getContext = () =>
        context
          ? new Proxy(
              {},
              {
                get:
                  (_, name) =>
                  (...args) => {
                    if (failPaint) throw new Error('Lost context');
                    if (name === 'fillText') labels.push(args[0]);
                  },
              },
            )
          : null;
    return element;
  };
  const present = createTeamMissionCardPresenter(journey, {
    snapshot: () => structuredClone(profile),
  });
  return {
    document,
    profile,
    labels,
    render(row) {
      const card = document.createElement('article');
      return { card, result: present({ document, row: { journeyRow: row }, card }) };
    },
  };
}

test('all36 owned Team cards describe exact presets, maps and two craft without reward-picture claims', () => {
  const f = fixture();
  for (const row of journey.rows) {
    const diagram = journey.card(row.mission, row.difficulty),
      { card, result } = f.render(row),
      canvas = card.querySelector('canvas');
    assert.equal(result, true);
    assert.equal(canvas.width, 288);
    assert.equal(canvas.height, Math.round((288 * diagram.height) / diagram.width));
    assert.equal(canvas.getAttribute('aria-hidden'), 'true');
    assert.equal(card.querySelector('.team-mission-route').textContent, diagram.route);
    assert.match(
      card.querySelector('.team-mission-difficulty').textContent,
      new RegExp(`band ${diagram.band}`),
    );
    assert.equal(card.querySelector('.team-mission-mastery').textContent, diagram.mastery);
    assert.equal(card.querySelector('summary').textContent, 'Optional goal · not tracked');
    assert.equal(card.querySelector('details').hasAttribute('open'), false);
    assert.equal(card.querySelector('.team-mission-completion').textContent, 'Not cleared');
    assert.match(
      card.querySelector('figcaption').textContent,
      /Not a capture prediction.*Original artwork pending/,
    );
  }
  assert.deepEqual(f.labels, Array.from({ length: 36 }, () => ['1', '2']).flat());
});

test('same-ID copies and absent candidate rows never acquire candidate presentation', () => {
  const f = fixture();
  for (const row of [undefined, null, { ...journey.rows[0] }]) {
    const { card, result } = f.render(row);
    assert.equal(result, false);
    assert.equal(card.children.length, 0);
  }
});

test('completion labels separate skipped, exact-preset, other-preset and historical-edition receipts', () => {
  const f = fixture(),
    row = journey.rows.find((row) => row.difficulty === 'standard'),
    expert = journey.row(row.mission, 'expert'),
    label = (target = row) =>
      f.render(target).card.querySelector('.team-mission-completion').textContent;
  f.profile.skipped.team.push(row.mission.id);
  assert.match(label(), /^Skipped/);
  f.profile.clears.team[row.mission.id] = {
    runId: 'one',
    gameplayId: row.simulationIdentity,
    difficulty: 'standard',
  };
  assert.equal(label(), 'Cleared on Standard · selected edition');
  assert.equal(label(expert), 'Cleared on Standard · no clear recorded for this selected edition');
  f.profile.clears.team[row.mission.id].gameplayId = 'historical-edition';
  assert.equal(
    label(),
    'Earlier edition cleared on Standard · no clear recorded for this selected edition',
  );
});

test('rendered Team card copy and verified authored fields switch locale in place', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const f = fixture(),
    row = journey.rows[0],
    { card } = f.render(row);
  f.document.body.append(card);
  setLocale('uk', { persist: false });
  assert.match(card.querySelector('.team-mission-difficulty').textContent, /Рівень випробування/);
  assert.equal(card.querySelector('summary').textContent, 'Додаткова ціль · не відстежується');
  assert.equal(
    card.querySelector('.team-mission-route').textContent,
    'З’єднати острови між собою чи спершу прокласти протилежні шляхи повернення?',
  );
  assert.match(card.querySelector('.team-mission-mastery').textContent, /обидва апарати/);
  assert.match(card.querySelector('figcaption').textContent, /Початкова карта/);
  setLocale('en', { persist: false });
  assert.equal(card.querySelector('summary').textContent, 'Optional goal · not tracked');
});

for (const options of [{ context: false }, { failPaint: true }])
  test(`missing/lost canvas preserves candidate text and avoids fallback artwork: ${JSON.stringify(options)}`, () => {
    const f = fixture(options),
      { card, result } = f.render(journey.rows[0]);
    assert.equal(result, true);
    assert.equal(card.querySelector('canvas').hidden, true);
    assert.match(
      card.querySelector('figcaption').textContent,
      /diagram unavailable.*Play remain available/,
    );
    assert(card.querySelector('.team-mission-route').textContent.length > 20);
  });
