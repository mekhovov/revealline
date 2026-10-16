import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachFlightDetails, flightDetailsModel } from '../ui/flight-information-details.mjs';
import { localizedMessage, setLocale } from '../i18n/index.mjs';

const locale = (value) => setLocale(value, { persist: false });
function information() {
  return {
    owner: { attempt: 'accepted-flight', generation: 4 },
    snapshot: {
      status: 'running',
      paused: true,
      player: { cutting: true },
      objectives: { done: 1, total: 3 },
      laneBosses: [{ axis: 'horizontal', phase: 'warning', seconds: 2.5, clockFrozen: true }],
      classic: {
        summary: 'Previously rendered field',
        terrain: [{ kind: 'slow' }, { kind: 'lethal' }],
        lineImpacts: [{ direction: 1 }],
        enemies: [
          { type: 'contour-patrol', mode: 'patrolling' },
          { type: 'border-patrol', frozen: true },
          { type: 'eroder', mode: 'warning', seconds: 3.5 },
          { type: 'bouncer', pressure: { phase: 'committed', seconds: 1.5 } },
        ],
        erosion: [{ seconds: 4.5 }],
        effects: [
          { kind: 'enemy-freeze', label: 'Old freeze label', phase: 'active', seconds: 5.5 },
        ],
        powerups: [{ kind: 'player-speed', label: 'Old speed label', timed: true, seconds: 6.5 }],
        timedBonuses: [
          { kind: 'extra-life', label: 'Old life label', phase: 'announce', seconds: 7.5 },
        ],
      },
    },
    lastWarning: { fullText: 'Observed warning <exact> & unchanged.' },
    recentNotices: [{ fullText: 'Historical notice — preserve these bytes.' }],
  };
}
const context = () => ({
  mission: 'Authored mission',
  goal: localizedMessage('interface:flightDetails.reveal', { coverage: 65 }),
  steering: localizedMessage('interface:flightDetails.steering'),
  objectiveLabel: 'Authored objective',
  actions: [
    {
      label: localizedMessage('interface:supply'),
      detail: localizedMessage('interface:flightDetails.supply', {
        keyboard: 'R',
        controller: 'X',
      }),
    },
  ],
});
const text = (model) => model.flatMap((part) => part.lines).join('\n');

test('typed field facts translate EN/UK/EN while observed messages stay exact', (t) => {
  locale('en');
  t.after(() => locale('en'));
  const retained = information(),
    before = structuredClone(retained),
    details = context();
  const english = text(flightDetailsModel(retained, details));
  assert.match(english, /1 \/ 3 required objectives/);
  assert.match(english, /2.5s remaining/);
  assert.match(english, /charging toward its marked target/);
  assert.match(english, /touch before the ring expires/);
  assert.doesNotMatch(english, /Old (freeze|speed|life) label|Previously rendered field/);
  locale('uk');
  const ukrainian = text(flightDetailsModel(retained, details));
  assert.notEqual(ukrainian, english);
  assert.match(ukrainian, /2,5/);
  assert.match(ukrainian, /Вороги заморожені/);
  assert.doesNotMatch(
    ukrainian,
    /remaining|required objectives|patrolling|charging|Marked ground|Hollow symbols|Collect a nearby|undefined|NaN|flightDetails\./,
  );
  for (const message of [retained.lastWarning.fullText, retained.recentNotices[0].fullText])
    assert.ok(ukrainian.includes(message));
  locale('en');
  assert.equal(text(flightDetailsModel(retained, details)), english);
  assert.deepEqual(retained, before);
});

