/**
 * The save file: gold, purchased upgrades, unlocks.
 *
 * Storage is abstracted because the two backends have nothing in common —
 * `localStorage` in the browser, a JSON file under `XDG_STATE_HOME` in the
 * terminal — but the *shape* is identical, so a run in either place spends the
 * same gold.
 *
 * A corrupt or unreadable save is never fatal. It resets to a fresh profile and
 * says so. Losing a meta-progression file is annoying; refusing to start the
 * game because of one is worse.
 */

export const SAVE_VERSION = 1;

export type Profile = {
  version: number;
  gold: number;
  /** upgrade id -> levels purchased. Unlocks are level 1. */
  upgrades: Record<string, number>;
  /** Set once the player has seen dawn; gates Endless. */
  wonOnce: boolean;
  /** Character id selected at The Crossroads. */
  character: string;
  runs: number;
  bestTime: number;
  bestKills: number;
};

export function emptyProfile(): Profile {
  return {
    version: SAVE_VERSION,
    gold: 0,
    upgrades: {},
    wonOnce: false,
    character: 'warden',
    runs: 0,
    bestTime: 0,
    bestKills: 0,
  };
}

export interface SaveStore {
  read(): string | null;
  write(data: string): void;
}

/** Never throws. Bad JSON, wrong version, or a missing file all mean "fresh". */
export function loadProfile(store: SaveStore): { profile: Profile; warning: string | null } {
  let raw: string | null = null;
  try {
    raw = store.read();
  } catch (err) {
    return { profile: emptyProfile(), warning: `could not read save: ${(err as Error).message}` };
  }
  if (raw === null || raw === '') return { profile: emptyProfile(), warning: null };

  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (parsed.version !== SAVE_VERSION) {
      return { profile: emptyProfile(), warning: `save is version ${String(parsed.version)}, expected ${SAVE_VERSION} — starting fresh` };
    }

    const base = emptyProfile();
    return {
      profile: {
        ...base,
        ...parsed,
        // Trust nothing numeric that came off disk.
        gold: Math.max(0, Math.floor(Number(parsed.gold ?? 0))),
        upgrades: sanitizeUpgrades(parsed.upgrades),
        version: SAVE_VERSION,
      },
      warning: null,
    };
  } catch {
    return { profile: emptyProfile(), warning: 'save file is corrupt — starting fresh' };
  }
}

function sanitizeUpgrades(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

/** Best-effort. A failed write costs the player one run's gold, never a crash. */
export function saveProfile(store: SaveStore, profile: Profile): void {
  try {
    store.write(JSON.stringify(profile));
  } catch {
    // Read-only home directory, private browsing, quota. Play on.
  }
}

/** Discards everything and returns a fresh profile, persisted. */
export function resetProfile(store: SaveStore): Profile {
  const p = emptyProfile();
  saveProfile(store, p);
  return p;
}

/** A store that remembers nothing. Used by tests and by `--no-save`. */
export function memoryStore(): SaveStore {
  let data: string | null = null;
  return {
    read: () => data,
    write: (d) => {
      data = d;
    },
  };
}
