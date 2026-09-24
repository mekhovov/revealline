import { createCreatorStore } from '../creator/installed.mjs';
import { createCommunityClient } from './client.mjs';
import { createCommunityDownloadStore } from './download-store.mjs';
import { createCommunityLibrary } from './library.mjs';
import { createCommunityPublisher } from './publisher.mjs';
import { createCommunityStateStore } from './state.mjs';

const $ = (id) => document.getElementById(id);
const status = (message, error = false) => {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
};
const auth = globalThis.RevealLineCommunityAuth;
const client = createCommunityClient({
  baseURL: document.documentElement.dataset.communityApi,
  authHeaders: auth?.headers,
  resumableUpload: auth?.uploadResumable,
});
const creatorStore = createCreatorStore();
const library = createCommunityLibrary({
  client,
  creatorStore,
  stateStore: createCommunityStateStore(),
  downloadStore: createCommunityDownloadStore(),
});
const publisher = createCommunityPublisher({ client });
let rows = [];
let nextCursor = null;
let submissionId = null;
let submissionTimer = null;
const previewURLs = new Set();

const text = (tag, value, className) => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};
const action = (label, run, className = '') => {
  const button = text('button', label, className);
  button.type = 'button';
  button.onclick = async () => {
    button.disabled = true;
    try {
      await run();
    } catch (error) {
      status(error.message, true);
    } finally {
      button.disabled = false;
    }
  };
  return button;
};
function render() {
  for (const url of previewURLs) URL.revokeObjectURL(url);
  previewURLs.clear();
  $('catalog').replaceChildren();
  if (!rows.length) $('catalog').append(text('p', 'No campaigns match these filters.', 'muted'));
  for (const edition of rows) {
    const card = document.createElement('article');
    card.className = 'edition';
    card.append(text('h2', edition.title));
    card.append(text('p', edition.description || 'No creator description.'));
    const flags = document.createElement('p');
    if (edition.installed) flags.append(text('span', 'Installed', 'badge'));
    if (edition.packageRetained) flags.append(text('span', 'Offline copy', 'badge'));
    if (edition.updateAvailable) flags.append(text('span', 'Update available', 'badge'));
    card.append(flags);
    const preview = document.createElement('figure');
    preview.className = 'preview';
    if (edition.previewAvailable)
      preview.append(
        action(
          'Load preview',
          async () => {
            const blob = await library.preview(edition);
            const url = URL.createObjectURL(blob);
            previewURLs.add(url);
            const image = document.createElement('img');
            image.src = url;
            image.alt = `${edition.title} catalog preview`;
            preview.replaceChildren(image);
          },
          'secondary',
        ),
      );
    card.append(preview);
    card.append(
      text(
        'p',
        `Version ${edition.version} · ${(edition.packageSize / 1024 / 1024).toFixed(1)} MiB · published ${new Date(edition.publishedAt).toLocaleDateString()}`,
        'meta',
      ),
    );
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (edition.installed) {
      const play = text('a', 'Play offline');
      play.href = edition.playHref;
      actions.append(play);
      if (edition.packageRetained)
        actions.append(
          action(
            'Remove recovery download',
            async () => {
              const review = await library.reviewDownloadRemoval(edition);
              await library.removeDownload(edition, review);
              status(
                'Recovery download removed. Installed play, saves and earned pictures remain.',
              );
              await refresh({ reset: true });
            },
            'secondary',
          ),
        );
      else
        actions.append(
          action(
            'Keep recovery download',
            async () => {
              await library.retainFromInstalled(edition);
              status('Exact recovery package retained for offline reinstall.');
              await refresh({ reset: true });
            },
            'secondary',
          ),
        );
    } else
      actions.append(
        action(edition.updateAvailable ? 'Download update' : 'Download and install', async () => {
          status(`Downloading ${edition.title}…`);
          await library.install(edition, { offline: false });
          status(`${edition.title} installed. It can now play offline.`);
          await refresh({ reset: true });
        }),
      );
    const reportReason = document.createElement('select');
    reportReason.setAttribute('aria-label', `Report reason for ${edition.title}`);
    for (const [value, label] of [
      ['broken', 'Broken content'],
      ['copyright', 'Copyright concern'],
      ['unsafe', 'Unsafe content'],
      ['misleading', 'Misleading listing'],
      ['other', 'Other concern'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      reportReason.append(option);
    }
    actions.append(
      reportReason,
      action(
        'Report',
        async () => {
          await library.report(edition.editionId, {
            reason: reportReason.value,
          });
          status('Report received for moderator review.');
        },
        'secondary',
      ),
    );
    card.append(actions);
    $('catalog').append(card);
  }
}
async function refresh({ reset = true } = {}) {
  try {
    if (reset) nextCursor = null;
    const result = await library.catalog({
      query: $('search').value,
      installed: $('filter').value,
      cursor: reset ? null : nextCursor,
    });
    rows = reset
      ? [...result.editions]
      : [
          ...rows,
          ...result.editions.filter(
            (candidate) => !rows.some((row) => row.editionId === candidate.editionId),
          ),
        ];
    nextCursor = result.nextCursor;
    $('more').hidden = !nextCursor;
    render();
    status(`${rows.length} community edition${rows.length === 1 ? '' : 's'} shown.`);
  } catch (error) {
    status(
      `Community catalog unavailable: ${error.message} Installed campaigns still play from My creations.`,
      true,
    );
  }
}
$('refresh').onclick = refresh;
$('more').onclick = () => refresh({ reset: false });
$('search').oninput = () => refresh({ reset: true });
$('filter').onchange = () => refresh({ reset: true });
$('publish-file').onchange = async () => {
  try {
    const file = $('publish-file').files[0];
    if (!file) return;
    const selected = await publisher.select(file);
    $('publish-title').value = selected.suggestedTitle;
    $('publish-slug').value = selected.suggestedSlug;
    $('publish').disabled = !auth?.headers;
    $('publish-status').textContent = auth?.headers
      ? 'Approved package verified locally. Ready to upload.'
      : 'Approved package verified. Configure a creator account to upload it.';
  } catch (error) {
    $('publish').disabled = true;
    $('publish-status').textContent = error.message;
  }
};
$('publish').onclick = async () => {
  $('publish').disabled = true;
  try {
    const result = await publisher.publish({
      title: $('publish-title').value,
      slug: $('publish-slug').value,
      version: $('publish-version').value,
      description: $('publish-description').value,
      onProgress: ({ uploaded, total }) => {
        $('publish-status').textContent = `Uploaded ${Math.round((uploaded / total) * 100)}%.`;
      },
    });
    submissionId = result.id;
    $('publish-status').textContent =
      `Submission ${result.status}. Automatic validation decides when it becomes public.`;
    if (['queued', 'validating'].includes(result.status)) scheduleSubmissionCheck();
  } catch (error) {
    $('publish-status').textContent = error.message;
  } finally {
    $('publish').disabled = !publisher.current() || !auth?.headers;
  }
};
async function checkSubmission() {
  if (!submissionId) return;
  try {
    const current = await publisher.status(submissionId);
    $('publish-status').textContent =
      current.status === 'published'
        ? 'Published. The immutable edition is now in the public catalog.'
        : current.status === 'rejected'
          ? `Rejected${current.rejectionCode ? `: ${current.rejectionCode}` : '.'}`
          : `Submission ${current.status}. Validation is still running.`;
    $('publish-unlist').hidden = current.status !== 'published';
    if (['queued', 'validating'].includes(current.status)) scheduleSubmissionCheck();
  } catch (error) {
    $('publish-status').textContent = `Could not refresh submission status: ${error.message}`;
  }
}
$('publish-unlist').onclick = async () => {
  $('publish-unlist').disabled = true;
  try {
    const current = await publisher.unlist();
    $('publish-status').textContent =
      `Edition ${current.status}. Existing installed copies remain playable.`;
    $('publish-unlist').hidden = true;
  } catch (error) {
    $('publish-status').textContent = error.message;
  } finally {
    $('publish-unlist').disabled = false;
  }
};
function scheduleSubmissionCheck() {
  clearTimeout(submissionTimer);
  submissionTimer = setTimeout(checkSubmission, 5_000);
}
window.addEventListener('pagehide', () => {
  clearTimeout(submissionTimer);
  for (const url of previewURLs) URL.revokeObjectURL(url);
  creatorStore.close();
});
void refresh();