function fixture(t) {
  locale('en');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = new Document();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  const add = (tag, id, parent = doc.body) => {
    const node = doc.createElement(tag);
    node.id = id;
    parent.append(node);
    return node;
  };
  const opener = add('button', 'overlay-field-details');
  const dialog = add('dialog', 'flight-details-dialog');
  const readButton = add('button', 'flight-details-read', dialog);
  const reading = add('div', 'flight-details-reading', dialog);
  const content = add('div', 'flight-details-content', reading);
  add('button', 'flight-details-back', dialog);
  const retained = information(),
    savedContext = context();
  let current = retained,
    reads = 0,
    contexts = 0,
    clears = 0,
    pauses = 0;
  const details = attachFlightDetails({
    document: doc,
    read: () => {
      reads++;
      return current;
    },
    getContext: () => {
      contexts++;
      return savedContext;
    },
    pause: () => pauses++,
    clearInput: () => clears++,
    topDialog: () => null,
    onReadingChange() {},
    canOpen: () => true,
  });
  opener.focus();
  opener.click();
  t.after(() => {
    details.dispose();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
    locale('en');
  });
  return {
    doc,
    dialog,
    content,
    reading,
    readButton,
    retained,
    savedContext,
    details,
    counts: () => ({ reads, contexts, clears, pauses }),
    replace: (value) => {
      current = value;
    },
  };
}

test('an open Details visit refreshes without reading a newer run, resetting focus or changing scroll', (t) => {
  const f = fixture(t);
  assert.equal(f.dialog.open, true);
  const counts = f.counts(),
    english = f.content.textContent,
    before = structuredClone(f.retained);
  f.reading.tabIndex = 0;
  f.reading.focus();
  f.dialog.scrollTop = 120;
  f.reading.scrollTop = 35;
  f.savedContext.actions[0].detail = 'New context must not leak';
  f.replace({
    ...information(),
    owner: { attempt: 'newer', generation: 5 },
    lastWarning: { fullText: 'New warning must not leak' },
  });
  locale('uk');
  assert.equal(f.dialog.open, true);
  assert.equal(f.doc.activeElement, f.reading);
  assert.equal(f.dialog.scrollTop, 120);
  assert.equal(f.reading.scrollTop, 35);
  assert.notEqual(f.content.textContent, english);
  assert.doesNotMatch(
    f.content.textContent,
    /charging toward its marked target|2\.5s remaining|Release a direction/,
  );
  assert.ok(f.content.textContent.includes(before.lastWarning.fullText));
  assert.doesNotMatch(f.content.textContent, /New (context|warning) must not leak/);
  assert.deepEqual(f.counts(), counts);
  assert.deepEqual(f.retained, before);
  locale('en');
  assert.equal(f.content.textContent, english);
  assert.deepEqual(f.counts(), counts);
});

for (const end of ['close', 'suspend', 'reconcile', 'dispose'])
  test(`${end}: a retired visit cannot repaint or reopen on language change`, (t) => {
    const f = fixture(t);
    if (end === 'close') f.dialog.close();
    else if (end === 'reconcile') {
      f.replace({ owner: { attempt: 'newer', generation: 5 } });
      f.details.reconcile();
    } else f.details[end]();
    assert.equal(f.dialog.open, false);
    const text = f.content.textContent,
      focus = f.doc.activeElement,
      counts = f.counts();
    locale('uk');
    assert.equal(f.dialog.open, false);
    assert.equal(f.content.textContent, text);
    assert.equal(f.doc.activeElement, focus);
    assert.deepEqual(f.counts(), counts);
  });

test('impact carriers retain their distinct role in the field summary in both languages', (t) => {
  t.after(() => locale('en'));
  const retained = information();
  retained.snapshot.classic.enemies = [{ type: 'bouncer', impactCarrier: true }];
  for (const language of ['en', 'uk']) {
    locale(language);
    const summary = flightDetailsModel(retained, context())
      .find((s) => s.id === 'field')
      .lines.join(' ');
    assert.match(summary, /1 ×/);
    assert.doesNotMatch(summary, /Field hunter|Польовий мисливець|flightDetails\./);
    assert.match(summary, language === 'en' ? /Trail-impact carrier/ : /Носій/);
  }
});
