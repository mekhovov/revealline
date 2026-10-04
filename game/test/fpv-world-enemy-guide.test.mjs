import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { dataIdentity } from '../data-json.mjs';
import {
  worldEnemyGuide,
  mountWorldEnemyGuide,
} from '../../optional-practice/civilian-fpv/world-enemy-guide.mjs';
import {
  NATIVE_PURSUIT_COURSES,
  NATIVE_PURSUIT_V2_COURSES,
} from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import { EXPRESSIVE_HUNT_COURSES } from '../../optional-practice/civilian-fpv/expressive-hunt-courses.mjs';
import { validateWorldCourse } from '../../optional-practice/civilian-fpv/world-model.mjs';
import { mountActorEditor } from '../../optional-practice/civilian-fpv/world-actor-editor.mjs';

const courseNamed = (id, courses = NATIVE_PURSUIT_COURSES) =>
  validateWorldCourse(courses.find((course) => course.id === `native-pursuit-${id}`));

test('native Hunt preview names accepted families and counts an optional courier without a quota or points award', () => {
  const course = courseNamed('refuge-return', NATIVE_PURSUIT_V2_COURSES),
    before = dataIdentity(course),
    guide = worldEnemyGuide(course);
  assert.deepEqual(
    guide.rows.map(({ family, total, required, optional }) => ({
      family,
      total,
      required,
      optional,
    })),
    [
      { family: 'refuge-seeker', total: 1, required: 1, optional: 0 },
      { family: 'courier', total: 1, required: 0, optional: 1 },
    ],
  );
  assert.match(guide.rows[1].counter, /does not satisfy a required Hunt objective/);
  assert.doesNotMatch(JSON.stringify(guide), /250|points|enclosure|Pulse|Reel/);
  assert.equal(dataIdentity(course), before);
});

test('historical native waypoints remain patrol/lookout rather than inheriting a costume’s pursuit family', () => {
  const course = validateWorldCourse(EXPRESSIVE_HUNT_COURSES[0]),
    guide = worldEnemyGuide(course);
  assert.ok(guide.rows.length > 0);
  assert.ok(guide.rows.every((row) => ['lookout', 'patroller'].includes(row.family)));
  assert.equal(
    guide.rows.reduce((n, row) => n + row.total, 0),
    new Set(
      course.steps['self-level']
        .filter((step) => step.type === 'hunt-contact-v1')
        .flatMap((step) => step.targets),
    ).size,
  );
  const duplicate = structuredClone(course);
  duplicate.steps['self-level'].push(
    structuredClone(duplicate.steps['self-level'].find((step) => step.type === 'hunt-contact-v1')),
  );
  assert.deepEqual(worldEnemyGuide(duplicate), guide);
  duplicate.steps.acro = [{ type: 'survive', ticks: 50 }];
  assert.deepEqual(worldEnemyGuide(duplicate, { mode: 'acro' }).rows, []);
  const singleWaypoint = structuredClone(course);
  const target = singleWaypoint.actors[0];
  target.path = [{ ...target.position, x: target.position.x + 1000 }];
  target.speed = 1000;
  singleWaypoint.steps['self-level'] = [
    {
      ...singleWaypoint.steps['self-level'].find((step) => step.type === 'hunt-contact-v1'),
      targets: [target.id],
    },
  ];
  assert.equal(
    worldEnemyGuide(singleWaypoint).rows[0].family,
    'patroller',
    'Native actors can move to a single authored waypoint',
  );
});

test('successor refuge and meeting advice never rewrites historical policy descriptions', () => {
  const oldRefuge = worldEnemyGuide(courseNamed('refuge-return')).rows[0],
    newRefuge = worldEnemyGuide(courseNamed('refuge-return', NATIVE_PURSUIT_V2_COURSES)).rows[0],
    oldPair = worldEnemyGuide(courseNamed('meeting-yard')).rows[0],
    newPair = worldEnemyGuide(courseNamed('meeting-yard', NATIVE_PURSUIT_V2_COURSES)).rows[0];
  assert.doesNotMatch(oldRefuge.tell, /commits until arrival/);
  assert.match(newRefuge.tell, /commits until arrival/);
  assert.doesNotMatch(oldPair.tell, /waits for its partner/);
  assert.match(newPair.tell, /waits for its partner/);
  assert.equal(newPair.total, 2);
});

