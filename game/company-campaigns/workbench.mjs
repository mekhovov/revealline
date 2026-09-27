import {
  createLearningAttempt,
  reduceLearningAttempt,
  validateCompanyLesson,
  verifyLearningAttempt,
} from './learning.mjs';

let sequence = 0;

/** Host opens this only at a safe, paused boundary. No core state is changed. */
export function mountCompanyWorkbench(
  container,
  {
    lesson: input,
    attempt: initial,
    onChange = () => {},
    onClose = () => {},
    anchor = null,
    evidence = null,
  },
) {
  const lesson = validateCompanyLesson(input);
  const checked = verifyLearningAttempt(lesson, initial ?? createLearningAttempt(lesson));
  if (!checked.valid) throw new TypeError(checked.reason);
  const document = container.ownerDocument;
  const prefix = `company-workbench-${++sequence}`;
  let attempt = checked.attempt;
  let active = true;
  let root;
  const pinned = attempt.simulationIdentity !== null;
  const currentEvidence = () => (typeof evidence === 'function' ? evidence() : evidence);
  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const button = (label, control, handler) => {
    const node = element('button', 'company-workbench-button', label);
    node.type = 'button';
    node.setAttribute('data-control', control);
    node.addEventListener('click', handler);
    return node;
  };
  function apply(action) {
    if (!active) return;
    const facts = pinned ? currentEvidence() : null;
    if (
      pinned &&
      (!facts?.boundary ||
        (action.type === 'inspect' && !facts.availableRecordIds.includes(action.recordId)))
    )
      return;
    const boundary = pinned ? facts.boundary : typeof anchor === 'function' ? anchor() : anchor;
    attempt = reduceLearningAttempt(lesson, attempt, { ...action, anchor: boundary });
    render();
    if (action.type === 'commit') root.querySelector('[data-feedback]')?.focus();
    onChange(attempt);
  }
  function render() {
    const facts = pinned ? currentEvidence() : null;
    const safe = !pinned || !!facts?.boundary;
    const focused = root?.contains(document.activeElement)
      ? document.activeElement?.dataset?.control
      : null;
    root = element('section', 'company-workbench');
    root.dataset.lessonId = lesson.id;
    root.setAttribute('aria-labelledby', `${prefix}-title`);
    const title = element('h2', 'company-workbench-title', lesson.title);
    title.id = `${prefix}-title`;
    root.append(
      title,
      element(
        'p',
        'company-workbench-role',
        `${lesson.role} · ${lesson.kind === 'reflection' ? 'Reflection' : 'Local practice'}`,
      ),
      element('p', 'company-workbench-brief', lesson.brief),
      element('p', 'company-workbench-notice', lesson.notice),
    );
    const evidenceSection = element('section', 'company-workbench-evidence');
    evidenceSection.append(element('h3', null, '1. Inspect the evidence'));
    if (pinned)
      evidenceSection.append(
        element(
          'p',
          'company-workbench-evidence-status',
          safe
            ? `${facts.availableRecordIds.length} of ${lesson.records.length} records recovered. Finish a line on safe ground or connect a marked objective to recover the next record. Winning recovers the rest.`
            : 'Return to safe ground before working on the handoff.',
        ),
      );
    for (const record of lesson.records) {
      const card = element('article', 'company-workbench-record');
      const available = !pinned || facts?.availableRecordIds.includes(record.id);
      const inspected = attempt.inspected.includes(record.id);
      const inspect = button(
        !available
          ? `${record.title} — recover on the board`
          : inspected
            ? `${record.title} — inspected`
            : `Inspect ${record.title}`,
        `inspect-${record.id}`,
        () => {
          if (!inspected) apply({ type: 'inspect', recordId: record.id });
        },
      );
      inspect.disabled = attempt.status === 'complete' || !available || !safe;
      inspect.setAttribute('aria-expanded', String(inspected && available));
      card.append(inspect);
      if (inspected && available)
        for (const line of record.lines) card.append(element('p', null, line));
      evidenceSection.append(card);
    }
    root.append(evidenceSection);
    const configure = element('fieldset', 'company-workbench-configuration');
    configure.append(element('legend', null, '2. Configure the handoff'));
    configure.disabled = attempt.status === 'complete' || !safe;
    for (const field of lesson.fields) {
      const row = element('div', 'company-workbench-field');
      const label = element('label', null, field.label);
      label.htmlFor = `${prefix}-${field.id}`;
      const select = element('select', 'company-workbench-select');
      select.required = true;
      select.id = label.htmlFor;
      select.setAttribute('data-control', `field-${field.id}`);
      const placeholder = element('option', null, 'Choose an action');
      placeholder.value = '';
      placeholder.disabled = true;
      select.append(placeholder);
      for (const option of field.options) {
        const item = element('option', null, option.label);
        item.value = option.value;
        select.append(item);
      }
      select.value = attempt.configuration[field.id] ?? '';
      select.addEventListener('change', () =>
        apply({ type: 'configure', fieldId: field.id, value: select.value }),
      );
      row.append(label, select);
      configure.append(row);
    }
    root.append(configure);
    const feedback = element('div', 'company-workbench-feedback');
    feedback.setAttribute('data-feedback', '');
    feedback.setAttribute('tabindex', '-1');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    for (const line of attempt.feedback) feedback.append(element('p', null, line));
    root.append(feedback);
    const controls = element('div', 'company-workbench-controls');
    const commit = button(
      attempt.status === 'complete' ? 'Practice complete' : '3. Commit local handoff',
      'commit',
      () => apply({ type: 'commit' }),
    );
    if (attempt.status === 'complete' && lesson.kind === 'reflection')
      commit.textContent = 'Reflection saved';
    commit.disabled = attempt.status === 'complete' || !safe;
    controls.append(
      commit,
      button('Return to journey', 'close', () => {
        if (active) onClose(attempt);
      }),
    );
    root.append(controls);
    const references = element('details', 'company-workbench-sources');
    references.append(
      element('summary', null, `Source notes · reviewed ${lesson.sourceReviewedAt}`),
      element(
        'p',
        null,
        'A frozen illustrative exercise, not a replica of a live customer configuration.',
      ),
    );
    for (const source of lesson.sources) {
      const row = element('p');
      const link = element('a', null, source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.append(link);
      references.append(row);
    }
    root.append(references);
    container.replaceChildren(root);
    if (focused) {
      const control = root.querySelector(`[data-control="${focused}"]`);
      if (!control?.disabled) control?.focus();
      else root.querySelector('[data-control="close"]')?.focus();
    }
  }
  render();
  return Object.freeze({
    getAttempt: () => attempt,
    destroy() {
      active = false;
      root.remove();
    },
  });
}
