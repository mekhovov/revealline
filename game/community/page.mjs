import { createCreatorStore } from '../creator/installed.mjs';
import { createCommunityAccountClient } from './account.mjs';
import { createCommunityClient } from './client.mjs';
import { createCommunityDownloadStore } from './download-store.mjs';
import { createCommunityLibrary } from './library.mjs';
import { createCommunityPublisher } from './publisher.mjs';
import { createCommunityStateStore } from './state.mjs';
import { createTusBrowserUpload } from './tus-upload.mjs';
import {
  formatDate,
  formatNumber,
  localizedAttribute,
  localizedMessage,
  localizedText,
  t,
} from '../i18n/index.mjs';

const $ = (id) => document.getElementById(id);
const status = (message, error = false) => {
  localizedText($('status'), message);
  $('status').classList.toggle('error', error);
};
const apiBase = document.documentElement.dataset.communityApi;
const injectedAuth = globalThis.RevealLineCommunityAuth;
const account = injectedAuth ? null : createCommunityAccountClient({ baseURL: apiBase });
const auth = injectedAuth ?? {
  headers: account.headers,
  uploadResumable: createTusBrowserUpload({ baseURL: apiBase }),
};
const client = createCommunityClient({
  baseURL: apiBase,
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
let accountSession = injectedAuth ? { user: {}, configured: true } : null;
const accountParameters = new URL(globalThis.location.href).searchParams;
const passwordResetToken = accountParameters.get('token');
const previewURLs = new Set();
const canPublish = () => Boolean(accountSession && auth?.headers);
const renderAccount = () => {
  $('account-signed-out').hidden = Boolean(accountSession);
  $('account-signed-in').hidden = !accountSession;
  if (accountSession)
    localizedText($('account-identity'), () =>
      accountSession.configured
        ? t('interface:community.configuredCreator')
        : t('interface:community.signedInAs', {
            identity: accountSession.user.name || accountSession.user.email,
          }),
    );
  $('publish').disabled = !publisher.current() || !canPublish();
};
const setAccountStatus = (message, error = false) => {
  localizedText($('account-status'), message);
  $('account-status').classList.toggle('error', error);
};
const clearAccountAction = () => {
  const url = new URL(globalThis.location.href);
  url.searchParams.delete('account');
  url.searchParams.delete('token');
  url.searchParams.delete('error');
  globalThis.history.replaceState(null, '', url);
};
const renderAccountAction = () => {
  if (accountParameters.get('account') === 'reset' && passwordResetToken) {
    $('account-reset').hidden = false;
    setAccountStatus(localizedMessage('interface:community.enterNewPassword'));
    return true;
  }
  if (accountParameters.get('account') === 'verified') {
    setAccountStatus(localizedMessage('interface:community.emailVerified'));
    clearAccountAction();
    return true;
  }
  if (accountParameters.get('error')) {
    setAccountStatus(localizedMessage('interface:community.accountLinkInvalid'), true);
    clearAccountAction();
    return true;
  }
  return false;
};

const text = (tag, value, className) => {
  const node = document.createElement(tag);
  localizedText(node, value);
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
  if (!rows.length)
    $('catalog').append(
      text('p', localizedMessage('interface:community.noCampaignsMatch'), 'muted'),
    );
  for (const edition of rows) {
    const card = document.createElement('article');
    card.className = 'edition';
    card.append(text('h2', edition.title));
    card.append(
      text(
        'p',
        edition.description || localizedMessage('interface:community.noCreatorDescription'),
      ),
    );
    const flags = document.createElement('p');
    if (edition.installed)
      flags.append(text('span', localizedMessage('common:status.installed'), 'badge'));
    if (edition.packageRetained)
      flags.append(text('span', localizedMessage('interface:community.offlineCopy'), 'badge'));
    if (edition.updateAvailable)
      flags.append(text('span', localizedMessage('interface:community.updateAvailable'), 'badge'));
    card.append(flags);
    const preview = document.createElement('figure');
    preview.className = 'preview';
    if (edition.previewAvailable)
      preview.append(
        action(
          localizedMessage('interface:community.loadPreview'),
          async () => {
            const blob = await library.preview(edition);
            const url = URL.createObjectURL(blob);
            previewURLs.add(url);
            const image = document.createElement('img');
            image.src = url;
            localizedAttribute(
              image,
              'alt',
              localizedMessage('interface:community.catalogPreview', { title: edition.title }),
            );
            preview.replaceChildren(image);
          },
          'secondary',
        ),
      );
    card.append(preview);
    card.append(
      text(
        'p',
        () =>
          t('interface:community.editionMetadata', {
            version: edition.version,
            size: formatNumber(edition.packageSize / 1024 / 1024, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            date: formatDate(new Date(edition.publishedAt)),
          }),
        'meta',
      ),
    );
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (edition.installed) {
      const play = text('a', localizedMessage('interface:community.playOffline'));
      play.href = edition.playHref;
      actions.append(play);
      if (edition.packageRetained)
        actions.append(
          action(
            localizedMessage('interface:community.removeRecoveryDownload'),
            async () => {
              const review = await library.reviewDownloadRemoval(edition);
              await library.removeDownload(edition, review);
              status(localizedMessage('interface:community.recoveryDownloadRemoved'));
              await refresh({ reset: true });
            },
            'secondary',
          ),
        );
      else
        actions.append(
          action(
            localizedMessage('interface:community.keepRecoveryDownload'),
            async () => {
              await library.retainFromInstalled(edition);
              status(localizedMessage('interface:community.recoveryPackageRetained'));
              await refresh({ reset: true });
            },
            'secondary',
          ),
        );
    } else
      actions.append(
        action(
          localizedMessage(
            edition.updateAvailable
              ? 'interface:community.downloadUpdate'
              : 'interface:community.downloadAndInstall',
          ),
          async () => {
            status(localizedMessage('interface:community.downloading', { title: edition.title }));
            await library.install(edition, { offline: false });
            status(
              localizedMessage('interface:community.installedOffline', { title: edition.title }),
            );
            await refresh({ reset: true });
          },
        ),
      );
    const reportReason = document.createElement('select');
    localizedAttribute(
      reportReason,
      'aria-label',
      localizedMessage('interface:community.reportReasonFor', { title: edition.title }),
    );
    for (const [value, key] of [
      ['broken', 'brokenContent'],
      ['copyright', 'copyrightConcern'],
      ['unsafe', 'unsafeContent'],
      ['misleading', 'misleadingListing'],
      ['other', 'otherConcern'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      localizedText(option, localizedMessage(`interface:community.${key}`));
      reportReason.append(option);
    }
    actions.append(
      reportReason,
      action(
        localizedMessage('interface:community.report'),
        async () => {
          await library.report(edition.editionId, {
            reason: reportReason.value,
          });
          status(localizedMessage('interface:community.reportReceived'));
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
    status(localizedMessage('interface:community.editionsShown', { count: rows.length }));
  } catch (error) {
    status(
      localizedMessage('interface:community.catalogUnavailable', { error: error.message }),
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
    $('publish').disabled = !canPublish();
    localizedText(
      $('publish-status'),
      localizedMessage(
        canPublish()
          ? 'interface:community.packageReadyToUpload'
          : 'interface:community.packageNeedsSignIn',
      ),
    );
  } catch (error) {
    $('publish').disabled = true;
    localizedText($('publish-status'), error.message);
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
        localizedText(
          $('publish-status'),
          localizedMessage('interface:community.uploadedPercent', {
            percent: formatNumber(Math.round((uploaded / total) * 100)),
          }),
        );
      },
    });
    submissionId = result.id;
    localizedText(
      $('publish-status'),
      localizedMessage('interface:community.submissionStatus', { status: result.status }),
    );
    if (['queued', 'validating'].includes(result.status)) scheduleSubmissionCheck();
  } catch (error) {
    localizedText($('publish-status'), error.message);
  } finally {
    $('publish').disabled = !publisher.current() || !canPublish();
  }
};
async function checkSubmission() {
  if (!submissionId) return;
  try {
    const current = await publisher.status(submissionId);
    localizedText(
      $('publish-status'),
      localizedMessage(
        current.status === 'published'
          ? 'interface:community.published'
          : current.status === 'rejected'
            ? current.rejectionCode
              ? 'interface:community.rejectedWithCode'
              : 'interface:community.rejected'
            : 'interface:community.validationRunning',
        { code: current.rejectionCode, status: current.status },
      ),
    );
    $('publish-unlist').hidden = current.status !== 'published';
    if (['queued', 'validating'].includes(current.status)) scheduleSubmissionCheck();
  } catch (error) {
    localizedText(
      $('publish-status'),
      localizedMessage('interface:community.submissionRefreshFailed', { error: error.message }),
    );
  }
}
$('publish-unlist').onclick = async () => {
  $('publish-unlist').disabled = true;
  try {
    const current = await publisher.unlist();
    localizedText(
      $('publish-status'),
      localizedMessage('interface:community.editionStatus', { status: current.status }),
    );
    $('publish-unlist').hidden = true;
  } catch (error) {
    localizedText($('publish-status'), error.message);
  } finally {
    $('publish-unlist').disabled = false;
  }
};
function scheduleSubmissionCheck() {
  clearTimeout(submissionTimer);
  submissionTimer = setTimeout(checkSubmission, 5_000);
}
$('account-sign-up').onclick = async () => {
  if (!account) return;
  $('account-sign-up').disabled = true;
  try {
    accountSession = await account.signUp({
      name: $('account-name').value,
      email: $('account-email').value,
      password: $('account-password').value,
    });
    $('account-password').value = '';
    setAccountStatus(localizedMessage('interface:community.accountCreatedVerify'));
    renderAccount();
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    $('account-sign-up').disabled = false;
  }
};
$('account-verify').onclick = async () => {
  if (!account) return;
  $('account-verify').disabled = true;
  try {
    await account.requestEmailVerification({ email: $('account-email').value });
    setAccountStatus(localizedMessage('interface:community.verificationSent'));
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    $('account-verify').disabled = false;
  }
};
$('account-forgot').onclick = async () => {
  if (!account) return;
  $('account-forgot').disabled = true;
  try {
    await account.requestPasswordReset({ email: $('account-email').value });
    setAccountStatus(localizedMessage('interface:community.passwordResetSent'));
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    $('account-forgot').disabled = false;
  }
};
$('account-reset').onclick = async () => {
  if (!account || !passwordResetToken) return;
  $('account-reset').disabled = true;
  try {
    await account.resetPassword({
      token: passwordResetToken,
      newPassword: $('account-password').value,
    });
    $('account-password').value = '';
    clearAccountAction();
    $('account-reset').hidden = true;
    setAccountStatus(localizedMessage('interface:community.passwordChanged'));
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    $('account-reset').disabled = false;
  }
};
$('account-sign-in').onclick = async () => {
  if (!account) return;
  $('account-sign-in').disabled = true;
  try {
    accountSession = await account.signIn({
      email: $('account-email').value,
      password: $('account-password').value,
    });
    $('account-password').value = '';
    setAccountStatus(localizedMessage('interface:community.signedInPublishingAvailable'));
    renderAccount();
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    $('account-sign-in').disabled = false;
  }
};
$('account-sign-out').onclick = async () => {
  if (!account) return;
  $('account-sign-out').disabled = true;
  try {
    await account.signOut();
    accountSession = null;
    submissionId = null;
    clearTimeout(submissionTimer);
    setAccountStatus(localizedMessage('interface:community.signedOutBrowsingAvailable'));
    renderAccount();
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    $('account-sign-out').disabled = false;
  }
};
window.addEventListener('pagehide', () => {
  clearTimeout(submissionTimer);
  for (const url of previewURLs) URL.revokeObjectURL(url);
  creatorStore.close();
});
renderAccount();
if (account)
  void account
    .session()
    .then((session) => {
      accountSession = session;
      if (session) setAccountStatus(localizedMessage('interface:community.sessionRestored'));
      else if (!renderAccountAction())
        setAccountStatus(localizedMessage('interface:community.signInOnlyToPublish'));
      renderAccount();
    })
    .catch((error) =>
      setAccountStatus(
        localizedMessage('interface:community.accountServiceUnavailable', {
          error: error.message,
        }),
        true,
      ),
    );
void refresh();
