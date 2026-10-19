/** Branded distributions may supply an admitted presentation-only adapter.
 * It may paint pixels; simulation, warning badges and collision geometry remain
 * owned by the common renderer. False preserves the normal game artwork. */
export function drawBrandActor() {
  return false;
}
