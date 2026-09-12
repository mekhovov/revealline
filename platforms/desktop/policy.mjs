import path from 'node:path';

export const APP_SCHEME = 'revealline';
export const APP_HOST = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}/`;
export const SESSION_PARTITION = 'persist:revealline';
export const NATIVE_MARKER = '.revealline-native.json';
export const NATIVE_FORMAT = 'revealline-native-site.v1';
export const SCHEME_PRIVILEGES = Object.freeze({
  standard: true,
  secure: true,
  supportFetchAPI: true,
  corsEnabled: true,
  bypassCSP: false,
  allowServiceWorkers: false,
  allowExtensions: false,
});
export const WEB_PREFERENCES = Object.freeze({
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false,
  navigateOnDragDrop: false,
  safeDialogs: true,
  spellcheck: false,
  devTools: false,
  autoplayPolicy: 'user-gesture-required',
});
export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
});
export const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
});

export function safeAssetPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 1024 &&
    value
      .split('/')
      .every(
        (part) =>
          /^[A-Za-z0-9_][A-Za-z0-9._ -]{0,179}$/.test(part) &&
          !part.endsWith('.') &&
          !part.endsWith(' ') &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  );
}

/** Inspect the raw path before WHATWG URL can erase traversal components. */
export function resourcePathForURL(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\u0000-\u0020\u007f\\]/.test(value))
    return null;
  const match = /^revealline:\/\/app(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/.exec(value);
  if (!match) return null;
  if (/%(?:2f|5c)/i.test(match[1] || '')) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(match[1] || '/');
  } catch {
    return null;
  }
  const components = decoded.slice(1).split('/');
  if (
    components.some(
      (part, index) => part === '.' || part === '..' || (!part && index !== components.length - 1),
    )
  )
    return null;
  if (/%|\\|:|[\u0000-\u001f\u007f]/.test(decoded)) return null;
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  return safeAssetPath(relative) ? relative : null;
}

export function isAppBlobURL(value) {
  return typeof value === 'string' && /^blob:revealline:\/\/app\/[a-zA-Z0-9-]{1,128}$/.test(value);
}

export function isAllowedRequestURL(value, resourceType = 'other') {
  if (resourcePathForURL(value) !== null) return true;
  if (isAppBlobURL(value))
    return !['mainFrame', 'subFrame', 'script', 'worker'].includes(resourceType);
  return (
    ['image', 'media'].includes(resourceType) &&
    typeof value === 'string' &&
    /^data:(?:image\/(?:png|jpeg|webp|gif|svg\+xml)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)[;,]/i.test(
      value,
    )
  );
}

/** The manifest predicate prevents navigating to executable/data resources. */
export function isNavigationAllowed(value, hasResource) {
  const relative = resourcePathForURL(value);
  return relative !== null && relative.endsWith('.html') && hasResource(relative);
}

export function desktopDirectories({ appPath, appData, siteOverride, userDataOverride } = {}) {
  const choose = (override, fallback, label) => {
    const value = override === undefined ? fallback : override;
    if (typeof value !== 'string' || !value || value.includes('\0') || !path.isAbsolute(value))
      throw new TypeError(`${label} must be an absolute local directory.`);
    return path.resolve(value);
  };
  return {
    site: choose(siteOverride, path.join(appPath, 'site'), 'REVEALLINE_SITE_DIR'),
    userData: choose(
      userDataOverride,
      path.join(appData, 'RevealLine'),
      'REVEALLINE_USER_DATA_DIR',
    ),
  };
}

export const MAX_DOWNLOAD_BYTES = 128 * 1024 * 1024;
export function downloadDecision({
  url,
  pageURL,
  filename,
  mimeType,
  bytes = 0,
  userGesture = false,
  ownsWindow = false,
} = {}) {
  if (!ownsWindow || resourcePathForURL(pageURL) === null)
    return { allowed: false, reason: 'The export must come from this app window.' };
  if (!userGesture)
    return {
      allowed: false,
      reason: 'Choose the export control again to start a user-initiated download.',
    };
  if (!isAppBlobURL(url))
    return { allowed: false, reason: 'Only locally generated export files may be saved.' };
  if (
    typeof filename !== 'string' ||
    filename.length < 1 ||
    filename.length > 180 ||
    /[\\/:\u0000-\u001f\u007f]/.test(filename) ||
    filename.startsWith('.')
  )
    return { allowed: false, reason: 'This export filename is not supported.' };
  const extension = path.extname(filename).toLowerCase();
  const mime = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : '';
  if (
    !(
      (extension === '.json' && ['application/json', 'text/json'].includes(mime)) ||
      (extension === '.zip' && ['application/zip', 'application/x-zip-compressed'].includes(mime))
    )
  )
    return {
      allowed: false,
      reason: 'Only JSON backups, packs and replays, or ZIP archives, may be exported.',
    };
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_DOWNLOAD_BYTES)
    return { allowed: false, reason: 'The export exceeds the 128 MiB desktop download limit.' };
  return { allowed: true, extension: extension.slice(1), filename };
}
