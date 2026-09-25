import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, localizedText, setLocale } from '../i18n/index.mjs';
import { contentText } from '../i18n/content.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createCrosswindCandidates } from '../content-design/crosswind-candidates.mjs';
import { createRelayCandidates } from '../content-design/relay-candidates.mjs';
import { createTimedBorderCandidates } from '../content-design/timed-border-candidates.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import {
  inspectEffectiveGameplay,
  withPressureDifficulty,
} from '../content-design/pressure-candidates.mjs';
import { setBoardAvailability } from '../studio/board-state.mjs';
import {
  bindStudioPreviewCopy,
  studioContentText,
  studioGameplayText,
  studioGeometryText,
  studioRulesText,
} from '../studio/preview-copy.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { sentinelProjectFixture } from './helpers/sentinel-project.mjs';

function board() {
  const document = new Document();
  for (const id of [
    'mission',
    'difficulty',
    'geometry-tools',
    'tuning-tools',
    'show-capture',
    'trail',
    'inspect',
    'clear-inspection',
    'board',
    'empty-board',
    'board-legend',
    'map-name',
    'lesson',
    'rules',
    'current-gameplay',
    'geometry',
    'play',
    'effective',
    'capture',
    'capture-summary',
    'diagnostics',
    'target-coverage',
    'countdown-seconds',
    'capture-legend',
    ...[
      'band',
      'planning',
      'execution',
      'threatDensity',
      'timePressure',
      'mechanicLoad',
      'coordination',
    ].map((facet) => `rating-${facet}`),
  ]) {
    const element = document.createElement('div');
    element.id = id;
    document.body.append(element);
  }
  document.getElementById('board').getContext = () => ({ clearRect() {} });
  return document;
}

