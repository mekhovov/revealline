import { app, BrowserWindow, Menu, dialog, protocol, session } from 'electron';
import { mkdirSync } from 'node:fs';
import {
  APP_SCHEME,
  SCHEME_PRIVILEGES,
  WEB_PREFERENCES,
  SESSION_PARTITION,
  desktopDirectories,
  isAllowedRequestURL,
  downloadDecision,
  MAX_DOWNLOAD_BYTES,
} from './policy.mjs';
import { loadNativeSite } from './resources.mjs';

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { ...SCHEME_PRIVILEGES } },
]);
app.enableSandbox();
app.setName('Reveal Line');
const directories = desktopDirectories({
  appPath: app.getAppPath(),
  appData: app.getPath('appData'),
  siteOverride: process.env.REVEALLINE_SITE_DIR,
  userDataOverride: process.env.REVEALLINE_USER_DATA_DIR,
});
mkdirSync(directories.userData, { recursive: true });
app.setPath('userData', directories.userData);
app.setPath('sessionData', directories.userData);
let mainWindow = null,
  nativeSite = null,
  appSession = null,
  activeDownload = null;

function failure(message) {
  dialog.showErrorBox('Reveal Line could not continue', message);
}
function foreground() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return foreground();
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 360,
    minHeight: 480,
    title: 'Reveal Line',
    backgroundColor: '#091324',
    show: false,
    webPreferences: { ...WEB_PREFERENCES, session: appSession },
  });
  mainWindow = window;
  const contents = window.webContents;
  const guardNavigation = (event, legacyURL) => {
    const url = event.url || legacyURL;
    if (!nativeSite.isNavigationAllowed(url)) event.preventDefault();
  };
  contents.on('will-navigate', guardNavigation);
  contents.on('will-frame-navigate', guardNavigation);
  contents.on('will-redirect', guardNavigation);
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (nativeSite.isNavigationAllowed(contents.getURL()) && nativeSite.isNavigationAllowed(url)) {
      // Keep the existing tab's sessionStorage for the Playground practice handoff.
      queueMicrotask(() => {
        if (!contents.isDestroyed())
          void contents.loadURL(url).catch((error) => failure(error.message));
      });
    }
    return { action: 'deny' };
  });
  contents.on('render-process-gone', () =>
    failure(
      'The game renderer stopped. Close and reopen the app. Your existing local files are preserved.',
    ),
  );
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  void window.loadURL(nativeSite.entryURL).catch((error) => {
    failure(error.message);
    window.close();
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', foreground);
  app.on('open-url', (event) => event.preventDefault());
  app.on('open-file', (event) => event.preventDefault());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (nativeSite && appSession) createWindow();
  });
  app
    .whenReady()
    .then(async () => {
      nativeSite = await loadNativeSite(directories.site);
      appSession = session.fromPartition(SESSION_PARTITION);
      appSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      appSession.setPermissionCheckHandler(() => false);
      appSession.setDevicePermissionHandler(() => false);
      appSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));
      appSession.webRequest.onBeforeRequest((details, callback) =>
        callback({ cancel: !isAllowedRequestURL(details.url, details.resourceType) }),
      );
      appSession.protocol.handle(APP_SCHEME, (request) => nativeSite.handle(request));
      appSession.on('will-download', (event, item, contents) => {
        const decision = downloadDecision({
          url: item.getURL(),
          pageURL: contents?.getURL(),
          filename: item.getFilename(),
          mimeType: item.getMimeType(),
          bytes: item.getTotalBytes(),
          userGesture: item.hasUserGesture(),
          ownsWindow: !!mainWindow && contents === mainWindow.webContents,
        });
        if (!decision.allowed || activeDownload) {
          event.preventDefault();
          failure(
            activeDownload
              ? 'Finish or cancel the current export before starting another.'
              : decision.reason,
          );
          return;
        }
        activeDownload = item;
        item.setSaveDialogOptions({
          title: 'Save Reveal Line export',
          defaultPath: decision.filename,
          filters: [
            {
              name: decision.extension === 'json' ? 'Reveal Line JSON export' : 'ZIP archive',
              extensions: [decision.extension],
            },
          ],
        });
        item.on('updated', () => {
          if (item.getReceivedBytes() > MAX_DOWNLOAD_BYTES) item.cancel();
        });
        item.once('done', (_event, state) => {
          activeDownload = null;
          if (state === 'interrupted')
            failure(
              'The export could not be saved. Your game data remains unchanged; try exporting again.',
            );
        });
      });
      const template = [
        ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
        { role: 'editMenu' },
        {
          label: 'View',
          submenu: [
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ],
        },
        { role: 'windowMenu' },
      ];
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
      createWindow();
    })
    .catch((error) => {
      failure(error.message);
      app.quit();
    });
}
