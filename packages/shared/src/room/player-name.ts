/** Unicode Cc plus explicit bidi controls. Does not reject ZWJ (U+200D). */
const PLAYER_NAME_BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
const PLAYER_NAME_CONTROL = /\p{Cc}/u;

export function textContainsForbiddenChars(value: string): boolean {
  return PLAYER_NAME_CONTROL.test(value) || PLAYER_NAME_BIDI_CONTROLS.test(value);
}

export function playerNameContainsForbiddenChars(name: string): boolean {
  return textContainsForbiddenChars(name);
}
