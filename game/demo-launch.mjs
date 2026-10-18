const entries = {
  solo: './',
  snake: './snake/play.html',
  sim: '../optional-practice/fpv-worlds/index.html',
  survival: './overflight/play.html',
};

/** A demo may request only its own native entry. The ordinary host still owns
 * save/departure confirmation and the receiving game still validates the mission. */
export function demoLaunchURL(source) {
  const path = entries[source?.modeId];
  if (!path || !source.launchURL) throw new Error('The demonstrated mission cannot be opened.');
  const expected = new URL(path, import.meta.url);
  const url = new URL(source.launchURL, expected);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.hash)
    throw new Error('Invalid demonstration destination.');
  return url.href;
}
