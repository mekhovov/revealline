import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale, t, localizedMessage } from '../i18n/index.mjs';
import { dataIdentity } from '../data-json.mjs';
import { SOURCE_EXTERNAL_EDITIONS } from '../external-chapter-source.mjs';
import { presentSourceChapter, optionalChapterText } from '../ui/optional-chapter-presentation.mjs';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';

// Model the owned text node separately from element children, as in a browser.
// The older minimal host fixture only models destructive textContent writes.
class ChapterElement extends SoloElement {
  get textContent() {
    return super.textContent;
  }
  set textContent(value) {
    this.caption?.remove();
    super.textContent = value;
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.nodeType !== 3) {
        super.append(node);
        continue;
      }
      node.remove();
      this.caption = node;
      node.parentNode = this;
      this._text = node.textContent;
    }
  }
}

function localeFor(context, locale = 'en') {
  const original = getLocale();
  context.after(() => setLocale(original, { persist: false }));
  setLocale(locale, { persist: false });
}
function fixture(
  context,
  { editions = SOURCE_EXTERNAL_EDITIONS, panel: options = {}, download = async () => {} } = {},
) {
  const doc = new Document();
  doc.createElement = (tag) => new ChapterElement(doc, tag);
  doc.createTextNode = (value) => ({
    nodeType: 3,
    parentNode: null,
    value,
    get textContent() {
      return this.value;
    },
    set textContent(text) {
      this.value = text;
      if (this.parentNode) this.parentNode._text = text;
    },
    remove() {
      if (this.parentNode) {
        this.parentNode._text = '';
        this.parentNode.caption = null;
      }
      this.parentNode = null;
    },
  });
  let inspected = 0,
    launched = 0;
  const chapters = editions.map((edition, index) =>
    presentSourceChapter(edition, {
      id: edition.descriptor.id,
      controlId: `chapter-${index}`,
      name: edition.name,
      description: edition.description,
      themeId: edition.descriptor.themeId,
      mode: edition.mode,
      levels: edition.levels,
      bytes: 1572864,
      sourceOnly: false,
      backupSupported: true,
      inspect: async () => {
        inspected++;
        return { status: 'absent' };
      },
      download,
      play: async () => {
        launched++;
      },
    }),
  );
  const panel = attachOptionalChaptersPanel({
    document: doc,
    matchMedia: () => null,
    getLibrary: () => ({ packs: [] }),
    loadCatalog: async () => ({ format: 'revealline-optional-chapters.v1', packs: [] }),
    sourceChapters: chapters,
    ...options,
  });
  context.after(() => panel.dispose());
  return {
    doc,
    panel,
    chapters,
    $: (id) => doc.getElementById(`optional-worlds-${id}`),
    get inspected() {
      return inspected;
    },
    get launched() {
      return launched;
    },
  };
}

test('all exact source editions translate through action adapters without changing content identities', (context) => {
  localeFor(context, 'uk');
  for (const edition of SOURCE_EXTERNAL_EDITIONS) {
    const bytes = JSON.stringify(edition),
      identity = dataIdentity(edition);
    const chapter = presentSourceChapter(edition, {
      name: edition.name,
      description: edition.description,
      inspect() {},
    });
    for (const field of ['name', 'description']) {
      assert.notEqual(optionalChapterText(chapter, field), edition[field]);
      assert.match(optionalChapterText(chapter, field), /[А-Яа-яІіЇїЄєҐґ]/);
    }
    const edited = structuredClone(edition);
    edited.descriptor.pack.sha256 = '0'.repeat(64);
    const custom = presentSourceChapter(edited, {
      name: edition.name,
      description: edition.description,
    });
    assert.equal(
      optionalChapterText(custom, 'name'),
      edition.name,
      'Same title with changed content keeps authored text.',
    );
    chapter.name = 'My own chapter';
    assert.equal(optionalChapterText(chapter, 'name'), chapter.name);
    assert.equal(JSON.stringify(edition), bytes);
    assert.equal(dataIdentity(edition), identity);
  }
});

