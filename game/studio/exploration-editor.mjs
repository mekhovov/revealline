import { boundedJSON, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { validateExplorationPayload } from '../rewards/exploration.mjs';
import { validateCompletionRewards } from '../rewards/model.mjs';
import { editDiscoveryExploration } from '../content-design/discovery.mjs';
import { mountLocalExplorationPreview } from './exploration-image-preview.mjs';
import { createExplorationDiagramEditor } from './exploration-diagram-editor.mjs';
import { createExplorationExample } from './exploration-example.mjs';
import { createExplorationGuidedEditor } from './exploration-guided-editor.mjs';

/** Reusable authoring panel for Level/Campaign Studio and Company Studio.
 * Edits are explicit drafts; shared viewer previews never receive a store. */
export function createExplorationEditor({
  container,
  getSource,
  getRewards,
  apply,
  getLocale = () => 'en',
  window = globalThis.window,
}) {
  const document = container.ownerDocument,
    tr = (key) => t(`tools:studio.exploration.${key}`),
    element = (tag, text) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      return node;
    },
    root = element('fieldset'),
    select = element('select'),
    editor = element('textarea'),
    status = element('p'),
    preview = element('div');
  root.setAttribute('data-exploration-editor', 'true');
  root.append(element('legend', tr('title')));
  const label = element('label', tr('reward'));
  select.setAttribute('data-exploration-field', 'reward');
  label.append(select);
  const codeLabel = element('label', tr('recipe'));
  editor.rows = 18;
  editor.spellcheck = false;
  editor.style.width = '100%';
  editor.setAttribute('data-exploration-field', 'json');
  codeLabel.append(editor);
  root.append(element('p', tr('help')), label, codeLabel);
  let viewer = null,
    disposed = false,
    busy = false;
  const stopPreview = () => {
    viewer?.dispose();
    viewer = null;
    preview.replaceChildren();
  };
  const controls = [];
  const button = (action, handler) => {
    const node = element('button', tr(action));
    node.type = 'button';
    node.setAttribute('data-exploration-action', action);
    node.onclick = async () => {
      if (busy || disposed) return;
      busy = true;
      try {
        await handler();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
      }
    };
    root.append(node);
    controls.push(node);
    return node;
  };
  const read = () =>
    validateExplorationPayload(
      boundedJSON(editor.value, {
        maxBytes: 52 * 1024,
        maxNodes: 2300,
        maxDepth: 13,
        maxArray: 12,
        maxString: 2048,
      }),
    );
  const diagram = createExplorationDiagramEditor({
    container: root,
    getDraft: read,
    setDraft(value) {
      stopPreview();
      editor.value = JSON.stringify(value, null, 2);
      guided.sync();
    },
    getLocale,
  });
  const guided = createExplorationGuidedEditor({
    container: root,
    getDraft: read,
    setDraft(value) {
      stopPreview();
      editor.value = JSON.stringify(value, null, 2);
      diagram.sync();
    },
    getLocale,
  });
  editor.onchange = () => {
    diagram.sync();
    guided.sync();
  };
  function load() {
    stopPreview();
    const reward = getRewards().find((item) => item.id === select.value),
      payload = reward?.payloads.find((item) => item.type === 'exploration');
    editor.value = payload ? JSON.stringify(payload, null, 2) : '';
    diagram.sync();
    guided.sync();
    status.textContent = tr(payload ? 'loaded' : 'start');
  }
  button('load', load);
  button('example', () => {
    stopPreview();
    editor.value = JSON.stringify(createExplorationExample(), null, 2);
    diagram.sync();
    guided.sync();
    status.textContent = tr('exampleReady');
  });
  button('preview', () => {
    stopPreview();
    viewer = mountLocalExplorationPreview({
      container: preview,
      payload: read(),
      locale: getLocale(),
      window,
    });
    status.textContent = tr('previewOnly');
  });
  button('apply', async () => {
    required(select.value, 'Choose an existing reward with explicit requirements.');
    const candidate = editDiscoveryExploration(getSource(), getRewards(), select.value, read());
    if ((await apply(candidate)) === false) return;
    sync();
    status.textContent = tr('applied');
  });
  button('export', () => {
    const definitions = validateCompletionRewards(getRewards());
    required(definitions.length, 'Import or author a reward sidecar first.');
    const url = window.URL.createObjectURL(
        new Blob([JSON.stringify(definitions, null, 2)], { type: 'application/json' }),
      ),
      anchor = element('a');
    anchor.href = url;
    anchor.download = 'completion-rewards.json';
    anchor.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    status.textContent = tr('exported');
  });
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  select.onchange = load;
  function sync() {
    if (disposed) return;
    const previous = select.value,
      definitions = getRewards();
    select.replaceChildren(
      ...definitions.map((reward) => {
        const option = element('option', reward.locales[getLocale()].title);
        option.value = reward.id;
        return option;
      }),
    );
    select.value = definitions.some((reward) => reward.id === previous)
      ? previous
      : (definitions[0]?.id ?? '');
    load();
  }
  return {
    sync,
    // Stop transient playback without rebuilding or removing draft controls.
    suspend: stopPreview,
    dispose() {
      disposed = true;
      stopPreview();
      diagram.dispose();
      guided.dispose();
      select.onchange = null;
      editor.onchange = null;
      controls.forEach((node) => {
        node.onclick = null;
      });
      root.remove();
    },
  };
}