test('an actor inspector scopes native counts before family grouping and still admits optional couriers', () => {
  const course = courseNamed('meeting-yard', NATIVE_PURSUIT_V2_COURSES),
    actorId = course.pursuit.actors[0].id,
    original = structuredClone(course),
    [selected] = worldEnemyGuide(course, { actorId }).rows;
  assert.equal(selected.family, 'rendezvous-pair');
  assert.equal(selected.total, 1);
  assert.equal(selected.required, 1);
  assert.match(selected.tell, /waits for its partner/);
  assert.equal(worldEnemyGuide(course).rows[0].total, 2);
  assert.deepEqual(worldEnemyGuide(course, { actorId: 'missing-actor' }).rows, []);
  const refuge = courseNamed('refuge-return', NATIVE_PURSUIT_V2_COURSES),
    courierId = refuge.pursuit.actors.find((actor) => actor.family === 'courier').id;
  for (const mode of ['self-level', 'acro']) {
    const [courier] = worldEnemyGuide(refuge, { actorId: courierId, mode }).rows;
    assert.equal(courier.total, 1);
    assert.equal(courier.optional, 1);
    assert.equal(courier.required, 0);
    assert.match(courier.counter, /does not satisfy a required Hunt objective/);
  }
  assert.deepEqual(course, original);
});

test('World Studio uses native versioned guide advice and exposes optional couriers without changing objectives', (t) => {
  const document = new Document(),
    container = document.createElement('section'),
    create = document.createElement.bind(document);
  // This regression owns native guide/authoring behavior, not pixel rendering.
  document.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'canvas') node.getContext = () => null;
    return node;
  };
  document.body.append(container);
  let course = courseNamed('refuge-return'),
    locale = 'en',
    changes = 0;
  const editor = mountActorEditor({
    container,
    getCourse: () => course,
    locale: () => locale,
    onChange: () => changes++,
  });
  t.after(() => editor.dispose());
  const select = (family) => {
    const actorId = course.pursuit.actors.find((actor) => actor.family === family).id;
    editor.select(actorId);
    return container.querySelector(`[data-actor-field-guide="${actorId}"]`);
  };
  const oldBefore = structuredClone(course);
  let guide = select('refuge-seeker');
  assert.match(guide.textContent, /rests after reaching a shelter/);
  assert.doesNotMatch(guide.textContent, /commits until arrival/);
  assert.deepEqual(course, oldBefore);
  course = courseNamed('refuge-return', NATIVE_PURSUIT_V2_COURSES);
  const before = structuredClone(course);
  guide = select('refuge-seeker');
  assert.match(guide.textContent, /commits until arrival/);
  assert.match(guide.textContent, /Required target in: Self-level, Acro/);
  guide = select('courier');
  assert.match(guide.textContent, /Optional catch · no quota credit/);
  assert.match(guide.textContent, /does not satisfy a required Hunt objective/);
  assert.doesNotMatch(guide.textContent, /Required target|250|points/);
  locale = 'uk';
  editor.refresh();
  assert.match(container.querySelector('[data-actor-field-guide]').textContent, /Необов’язкове/);
  assert.deepEqual(course, before);
  course = courseNamed('armor-windows');
  const armorBefore = structuredClone(course);
  locale = 'en';
  guide = select('brace-trooper');
  assert.match(guide.textContent, /Warning and burst contact damage the hull/);
  assert.doesNotMatch(guide.textContent, /Pulse|Reel|enclosure/);
  assert.deepEqual(course, armorBefore);
  assert.equal(changes, 0, 'Inspecting advice never edits a course or starts a flight');
});

