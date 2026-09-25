import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { chooseJourneyMission } from './helpers/library-selection.mjs';
import { playCurrentTeamRoute } from './helpers/current-team-route.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { JOURNEY_REACTION_PREFERENCES_KEY as preferenceKey } from '../journey/reaction-preferences.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const fetchResponse = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;

test('a real released Sentinel uses its caption only after victory, with exact physics and objective facts', async (t) => {
  const p = await soloPage(t, {
    search: '?journey=whole-originals-v3',
    titleScreen: true,
    storage: memoryStorage(),
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse,
  });
  await chooseJourneyMission(p, 'shell-play', 'whole-originals-v3', 'first-relay');
  await settle(() => {
    p.frame(0);
    return p.rendered.run.levelId === 'first-relay' && p.doc.body.dataset.flightState === 'running';
  });
  assert.equal(p.$('journey-reactions').hidden, true);
  const manifest = resolveMission(
    compileContentProject(createAuthoredJourneyRoute('whole-originals-v3').source),
    'first-relay',
  );
  const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
  assert.deepEqual(p.rendered.run.level, level);
  assert.deepEqual(p.rendered.backdrop.assetRevision, manifest.background);
  const acceptedPicture = p.rendered.backdrop;
  const options = { seed: 1, classId: 'scout' };
  const reference = createRun(level, options),
    recorder = createRecorder(level, options);
  // Legal current Standard route; historical untuned feasibility logs stay unchanged.
  // Waiting follows completed cuts, and each closure requires a fresh real gesture.
  const segments = [
    ['down', 470],
    [null, 60],
    ['down', 7],
    ['up', 353],
    ['right', 530],
    ['left', 489],
    ['down', 244],
    ['right', 217],
    ['down', 27],
    ['left', 210],
    [null, 960],
    ['right', 7],
    ['up', 26],
    ['left', 14],
    ['up', 150],
    ['right', 312],
    ['down', 27],
    ['left', 251],
    [null, 600],
    ['right', 88],
    ['up', 21],
  ];
  const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  for (const [direction, ticks] of segments) {
    if (direction) {
      p.key(keys[direction]);
      p.key(keys[direction], false);
    }
    let frames = 0;
    for (let tick = 0; tick < ticks; tick++) {
      recordInput(recorder, { direction });
      stepRun(reference, { direction }, FIXED_DT);
      frames++;
      const closure = reference.events.some((event) => event.type === 'capture.stopped');
      if (closure || frames === 12 || tick === ticks - 1) {
        p.frame(frames * FIXED_DT * 1000);
        frames = 0;
        if (p.rendered.run.status !== 'won') assert.equal(p.$('journey-reactions').hidden, true);
        if (closure && tick < ticks - 1 && p.rendered.run.status !== 'won') {
          p.key(keys[direction]);
          p.key(keys[direction], false);
        }
      }
    }
  }
  assert.equal(p.rendered.run.status, 'won');
  assert.equal(p.rendered.run.tick, 5063);
  assert.equal(p.rendered.run.classic.livesLost, 0);
  assert(p.rendered.run.objectives.every((objective) => objective.captured));
  assert.equal(p.rendered.run.encounter.defeated, true);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), authoritativeCheckpoint(reference));
  assert.equal(verifyReplay(exportReplay(recorder, reference)).match, true);
  assert.equal(p.rendered.backdrop, acceptedPicture);
  assert.equal(p.$('journey-reactions').hidden, false);
  assert.match(p.$('journey-reactions').textContent, /^Sentinel — /);
  assert.match(p.$('overlay-copy').textContent, /captured.*points/);
  assert.equal(p.$('next-button').hidden, false);
  assert.deepEqual(p.errors, []);
});

