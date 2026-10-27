import { createCreatorStore } from '../creator/installed.mjs';
import { createCommunityAccountClient } from './account.mjs';
import { createCommunityClient } from './client.mjs';
import { attachCommunityReadiness, communityRequest, probeCommunityService } from './readiness.mjs';
import { confirmCommunityRemoval } from './removal-review.mjs';
import { captureCommunityActionFocus } from './action-focus.mjs';
import { createCommunityDownloadStore } from './download-store.mjs';
import { createCommunityLibrary } from './library.mjs';
import { createCommunityPublisher } from './publisher.mjs';
import { createCommunityStateStore } from './state.mjs';
import { createTusBrowserUpload } from './tus-upload.mjs';
import {
  formatDate,
  getLocale,
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
let publishBusy = false;
let preparingPackage = false;
let packageSelectionValid = Boolean(publisher.current());
const canPublish = () =>
  !publishBusy &&
  !preparingPackage &&
  packageSelectionValid &&
  readiness.available() &&
  Boolean(accountSession && auth?.headers);
let catalogRequest = null;
let catalogGeneration = 0;
let catalogBusy = false;
let catalogSelection = null;
localizedText($('open-installed'), () =>
  getLocale() === 'uk' ? 'Встановлені кампанії' : 'Installed campaigns',
);
const selectedCatalog = () => ({ query: $('search').value, installed: $('filter').value });
const sameCatalog = (left, right) =>
  left?.query === right.query && left?.installed === right.installed;
localizedText($('open-recovery'), localizedMessage('interface:community.recovery.copies'));
const localCatalogSelected = () => ['installed', 'recovery'].includes($('filter').value);
const canBrowseCatalog = () => localCatalogSelected() || readiness.available();
const renderPagination = () => {
  $('more').hidden = !nextCursor;
  $('more').disabled = catalogBusy || !nextCursor || !canBrowseCatalog();
  $('catalog').setAttribute('aria-busy', String(catalogBusy));
};
const cancelCatalog = () => {
  catalogGeneration += 1;
  catalogRequest?.abort();
  catalogRequest = null;
  catalogBusy = false;
  catalogSelection = null;
  nextCursor = null;
  renderPagination();
};
let sessionGeneration = 0;
let accountMutations = 0;
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
  $('publish-file').disabled = publishBusy || preparingPackage;
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
    let restoreFocus;
    const startedWithFocus = document.activeElement === button;
    button.disabled = true;
    try {
      await run({
        button,
        startedWithFocus,
        returnFocus: (restore) => {
          restoreFocus = restore;
        },
      });
    } catch (error) {
      status(error.message, true);
    } finally {
      button.disabled = false;
      restoreFocus?.();
    }
  };
  return button;
};
async function confirmRemoval(kind, edition, review, action, generation) {
  const current = () => action.button.isConnected && generation === catalogGeneration;
  const decision = await confirmCommunityRemoval({
    document,
    window,
    kind,
    edition,
    review,
    opener: action.button,
    fallback: () => $('filter'),
    isCurrent: current,
  });
  action.returnFocus(decision.restoreFocus);
  if (!decision.confirmed || !current()) {
    if (current()) status(localizedMessage('interface:community.removal.cancelled'));
    return false;
  }
  return true;
}
async function prepareRemoval(read, action, generation) {
  status(localizedMessage('interface:community.removal.checking'));
  try {
    return await read();
  } catch (error) {
    if (generation === catalogGeneration && action.button.isConnected) status(error.message, true);
    return null;
  }
}
function render({ append = false, start = 0 } = {}) {
  if (!append) {
    for (const url of previewURLs) URL.revokeObjectURL(url);
    previewURLs.clear();
    $('catalog').replaceChildren();
  }
  if (!rows.length && !catalogBusy && !nextCursor)
    $('catalog').append(
      text('p', localizedMessage('interface:community.noCampaignsMatch'), 'muted'),
    );
  for (const edition of rows.slice(start)) {
    const card = document.createElement('article');
    card.className = 'edition';
    card.dataset.editionId = edition.editionId;
    card.append(text('h2', edition.title));
    card.append(
      text(
        'p',
        edition.description ||
          (edition.localUnavailable || edition.recoveryCopy
            ? () =>
                getLocale() === 'uk'
                  ? 'На цьому пристрої є запис цього видання.'
                  : 'This device has a record of this edition.'
            : edition.local
              ? () =>
                  getLocale() === 'uk'
                    ? 'Збережено на цьому пристрої. Для гри підключення до каталогу не потрібне.'
                    : 'Stored on this device. Playing does not require the online catalog.'
              : localizedMessage('interface:community.noCreatorDescription')),
      ),
    );
    const flags = document.createElement('p');
    if (edition.family)
      flags.append(
        text(
          'span',
          () =>
            ({
              classic: 'Snake',
              team: 'Team',
              fpv: 'FPV SIM',
              overflight: getLocale() === 'uk' ? 'Проліт' : 'Overflight',
              'overflight-hunt': getLocale() === 'uk' ? 'Проліт: Наліт' : 'Overflight: Raid',
              'overflight-riy': getLocale() === 'uk' ? 'Проліт: Рій' : 'Overflight: Riy',
            })[edition.family],
          'badge',
        ),
      );
    if (edition.installed)
      flags.append(text('span', localizedMessage('common:status.installed'), 'badge'));
    if (edition.offloaded)
      flags.append(text('span', localizedMessage('interface:community.mediaOffloaded'), 'badge'));
    if (edition.packageRetained)
      flags.append(text('span', localizedMessage('interface:community.offlineCopy'), 'badge'));
    if (edition.updateAvailable)
      flags.append(text('span', localizedMessage('interface:community.updateAvailable'), 'badge'));
    card.append(flags);
    if (edition.localCopyRetained)
      card.append(
        text(
          'p',
          ['overflight', 'overflight-hunt', 'overflight-riy'].includes(edition.family)
            ? () =>
                getLocale() === 'uk'
                  ? 'Локальна копія Studio також використовує цей виліт. Вивантаження видання збереже її.'
                  : 'A local Studio copy also uses this sortie. Offloading this edition keeps that copy.'
            : localizedMessage('interface:community.localSnakeCopyRetained'),
          'meta',
        ),
      );
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
              localizedMessage('interface:community.catalogPreview', {
                title: edition.title,
              }),
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
          !edition.publishedAt
            ? getLocale() === 'uk'
              ? `Версія ${edition.version} · локальне видання`
              : `Version ${edition.version} · local edition`
            : t('interface:community.editionMetadata', {
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
    if (edition.recoveryCopy) {
      if (edition.localUnavailable) {
        actions.append(
          text('p', localizedMessage('interface:community.recovery.unavailable'), 'meta'),
        );
      } else {
        actions.append(
          text('p', localizedMessage('interface:community.recovery.presence'), 'meta'),
        );
        actions.append(
          text(
            'p',
            localizedMessage('interface:community.recovery.bytes', {
              bytes: formatNumber(edition.retainedBytes),
            }),
            'meta',
          ),
        );
        if (edition.installed && edition.playHref) {
          const play = text('a', localizedMessage('interface:community.playOffline'));
          play.href = edition.playHref;
          actions.append(play);
        }
        actions.append(
          action(localizedMessage('interface:community.reinstallExactEdition'), async (action) => {
            const generation = catalogGeneration;
            let focusGeneration = generation;
            const focus = captureCommunityActionFocus({
              document,
              window,
              opener: action.button,
              startedWithFocus: action.startedWithFocus,
              isCurrent: () => focusGeneration === catalogGeneration,
            });
            action.returnFocus(() => {
              const replacement = [...$('catalog').querySelectorAll('article')].find(
                (candidate) => candidate.dataset.editionId === edition.editionId,
              );
              focus.restore(
                replacement?.querySelector('a') ??
                  replacement?.querySelector('button') ??
                  $('refresh'),
              );
            });
            status(localizedMessage('interface:community.recovery.checking'));
            let result;
            try {
              result = await library.restoreRetained(edition.editionId);
            } catch (error) {
              if (generation !== catalogGeneration || !action.button.isConnected) return;
              status(
                localizedMessage('interface:community.recovery.failed', { error: error.message }),
                true,
              );
              return;
            }
            if (generation !== catalogGeneration || !action.button.isConnected) return;
            await refresh({ reset: true });
            if (generation + 1 !== catalogGeneration) return;
            focusGeneration = catalogGeneration;
            status(
              localizedMessage(
                result.journalComplete === false
                  ? 'interface:community.recovery.journalIncomplete'
                  : 'interface:community.recovery.restored',
              ),
              result.journalComplete === false,
            );
          }),
        );
      }
    } else if (edition.localUnavailable) {
      actions.append(
        text(
          'p',
          () =>
            getLocale() === 'uk'
              ? 'Не вдалося перевірити локальні файли цього видання. Спробуйте оновити список. Інші встановлені ігри залишаються доступними.'
              : 'This edition’s local files could not be checked. Try Refresh. Other installed games remain available.',
          'meta',
        ),
      );
    } else if (edition.installed) {
      const play = text('a', localizedMessage('interface:community.playOffline'));
      play.href = edition.playHref;
      actions.append(play);
      if (edition.local && !edition.managementAvailable) {
        actions.append(
          text(
            'p',
            () =>
              getLocale() === 'uk'
                ? 'Гра доступна. Для керування пакетами відкрийте це видання в онлайн-каталозі.'
                : 'Ready to play. Open this edition in the online catalog to manage its packages.',
            'meta',
          ),
        );
      } else if (edition.packageRetained)
        actions.append(
          action(
            localizedMessage('interface:community.offloadInstalledMedia'),
            async (action) => {
              const generation = catalogGeneration;
              const review = await prepareRemoval(
                () => library.reviewInstalledOffload(edition),
                action,
                generation,
              );
              if (!review) return;
              if (!(await confirmRemoval('offload', edition, review, action, generation))) return;
              let result;
              try {
                result = await library.offloadInstalled(edition, review);
              } catch (error) {
                if (generation !== catalogGeneration || !action.button.isConnected) return;
                status(
                  localizedMessage('interface:community.removal.unconfirmed', {
                    error: error.message,
                  }),
                  true,
                );
                return;
              }
              if (generation !== catalogGeneration || !action.button.isConnected) return;
              await refresh({ reset: true });
              if (generation + 1 !== catalogGeneration) return;
              if (result?.journalComplete === false) {
                status(localizedMessage('interface:community.removal.journalIncomplete'), true);
                return;
              }
              status(
                review.localCopyRetained &&
                  ['overflight', 'overflight-hunt', 'overflight-riy'].includes(edition.family)
                  ? () =>
                      getLocale() === 'uk'
                        ? 'Видання вивантажено. Локальну копію та пакет відновлення збережено.'
                        : 'Edition offloaded. The local copy and recovery package are retained.'
                  : localizedMessage(
                      review.localCopyRetained
                        ? 'interface:community.snakeEditionOffloadedLocalKept'
                        : 'interface:community.installedMediaOffloaded',
                    ),
              );
            },
            'secondary',
          ),
          action(
            localizedMessage('interface:community.removeRecoveryDownload'),
            async (action) => {
              const generation = catalogGeneration;
              const review = await prepareRemoval(
                () => library.reviewDownloadRemoval(edition),
                action,
                generation,
              );
              if (!review) return;
              if (!(await confirmRemoval('download', edition, review, action, generation))) return;
              try {
                await library.removeDownload(edition, review);
              } catch (error) {
                if (generation !== catalogGeneration || !action.button.isConnected) return;
                status(
                  localizedMessage('interface:community.removal.unconfirmed', {
                    error: error.message,
                  }),
                  true,
                );
                return;
              }
              if (generation !== catalogGeneration || !action.button.isConnected) return;
              await refresh({ reset: true });
              if (generation + 1 !== catalogGeneration) return;
              status(localizedMessage('interface:community.recoveryDownloadRemoved'));
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
            edition.offloaded
              ? 'interface:community.reinstallExactEdition'
              : edition.updateAvailable
                ? 'interface:community.downloadUpdate'
                : 'interface:community.downloadAndInstall',
          ),
          async () => {
            status(
              localizedMessage('interface:community.downloading', {
                title: edition.title,
              }),
            );
            await library.install(edition, { offline: edition.offloaded });
            status(
              localizedMessage('interface:community.installedOffline', {
                title: edition.title,
              }),
            );
            await refresh({ reset: true });
          },
        ),
      );
    const reportReason = document.createElement('select');
    localizedAttribute(
      reportReason,
      'aria-label',
      localizedMessage('interface:community.reportReasonFor', {
        title: edition.title,
      }),
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
    if (!edition.local)
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
  if (!canBrowseCatalog()) {
    cancelCatalog();
    rows = [];
    render();
    readiness.render();
    status(localizedMessage('interface:community.service.catalogWaiting'));
    return;
  }
  readiness.render();
  const selection = selectedCatalog();
  // A queued Load more belongs only to the committed result set. It must not
  // replace a first-page request or consume a cursor from another filter.
  if (!reset && (catalogBusy || !nextCursor || !sameCatalog(catalogSelection, selection))) return;
  catalogRequest?.abort();
  catalogRequest = new AbortController();
  const current = ++catalogGeneration,
    cursor = reset ? null : nextCursor,
    previousCount = reset ? 0 : rows.length,
    returnFocus = !reset && document.activeElement === $('more');
  let focusDestination;
  catalogBusy = true;
  if (reset) {
    nextCursor = null;
    catalogSelection = null;
    rows = [];
    render();
  }
  renderPagination();
  status(localizedMessage('interface:community.loadingCatalog'));
  try {
    const result = await communityRequest(
      (signal) =>
        library.catalog({
          ...selection,
          cursor,
          signal,
        }),
      { signal: catalogRequest.signal },
    );
    if (current !== catalogGeneration || !canBrowseCatalog()) return;
    const seen = new Set(reset ? [] : rows.map((row) => row.editionId));
    rows = [
      ...(reset ? [] : rows),
      ...result.editions.filter((candidate) => {
        if (seen.has(candidate.editionId)) return false;
        seen.add(candidate.editionId);
        return true;
      }),
    ];
    catalogSelection = selection;
    nextCursor = result.nextCursor;
    catalogBusy = false;
    render({ append: !reset && previousCount > 0, start: previousCount });
    status(
      localizedMessage('interface:community.editionsShown', {
        count: rows.length,
      }),
    );
    focusDestination =
      $('catalog').querySelectorAll('h2')[previousCount] ?? (nextCursor ? $('more') : $('status'));
  } catch (error) {
    if (current !== catalogGeneration) return;
    // A failed query does not invalidate the separate service probe. Keep the
    // controls available so players can correct the query or retry this page.
    status(
      localizedMessage('interface:community.catalogUnavailable', {
        error: error.message,
      }),
      true,
    );
    focusDestination = nextCursor
      ? $('more')
      : localCatalogSelected()
        ? $('refresh')
        : $('service-retry');
  } finally {
    if (current === catalogGeneration) {
      catalogBusy = false;
      catalogRequest = null;
      renderPagination();
      if (returnFocus && [$('more'), document.body, null].includes(document.activeElement)) {
        if (focusDestination && !['BUTTON', 'INPUT', 'SELECT'].includes(focusDestination.tagName))
          focusDestination.setAttribute('tabindex', '-1');
        focusDestination?.focus({ preventScroll: false });
      }
    }
  }
}
$('refresh').onclick = () => (localCatalogSelected() ? refresh() : readiness.check());
$('open-installed').onclick = () => {
  $('filter').value = 'installed';
  readiness.render();
  $('filter').focus();
  return refresh();
};
$('open-recovery').onclick = () => {
  $('filter').value = 'recovery';
  readiness.render();
  $('filter').focus();
  return refresh();
};
$('more').onclick = () => refresh({ reset: false });
$('search').oninput = () => refresh({ reset: true });
$('filter').onchange = () => refresh({ reset: true });
$('publish-file').onchange = async () => {
  if (!readiness.available() || publishBusy || preparingPackage) return;
  preparingPackage = true;
  renderAccount();
  try {
    const file = $('publish-file').files[0];
    if (!file) return;
    packageSelectionValid = false;
    const selected = await publisher.select(file);
    packageSelectionValid = true;
    $('publish-title').value = selected.suggestedTitle;
    $('publish-slug').value = selected.suggestedSlug;
    preparingPackage = false;
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
  } finally {
    preparingPackage = false;
    renderAccount();
  }
};
$('publish').onclick = async () => {
  if (!canPublish()) return;
  publishBusy = true;
  renderAccount();
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
      localizedMessage('interface:community.submissionStatus', {
        status: result.status,
      }),
    );
    if (['queued', 'validating'].includes(result.status)) scheduleSubmissionCheck();
  } catch (error) {
    localizedText($('publish-status'), error.message);
  } finally {
    publishBusy = false;
    renderAccount();
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
      localizedMessage('interface:community.submissionRefreshFailed', {
        error: error.message,
      }),
    );
  }
}
$('publish-unlist').onclick = async () => {
  $('publish-unlist').disabled = true;
  try {
    const current = await publisher.unlist();
    localizedText(
      $('publish-status'),
      localizedMessage('interface:community.editionStatus', {
        status: current.status,
      }),
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
  sessionGeneration += 1;
  accountMutations += 1;
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
    accountMutations -= 1;
    sessionGeneration += 1;
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
  sessionGeneration += 1;
  accountMutations += 1;
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
    accountMutations -= 1;
    sessionGeneration += 1;
    $('account-sign-in').disabled = false;
  }
};
$('account-sign-out').onclick = async () => {
  if (!account) return;
  sessionGeneration += 1;
  accountMutations += 1;
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
    accountMutations -= 1;
    sessionGeneration += 1;
    $('account-sign-out').disabled = false;
  }
};
const cancelReadinessWork = () => {
  readiness.cancel();
  cancelCatalog();
  sessionGeneration += 1;
};
window.addEventListener('pagehide', (event) => {
  cancelReadinessWork();
  clearTimeout(submissionTimer);
  for (const url of previewURLs) URL.revokeObjectURL(url);
  if (!event.persisted) {
    library.close();
    creatorStore.close();
  }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    void readiness.check();
    if (localCatalogSelected()) void refresh();
  }
});
window.addEventListener('offline', () => {
  cancelReadinessWork();
  readiness.unavailable();
  if (localCatalogSelected()) void refresh();
});
window.addEventListener('online', () => void readiness.check());
async function restoreAccount() {
  if (!account || accountMutations) return;
  const current = ++sessionGeneration;
  try {
    const session = await communityRequest(() => account.session());
    if (current !== sessionGeneration || !readiness.available()) return;
    accountSession = session;
    if (session) setAccountStatus(localizedMessage('interface:community.sessionRestored'));
    else if (!renderAccountAction())
      setAccountStatus(localizedMessage('interface:community.signInOnlyToPublish'));
    renderAccount();
  } catch (error) {
    if (current !== sessionGeneration) return;
    setAccountStatus(
      localizedMessage('interface:community.accountServiceUnavailable', { error: error.message }),
      true,
    );
  }
}
const readiness = attachCommunityReadiness({
  document,
  localCatalogAvailable: localCatalogSelected,
  probe: (signal) => {
    if (!localCatalogSelected()) cancelCatalog();
    sessionGeneration += 1;
    return probeCommunityService({ baseURL: apiBase, signal });
  },
  onReady: () => {
    renderAccount();
    void restoreAccount();
    if (!localCatalogSelected()) return refresh();
  },
});
renderAccount();
void readiness.check();
