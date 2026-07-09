/**
 * What the game needs from a keyboard, and nothing more.
 *
 * The terminal implementation infers held keys from auto-repeat (or the Kitty
 * keyboard protocol); the browser gets real keydown/keyup. The game can't tell
 * the difference, which is the point.
 */

export interface InputSource {
  /** Expire decayed keys. Called once per frame. */
  update(now?: number): void;
  /** Keys newly pressed since the last call. Clears the set. */
  takePressed(): Set<string>;
  isDown(key: string): boolean;
  anyDown(...keys: string[]): boolean;
  readonly quitRequested: boolean;
}
