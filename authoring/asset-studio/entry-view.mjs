/** Fixed navigation hints choose only an inspection view. They cannot select a
 * workspace, stage a replacement, start playback or supply a return URL. */
export function studioEntryView(href, slots) {
  let page;
  try {
    page = new URL(href);
  } catch {
    return null;
  }
  if (
    !/\/authoring\/asset-studio\/(?:index\.html)?$/.test(page.pathname) ||
    page.searchParams.getAll('studio').length !== 1 ||
    page.searchParams.get('studio') !== 'sounds'
  )
    return null;
  const audio = slots.filter((slot) => slot.group === 'audio' && slot.id.startsWith('audio.')),
    selected = audio.find((slot) => slot.id === 'audio.destroy-soft') ?? audio[0];
  if (!selected) return null;
  return {
    version: 1,
    selected: selected.id,
    // Recipe-backed audio must remain visible alongside uploaded recordings.
    filters: { query: 'audio.', screen: '', state: '', kind: '', quality: '' },
  };
}
