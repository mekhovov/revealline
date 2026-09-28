/** Explicit opt-in package admission. New packages need a reviewed policy entry;
 * an uploaded archive cannot widen its own executable dependency allowance. */
export const OPTIONAL_PACKAGE_POLICIES = Object.freeze({
  'civilian-flight': Object.freeze({
    root: 'optional-practice/civilian-flight/',
    entry: 'optional-practice/civilian-flight/index.html',
    limits: Object.freeze({ files: 64, bytes: 8 * 1024 * 1024 }),
    localFiles: Object.freeze([
      'index.html',
      'app.mjs',
      'model.mjs',
      'input.mjs',
      'catalogue.mjs',
      'copy.mjs',
      'offline.mjs',
      'style.css',
      'app.webmanifest',
      'README.md',
    ]),
    sharedFiles: Object.freeze([
      'optional-practice/install-context.mjs',
      'game/data-json.mjs',
      'game/key-bindings.mjs',
      'game/i18n/index.mjs',
      'game/i18n/bootstrap.mjs',
      'game/i18n/catalogs.mjs',
      'game/vendor/i18next-26.4.2.min.js',
      'game/vendor/I18NEXT-LICENSE.txt',
    ]),
    template: 'optional-practice/civilian-flight/worker-template.mjs',
    launcherTemplate: 'optional-practice/launcher-template.mjs',
    localeInputs: Object.freeze(['game/locales/en/errors.json', 'game/locales/uk/errors.json']),
    licenses: Object.freeze([
      {
        dependency: 'i18next',
        version: '26.4.2',
        license: 'MIT',
        path: 'game/vendor/I18NEXT-LICENSE.txt',
      },
    ]),
  }),
});
export function optionalRuntimePaths(policy, { launcher = false } = {}) {
  return [
    ...(launcher
      ? [
          'index.html',
          'app.mjs',
          'context.mjs',
          'app.webmanifest',
          'worker.js',
          'icons/icon-192.png',
          'icons/icon-512.png',
        ].map((name) => 'launcher/' + name)
      : []),
    ...policy.localFiles.map((name) => policy.root + name),
    ...policy.sharedFiles,
    ...[192, 512].map((size) => `${policy.root}icons/icon-${size}.png`),
    `${policy.root}worker.js`,
  ].sort();
}
