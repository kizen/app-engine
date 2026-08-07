# Documentation site generator

Builds a browsable static site from the markdown in `docs/`. The markdown is the only source
of truth — there is no hand-maintained page, nav entry, table of contents, or search index anywhere
in here.

```
cd docs/site
npm install        # required once; marked is the only dependency
npm run build      # → docs/site/dist/
npm test           # 21 tests, no test-runner dependency
open dist/index.html
```

`npm run serve` starts a small static server on `http://localhost:4173` if you'd rather view it over
a real origin. The built site also works straight off disk over `file://`.

## Adding or changing docs

Edit or add a `.md` file under `docs/` and rebuild. That's the whole workflow.

- **New numbered doc** (`19-whatever.md`) — appears in the *Reference* group, in numeric position.
- **New unnumbered doc** — appears under *More*, so nothing is ever silently dropped.
- **New `examples/` doc** — appears in the *Examples* group.
- Each file's `# h1` becomes its title; `##`/`###` headings become its on-page table of contents.
- Every `README.md` becomes its directory's `index.html`, so `docs/README.md` is the site's home page.

Group assignment lives in one table at the top of `lib/docs.mjs` if you want to move things around.

This is a standalone npm project with its own lockfile, deliberately outside the engine's pnpm
workspace — it shares no dependencies with the published package, and `docs/` is excluded from the
repo's Prettier run so the generated corpus in `examples/` doesn't churn on every regeneration.

## What the build guarantees

Heading anchors use **GitHub's exact slug algorithm**, including its quirk of not collapsing
repeated separators (`## Recipe 1 — New plugin skeleton` → `recipe-1--new-plugin-skeleton`). That
matters because the docs contain ~1,800 hand-written internal links and anchors that were authored
against GitHub's rendering.

The build resolves and **verifies every one of them**, reporting anything that doesn't land:

```
Links: 1163 cross-document · 620 anchors · 1 external
All 1783 internal links and anchors resolve.
```

Use `node build.mjs --strict` to exit non-zero on any unresolved link — that's the check to wire into
CI if this ever gets one. A broken anchor is a link that silently goes nowhere, so it's worth failing on.

Also guaranteed:

- **A link with no target, or an unsafe scheme** (`javascript:`, `data:`, `vbscript:`), renders as inert
  text rather than a clickable anchor, and is named in the report. Only `http(s):`, `mailto:`, `tel:`
  and protocol-relative URLs become real hrefs.
- **A code block that fails to highlight** degrades to plain text and is reported. It never aborts the
  build, so one pathological sample can't cost you the whole site.
- **Slugs match `github-slugger` including its collision behavior** — `["Foo", "Foo", "Foo-1"]` yields
  `foo`, `foo-1`, `foo-1-1`, not a duplicate `id`.
- **Headings inside blockquotes and list items** get slugs, dedup, and TOC entries like any other.

## Trust model

`marked` passes **raw HTML in the source markdown straight through**, as most static site generators do.
The corpus relies on this for exactly one thing — a manual `<a id="esc-discipline"></a>` anchor in
`11-output-ui-iframes-frames.md`, which is actually redundant with that heading's own slug.

This is safe because the markdown is first-party and version-controlled, but it does mean **markdown in
this repo is executable in the browser**: a `<script>` tag added to a doc would run on the site. Treat
doc changes as code changes. Everything the *generator itself* produces is escaped, and `npm test`
asserts that the syntax highlighter can never emit an unescaped `<` or `>`.

## Layout

| Path | Role |
|---|---|
| `build.mjs` | Entry point: discover → analyze → render → write, plus the link report. |
| `lib/docs.mjs` | Filesystem discovery, ordering, sidebar grouping. The only place doc structure is defined. |
| `lib/markdown.mjs` | Markdown → HTML: heading IDs, link rewriting and validation, code blocks, tables, search sections. |
| `lib/slug.mjs` | GitHub-compatible heading slugs. |
| `lib/highlight.mjs` | Build-time syntax highlighter for the 12 fence languages the docs use. |
| `lib/templates.mjs` | The page shell — top bar, sidebar, TOC, pager, search dialog. |
| `assets/app.css` | Design tokens and all styling, light and dark. |
| `assets/app.js` | Search, table filters, copy buttons, theme toggle, mobile drawer, TOC tracking. |
| `dist/` | Build output. Gitignored. |

## Design notes

**Nothing ships to the browser but HTML, CSS, and one hand-written JS file.** Markdown parsing and
syntax highlighting both happen at build time, so `marked` is a build-only dependency and `dist/`
contains no third-party JavaScript.

**The search index is emitted as `search-index.js`, not `.json`,** and injected as a `<script>` on
first use. `fetch()` of a local file is blocked by CORS under `file://`, so this is what lets the
built site work off disk while still loading the ~700KB index lazily rather than on every page load.

**Tables of 20+ rows get a filter box** (added by `app.js`, so the markup lives in one place). The
293-row table in `method-index.md` is the reason.

**Syntax highlighting is hand-rolled** rather than using highlight.js: the output is pre-rendered, so
shipping a ~100KB grammar bundle to colour static text would be waste. Unknown languages fall through
to plain text instead of being guessed at.

## Updating marked

```
cd docs/site
npm install marked@<version>
npm run build
```

Then re-run with `--strict`; a clean link report is the regression test for a parser upgrade.
