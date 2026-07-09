/**
 * Text measurement shared by every backend.
 *
 * Lives apart from the renderers because the canvas backend needs it and must
 * not drag `node:*` types into the browser build.
 */

/** True for glyphs that occupy two terminal columns (CJK, emoji, ...). */
export function isWide(cp: number): boolean {
  return (
    cp >= 0x1100 &&
    (cp <= 0x115f || // Hangul Jamo
      cp === 0x2329 ||
      cp === 0x232a ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || // CJK
      (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1f9ff) || // Emoji
      (cp >= 0x20000 && cp <= 0x3fffd))
  );
}
