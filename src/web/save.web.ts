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
      localStorage.setItem(KEY, data);
    },
  };
}
