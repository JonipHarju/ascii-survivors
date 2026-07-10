# THE LONG NIGHT

An ASCII survivors game. One night. Kill everything. See the sun.

Runs in the browser on a canvas. No install, no dependencies at runtime, no
build server — the deployable is a folder of static files.

## Play

```bash
npm install
npm start          # http://localhost:5173
```

`npm start` recompiles and repacks `assets/` on every page load, so changing a
`.txt` sprite or a `.tsv` table only needs a browser refresh.

## Deploy

The build is a static folder. Anything that serves files can host it.

```bash
npm run build      # -> dist/   (~400 KB, no server required)
npm run preview    # serve dist/ exactly as a static host would
```

| Host | What to do |
|---|---|
| **Vercel** | Nothing. `vercel.json` sets `buildCommand` and `outputDirectory`. |
| **Coolify / Docker / Fly** | `docker build -t the-long-night . && docker run -p 8080:80 the-long-night` |
| **Netlify** | build `npm run build`, publish `dist` |
| **GitHub Pages / S3** | upload `dist/` |

The Dockerfile builds with Node 22 and serves with nginx; the runtime image has
no Node in it, because the output is just files.

## URL flags

| Flag | Effect |
|---|---|
| `?debug` | fps and entity counters |
| `?god` | invulnerable |
| `?play` | skip the title screen |
| `?shop` | open The Crossroads |
| `?gold=5000` | throwaway funded profile (never touches your save) |
| `?start=15:00` | begin the run at that clock time, field pre-populated |
| `?sim=9000` | fast-forward N simulated ticks, fighting, before drawing |
| `?bench=300` | measure frame cost and print it (ignores the display refresh) |
| `?seed=123` | deterministic run |
| `?nodark` · `?noglow` · `?nosave` | disable the lantern / bloom / persistence |

## Performance

Measured in Chrome at a 180×54 grid, `?bench`, real clock:

| Moment | Glyphs | Sim | Draw | Frame | Ceiling |
|---|---|---|---|---|---|
| 5:00 | 564 | 0.02 ms | 0.75 ms | **0.77 ms** | 1295 fps |
| 12:00 | 687 | 0.05 ms | 0.97 ms | **1.02 ms** | 977 fps |
| 15:00 | 844 | 0.08 ms | 0.98 ms | **1.06 ms** | 944 fps |
| 18:20 (The Tide) | 985 | 0.09 ms | 1.35 ms | **1.44 ms** | 694 fps |
| 19:00 (The Countess) | 1193 | 0.11 ms | 1.65 ms | **1.76 ms** | 567 fps |

120 fps needs 8.33 ms. Worst case leaves **4.7× headroom**.

The simulation runs at a fixed 60 Hz regardless of display refresh, so a seeded
run plays out identically at 60, 120 or 144 Hz — only the render rate follows the
monitor.

## Other entry points

```bash
npm test           # 114 tests
npm run typecheck  # browser bundle is typechecked with `types: []`, proving no node globals leak
npm run art        # render every sprite in assets/ to the terminal, with warnings
npm run bench      # headless simulation benchmark
npm run tui        # the original terminal renderer, still works, shares 100% of the game code
```

## Layout

```
assets/     Jane's art (.txt) and balance tables (.tsv). No numbers live in code.
src/engine/ Surface interface, terminal renderer, input, loop, colour
src/web/    Canvas backend, browser input, boot, save
src/game/   Simulation, rendering, upgrades, meta-progression
src/data/   Parsers for every .tsv Jane owns
```

`src/engine/surface.ts` is the seam. The game draws into a grid of character
cells and knows nothing else, which is why the terminal and the canvas share
every line of gameplay code.
