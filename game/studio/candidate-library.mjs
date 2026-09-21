// Presentation-only discovery. Existing static controls retain their source handlers.
const normalize = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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
    $('candidate-count').textContent =
      `${count} of ${total} entries shown. Some entries share edition controls.`;
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
      $('candidate-inspection-status').textContent = message;
      $('candidate-inspection').hidden = false;
    },
    clearInspection() {
      $('candidate-inspection').hidden = true;
      $('candidate-inspection-status').textContent = '';
    },
  };
}