test('Solo result has a silent optional Guide caption; changing the choice preserves result and Next', async (t) => {
  const storage = memoryStorage();
  const p = await soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse,
  });
  assert.equal(p.$('journey-reactions').hidden, true);
  p.$('shell-featured').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  assert.equal(p.$('journey-reactions').hidden, true);
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  // Standard pressure.v4 completes the same straight return at tick469.
  for (let i = 0; i < 469; i++) p.frame();
  assert.equal(p.rendered.run.status, 'won');
  assert.equal(p.$('journey-reactions').hidden, false);
  assert.match(p.$('journey-reactions').textContent, /^Guide — /);
  assert.equal(p.$('next-button').hidden, false);
  const checkpoint = authoritativeCheckpoint(p.rendered.run),
    copy = p.$('run-message').textContent;
  p.$('journey-reactions-enabled').checked = false;
  p.$('journey-reactions-enabled').emit('change');
  assert.equal(p.$('journey-reactions').hidden, true);
  assert.equal(JSON.parse(storage.getItem(preferenceKey)).enabled, false);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.equal(p.$('run-message').textContent, copy);
  p.$('next-button').click();
  await settle(() => {
    p.frame(0);
    return (
      p.rendered.run.levelId === 'choose-your-share' && p.doc.body.dataset.flightState === 'running'
    );
  });
  assert.equal(p.$('journey-reactions').hidden, true);
  assert.deepEqual(p.errors, []);
});

test('actual authored equal Versus completion uses Rival without changing race result or Next', async (t) => {
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=opening',
    initialLevel: null,
    storage: memoryStorage(),
    assetDatabase: managedIndexedDB().indexedDB,
    fetchResponse,
  });
  assert.equal(p.$('race-journey-reactions').hidden, true);
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  p.key('KeyS');
  p.key('ArrowDown');
  for (let i = 0; i < 1000 && p.renders[0].status !== 'won'; i++) p.frame();
  p.key('KeyS', false);
  p.key('ArrowDown', false);
  assert.equal(p.renders[0].status, 'won');
  assert.equal(p.renders[1].status, 'won');
  assert.match(p.$('race-message').textContent, /Draw/);
  assert.match(p.$('race-journey-reactions').textContent, /^Rival — /);
  assert.equal(p.$('race-journey-reactions').hidden, false);
  const before = p.renders.map(authoritativeCheckpoint);
  p.$('race-journey-reactions-enabled').checked = false;
  p.$('race-journey-reactions-enabled').emit('change');
  assert.deepEqual(p.renders.map(authoritativeCheckpoint), before);
  p.$('race-journey-next').click();
  await settle(() => {
    p.frame(0);
    return p.renders[0].levelId === 'choose-your-share';
  });
  assert.equal(p.$('race-journey-reactions').hidden, true);
});

test('real authored Team victory uses Engineer and does not replace completion facts or Next', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const storage = memoryStorage();
  const f = await teamPage(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    beforeImport({ install }) {
      install('localStorage', { value: storage });
    },
  });
  assert.equal(f.$('coop-journey-reactions').hidden, true);
  f.$('coop-start').focus();
  f.tap('Enter');
  playCurrentTeamRoute(f, createTeamJourneyCandidates(), 'twin-landings', 'standard', () => {
    if (f.$('coop-overlay').hidden) assert.equal(f.$('coop-journey-reactions').hidden, true);
  });
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.match(f.$('coop-overlay-copy').textContent, /Joint Cuts.*Rescues/);
  assert.match(f.$('coop-journey-reactions').textContent, /^Engineer — /);
  assert.equal(f.$('coop-journey-reactions').hidden, false);
  assert.equal(f.$('coop-next').hidden, false);
  const result = f.$('coop-overlay-copy').textContent;
  f.$('coop-next').focus();
  setLocale('uk', { persist: false });
  assert.match(f.$('coop-overlay-copy').textContent, /Разом ви відкрили/);
  assert.match(f.$('coop-overlay-copy').textContent, /Спільні контури/);
  assert.match(f.$('coop-overlay-copy').textContent, /Порятунки/);
  assert.match(f.$('coop-next').textContent, /^Далі:/);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  setLocale('en', { persist: false });
  assert.equal(f.$('coop-overlay-copy').textContent, result);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  f.$('coop-journey-reactions-enabled').checked = false;
  f.$('coop-journey-reactions-enabled').emit('change');
  assert.equal(f.$('coop-journey-reactions').hidden, true);
  assert.equal(f.$('coop-overlay-copy').textContent, result);
  f.tap('Enter');
  await settle(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-journey-reactions').hidden, true);
});
