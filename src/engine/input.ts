/**
 * Keyboard input, including held-key state.
 *
 * The hard problem: a classic terminal sends key-*down* only. There is no
 * key-up. So "hold D to walk right" has to be inferred, and the naive inference
 * (a key is held if we saw it in the last N ms) fights OS auto-repeat, which
 * waits ~500ms before the first repeat and only then fires every ~30ms. A fixed
 * decay window either stutters for half a second at the start of every hold, or
 * makes stopping feel like ice.
 *
 * So we do two things:
 *
 *  1. If the terminal speaks the **Kitty keyboard protocol** (kitty, ghostty,
 *     foot, WezTerm, recent xterm), we ask it for real press/repeat/release
 *     events. Then held-key state is exact and movement feels like a real game.
 *     We negotiate this at startup and quietly skip it if unsupported.
 *
 *  2. Otherwise we fall back to an *adaptive* decay: hold a key open for a short
 *     grace period, and once we've actually observed this machine's auto-repeat
 *     interval, widen the window to a small multiple of it. This tracks the
 *     user's real key-repeat rate instead of guessing one.
 */

export type Key = string;

/** How long a key stays "down" before we've learned the repeat rate. */
const GRACE_MS = 260;
/** Multiple of the observed repeat interval to keep a key alive. */
const REPEAT_SLACK = 2.6;
/** Never hold a key open longer than this, however slow the repeat rate is. */
const MAX_HOLD_MS = 700;

type KeyState = {
  /** Timestamp of the most recent press/repeat event. */
  lastSeen: number;
  /** Observed auto-repeat interval in ms, or 0 if not yet known. */
  interval: number;
  /** Kitty protocol told us this key is physically down. */
  explicitDown: boolean;
};

export class Input {
  private readonly inp: NodeJS.ReadStream;
  private readonly out: NodeJS.WriteStream;

  private states = new Map<Key, KeyState>();
  private pressed = new Set<Key>();
  private quit = false;

  /** True once the terminal has confirmed it speaks the Kitty keyboard protocol. */
  private kitty = false;
  private kittyPushed = false;

  /** Buffer for escape sequences split across chunks. */
  private pending = '';
  private pendingSince = 0;

  constructor(inp: NodeJS.ReadStream = process.stdin, out: NodeJS.WriteStream = process.stdout) {
    this.inp = inp;
    this.out = out;
  }

  get usingKittyProtocol(): boolean {
    return this.kitty;
  }

  get quitRequested(): boolean {
    return this.quit;
  }

  /**
   * Ask the terminal whether it supports the Kitty keyboard protocol, and turn
   * it on if so. Resolves as soon as we hear back, or after a short timeout —
   * we never block the game on a terminal that just ignores the query.
   */
  async negotiate(timeoutMs = 120): Promise<void> {
    if (!this.inp.isTTY) return;

    const supported = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (v: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.inp.removeListener('data', probe);
        resolve(v);
      };

      // A terminal that speaks the protocol answers CSI ? <flags> u.
      // We also send a Primary Device Attributes request as a fence: every
      // terminal answers DA, so its reply tells us "you'd have heard by now".
      const probe = (chunk: Buffer): void => {
        const s = chunk.toString('utf8');
        if (/\x1b\[\?\d+u/.test(s)) done(true);
        else if (/\x1b\[\?[\d;]*c/.test(s)) done(false);
      };

      const timer = setTimeout(() => done(false), timeoutMs);
      this.inp.on('data', probe);
      this.out.write('\x1b[?u\x1b[c');
    });

    if (!supported) return;

    this.kitty = true;
    this.kittyPushed = true;
    // Flag 1 = disambiguate escape codes, flag 2 = report event types
    // (press / repeat / release). Together that's exactly what a game needs.
    this.out.write('\x1b[>3u');
  }

  /** Pop the Kitty flags we pushed, so we don't leave the terminal reconfigured. */
  teardown(): void {
    if (this.kittyPushed) {
      this.out.write('\x1b[<u');
      this.kittyPushed = false;
    }
    this.inp.removeListener('data', this.onData);
  }

  start(): void {
    this.inp.on('data', this.onData);
  }

  private onData = (chunk: Buffer): void => {
    const s = this.pending + chunk.toString('utf8');
    this.pending = '';
    this.parse(s);
  };

  private parse(s: string): void {
    let i = 0;
    const now = Date.now();

    while (i < s.length) {
      const c = s[i]!;

      if (c === '\x03') {
        this.quit = true;
        i++;
        continue;
      }

      if (c === '\x1b') {
        // Lone ESC at the very end of a chunk: could be the Escape key, or the
        // head of a sequence whose tail hasn't arrived. Stash and decide later.
        if (i === s.length - 1) {
          this.pending = '\x1b';
          this.pendingSince = now;
          return;
        }

        if (s[i + 1] === '[') {
          const consumed = this.parseCSI(s, i, now);
          if (consumed === 0) {
            // Incomplete sequence; wait for more bytes.
            this.pending = s.slice(i);
            this.pendingSince = now;
            return;
          }
          i += consumed;
          continue;
        }

        // ESC followed by something else (Alt+key). Treat as Escape and move on.
        this.emit('escape', 'press', now);
        i++;
        continue;
      }

      this.emit(this.charToKey(c), 'press', now);
      i += c.length;
    }
  }

