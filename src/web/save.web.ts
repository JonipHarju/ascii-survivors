/** Browser save store. `localStorage` throws in private mode; treat as absent. */

import type { SaveStore } from '../game/save.ts';

const KEY = 'the-long-night/save';

export function localStore(): SaveStore {
  return {
    read(): string | null {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    write(data: string): void {
      // Throws in private mode, over `file://` in Safari, and when the quota is
      // full. Losing the gold from one run must never take the run down with it.
      try {
        localStorage.setItem(KEY, data);
      } catch {
        /* unsaved; the run still finishes */
      }
    },
  };
}
