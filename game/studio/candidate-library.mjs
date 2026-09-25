import { localizedText, t } from '../i18n/index.mjs';

// Presentation-only discovery. Existing static controls retain their source handlers.
const normalize = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Index semantic labels in both supported languages, independent of the startup
// locale. Switching language must not discard a query or reconstruct controls.
function translatedSearchText(node) {
  const attributes = ['data-i18n', 'data-i18n-rich', 'data-i18n-aria-label'];
  return [node, ...node.querySelectorAll(attributes.map((name) => `[${name}]`).join(', '))]
    .flatMap((element) => attributes.map((name) => element.getAttribute(name)).filter(Boolean))
    .flatMap((key) =>
      ['en', 'uk'].map((lng) => t(key, { lng }).replace(/\[\[[a-zA-Z0-9]+\]\]/g, ' ')),
    )
    .join(' ');
}

export function createCandidateLibrary({ document }) {
  const $ = (id) => document.getElementById(id);
  const library = $('candidate-library');
  const groups = [...library.querySelectorAll('[data-library-group]')].map((group) => ({
    node: group,
    category: group.dataset.libraryGroup,
    entries: [...group.querySelectorAll('[data-library-entry]')].map((node) => ({
      node,
      text: normalize(
        [
          node.textContent,
          translatedSearchText(node),
          node.dataset.libraryKeywords ?? '',
          ...[...node.querySelectorAll('[id]')].map((control) => control.id),
          ...[...node.querySelectorAll('a')].map((link) => link.getAttribute('href')),
        ].join(' '),
      ),
    })),
  }));
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  function filter() {
    const words = normalize($('candidate-search').value.slice(0, 160))
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const category = $('candidate-category').value || 'all';
    let count = 0;
    for (const group of groups) {
      let visible = 0;
      for (const entry of group.entries) {
        entry.node.hidden = !(
          (category === 'all' || category === group.category) &&
          words.every((word) => entry.text.includes(word))
        );
        if (!entry.node.hidden) visible++;
      }
      group.node.hidden = visible === 0;
      count += visible;
    }
    localizedText($('candidate-count'), () => t('tools:studio.library.matches', { count, total }));
    $('candidate-empty').hidden = count !== 0;
  }
  $('candidate-search').addEventListener('input', filter);
  $('candidate-category').addEventListener('change', filter);
  $('candidate-reset').addEventListener('click', () => {
    $('candidate-search').value = '';
    $('candidate-category').value = 'all';
    filter();
    $('candidate-search').focus();
  });
  $('candidate-review').addEventListener('click', (event) => {
    event.preventDefault();
    library.open = false;
    $('source').focus();
  });
  filter();
  return {
    reportInspection(message) {
      localizedText($('candidate-inspection-status'), message);
      $('candidate-inspection').hidden = false;
    },
    clearInspection() {
      $('candidate-inspection').hidden = true;
      localizedText($('candidate-inspection-status'), '');
    },
  };
}