  /** Returns bytes consumed, or 0 if the sequence is incomplete. */
  private parseCSI(s: string, start: number, now: number): number {
    let i = start + 2; // skip ESC [
    let params = '';
    while (i < s.length) {
      const ch = s[i]!;
      const code = ch.charCodeAt(0);
      // Parameter and intermediate bytes.
      if ((code >= 0x30 && code <= 0x3f) || (code >= 0x20 && code <= 0x2f)) {
        params += ch;
        i++;
        continue;
      }
      // Final byte.
      if (code >= 0x40 && code <= 0x7e) {
        this.handleCSI(params, ch, now);
        return i - start + 1;
      }
      break;
    }
    return 0;
  }

  private handleCSI(params: string, final: string, now: number): void {
    // Terminal replies to our capability probes; not key events.
    if (final === 'c' || (final === 'u' && params.startsWith('?'))) return;

    const groups = params.split(';');
    // Kitty encodes the event type as a sub-parameter of the modifier group:
    // `CSI key ; mods : event u`, where event is 1=press 2=repeat 3=release.
    const eventPart = groups[1]?.split(':')[1];
    const event: EventKind = eventPart === '3' ? 'release' : eventPart === '2' ? 'repeat' : 'press';

    let key: Key | null = null;

    if (final === 'u') {
      const cp = Number.parseInt(groups[0]?.split(':')[0] ?? '', 10);
      if (Number.isFinite(cp)) key = this.codepointToKey(cp);
    } else {
      key = LEGACY_FINAL[final] ?? null;
      if (final === '~') {
        const n = Number.parseInt(groups[0]?.split(':')[0] ?? '', 10);
        key = LEGACY_TILDE[n] ?? null;
      }
    }

    if (key !== null) this.emit(key, event, now);
  }

  private codepointToKey(cp: number): Key | null {
    switch (cp) {
      case 27:
        return 'escape';
      case 13:
        return 'enter';
      case 32:
        return 'space';
      case 9:
        return 'tab';
      case 127:
      case 8:
        return 'backspace';
      // Kitty's functional key range, for terminals that report arrows here.
      case 57352:
        return 'up';
      case 57353:
        return 'down';
      case 57350:
        return 'left';
      case 57351:
        return 'right';
      default:
        break;
    }
    if (cp < 32) return null;
    return String.fromCodePoint(cp).toLowerCase();
  }

  private charToKey(c: string): Key {
    switch (c) {
      case '\r':
      case '\n':
        return 'enter';
      case ' ':
        return 'space';
      case '\t':
        return 'tab';
      case '\x7f':
      case '\b':
        return 'backspace';
      default:
        return c.toLowerCase();
    }
  }

  private emit(key: Key | null, event: EventKind, now: number): void {
    if (key === null) return;

    if (event === 'release') {
      this.states.delete(key);
      return;
    }

    let st = this.states.get(key);
    if (st === undefined) {
      st = { lastSeen: now, interval: 0, explicitDown: false };
      this.states.set(key, st);
      this.pressed.add(key);
    } else {
      if (event === 'repeat' || !this.kitty) {
        const dt = now - st.lastSeen;
        // Only trust plausible auto-repeat intervals; a human re-tapping a key
        // produces much larger gaps and would poison the estimate.
        if (dt > 0 && dt < 200) {
          st.interval = st.interval === 0 ? dt : st.interval * 0.7 + dt * 0.3;
        }
      }
      if (event === 'press') this.pressed.add(key);
    }

    st.lastSeen = now;
    if (this.kitty) st.explicitDown = true;
  }

  /** Expire keys whose decay window has lapsed. Call once per frame. */
  update(now: number = Date.now()): void {
    // A lone ESC that nothing followed is the Escape key.
    if (this.pending === '\x1b' && now - this.pendingSince > 40) {
      this.pending = '';
      this.emit('escape', 'press', now);
    }

    if (this.kitty) return; // Releases are authoritative; nothing to expire.

    for (const [key, st] of this.states) {
      const window =
        st.interval > 0 ? Math.min(MAX_HOLD_MS, Math.max(GRACE_MS, st.interval * REPEAT_SLACK)) : GRACE_MS;
      if (now - st.lastSeen > window) this.states.delete(key);
    }
  }

  isDown(key: Key): boolean {
    return this.states.has(key);
  }

  anyDown(...keys: Key[]): boolean {
    return keys.some((k) => this.states.has(k));
  }

  /** Edge-triggered: keys newly pressed since the last call. Clears the set. */
  takePressed(): Set<Key> {
    const out = this.pressed;
    this.pressed = new Set();
    return out;
  }

  /** Convenience for menus: was this key pressed this frame? Consumes nothing. */
  wasPressed(key: Key): boolean {
    return this.pressed.has(key);
  }

  clear(): void {
    this.states.clear();
    this.pressed.clear();
  }
}

type EventKind = 'press' | 'repeat' | 'release';

const LEGACY_FINAL: Readonly<Record<string, Key | undefined>> = {
  A: 'up',
  B: 'down',
  C: 'right',
  D: 'left',
  H: 'home',
  F: 'end',
};

const LEGACY_TILDE: Readonly<Record<number, Key | undefined>> = {
  1: 'home',
  4: 'end',
  5: 'pageup',
  6: 'pagedown',
};
