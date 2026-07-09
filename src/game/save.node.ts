/** Terminal save store: a JSON file under XDG_STATE_HOME (or ~/.local/state). */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { SaveStore } from './save.ts';

export function saveFilePath(): string {
  const base = process.env['XDG_STATE_HOME'] ?? join(homedir(), '.local', 'state');
  return join(base, 'the-long-night', 'save.json');
}

export function fileStore(path: string = saveFilePath()): SaveStore {
  return {
    read(): string | null {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return null; // no save yet
      }
    },
    write(data: string): void {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, data, 'utf8');
    },
  };
}
