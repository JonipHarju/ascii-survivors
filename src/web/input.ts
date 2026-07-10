/**
 * Browser keyboard. The easy half of the problem.
 *
 * The terminal has to *infer* held keys from OS auto-repeat, because a TTY only
 * ever reports key-down. Here we get real keydown/keyup, so held-key state is
 * exact and movement has none of the mush the terminal build has to work around.
 * That alone is a meaningful chunk of the "smoother gameplay" the owner asked for.
 */

import type { InputSource } from '../engine/input-source.ts';

/** DOM `event.key` -> the names the game uses. */
const ALIASES: Readonly<Record<string, string>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Escape: 'escape',
  Enter: 'enter',
  ' ': 'space',
  Tab: 'tab',
  Backspace: 'backspace',
};

/** Keys the browser would otherwise scroll or tab away on. */
const SWALLOW = new Set(['up', 'down', 'left', 'right', 'space', 'tab', 'enter']);

export class WebInput implements InputSource {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private _quit = false;

  get quitRequested(): boolean {
    return this._quit;
  }

  attach(target: EventTarget = window): () => void {
    const onDown = (ev: Event): void => {
      const e = ev as KeyboardEvent;
      const key = this.normalize(e);
      if (key === null) return;
      if (SWALLOW.has(key)) e.preventDefault();

      // `repeat` fires while held; the game only wants the leading edge.
      if (!e.repeat) this.pressed.add(key);
      this.down.add(key);
    };

    const onUp = (ev: Event): void => {
      const key = this.normalize(ev as KeyboardEvent);
      if (key !== null) this.down.delete(key);
    };

    // Alt-tabbing away with W held would otherwise leave the player walking
    // north forever, because the keyup lands on a window we're not listening to.
    const onBlur = (): void => this.down.clear();

    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);

    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  private normalize(e: KeyboardEvent): string | null {
    const alias = ALIASES[e.key];
    if (alias !== undefined) return alias;
    if (e.key.length === 1) return e.key.toLowerCase();
    return null;
  }

  /** Inject a keypress. Used by `?sim` to answer level-up cards while fast-forwarding. */
  press(key: string): void {
    this.pressed.add(key);
  }

  /** Real key-up events mean there is nothing to expire. */
  update(): void {}

  takePressed(): Set<string> {
    const out = this.pressed;
    this.pressed = new Set();
    return out;
  }

  isDown(key: string): boolean {
    return this.down.has(key);
  }

  anyDown(...keys: string[]): boolean {
    return keys.some((k) => this.down.has(k));
  }
}
