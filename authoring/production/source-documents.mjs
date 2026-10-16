const documents = Object.freeze({
  'authoring/library/route-worlds/build.mjs':
    'authoring/production/source-documents/8cb7ec2e3bf6cf334517ad056568110af4f7bc70a0143ad37bc33b10ff733d43.txt',
  'authoring/library/sentinel-circuit-external/build.mjs':
    'authoring/production/source-documents/ee481bcaef80d86778fdda295f8660d0bfa2d6e0950bd24fddc59e051d463e88.txt',
});

/** Display-only aliases preserve the recorded source body without distributing
 * its executable producer or importing its Node-only dependency graph. */
export function productionSourceDocumentPath(path) {
  return Object.hasOwn(documents, path) ? documents[path] : path;
}
