/**
 * Terminal lifecycle: alternate screen, raw mode, cursor, resize, and — most
 * importantly — putting all of it back the way we found it, even if we crash.
 *
 * A game that leaves the user's terminal in raw mode with a hidden cursor is a
 * broken shell. Restoration is wired to every exit path there is.
 */

const ESC = '\x1b[';

export type ResizeHandler = (cols: number, rows: number) => void;

export class Terminal {
  private readonly out: NodeJS.WriteStream;
  private readonly inp: NodeJS.ReadStream;

  private active = false;
  private restored = false;
  private hadRawMode = false;
  private resizeHandlers: ResizeHandler[] = [];
  private onResizeBound = (): void => {
    for (const h of this.resizeHandlers) h(this.cols, this.rows);
  };

  constructor(out: NodeJS.WriteStream = process.stdout, inp: NodeJS.ReadStream = process.stdin) {
    this.out = out;
    this.inp = inp;
  }

  get cols(): number {
    return this.out.columns ?? 80;
  }

  get rows(): number {
    return this.out.rows ?? 24;
  }

  get isTTY(): boolean {
    return Boolean(this.out.isTTY && this.inp.isTTY);
  }

  /** Enter the alternate screen, hide the cursor, go raw. Idempotent. */
  enter(): void {
    if (this.active) return;
    this.active = true;
    this.restored = false;

    if (this.inp.isTTY) {
      this.hadRawMode = this.inp.isRaw ?? false;
      this.inp.setRawMode(true);
    }
    this.inp.resume();

    // ?1049h = alternate screen buffer, ?25l = hide cursor.
    this.out.write(`${ESC}?1049h${ESC}?25l${ESC}2J${ESC}H`);

    this.out.on('resize', this.onResizeBound);

    // Every way this process can end, in rough order of likelihood.
    process.once('exit', this.restore);
    process.once('SIGINT', this.onFatalSignal);
    process.once('SIGTERM', this.onFatalSignal);
    process.once('SIGHUP', this.onFatalSignal);
    process.once('uncaughtException', this.onFatalError);
    process.once('unhandledRejection', this.onFatalError);
  }

  /** Restore everything. Safe to call many times; only the first one does work. */
  restore = (): void => {
    if (this.restored) return;
    this.restored = true;
    this.active = false;

    this.out.removeListener('resize', this.onResizeBound);

    // Reset SGR, show cursor, leave the alternate screen.
    this.out.write(`${ESC}0m${ESC}?25h${ESC}?1049l`);

    if (this.inp.isTTY) {
      try {
        this.inp.setRawMode(this.hadRawMode);
      } catch {
        // Terminal already torn down (e.g. parent shell died). Nothing to do.
      }
    }
    this.inp.pause();
  };

  private onFatalSignal = (): void => {
    this.restore();
    process.exit(130);
  };

  private onFatalError = (err: unknown): void => {
    this.restore();
    // Now that we're back on the normal screen, the stack trace is readable.
    console.error('\nascii-vampire-survivors crashed:\n');
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exit(1);
  };

  onResize(h: ResizeHandler): void {
    this.resizeHandlers.push(h);
  }

  /** Write raw bytes. The renderer owns nearly all output; this is for escapes. */
  write(s: string): void {
    this.out.write(s);
  }
}