test('Ukrainian-first mode filters retain canonical values and live switching preserves controls, files, focus and page', async (context) => {
  localeFor(context, 'uk');
  const h = fixture(context);
  await h.panel.open();
  const mode = h.$('mode'),
    theme = h.$('theme');
  assert.deepEqual(
    mode.children.map((option) => option.value),
    ['', 'Arcade', 'Tactical', 'Other'],
  );
  assert.equal(mode.children[1].textContent, 'Аркада');
  mode.value = 'Tactical';
  mode.onchange();
  assert.doesNotMatch(h.$('page').textContent, /chapter|Page/);
  const visible = () =>
    h
      .$('cards')
      .children.filter((card) => !card.hidden)
      .map((card) => card.id);
  assert.ok(
    visible().every((id) => h.chapters[Number(id.match(/chapter-(\d+)/)[1])].mode === 'Tactical'),
  );
  h.$('next').onclick();
  const before = visible(),
    page = h.$('page').textContent,
    inspected = h.inspected;
  const files = [{ name: 'my-authored-pack.json' }],
    input = h.$('chapter-1-pack');
  input.files = files;
  h.$('chapter-1-recovery').open = true;
  mode.focus();
  h.$('cards').scrollTop = 75;
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    assert.equal(h.$('mode'), mode);
    assert.equal(h.$('theme'), theme);
    assert.equal(mode.value, 'Tactical');
    assert.equal(h.doc.activeElement, mode);
    assert.equal(input.files, files);
    assert.equal(h.$('chapter-1-recovery').open, true);
    assert.equal(h.$('cards').scrollTop, 75);
    assert.deepEqual(visible(), before);
    assert.equal(h.inspected, inspected);
    assert.equal(h.launched, 0);
  }
  assert.equal(h.$('page').textContent, page);
  mode.value = 'Other';
  mode.onchange();
  assert.deepEqual(visible(), []);
  assert.match(h.$('page').textContent, /0 розділів/);
});

for (const attempt of ['flight', 'race']) {
  test(`${attempt}: language switching during download keeps operation authority and cancellation status live`, async (context) => {
    localeFor(context);
    let finish;
    const h = fixture(context, {
      editions: SOURCE_EXTERNAL_EDITIONS.slice(0, 1),
      panel:
        attempt === 'race'
          ? {
              attemptLabel: attempt,
              heading: localizedMessage('interface:chaptersCouchVersus'),
              backLabel: localizedMessage('interface:backToVersus'),
            }
          : {},
      download: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await h.panel.open();
    const button = h.$('chapter-0-download');
    button.focus();
    const pending = button.onclick();
    assert.equal(typeof finish, 'function');
    const inspected = h.inspected;
    assert.match(h.$('status').textContent, /Downloading and checking/);
    const focused = h.doc.activeElement;
    setLocale('uk', { persist: false });
    assert.match(h.$('status').textContent, /Завантаження й перевірка/);
    assert.doesNotMatch(
      h.$('chapter-0-recovery-note').textContent,
      /Installation|Play|Choose|This/,
    );
    assert.match(h.$('operation').textContent, /Триває обробка/);
    assert.match(button.textContent, /1,5 МіБ/);
    assert.equal(h.doc.activeElement, focused);
    assert.equal(h.inspected, inspected);
    assert.equal(h.launched, 0);
    h.$('cancel').onclick();
    assert.match(
      h.$('status').textContent,
      attempt === 'race' ? /ваш заїзд збережено/ : /ваш політ збережено/,
    );
    setLocale('en', { persist: false });
    assert.equal(
      h.$('status').textContent,
      `Cancellation requested. Completed installs remain available; your ${attempt} is kept.`,
    );
    finish();
    await pending;
    assert.equal(h.launched, 0);
    assert.match(h.$('status').textContent, /Cancellation requested/);
  });
}

test('chapter and retained-picture count messages cover Ukrainian plural categories', (context) => {
  localeFor(context, 'uk');
  for (const [count, noun] of [
    [0, 'розділів'],
    [1, 'розділ'],
    [2, 'розділи'],
    [5, 'розділів'],
    [11, 'розділів'],
    [21, 'розділ'],
    [22, 'розділи'],
    [1.5, 'розділу'],
  ]) {
    const page = t('interface:chapters.page', { count, page: 1, pages: 2 });
    assert.ok(page.endsWith(noun), page);
    const review = t('interface:chapters.pictureReview', {
      count,
      chapter: 'Розділ',
      choices: 'Моя мапа',
    });
    assert.doesNotMatch(review, /chapter|choice|picture|{{/);
    assert.match(review, /Моя мапа/);
  }
});

test('accepted file errors and frozen preparation reports remain live without changing their owners', async (context) => {
  localeFor(context);
  const report = Object.freeze({
    message: 'Opening this flight’s original picture…',
    messageKey: 'interface:openingThisFlightSAuthoredPicture',
    stage: 'preparing',
    progress: null,
  });
  let finish;
  const h = fixture(context, {
    editions: SOURCE_EXTERNAL_EDITIONS.slice(0, 1),
    download: ({ onStatus }) => {
      onStatus(report);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  await h.panel.open();
  await h.$('chapter-0-install').onclick();
  assert.match(h.$('status').textContent, /Choose both exact chapter files/);
  setLocale('uk', { persist: false });
  assert.doesNotMatch(h.$('status').textContent, /Choose both|Completed installs|Use Play/);
  setLocale('en', { persist: false });
  const pending = h.$('chapter-0-download').onclick();
  assert.equal(typeof finish, 'function');
  assert.equal(h.$('status').textContent, t(report.messageKey));
  setLocale('uk', { persist: false });
  assert.equal(h.$('status').textContent, t(report.messageKey));
  assert.equal(report.message, 'Opening this flight’s original picture…');
  h.$('cancel').onclick();
  finish();
  await pending;
  assert.equal(h.launched, 0);
});
