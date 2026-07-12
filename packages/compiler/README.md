# @dotui/compiler

Turns `*.panel.tsx` sources into (a) a committed schema file the LLM reads and
(b) runtime id stamps on the live elements — from **one shared walk**, so the two
can never disagree.

## Pipeline

```
*.panel.tsx ──parse──▶ findRootDots ──▶ assignDotIds ──┬─▶ extract.ts ─▶ mergeSchemas ─▶ .dotui/schema.json   (dotui build)
                                                       └─▶ plugin.ts  ─▶ __dotId="…" stamped into the JSX     (app build)
```

- `walk.ts` — the shared traversal. `findRootDots` finds top-level `dot.*`
  elements; `assignDotIds` gives every known dot a structural id
  (`<file-scope>/<panel-path>/<kind>#<sibling-index>`). See the worked example
  at the top of the file.
- `extract.ts` — reads each element's className / `type` / `required` /
  `description` / content into `PanelNode`/`DotNode` records (`@dotui/core` types).
- `merge.ts` — combines per-file schemas; **fails the build** on id collisions
  (two files with the same base name → same scope).
- `plugin.ts` — Babel plugin (`dotuiBabelPlugin`) for the app build; stamps the
  same ids as `__dotId` props.
- `ids.ts` — id string construction + file-scope derivation.
- `ast.ts` — small readers over Babel JSX nodes (className, string/bool props,
  content parts). No traversal logic.
- `cli.ts` / `bin.ts` — `dotui build <glob…> [--out <path>]`; `run()` is pure
  logic (unit-tested), `bin.ts` is the 3-line executable.

## Usage

```sh
node packages/compiler/dist/bin.cjs build "apps/demo/app/**/*.panel.tsx" --out apps/demo/.dotui/schema.json
```

## The contract that matters

The schema's ids and the stamped runtime ids come from the same `assignDotIds`
call. If you change the walk, both sides move together — but any previously
persisted overlay keyed by old ids will no longer match.

`.map()` and conditionals are supported: dots inside them get `~`-marked ids in
their own counter namespace (`feed/panel#0/panel~0`) so static ids never shift;
function-boundary dots carry `repeated: true` (one template, N instances — one
overlay patch styles them all), and unsupported expression shapes produce build
warnings. Shared components (a card component reused across panels) still
collapse onto their defining file's ids — that's future work.
