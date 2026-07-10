#!/usr/bin/env node
/**
 * A ~100-line ES-module bundler, so `dist/` can be **one file**.
 *
 * Why this exists: a `<script type="module" src="...">` is fetched, and browsers
 * refuse cross-origin fetches from `file://`. Double-clicking `index.html` on a
 * multi-file build therefore runs *no JavaScript at all* — not the game, and not
 * the error handler that would have said so. The page sits on its loading text
 * forever. That is exactly what the owner saw.
 *
 * A single HTML file with the code and the assets inlined has no fetches to
 * block. It plays off a USB stick, off a `file://` path, and off any static host
 * unchanged.
 *
 * The trick is to let `tsc` do the hard part: compiled to CommonJS, every import
 * is a literal `require("./relative.js")` call, so bundling is just "wrap each
 * module in a function and give it a `require` that resolves against a map".
 * No parsing, no AST, no dependency.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/** `web/dist/boot.js` under `root` -> module id `web/dist/boot`. */
async function collect(root: string, dir = root, out = new Map<string, string>()): Promise<Map<string, string>> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collect(root, full, out);
    else if (entry.name.endsWith('.js')) {
      const id = relative(root, full).split(sep).join('/').replace(/\.js$/, '');
      out.set(id, await readFile(full, 'utf8'));
    }
  }
  return out;
}

/**
 * The runtime half. Kept as a string rather than a real module because it has to
 * survive being pasted into a `<script>` tag, and because it is the only code in
 * the project that must not be compiled.
 *
 * `__cache[id]` is populated *before* the factory runs, which is what makes a
 * cycle resolve to a half-built exports object rather than recursing forever.
 * `tsc`'s CommonJS emit only ever mutates `exports`, never reassigns it, so the
 * early-cached reference stays the right object.
 */
const RUNTIME = `
var __mods = {}, __cache = {};
function __resolve(dir, spec) {
  if (spec.charAt(0) !== '.') return spec.replace(/\\.js$/, '');
  var parts = (dir === '' ? [] : dir.split('/')).concat(spec.replace(/\\.js$/, '').split('/'));
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}
function __require(id) {
  if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id];
  var factory = __mods[id];
  if (factory === undefined) throw new Error('bundle: no module ' + id);
  var module = { exports: {} };
  __cache[id] = module.exports;
  var dir = id.indexOf('/') === -1 ? '' : id.slice(0, id.lastIndexOf('/'));
  factory(module.exports, module, function (spec) { return __require(__resolve(dir, spec)); });
  __cache[id] = module.exports;
  return module.exports;
}
`;

/**
 * Neutralize the two byte sequences that can end a `<script>` block early.
 *
 * Not `-->`: it only opens a comment at the start of a line, no line of ours
 * begins with it, and `i-->0` is real JavaScript that escaping would corrupt.
 */
export function scriptSafe(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

/** Bundle a compiled CommonJS tree rooted at `root` into one classic script. */
export async function bundle(root: string, entry: string): Promise<string> {
  const mods = await collect(root);
  if (!mods.has(entry)) throw new Error(`bundle: entry ${entry} not found in ${root}`);

  const parts: string[] = ['(function () {', '"use strict";', RUNTIME];
  for (const [id, code] of [...mods].sort(([a], [b]) => a.localeCompare(b))) {
    parts.push(`__mods[${JSON.stringify(id)}] = function (exports, module, require) {\n${code}\n};`);
  }
  parts.push(`__require(${JSON.stringify(entry)});`, '})();');
  return scriptSafe(parts.join('\n'));
}

/**
 * JSON as a JS expression that is safe in an HTML `<script>` and in any JS
 * parser. `JSON.parse` of a string literal beats an object literal here: it is
 * measurably faster to parse and it cannot grow syntax we have to escape.
 */
export function inlineJson(json: string): string {
  const literal = JSON.stringify(json)
    .replace(/</g, String.raw`\u003c`)
    .replace(/\u2028/g, String.raw`\u2028`)
    .replace(/\u2029/g, String.raw`\u2029`);
  return `JSON.parse(${literal})`;
}
