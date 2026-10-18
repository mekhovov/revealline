import { t, localizedText } from '../i18n/index.mjs';

const copy = (key, values) => t(`interface:backupApply.${key}`, values);
const complete = (step) => ['saved', 'skipped'].includes(step.state);

/** Session-only receipt of actual owner outcomes, never download activations.
 * A failed/uncertain step needs another review or an explicit keep-current choice. */
export function attachBackupArchiveApply({ document: doc, root, execute, current, busy }) {
  const steps = [];
  let working = false;
  const node = (tag, id, text) => {
    const element = doc.createElement(tag);
    element.id = `backup-apply-${id}`;
    if (text) localizedText(element, text);
    return element;
  };
  const summary = node('p', 'summary');
  summary.setAttribute('role', 'status');
  summary.tabIndex = -1;
  root.append(
    node('p', 'help', () => copy('help')),
    summary,
  );
  function update() {
    const done = steps.filter((step) => step.state === 'saved').length,
      skipped = steps.filter((step) => step.state === 'skipped').length;
    localizedText(summary, () =>
      copy(done === steps.length ? 'complete' : 'progress', { done, total: steps.length, skipped }),
    );
    for (const [index, step] of steps.entries()) {
      const allowed = !working && steps.slice(0, index).every(complete);
      step.review.disabled = !allowed || step.state === 'saved';
      step.keep.disabled = !allowed || complete(step);
      localizedText(step.review, () => copy(step.state === 'pending' ? 'review' : 'reviewAgain'));
      localizedText(step.status, () =>
        [copy(`state.${step.state}`), step.notice ? copy(`notice.${step.notice}`) : '', step.error]
          .filter(Boolean)
          .join(' '),
      );
    }
  }
  return {
    add(file, row) {
      const step = {
        state: 'pending',
        review: node('button', `review-${file.id}`),
        keep: node('button', `keep-${file.id}`, () => copy('keep')),
        status: node('p', `status-${file.id}`),
      };
      step.review.type = step.keep.type = 'button';
      step.review.className = step.keep.className = 'button secondary';
      step.status.setAttribute('role', 'status');
      step.review.setAttribute('aria-describedby', step.status.id);
      step.keep.setAttribute('aria-describedby', step.status.id);
      steps.push(step);
      row.append(step.status, step.review, step.keep);
      step.review.onclick = async () => {
        if (!current() || busy() || step.review.disabled) return false;
        working = true;
        step.state = 'reviewing';
        step.error = step.notice = '';
        try {
          // Lend focus to the Library operation before disabling its opener.
          const pending = execute(file, { isCurrent: current });
          update();
          const result = await pending;
          // The executor reports commit completion even after Stop waiting. A
          // removed view cannot overwrite a new archive's outcomes or focus.
          Object.assign(step, result ?? { state: 'cancelled' });
          return step.state === 'saved';
        } catch (error) {
          step.state = 'unconfirmed';
          step.error = error.message;
          return false;
        } finally {
          working = false;
          if (current()) {
            const ownedFocus = doc.activeElement === step.review;
            update();
            if (ownedFocus && step.state === 'saved')
              (steps.find((item) => !item.review.disabled)?.review ?? summary).focus({
                preventScroll: true,
              });
          }
        }
      };
      step.keep.onclick = () => {
        if (!current() || busy() || step.keep.disabled) return false;
        step.state = 'skipped';
        step.error = step.notice = '';
        const ownedFocus = doc.activeElement === step.keep;
        update();
        if (ownedFocus)
          (steps.find((item) => item !== step && !item.review.disabled)?.review ?? summary).focus({
            preventScroll: true,
          });
        return true;
      };
      update();
    },
  };
}
