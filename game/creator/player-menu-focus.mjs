/** Successful installation restores the next action only when the initiating
 * control still owns focus (or disabling it sent focus to the document body). */
export function focusCreatorInstalledPlay({ document: doc, opener, play, wasFocused }) {
  if (
    !wasFocused ||
    doc.hidden ||
    doc.hasFocus?.() === false ||
    !play?.isConnected ||
    play.hidden ||
    play.disabled ||
    ![opener, doc.body].includes(doc.activeElement)
  )
    return false;
  play.focus();
  return true;
}