test('a restored native snapshot accounts for once-only catches and a pair survivor without mutating recorded identity', () => {
  const course = courseNamed('meeting-yard', NATIVE_PURSUIT_V2_COURSES),
    first = course.pursuit.actors[0].id,
    second = course.pursuit.actors[1].id,
    state = {
      hunt: { caught: [first, first] },
      actors: [
        { id: first, status: 'caught' },
        { id: second, status: 'active', pursuit: { family: 'runner' } },
      ],
    },
    before = structuredClone({ course, state }),
    [row] = worldEnemyGuide(course, { state }).rows;
  assert.equal(row.total, 2);
  assert.equal(row.remaining, 1);
  assert.equal(row.family, 'rendezvous-pair');
  assert.equal(row.survivor, true);
  assert.deepEqual({ course, state }, before);
  const courierCourse = courseNamed('refuge-return'),
    courier = courierCourse.pursuit.actors.find((actor) => actor.family === 'courier').id;
  assert.equal(
    worldEnemyGuide(courierCourse, { state: { pursuit: { bonusCaught: [courier] } } }).rows.find(
      (entry) => entry.family === 'courier',
    ).remaining,
    0,
  );
});

function fixture(t) {
  const document = new Document(),
    trigger = document.createElement('button');
  document.body.append(trigger);
  let locale = 'en',
    pauses = 0;
  const guide = mountWorldEnemyGuide({ document, locale: () => locale, onPause: () => pauses++ });
  t.after(() => guide.dispose());
  return {
    document,
    trigger,
    guide,
    pauses: () => pauses,
    localize(value) {
      locale = value;
      guide.refresh();
    },
  };
}

test('native specialist guide owns a paused modal, explains hull contact, and Back/Escape never start or resume a flight', (t) => {
  const f = fixture(t),
    course = courseNamed('armor-windows');
  f.trigger.focus();
  assert.equal(f.guide.open(course, { trigger: f.trigger, state: { hunt: { caught: [] } } }), true);
  assert.equal(f.pauses(), 1);
  assert.equal(f.guide.dialog.open, true);
  assert.match(f.guide.dialog.textContent, /25 hull damage/);
  assert.match(f.guide.dialog.textContent, /20 flight ticks \(0\.4 s\)/);
  assert.match(f.guide.dialog.textContent, /Warning and burst contact damage/);
  assert.match(f.guide.dialog.textContent, /Required: 1 · Remaining: 1/);
  assert.doesNotMatch(f.guide.dialog.textContent, /enclosure|Pulse|Reel/);
  f.guide.dialog.querySelector('button').click();
  assert.equal(f.guide.dialog.open, false);
  assert.equal(f.pauses(), 1);
  assert.equal(f.document.activeElement, f.trigger);
  f.guide.open(course, { trigger: f.trigger });
  const event = f.guide.dialog.emit('cancel');
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.guide.dialog.open, false);
  assert.equal(f.pauses(), 2);
});

test('preview remains unstarted, preserves mode-specific ordered/tail advice and relocalizes native names', (t) => {
  const f = fixture(t),
    course = courseNamed('switchback-crossing');
  course.steps.acro[0].ordered = true;
  f.guide.open(course, { mode: 'acro', trigger: f.trigger });
  assert.match(f.guide.dialog.textContent, /Course preview · no flight started/);
  assert.match(f.guide.dialog.textContent, /includes ordered catches/);
  assert.match(f.guide.dialog.textContent, /solid echo tail/);
  assert.doesNotMatch(f.guide.dialog.textContent, /Remaining:/);
  f.localize('uk');
  assert.match(f.guide.dialog.textContent, /Довідник ворогів · FPV SIM/);
  assert.match(f.guide.dialog.textContent, /політ не розпочато/);
  assert.match(f.guide.dialog.textContent, /послідовні перехоплення/);
  assert.equal(f.pauses(), 1);
});

test('ordinary non-Hunt worlds have no prey guide and disposal retires the modal without a flight callback', (t) => {
  const f = fixture(t),
    course = courseNamed('runner-court');
  delete course.pursuit;
  course.steps = {
    'self-level': [{ type: 'survive', ticks: 50 }],
    acro: [{ type: 'survive', ticks: 50 }],
  };
  assert.equal(f.guide.open(course), false);
  assert.equal(f.pauses(), 0);
  assert.equal(f.guide.dialog.open, false);
  f.guide.open(courseNamed('runner-court'));
  f.guide.dispose();
  assert.equal(f.guide.dialog.open, false);
  assert.equal(f.guide.dialog.isConnected, false);
  assert.equal(f.guide.open(courseNamed('runner-court')), false);
  assert.equal(f.pauses(), 1);
});
