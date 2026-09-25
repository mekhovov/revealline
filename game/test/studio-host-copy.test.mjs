import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale, localizedText, t } from '../i18n/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { studioPreviewLoadingText, studioPreviewFailureText } from '../studio/preview-copy.mjs';
import { editorMessageError, editorErrorText } from '../studio/editor-copy.mjs';
import { platformExportText } from '../ui/export-copy.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('loading labels translate the captured owned mission but retain a custom owner’s authored text', () => {
  const previous = getLocale(),
    source = createStarterProject();
  const accepted = compileContentProject(source).source,
    before = JSON.stringify(accepted);
  const custom = structuredClone(source);
  custom.name = 'My authored project';
  const customAccepted = compileContentProject(custom).source;
  const document = new Document(),
    status = document.createElement('p');
  document.body.append(status);
  localizedText(status, () => studioPreviewLoadingText(accepted, 'nearby-shore', 'expert'));
  // Editing the original object cannot change the accepted loading caption.
  source.missions[0].name = 'Later unsaved edit';
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.doesNotMatch(status.textContent, /Later unsaved edit|tools:|interface:/);
      assert.match(status.textContent, locale === 'uk' ? /Завантаження:/ : /Loading Nearby shore/);
      assert(status.textContent.includes(t('interface:missionLibrary.difficulty.expert')));
      assert(
        studioPreviewLoadingText(customAccepted, 'nearby-shore', 'expert').includes('Nearby shore'),
      );
      assert.equal(JSON.stringify(accepted), before);
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('already visible launch and action errors retranslate without changing their technical details', () => {
  const previous = getLocale(),
    document = new Document(),
    status = document.createElement('p');
  document.body.append(status);
  const error = editorMessageError('errors:studio.trail.indexes');
  localizedText(status, () => studioPreviewFailureText(error));
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(editorErrorText(error), t('errors:studio.trail.indexes'));
      assert.equal(
        status.textContent,
        t('tools:studio.preview.loadFailed', { message: t('errors:studio.trail.indexes') }),
      );
    }
    const unexpected = new Error('Browser filesystem detail');
    assert.equal(
      editorErrorText(unexpected),
      unexpected.message,
      'Unknown host diagnostics stay available for recovery.',
    );
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('platform export outcomes share live copy and Ukrainian campaign plurals use every category', () => {
  const previous = getLocale(),
    document = new Document();
  const rows = ['requested', 'shared', 'cancelled'].map((status) => {
    const result = Object.freeze({ status, message: 'Platform implementation detail' }),
      node = document.createElement('p');
    document.body.append(node);
    localizedText(node, () => platformExportText(result));
    return { result, node };
  });
  try {
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      for (const { result, node } of rows) {
        assert.equal(node.textContent, t(`common:export.${result.status}`));
        assert(!node.textContent.includes(result.message));
      }
    }
    for (const count of [0, 1, 2, 5, 11, 21, 22, 1.5]) {
      const text = t('tools:studio.export.teamCampaign', {
        count,
        message: platformExportText(rows[0].result),
      });
      const category = new Intl.PluralRules('uk').select(count);
      assert(
        text.includes(
          {
            one: 'командна тестова місія',
            few: 'командні тестові місії',
            many: 'командних тестових місій',
            other: 'командної тестової місії',
          }[category],
        ),
      );
      assert.doesNotMatch(text, /tools:|common:|\{\{/);
    }
    assert.equal(
      platformExportText({ status: 'extension-specific', message: 'Authored detail' }),
      'Authored detail',
    );
  } finally {
    setLocale(previous, { persist: false });
  }
});
