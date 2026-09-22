/** Read-only copies of an authenticated picture. Teasers retain a broad border;
 * explicit detail shows the full original without granting gameplay ownership. */
export function paintTeamPicturePreview(
  context,
  image,
  width,
  height,
  { full = false, isCurrent = () => true } = {},
) {
  if (!isCurrent()) return false;
  context.imageSmoothingEnabled = false;
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  if (!isCurrent()) return false;
  context.drawImage(image, 0, 0, width, height);
  if (!isCurrent()) return false;
  if (!full) {
    const border = width / 12;
    context.fillStyle = '#0b1a24';
    if (!isCurrent()) return false;
    context.fillRect(border, border, width - border * 2, height - border * 2);
  }
  return isCurrent();
}
