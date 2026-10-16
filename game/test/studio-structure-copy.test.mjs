import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, localizedText, setLocale } from '../i18n/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectContentRemoval } from '../content-design/structure.mjs';
import {
  studioItemCaption,
  studioStructureSummary,
  studioStructureOutline,
  studioRemovalText,
  studioStructureResult,
  studioDiagnosticText,
} from '../studio/structure-copy.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('live structure captions preserve selected nodes, unsaved forms and literal custom names', () => {
  const previous = getLocale();
  const project = freezeDesign(createStarterProject());
  const doc = new Document();
  const select = doc.createElement('select');
  const name = doc.createElement('input');
  name.value = 'My custom ҐЄІЇ name';
  name.selectionStart = 4;
  name.selectionEnd = 10;
  doc.body.append(select, name);
  for (const campaign of project.campaigns) {
    const option = doc.createElement('option');
    option.value = campaign.id;
    localizedText(option, () => studioItemCaption(project, campaign));
    select.append(option);
  }
  select.value = project.campaigns[0].id;
  const options = [...select.options];
  name.focus();
  const before = JSON.stringify(project);
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      const text = studioStructureSummary(project);
      const outline = studioStructureOutline(project);
      assert.match(text, locale === 'uk' ? /^Набори: 1/ : /^Packs: 1/);
      assert.match(outline, locale === 'uk' ? /Початок/ : /Opening/);
      assert.match(outline, locale === 'uk' ? /Близький берег/ : /Nearby shore/);
      assert.equal(select.value, project.campaigns[0].id);
      assert.deepEqual([...select.options], options);
      assert.equal(doc.activeElement, name);
      assert.equal(name.value, 'My custom ҐЄІЇ name');
      assert.equal(name.selectionStart, 4);
      assert.equal(name.selectionEnd, 10);
    }
    const custom = { ...project, name: 'Personal draft' };
    assert.equal(
      studioItemCaption(custom, project.campaigns[0]),
      'Horizon School · horizon-school',
    );
    const archived = { ...project.missions[0], archived: true, name: '<b>My & Mission ҐЄІЇ</b>' };
    const option = doc.createElement('option');
    localizedText(option, () => studioItemCaption(custom, archived));
    assert.equal(option.textContent, '<b>My & Mission ҐЄІЇ</b> · nearby-shore · Архівовано');
    assert.equal(option.children.length, 0);
    assert.equal(JSON.stringify(project), before);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('localized removal notices preserve dependency and confirmation identities', () => {
  const previous = getLocale();
  const project = createStarterProject();
  const removal = inspectContentRemoval(project, 'campaign', 'horizon-school');
  const before = JSON.stringify(removal);
  try {
    setLocale('uk', { persist: false });
    const blocked = studioRemovalText(project, removal);
    assert.match(blocked, /Не вдалося видалити/);
    assert(blocked.includes('opening'));
    assert(blocked.includes('nearby-shore'));
    assert.match(blocked, /батьківський елемент/);
    assert.match(blocked, /вкладений елемент/);
    assert.doesNotMatch(blocked, /Horizon School|Remove memberships|cascade/);
    const empty = {
      ...project,
      campaigns: [],
      missions: [],
      packs: [{ ...project.packs[0], campaignIds: [] }],
    };
    const allowed = inspectContentRemoval(empty, 'pack', 'opening');
    assert.match(studioRemovalText(empty, allowed), /\(opening\)/);
    assert.match(studioRemovalText(empty, allowed), /введи точний ID/);
    for (const action of [
      'create',
      'duplicate',
      'rename',
      'set-band',
      'place',
      'detach',
      'earlier',
      'later',
      'delete',
      'archive',
      'restore',
    ]) {
      const result = studioStructureResult(action, 'campaign', 'my-campaign');
      assert(result.includes('my-campaign'));
      assert.doesNotMatch(result, /tools:|interface:|undefined/);
      assert.match(result, /Змінено лише чернетку/);
    }
    assert.equal(JSON.stringify(removal), before);
  } finally {
    setLocale(previous, { persist: false });
  }
});

for (const occupied of [true, false])
  for (const required of [true, false])
    test(`diagnostics localize actual remote-chamber facts and preserve machine codes: ${occupied}/${required}`, () => {
      const previous = getLocale();
      const source = createStarterProject();
      source.maps[0].foundations = [];
      source.maps[0].walls = [
        { x: 40, y: 8, w: 22, h: 1 },
        { x: 40, y: 28, w: 22, h: 1 },
        { x: 40, y: 9, w: 1, h: 19 },
        { x: 61, y: 9, w: 1, h: 19 },
      ];
      source.missions[0].actors[0].x = occupied ? 50.5 : 20.5;
      source.missions[0].actors[0].y = 18.5;
      source.missions[0].objectives = [{ id: 'remote', x: 50.5, y: 12.5, required, hidden: false }];
      source.missions[0].coverage = 0.99;
      const manifest = resolveMission(compileContentProject(source), 'nearby-shore');
      const before = JSON.stringify({ source, manifest });
      try {
        for (const locale of ['uk', 'en', 'uk']) {
          setLocale(locale, { persist: false });
          for (const diagnostic of manifest.diagnostics) {
            const text = studioDiagnosticText(diagnostic, manifest);
            assert(text.includes(`(${diagnostic.code})`));
            assert.doesNotMatch(text, /tools:|undefined|NaN/);
            if (locale === 'uk') {
              assert.match(text, /^(Помилка|Попередження):/);
              if (diagnostic.message) assert(!text.includes(diagnostic.message));
              if (diagnostic.code === 'unreachable-coverage-quota') assert.match(text, /99,0%/);
              if (diagnostic.code === 'unreachable-objective')
                assert(text.includes(required ? '(обов’язкова)' : '(необов’язкова)'));
            }
          }
        }
        assert.equal(JSON.stringify({ source, manifest }), before);
      } finally {
        setLocale(previous, { persist: false });
      }
    });
