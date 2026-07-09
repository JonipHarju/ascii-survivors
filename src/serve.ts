#!/usr/bin/env node
/**
 * Dev server for the canvas build. `npm run web`
 *
 * Serves `web/`, compiles `src/web` on demand, and regenerates `assets.json`
 * from disk on every request. That keeps Jane's feedback loop the same as it was
 * in the terminal build: save a `.txt`, refresh, see the art.
 *
 * Zero dependencies — `node:http` and the TypeScript compiler we already had.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { packAssets } from './tools/pack.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const PORT = Number.parseInt(process.env['PORT'] ?? '5173', 10);

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/** Compile `src/web` -> `web/dist`. Returns compiler output on failure. */
function compile(): string | null {
  const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.web.json'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) return null;
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
}

console.log('compiling src/web ...');
const initialError = compile();
if (initialError !== null) {
  console.error(initialError);
  console.error('\nfix the type errors above, then re-run `npm run web`.');
  process.exit(1);
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';

    // Rebuilt per request so a saved .txt shows up on refresh, no restart.
    if (path === '/assets.json') {
      try {
        const json = await packAssets();
        res.writeHead(200, { 'content-type': MIME['.json']!, 'cache-control': 'no-store' });
        res.end(json);
      } catch (err) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end(`could not pack assets: ${(err as Error).message}`);
      }
      return;
    }

    // Recompile on every page load, so editing src/web needs only a refresh.
    if (path === '/index.html') {
      const err = compile();
      if (err !== null) {
        res.writeHead(200, { 'content-type': MIME['.html']! });
        res.end(`<pre style="color:#f66;background:#111;padding:2rem;font:14px monospace">${escapeHtml(err)}</pre>`);
        return;
      }
    }

    // `normalize` collapses `..`, and the prefix check keeps us inside web/.
    const file = normalize(join(WEB, path));
    if (!file.startsWith(WEB)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  })();
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

server.listen(PORT, () => {
  console.log(`\n  THE LONG NIGHT  ->  http://localhost:${PORT}\n`);
  console.log('  ?play    skip the title screen');
  console.log('  ?debug   fps + entity counters');
  console.log('  ?god     invulnerable');
  console.log('  ?gold=5000     throwaway profile with gold, for the Crossroads');
  console.log('  ?nodark  disable the lantern');
  console.log('  ?noglow  disable glyph bloom');
  console.log('  ?noautoface    the Chain never aims itself');
  console.log('  ?start=15:00   begin the run late');
  console.log('  ?seed=123      deterministic run\n');
});
