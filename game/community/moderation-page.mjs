import { createCommunityAccountClient } from './account.mjs';
import { createCommunityClient } from './client.mjs';
import { createCommunityModerator } from './moderator.mjs';
import {
  formatDate,
  localizedAttribute,
  localizedMessage,
  localizedText,
  t,
} from '../i18n/index.mjs';

const $ = (id) => document.getElementById(id);
const apiBase = document.documentElement.dataset.communityApi;
const injectedAuth = globalThis.RevealLineCommunityAuth;
const account = injectedAuth ? null : createCommunityAccountClient({ baseURL: apiBase });
const auth = injectedAuth ?? { headers: account.headers };
const client = createCommunityClient({ baseURL: apiBase, authHeaders: auth.headers });
const moderator = createCommunityModerator({ client });
const previewURLs = new Set();

const localText = (tag, message, className = '') => {
  const node = document.createElement(tag);
  localizedText(node, message);
  node.className = className;
  return node;
};

const remoteText = (tag, value, className = '') => {
  const node = document.createElement(tag);
  node.textContent = String(value ?? '');
  node.className = className;
  return node;
};

const setStatus = (message, error = false, focus = false) => {
  localizedText($('status'), message);
  $('status').classList.toggle('error', error);
  if (focus) $('status').focus();
};

const setAccountStatus = (message, error = false) => {
  localizedText($('account-status'), message);
  $('account-status').classList.toggle('error', error);
};

const reasonMessage = (reason) =>
  localizedMessage(
    `interface:community.${
      {
        broken: 'brokenContent',
        copyright: 'copyrightConcern',
        unsafe: 'unsafeContent',
        misleading: 'misleadingListing',
        other: 'otherConcern',
      }[reason] ?? 'otherConcern'
    }`,
  );

const revokePreviews = () => {
  for (const url of previewURLs) URL.revokeObjectURL(url);
  previewURLs.clear();
};

const action = (label, run, className = '') => {
  const button = localText('button', label, className);
  button.type = 'button';
  button.onclick = async () => {
    button.disabled = true;
    try {
      await run();
    } catch (error) {
      setStatus(error.message, true, true);
    } finally {
      button.disabled = false;
    }
  };
  return button;
};

const render = () => {
  revokePreviews();
  const state = moderator.snapshot();
  $('reports').replaceChildren();
  if (!state.reports.length)
    $('reports').append(
      localText('p', localizedMessage('interface:community.noModerationReports'), 'muted'),
    );

  for (const report of state.reports) {
    const card = document.createElement('article');
    card.className = 'panel moderation-card';

    const heading = localText('h2', () =>
      t('interface:community.reportHeading', { reason: reasonMessage(report.reason) }),
    );
    card.append(heading);
    card.append(
      localText('p', localizedMessage('interface:community.reportedEdition'), 'meta'),
      remoteText('code', report.editionId, 'edition-identity'),
      localText(
        'p',
        () =>
          t('interface:community.reportSubmitted', {
            date: formatDate(new Date(report.createdAt)),
          }),
        'meta',
      ),
    );
    card.append(
      remoteText(
        'p',
        report.details || localizedMessage('interface:community.noReportDetails'),
        report.details ? 'report-details' : 'muted',
      ),
    );

    const preview = document.createElement('figure');
    preview.className = 'preview moderation-preview';
    preview.append(
      action(
        localizedMessage('interface:community.loadReportedPreview'),
        async () => {
          const blob = await moderator.preview(report.id);
          const url = URL.createObjectURL(blob);
          previewURLs.add(url);
          const image = document.createElement('img');
          image.src = url;
          localizedAttribute(
            image,
            'alt',
            localizedMessage('interface:community.reportedEditionPreview'),
          );
          preview.replaceChildren(image);
        },
        'secondary',
      ),
    );
    card.append(preview);

    if (report.status === 'resolved') {
      card.append(
        localText('h3', localizedMessage('interface:community.recordedResolution')),
        remoteText('p', report.resolution, 'report-details'),
        localText(
          'p',
          () =>
            t('interface:community.resolvedOn', {
              date: formatDate(new Date(report.resolvedAt)),
            }),
          'meta',
        ),
      );
    } else {
      const label = document.createElement('label');
      const labelText = localText('span', localizedMessage('interface:community.resolutionLabel'));
      const resolution = document.createElement('textarea');
      resolution.maxLength = 1_000;
      resolution.required = true;
      localizedAttribute(
        resolution,
        'placeholder',
        localizedMessage('interface:community.resolutionPlaceholder'),
      );
      label.append(labelText, resolution);

      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.append(
        action(localizedMessage('interface:community.resolveKeepListed'), async () => {
          await moderator.resolve(report.id, resolution.value);
          render();
          setStatus(localizedMessage('interface:community.reportResolved'), false, true);
        }),
        action(
          localizedMessage('interface:community.unlistAndResolve'),
          async () => {
            await moderator.unlistAndResolve(report.id, resolution.value);
            render();
            setStatus(
              localizedMessage('interface:community.editionUnlistedReportResolved'),
              false,
              true,
            );
          },
          'secondary danger',
        ),
      );
      card.append(label, actions);
    }
    $('reports').append(card);
  }
  $('more').hidden = !state.nextCursor;
};

async function refresh({ reset = true } = {}) {
  try {
    const state = await moderator.load({
      selectedStatus: $('report-status').value,
      reset,
    });
    render();
    setStatus(
      localizedMessage('interface:community.reportsShown', { count: state.reports.length }),
    );
  } catch (error) {
    setStatus(
      localizedMessage('interface:community.moderationUnavailable', { error: error.message }),
      true,
    );
  }
}

$('refresh').onclick = () => refresh({ reset: true });
$('more').onclick = () => refresh({ reset: false });
$('report-status').onchange = () => refresh({ reset: true });
globalThis.addEventListener('beforeunload', revokePreviews, { once: true });

try {
  const session = account ? await account.session() : { user: {}, configured: true };
  if (!session) {
    setAccountStatus(localizedMessage('interface:community.adminSignInRequired'), true);
    setStatus(localizedMessage('interface:community.adminSignInHelp'));
  } else {
    setAccountStatus(
      session.configured
        ? localizedMessage('interface:community.configuredAdministrator')
        : localizedMessage('interface:community.signedInAs', {
            identity: session.user.name || session.user.email,
          }),
    );
    await refresh({ reset: true });
  }
} catch (error) {
  setAccountStatus(
    localizedMessage('interface:community.accountServiceUnavailable', { error: error.message }),
    true,
  );
  setStatus(localizedMessage('interface:community.adminSignInHelp'));
}
