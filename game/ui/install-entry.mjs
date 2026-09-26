import { installedAppURL } from '../installed-app.mjs';
// Version pages join the stable installation identity when hosted as frozen releases.
if (location.pathname.includes('/releases/')) {
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.href = new URL('manifest.webmanifest', installedAppURL()).href;
}
