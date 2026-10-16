const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIUlEQVR42mNgGHKg4s6L/zA8EgzApng4G0Cs4uFswIABALbL6JnK2NeAAAAAAElFTkSuQmCC';

export const ACCEPTANCE_PNG_WIDTH = 16;
export const ACCEPTANCE_PNG_HEIGHT = 16;

export const createAcceptancePng = () => Buffer.from(PNG_BASE64, 'base64');

export const inspectAcceptanceImage = async () => ({
  naturalWidth: ACCEPTANCE_PNG_WIDTH,
  naturalHeight: ACCEPTANCE_PNG_HEIGHT,
});

export const decodeAcceptanceImage = async () => ({
  width: ACCEPTANCE_PNG_WIDTH,
  height: ACCEPTANCE_PNG_HEIGHT,
  naturalWidth: ACCEPTANCE_PNG_WIDTH,
  naturalHeight: ACCEPTANCE_PNG_HEIGHT,
  close() {},
});
