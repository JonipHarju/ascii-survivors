/**
 * Shared reader for Jane's `.tsv` tables.
 *
 * All of them share a dialect: tab-separated, `#` comments, blank lines ignored,
 * `-` meaning "not applicable". Every table she owns is parsed, never hardcoded,
 * so she can retune the game without touching code or filing a ticket.
 */

export type Row = {
  /** Trimmed cells. Trailing empty cells are preserved. */
  readonly cells: readonly string[];
  /** 1-based line number, for warnings that point somewhere useful. */
  readonly line: number;
};

export function readRows(source: string): Row[] {
  const rows: Row[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim() === '' || raw.startsWith('#')) continue;
    rows.push({ cells: raw.split('\t').map((c) => c.trim()), line: i + 1 });
  }
  return rows;
}

/** `mm:ss` -> seconds. `-` / blank / junk -> null. */
export function parseTime(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (s === '' || s === '-') return null;
  const m = /^(\d+):(\d{1,2})$/.exec(s);
  if (m !== null) return Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10);
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Numeric cell. `-` and blanks mean "not applicable", modelled as `fallback`. */
export function num(raw: string | undefined, fallback = 0): number {
  const s = (raw ?? '').trim();
  if (s === '' || s === '-') return fallback;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

/** `-` and blanks become null, so callers can tell "absent" from "zero". */
export function optNum(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (s === '' || s === '-') return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