test('current gameplay translates every inspector warning without changing its canonical report', () => {
  const previous = getLocale();
  const narrow = createStarterProject();
  narrow.maps[0].walls = [
    { x: 59, y: 1, w: 1, h: 34 },
    { x: 62, y: 1, w: 1, h: 34 },
  ];
  const reports = [
    inspectEffectiveGameplay(narrow, 'nearby-shore', { difficulty: 'expert' }),
    inspectEffectiveGameplay(sentinelProjectFixture(), 'nearby-shore', {
      difficulty: 'expert',
      overrides: { enemySpeed: 1.5 },
    }),
  ];
  const before = JSON.stringify(reports);
  const codes = new Set(
    reports.flatMap((report) => report.warnings.map((warning) => warning.code)),
  );
  assert.equal(codes.size, 4);
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      for (const report of reports) {
        const text = studioGameplayText(report);
        assert.doesNotMatch(text, /tools:|undefined|NaN/);
        if (locale === 'uk') {
          for (const warning of report.warnings) assert(!text.includes(warning.message));
          assert.match(text, /Значення для нової спроби/);
        }
      }
    }
    assert.equal(JSON.stringify(reports), before);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('authored rule captions use Ukrainian life plurals, including zero and decimal counts', () => {
  const previous = getLocale();
  const project = createStarterProject();
  const mission = project.missions[0];
  const preview = prepareContentPreview(project, mission.id);
  try {
    setLocale('uk', { persist: false });
    for (const [count, word] of [
      [0, 'життів'],
      [1, 'життя'],
      [2, 'життя'],
      [5, 'життів'],
      [11, 'життів'],
      [21, 'життя'],
      [22, 'життя'],
      [1.5, 'життя'],
    ]) {
      const display = String(count).replace('.', ',');
      const withCount = {
        ...preview,
        manifest: {
          ...preview.manifest,
          level: {
            ...preview.manifest.level,
            rules: { ...preview.manifest.level.rules, lives: count },
          },
        },
      };
      assert(
        studioRulesText(project, mission, withCount).startsWith(
          `Авторський перегляд: ${display} ${word} · `,
        ),
      );
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('Studio translates exact starter fields, while changed owners retain all authored copy', () => {
  const previous = getLocale();
  const project = createStarterProject();
  const before = JSON.stringify(project);
  try {
    setLocale('uk', { persist: false });
    assert.equal(contentText(project, 'name'), 'Моя подорож');
    assert.notEqual(
      studioContentText(project, project.missions[0], 'name'),
      project.missions[0].name,
    );
    assert.equal(
      studioContentText(project, project.missions[0], 'design.routeDecision'),
      'Повернутися до острова чи продовжити до далекої межі?',
    );
    for (const custom of [
      { ...project, name: 'Мій власний світ ҐЄІЇ' },
      createStarterProject('my-custom-journey'),
      { ...project, maps: project.maps.map((map) => ({ ...map, name: 'Changed map' })) },
    ]) {
      assert.equal(studioContentText(custom, custom.missions[0], 'name'), custom.missions[0].name);
      assert.equal(
        studioContentText(custom, custom.missions[0], 'design.routeDecision'),
        custom.missions[0].design.routeDecision,
      );
    }
    setLocale('en', { persist: false });
    assert.equal(contentText(project, 'name'), project.name);
    assert.equal(studioContentText(project, project.missions[0], 'name'), project.missions[0].name);
    assert.equal(JSON.stringify(project), before);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('live board copy and empty transitions retain draft input, selection and simulation identity', () => {
  const previous = getLocale();
  const project = freezeDesign(createStarterProject());
  const mission = project.missions[0];
  const preview = prepareContentPreview(project, mission.id, { difficulty: 'expert' });
  const report = inspectEffectiveGameplay(project, mission.id, {
    difficulty: 'expert',
    overrides: { enemySpeed: 1.5 },
  });
  const before = JSON.stringify({ project, preview, report });
  const document = board();
  const $ = (id) => document.getElementById(id);
  const source = document.createElement('textarea');
  source.value = '{"unapplied": "ҐЄІЇ", "name": "My custom name"}';
  source.selectionStart = 3;
  source.selectionEnd = 13;
  source.scrollTop = 58;
  document.body.append(source);
  source.focus();
  const raw = source.value;
  $('mission').value = mission.id;
  $('difficulty').value = 'expert';
  try {
    bindStudioPreviewCopy(document, project, mission, preview);
    localizedText($('current-gameplay'), () =>
      studioGameplayText(report, { error: 'storage failure' }),
    );
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.match(
        $('rules').textContent,
        locale === 'uk' ? /^Авторський перегляд:/ : /^Authored preview:/,
      );
      assert.match(
        $('current-gameplay').textContent,
        locale === 'uk' ? /^Поточні правила гри/ : /^Current gameplay/,
      );
      assert.match(
        $('current-gameplay').textContent,
        locale === 'uk' ? /лише в цьому сеансі/ : /session-only/,
      );
      assert.equal(source.value, raw);
      assert.equal(source.selectionStart, 3);
      assert.equal(source.selectionEnd, 13);
      assert.equal(source.scrollTop, 58);
      assert.equal(document.activeElement, source);
      assert.equal($('mission').value, mission.id);
      assert.equal($('difficulty').value, 'expert');
      assert.equal(JSON.stringify({ project, preview, report }), before);
    }
    setBoardAvailability(document, false);
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      for (const id of [
        'lesson',
        'rules',
        'current-gameplay',
        'effective',
        'capture',
        'capture-summary',
      ])
        assert.equal($(id).textContent, '', id);
      assert.match($('map-name').textContent, locale === 'uk' ? /перша місія/ : /first mission/);
      assert.match(
        $('play').getAttribute('title'),
        locale === 'uk' ? /Створи місію/ : /Create a mission/,
      );
      assert.equal(source.value, raw);
      assert.equal(document.activeElement, source);
    }
    setBoardAvailability(document, true);
    bindStudioPreviewCopy(document, project, mission, preview);
    setLocale('en', { persist: false });
    assert.equal($('map-name').textContent, mission.name);
    assert.equal($('play').getAttribute('title'), '');
  } finally {
    setLocale(previous, { persist: false });
  }
});

for (const [name, create] of [
  ['Solo', createStarterProject],
  ['Team', createTeamOpeningCandidates],
])
  for (const pressure of [false, true])
    test(`${name} rules preserve both difficulty editions and all actual preset values: ${pressure}`, () => {
      const previous = getLocale();
      const project = pressure ? withPressureDifficulty(create()) : create();
      const mission = project.missions[0];
      try {
        for (const difficulty of ['gentle', 'standard', 'expert']) {
          const preview = prepareContentPreview(project, mission.id, {
            difficulty,
            mode: name === 'Team' ? 'team' : 'solo',
          });
          const snapshot = JSON.stringify(preview);
          for (const locale of ['en', 'uk']) {
            setLocale(locale, { persist: false });
            const text = studioRulesText(project, mission, preview);
            assert(text.includes(project.difficultyCatalogId));
            assert.match(text, locale === 'uk' ? /кліт/ : /cells\/s/);
            if (name === 'Team') assert.match(text, locale === 'uk' ? /спільн/ : /shared team/);
            assert.doesNotMatch(text, /tools:|undefined|NaN/);
          }
          assert.equal(JSON.stringify(preview), snapshot);
        }
      } finally {
        setLocale(previous, { persist: false });
      }
    });

for (const [name, create] of [
  ['directional', createCrosswindCandidates],
  ['relay', createRelayCandidates],
  ['timed pickups', createTimedBorderCandidates],
  ['combat', createCombatCandidates],
  ['sentinel', createSentinelCandidates],
])
  test(`${name} diagrams translate authored geometry without rewriting resolved rules`, () => {
    const previous = getLocale();
    const project = create();
    const mission = project.missions[0];
    const preview = prepareContentPreview(project, mission.id);
    const before = JSON.stringify({ project, preview });
    try {
      setLocale('en', { persist: false });
      const english = studioGeometryText(mission, preview);
      assert.match(english, /Contact bonuses:/);
      setLocale('uk', { persist: false });
      const ukrainian = studioGeometryText(mission, preview);
      assert.notEqual(ukrainian, english);
      assert.doesNotMatch(
        ukrainian,
        /tools:|undefined|NaN|Contact bonuses|stationary|lane warning/,
      );
      for (const actor of preview.markers.actors) assert(ukrainian.includes(actor.id));
      assert.equal(JSON.stringify({ project, preview }), before);
    } finally {
      setLocale(previous, { persist: false });
    }
  });
