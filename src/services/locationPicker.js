/**
 * A tiny hand-off store for the map picker.
 *
 * React Navigation params must be serialisable, so a callback cannot be
 * passed to the picker screen. Instead the picker leaves its result here and
 * the screen that opened it collects it when it comes back into focus.
 */

let draft = null;
let result = null;

/** The place the picker should open at (may be null). */
export const setPickerDraft = location => {
  draft = location || null;
};

export const getPickerDraft = () => draft;

/** Called by the picker once the user confirms a spot. */
export const setPickedLocation = location => {
  result = location || null;
};

/** Called by the task screen when it regains focus. Returns null if nothing. */
export const takePickedLocation = () => {
  const picked = result;
  result = null;
  draft = null;
  return picked;
};