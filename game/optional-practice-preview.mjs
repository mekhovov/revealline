// Developer source previews are deliberately separate from the publication
// catalog. Only existing source packages may be listed here; a preview never
// certifies an installation or grants access to a production launcher.
const SOURCE_PREVIEWS = Object.freeze([
  Object.freeze({
    id: 'civilian-flight',
    titleKey: 'assistedSourcePreview',
    path: 'optional-practice/civilian-flight/',
  }),
  Object.freeze({
    id: 'civilian-fpv',
    titleKey: 'fpvSourcePreview',
    path: 'optional-practice/civilian-fpv/',
  }),
]);

export function optionalPracticeSourcePreviews(href) {
  let location;
  try {
    location = new URL(href);
  } catch {
    return [];
  }
  if (
    !['http:', 'https:'].includes(location.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ||
    location.username ||
    location.password
  )
    return [];
  if (location.pathname !== '/game/index.html') return [];
  return SOURCE_PREVIEWS.map((preview) =>
    Object.freeze({
      id: preview.id,
      titleKey: preview.titleKey,
      url: new URL('/' + preview.path, location.origin).href,
    }),
  );
}
